import { ConductorError } from "@sourceacademy/conductor/common";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { existsSync } from "fs";
import { resolve } from "path";
import { OCamlEvaluator, type Toplevel } from "../conductor/OCamlEvaluator";

// The OCaml toplevel is built by `yarn build:ocaml` (dune), which CI runs before the tests.
const bundle = resolve(__dirname, "../../dist/ocaml-toplevel.js");

function fakeConductor() {
  const outputs: string[] = [];
  const errors: ConductorError[] = [];
  const conductor = {
    sendOutput: (m: string) => outputs.push(m),
    sendError: (e: ConductorError) => errors.push(e),
  } as unknown as IRunnerPlugin;
  return { conductor, outputs, errors };
}

describe("OCamlEvaluator with the built toplevel", () => {
  beforeAll(() => {
    if (!existsSync(bundle)) throw new Error(`${bundle} is missing: run 'yarn build:ocaml' first`);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(bundle);
  });

  test("runs a phrase and sends what the toplevel printed", async () => {
    const { conductor, outputs, errors } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateChunk(
      "let rec fact n = if n = 0 then 1 else n * fact (n - 1);; fact 5;;",
    );
    expect(errors).toEqual([]);
    expect(outputs.join("")).toContain("- : int = 120");
  });

  test("keeps the session between chunks", async () => {
    const { conductor, outputs } = fakeConductor();
    const ev = new OCamlEvaluator(conductor);
    await ev.evaluateChunk("let x = 20;;");
    await ev.evaluateChunk("x + 1;;");
    expect(outputs.join("")).toContain("- : int = 21");
  });

  test("MenhirLib is linked in", async () => {
    const { conductor, outputs } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateChunk(
      "MenhirLib.Convert.Simplified.traditional2revised;;",
    );
    expect(outputs.join("")).toContain("MenhirLib.Convert.revised");
  });

  test("sends a type error as an error, not as output", async () => {
    const { conductor, outputs, errors } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateChunk('let x : int = "five";;');
    expect(outputs).toEqual([]);
    expect(errors[0].message).toContain("Error: This constant has type string");
  });
});

describe("sessions and chunks", () => {
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(bundle);
  });

  async function chunks(...cs: string[]) {
    const { conductor, outputs, errors } = fakeConductor();
    const ev = new OCamlEvaluator(conductor);
    for (const c of cs) await ev.evaluateChunk(c);
    return { ev, outputs: outputs.join(""), errors: errors.map(e => e.message).join("\n") };
  }

  test("a syntax error rejects the whole chunk", async () => {
    const r = await chunks("let a1 = 1;; let b1 = ;;", "a1;;");
    expect(r.errors).toContain("Syntax error");
    expect(r.errors).toContain("Unbound value a1");
  });

  test("a type error in a later phrase rejects the whole chunk and runs nothing", async () => {
    const r = await chunks('print_string "ran";; let c1 = 1;; let d1 : int = "x";;', "c1;;");
    expect(r.outputs).not.toContain("ran");
    expect(r.errors).toContain("This constant has type string");
    expect(r.errors).toContain("Unbound value c1");
  });

  test("phrases of a chunk see each other's types", async () => {
    const r = await chunks("type t = A | B;; let f = function A -> 1 | B -> 2;; f B;;");
    expect(r.errors).toBe("");
    expect(r.outputs).toContain("- : int = 2");
  });

  test("an exception stops the chunk; earlier phrases stay", async () => {
    const r = await chunks('let e1 = 1;; failwith "boom";; let f1 = 2;;', "e1;;", "f1;;");
    expect(r.errors).toContain("Failure");
    expect(r.errors).toContain("Unbound value f1");
    expect(r.outputs).toContain("- : int = 1");
  });

  test("a warning is shown once and does not reject the chunk", async () => {
    const r = await chunks("let g1 = function Some x -> x;;");
    expect(r.errors).toBe("");
    expect(r.outputs.match(/Warning 8/g)).toHaveLength(1);
    expect(r.outputs).toContain("val g1");
  });

  test("evaluating a file starts a new session", async () => {
    const { conductor, outputs, errors } = fakeConductor();
    const ev = new OCamlEvaluator(conductor);
    await ev.evaluateChunk("let kept = 7;;");
    await ev.evaluateFile("main.ml", "let fresh = 1;;");
    await ev.evaluateChunk("kept;;");
    await ev.evaluateChunk("fresh;;");
    expect(errors.map(e => e.message).join("\n")).toContain("Unbound value kept");
    expect(outputs.join("")).toContain("- : int = 1");
  });

  test("phrases after a directive see what it defined", async () => {
    (globalThis as unknown as { ocaml: Toplevel }).ocaml.writeFile(
      "/static/defs.ml",
      "let from_defs = 42;;",
    );
    const r = await chunks('#use "/static/defs.ml";; from_defs + 1;;');
    expect(r.errors).toBe("");
    expect(r.outputs).toContain("- : int = 43");
  });

  test("a new session has the initial settings: warnings, #rectypes", async () => {
    const { conductor, outputs, errors } = fakeConductor();
    const ev = new OCamlEvaluator(conductor);
    await ev.evaluateChunk('#warnings "-8";; #rectypes;; #print_depth 1;;');
    await ev.evaluateChunk("let g2 = function Some x -> x;;");
    expect(outputs.join("")).not.toContain("Warning 8");
    outputs.length = 0;
    await ev.evaluateFile("main.ml", "let g3 = function Some x -> x;;");
    expect(outputs.join("")).toContain("Warning 8");
    await ev.evaluateChunk("let rec cyc : 'a list as 'a = [];;");
    expect(errors.map(e => e.message).join("\n")).toContain("occurs inside");
  });

  test("a new session still has MenhirLib and the Stdlib", async () => {
    const { conductor, outputs, errors } = fakeConductor();
    const ev = new OCamlEvaluator(conductor);
    await ev.evaluateFile("main.ml", "List.length [1;2;3];;");
    await ev.evaluateChunk("MenhirLib.Convert.Simplified.traditional2revised;;");
    expect(errors).toEqual([]);
    expect(outputs.join("")).toContain("- : int = 3");
  });
});

describe("OCamlEvaluator without a toplevel", () => {
  test("sends an error", async () => {
    const saved = (globalThis as { ocaml?: unknown }).ocaml;
    delete (globalThis as { ocaml?: unknown }).ocaml;
    try {
      const { conductor, errors } = fakeConductor();
      await new OCamlEvaluator(conductor).evaluateChunk("1;;");
      expect(errors[0].message).toContain("not loaded");
    } finally {
      (globalThis as { ocaml?: unknown }).ocaml = saved;
    }
  });
});
