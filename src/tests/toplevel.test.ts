import { ConductorError } from "@sourceacademy/conductor/common";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { editorColumn } from "../conductor/errors";
import { OCamlEvaluator } from "../conductor/OCamlEvaluator";
import type { Toplevel } from "../conductor/toplevel";

// The OCaml toplevel is built by `yarn build:ocaml` (dune), which CI runs before the tests.
const bundle = resolve(__dirname, "../../dist/ocaml-toplevel.js");

// The evaluator loads the toplevel itself (loader.ts); a file path is read under Node.
function useBuiltBundle() {
  if (!existsSync(bundle)) throw new Error(`${bundle} is missing: run 'yarn build:ocaml' first`);
  g.OCAML_SLANG_TOPLEVEL_URL = bundle;
}

const g = globalThis as { ocaml?: Toplevel; OCAML_SLANG_TOPLEVEL_URL?: string };

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
  beforeAll(useBuiltBundle);

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
  beforeAll(useBuiltBundle);

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
    g.ocaml!.writeFile("/static/defs.ml", "let from_defs = 42;;");
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

  test("a directive that runs several phrases shows all their results", async () => {
    g.ocaml!.writeFile("/static/defs3.ml", "let a3 = 1;;\nlet b3 = 2;;\nlet c3 = a3 + b3;;");
    const { conductor, outputs, errors } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateChunk('#use "/static/defs3.ml";;');
    expect(errors).toEqual([]);
    expect(outputs.join("\n")).toContain("val a3 : int = 1");
    expect(outputs.join("\n")).toContain("val b3 : int = 2");
    expect(outputs.join("\n")).toContain("val c3 : int = 3");
  });

  test("a custom printer runs once for the value of a phrase", async () => {
    const { conductor, outputs } = fakeConductor();
    const ev = new OCamlEvaluator(conductor);
    await ev.evaluateChunk(
      'type t = T;; let n = ref 0;; let pp ppf T = incr n; Format.pp_print_string ppf "T#";; #install_printer pp;; T;; !n;;',
    );
    expect(outputs.join("\n")).toContain("- : t = T#");
    expect(outputs.join("\n")).toContain("- : int = 1");
  });

  test("spaces that a custom printer emits are kept", async () => {
    const program =
      'type s = S;; let pp ppf S = Format.pp_print_string ppf " X ";; #install_printer pp;; S;;';
    const run = fakeConductor();
    await new OCamlEvaluator(run.conductor).evaluateFile("main.ml", program);
    expect(run.outputs[run.outputs.length - 1]).toBe(" X ");
    const chunk = fakeConductor();
    await new OCamlEvaluator(chunk.conductor).evaluateChunk(program);
    expect(chunk.outputs[chunk.outputs.length - 1].endsWith("=  X")).toBe(true);
  });

  test("a value whose printer prints nothing is still the result of a run", async () => {
    const { conductor, outputs } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateFile(
      "main.ml",
      'type e = E;; let pp _ E = ();; #install_printer pp;; print_endline "earlier";; E;;',
    );
    expect(outputs).toEqual(["earlier", ""]);
  });

  test("modUse returns the signature it prints", () => {
    g.ocaml!.writeFile("/static/m4.ml", "let m4 = 42;;");
    expect(g.ocaml!.modUse("/static/m4.ml")).toContain("module M4");
  });

  test("what #use printed before a later phrase of its file failed is shown, with OCaml's text of the error", async () => {
    g.ocaml!.writeFile("/static/defs5.ml", 'let a5 = 1;;\nlet b5 : int = "s";;');
    const { conductor, outputs } = fakeConductor();
    const ev = new OCamlEvaluator(conductor);
    // The directive itself succeeds (as in `ocaml`): the error of the file is part of its text.
    await ev.evaluateChunk('#use "/static/defs5.ml";;');
    const text = outputs.join("\n");
    expect(text).toContain("val a5 : int = 1");
  });

  test("an exception that a #use'd file raises is an error of the chunk", async () => {
    g.ocaml!.writeFile("/static/defs7.ml", 'let a7 = 1;;\nfailwith "inner";;');
    const { conductor, outputs, errors } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateChunk('#use "/static/defs7.ml";; let after7 = 1;;');
    expect(errors[0].message).toBe('Exception: Failure "inner".');
    expect(outputs.join("\n")).toContain("val a7 : int = 1");
    expect(outputs.join("\n")).not.toContain("after7");
  });

  test("a directive's own text is shown", async () => {
    const { conductor, outputs, errors } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateChunk("#help;;");
    expect(errors).toEqual([]);
    expect(outputs.join("")).toContain("#quit");
  });

  test("an alias of unit is unit: a run shows no value", async () => {
    const { conductor, outputs } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateFile("main.ml", "type u = unit;; (() : u);;");
    expect(outputs).toEqual([]);
  });

  test("a type error after a directive has a location too", async () => {
    g.ocaml!.writeFile("/static/defs2.ml", "let from_defs2 = 1;;");
    const { conductor, errors } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateChunk(
      '#use "/static/defs2.ml";;\nlet y : int = "s";;',
    );
    const e = errors[0] as ConductorError & {
      line?: number;
      column?: number;
      rawMessage: string;
    };
    expect(e.line).toBe(2);
    expect(e.column).toBe(14);
    expect(e.rawMessage).toMatch(/^Error: This constant has type string/);
  });

  test("a new session still has MenhirLib and the Stdlib", async () => {
    const { conductor, outputs, errors } = fakeConductor();
    const ev = new OCamlEvaluator(conductor);
    await ev.evaluateFile("main.ml", "List.length [1;2;3];;");
    expect(outputs).toEqual(["3"]);
    await ev.evaluateChunk("MenhirLib.Convert.Simplified.traditional2revised;;");
    expect(errors).toEqual([]);
    expect(outputs[1]).toContain("MenhirLib.Convert.revised");
  });
});

