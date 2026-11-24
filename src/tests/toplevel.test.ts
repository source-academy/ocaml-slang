import { ConductorError } from "@sourceacademy/conductor/common";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { existsSync } from "fs";
import { resolve } from "path";
import { OCamlEvaluator } from "../conductor/OCamlEvaluator";

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

  test("reports type errors with their position", async () => {
    const { conductor, outputs } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateChunk('let x : int = "five";;');
    expect(outputs.join("")).toContain("Error: This constant has type string");
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