describe("output, results and errors", () => {
  beforeAll(useBuiltBundle);

  function setup() {
    const { conductor, outputs, errors } = fakeConductor();
    const ev = new OCamlEvaluator(conductor);
    const err = () =>
      errors[0] as ConductorError & { line?: number; column?: number; rawMessage: string };
    return { ev, outputs, errors, err };
  }

  test("a run shows what the program prints and the value of the last expression, without its type", async () => {
    const { ev, outputs, errors } = setup();
    await ev.evaluateFile(
      "main.ml",
      'let rec fact n = if n = 0 then 1 else n * fact (n - 1)\nlet () = print_endline "hello"\nlet () = Printf.printf "%d\\n" 7\n;;\nfact 5;;',
    );
    expect(errors).toEqual([]);
    expect(outputs).toEqual(["hello", "7", "120"]);
  });

  test("a run shows no value if the last phrase is a definition, or of type unit", async () => {
    const a = setup();
    await a.ev.evaluateFile("main.ml", "let x = 1;; let _ = x + 1;;");
    expect(a.outputs).toEqual([]);
    const b = setup();
    await b.ev.evaluateFile("main.ml", 'print_string "done";;');
    expect(b.outputs).toEqual(["done"]);
  });

  test("values print as OCaml prints them", async () => {
    const { ev, outputs } = setup();
    await ev.evaluateFile("main.ml", "[1; 2];;");
    await ev.evaluateFile("main.ml", '"abc";;');
    await ev.evaluateFile("main.ml", "(1, 'c', 2.5);;");
    expect(outputs).toEqual(["[1; 2]", '"abc"', "(1, 'c', 2.5)"]);
  });

  test("a chunk shows its output and then the results in the toplevel's style", async () => {
    const { ev, outputs } = setup();
    await ev.evaluateChunk('let f x = x + 1;; print_endline "side";; f 5;;');
    expect(outputs).toEqual(["side", "val f : int -> int = <fun>\n- : unit = ()\n- : int = 6"]);
  });

  test("output that was not flushed by a newline comes out at the end of the chunk", async () => {
    const { ev, outputs } = setup();
    await ev.evaluateFile("main.ml", 'print_string "no newline";;');
    expect(outputs).toEqual(["no newline"]);
  });

  test("a type error has OCaml's message and its line and column", async () => {
    const { ev, outputs, err } = setup();
    await ev.evaluateChunk('let ok = 1;;\nlet x : int = "five";;');
    expect(outputs).toEqual([]);
    expect(err().rawMessage).toBe(
      "Error: This constant has type string but an expression was expected of type\n         int",
    );
    expect(err().line).toBe(2);
    expect(err().column).toBe(14);
  });

  test("a syntax error has a line and column", async () => {
    const { ev, err } = setup();
    await ev.evaluateFile("main.ml", "let a = 1\nlet b = ;;");
    expect(err().rawMessage).toBe("Error: Syntax error");
    expect(err().line).toBe(2);
    expect(err().column).toBe(8);
  });

  test("a syntax error says where it is in its message, which is all that a clone keeps (#49)", async () => {
    const { ev, err } = setup();
    await ev.evaluateFile("main.ml", "let a = 1\nlet b = ;;");
    const kept = structuredClone(err());
    expect(kept.message).toBe(
      "Error at line 2, characters 8-10:\n\n    let b = ;;\n            ^^\n\nError: Syntax error",
    );
  });

  test("columns are editor characters, not OCaml's bytes", async () => {
    const { ev, err } = setup();
    await ev.evaluateFile("main.ml", 'let s = "héllo" ^ 1;;');
    expect(err().line).toBe(1);
    expect(err().column).toBe(18); // 19 in bytes
    const emoji = setup();
    await emoji.ev.evaluateFile("main.ml", 'let s = "😀" ^ 1;;'); // 4 bytes, 2 code units
    expect(emoji.err().column).toBe(15); // 18 in bytes
  });

  test("an uncaught exception is an error without a location; the output before it is shown", async () => {
    const { ev, outputs, err } = setup();
    await ev.evaluateFile("main.ml", 'print_endline "before";; failwith "boom";;');
    expect(outputs).toEqual(["before"]);
    expect(err().message).toBe('Exception: Failure "boom".');
    expect(err().line).toBeUndefined();
  });

  test("a chunk that stops on an exception still shows the earlier results", async () => {
    const { ev, outputs, err } = setup();
    await ev.evaluateChunk('let a = 1;; failwith "no";; let b = 2;;');
    expect(outputs).toEqual(["val a : int = 1"]);
    expect(err().message).toContain("Failure");
  });

  test("a warning is output with its location, and does not stop the run", async () => {
    const { ev, outputs, errors } = setup();
    await ev.evaluateFile("main.ml", 'let f = function Some x -> x;;\nprint_string "after";;');
    expect(errors).toEqual([]);
    expect(outputs.join("\n")).toMatch(/Warning 8 \[partial-match\]/);
    expect(outputs[outputs.length - 1]).toBe("after");
  });

  test("reading from stdin finds the end of the input", async () => {
    const { ev, err } = setup();
    await ev.evaluateFile("main.ml", "read_line ();;");
    expect(err().message).toContain("End_of_file");
  });
});

describe("editorColumn", () => {
  test("is the identity for ASCII", () => {
    expect(editorColumn("let x = 1", 1, 4)).toBe(4);
  });
  test("counts a two-byte character once and a four-byte one twice", () => {
    expect(editorColumn('"é" x', 1, 4)).toBe(3);
    expect(editorColumn('"😀" x', 1, 7)).toBe(5);
  });
  test("a cut inside a character backs up to its start", () => {
    expect(editorColumn("é", 1, 1)).toBe(0);
  });
  test("later lines, and a line past the end", () => {
    expect(editorColumn("é\nabc", 2, 2)).toBe(2);
    expect(editorColumn("abc", 5, 2)).toBe(0);
  });
});

describe("loading the toplevel", () => {
  let saved: Toplevel | undefined;
  beforeEach(() => {
    saved = g.ocaml;
    delete g.ocaml; // so that the evaluator has to load it
  });
  afterEach(() => {
    delete g.OCAML_SLANG_TOPLEVEL_URL;
    g.ocaml = saved;
  });

  test("loads the bundle from a URL, when the evaluator starts, before any chunk", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(readFileSync(bundle));
    });
    await new Promise<void>(r => server.listen(0, r));
    try {
      g.OCAML_SLANG_TOPLEVEL_URL = `http://localhost:${(server.address() as AddressInfo).port}/ocaml-toplevel.js`;
      const { conductor, outputs, errors } = fakeConductor();
      const ev = new OCamlEvaluator(conductor);
      await waitFor(() => g.ocaml !== undefined); // loading started by the constructor
      await ev.evaluateChunk("1 + 2;;");
      expect(errors).toEqual([]);
      expect(outputs.join("")).toContain("- : int = 3");
    } finally {
      server.close();
    }
  });

  test("a failed load is an error that says why; the next run tries again", async () => {
    g.OCAML_SLANG_TOPLEVEL_URL = "/no/such/ocaml-toplevel.js";
    const { conductor, outputs, errors } = fakeConductor();
    const ev = new OCamlEvaluator(conductor);
    await ev.evaluateChunk("1;;");
    expect(errors[0].message).toContain("Could not load the OCaml toplevel");
    expect(errors[0].message).toContain("/no/such/ocaml-toplevel.js");
    expect(g.ocaml).toBeUndefined();
    g.OCAML_SLANG_TOPLEVEL_URL = bundle;
    await ev.evaluateChunk("1 + 1;;");
    expect(errors).toHaveLength(1);
    expect(outputs.join("")).toContain("- : int = 2");
  });

  test("an HTTP error is reported with its status", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>(r => server.listen(0, r));
    try {
      const url = `http://localhost:${(server.address() as AddressInfo).port}/x.js`;
      g.OCAML_SLANG_TOPLEVEL_URL = url;
      const { conductor, errors } = fakeConductor();
      await new OCamlEvaluator(conductor).evaluateChunk("1;;");
      expect(errors[0].message).toContain("HTTP 404");
    } finally {
      server.close();
    }
  });

  test("a script that does not define the toplevel is an error", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "ocaml-slang-")), "empty.js");
    writeFileSync(file, "// nothing");
    g.OCAML_SLANG_TOPLEVEL_URL = file;
    const { conductor, errors } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateChunk("1;;");
    expect(errors[0].message).toContain("did not define");
  });

  test("an already loaded toplevel is used as it is", async () => {
    g.ocaml = saved;
    g.OCAML_SLANG_TOPLEVEL_URL = "/no/such/file.js";
    const { conductor, errors } = fakeConductor();
    await new OCamlEvaluator(conductor).evaluateChunk("1;;");
    expect(errors).toEqual([]);
  });
});

async function waitFor(condition: () => boolean, ms = 10000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > ms) throw new Error("timed out");
    await new Promise(r => setTimeout(r, 10));
  }
}
