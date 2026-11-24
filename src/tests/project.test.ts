import type { ConductorError } from "@sourceacademy/conductor/common";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { existsSync } from "fs";
import { resolve } from "path";
import { OCamlEvaluator } from "../conductor/OCamlEvaluator";
import { moduleOfFile } from "../conductor/project";

const bundle = resolve(__dirname, "../../dist/ocaml-toplevel.js");

/** A conductor with a folder of files, which also records which files were asked for. */
function setup(folder: Record<string, string>) {
  const outputs: string[] = [];
  const errors: (ConductorError & { line?: number; file?: string })[] = [];
  const requested: string[] = [];
  const conductor = {
    sendOutput: (m: string) => outputs.push(m),
    sendError: (e: ConductorError) => errors.push(e),
    requestFile: (path: string) => {
      requested.push(path);
      return Promise.resolve(folder[path]);
    },
  } as unknown as IRunnerPlugin;
  return { evaluator: new OCamlEvaluator(conductor), outputs, errors, requested };
}

describe("programs of several files", () => {
  beforeAll(() => {
    if (!existsSync(bundle)) throw new Error(`${bundle} is missing: run 'yarn build:ocaml' first`);
    (globalThis as { OCAML_SLANG_TOPLEVEL_URL?: string }).OCAML_SLANG_TOPLEVEL_URL = bundle;
  });

  test("the module of a file", () => {
    expect(moduleOfFile("/playground/lexer.ml")).toBe("Lexer");
    expect(moduleOfFile("/a/b/Parser.mli")).toBe("Parser");
    expect(moduleOfFile("main.ml")).toBe("Main");
  });

  test("files are requested by name, in the directory of the entry, for the modules it refers to", async () => {
    const { evaluator, requested, outputs } = setup({
      "/w/proj/util.ml": "let v = 1",
      "/w/other/util.ml": 'let v = failwith "not this one"',
    });
    await evaluator.evaluateFile("/w/proj/main.ml", "let () = print_int Util.v");
    expect(outputs).toEqual(["1"]);
    expect(requested.every(p => p.startsWith("/w/proj/"))).toBe(true);
    // `util.ml` is found, so `Util.ml` is not needed; the interface is looked for under both names
    expect(requested.sort()).toEqual(["/w/proj/Util.mli", "/w/proj/util.ml", "/w/proj/util.mli"]);
  });

  test("a file is not requested twice, and the Stdlib is not a project module", async () => {
    const { evaluator, requested, outputs } = setup({
      "/p/a.ml": "let v = B.v + C.v",
      "/p/b.ml": "let v = D.v",
      "/p/c.ml": "let v = D.v",
      "/p/d.ml": "let v = List.length [1; 2; 3]",
    });
    await evaluator.evaluateFile("/p/main.ml", "let () = print_int A.v");
    expect(outputs).toEqual(["6"]);
    expect(requested.filter(p => p === "/p/d.ml")).toHaveLength(1);
  });

  test("the entry is whichever file is open, and a later chunk sees the modules", async () => {
    const { evaluator, outputs, errors } = setup({
      "/p/util.ml": 'let () = print_endline "util loads"\nlet double x = x * 2',
      "/p/main.ml": "let () = print_int (Util.double 4)",
    });
    await evaluator.evaluateFile("/p/main.ml", "let () = print_int (Util.double 4)");
    await evaluator.evaluateChunk("Util.double 10;;");
    expect(errors).toEqual([]);
    expect(outputs).toEqual(["util loads", "8", "- : int = 20"]);
  });

  test("a new run forgets the modules of the last", async () => {
    const { evaluator, errors } = setup({ "/p/util.ml": "let v = 1" });
    await evaluator.evaluateFile("/p/main.ml", "let () = print_int Util.v");
    await evaluator.evaluateFile("/q/main.ml", "let () = print_int Util.v");
    expect(errors[0].message).toContain("Unbound module Util");
  });

  test("an error in another file names it, and has no line and column for the editor", async () => {
    const { evaluator, errors } = setup({ "/p/lib.ml": "let ok = 1\nlet s : string = 1" });
    await evaluator.evaluateFile("/p/main.ml", "let () = print_string Lib.s");
    expect(errors).toHaveLength(1);
    expect(errors[0].file).toBe("lib.ml");
    expect(errors[0].line).toBeUndefined();
    expect(errors[0].message).toMatch(/^File "lib.ml", line 2, characters 17-18:\nError: /);
  });

  test("an error in the entry keeps its line and column", async () => {
    const { evaluator, errors } = setup({ "/p/lib.ml": "let s = 1" });
    await evaluator.evaluateFile("/p/main.ml", "let x = 1\nlet () = print_string Lib.s");
    expect(errors[0].file).toBeUndefined();
    expect(errors[0].line).toBe(2);
  });

  test("a cycle is an error that lists the files", async () => {
    const { evaluator, errors, outputs } = setup({
      "/p/a.ml": "let v = B.v",
      "/p/b.ml": "let v = A.v",
    });
    await evaluator.evaluateFile("/p/main.ml", 'let () = print_endline "no"; print_int A.v');
    expect(outputs).toEqual([]);
    expect(errors[0].message).toBe(
      "Error: Circular dependency between the files: a.ml -> b.ml -> a.ml",
    );
  });

  test("a file that the program does not refer to is not read as OCaml", async () => {
    const { evaluator, errors, outputs } = setup({
      "/p/used.ml": "let v = 7",
      "/p/junk.ml": "this is not ocaml (((",
    });
    await evaluator.evaluateFile("/p/main.ml", "let () = print_int Used.v");
    expect(errors).toEqual([]);
    expect(outputs).toEqual(["7"]);
  });

  test("a conductor that cannot give files runs a single file as before", async () => {
    const outputs: string[] = [];
    const conductor = {
      sendOutput: (m: string) => outputs.push(m),
      sendError: () => undefined,
      requestFile: () => Promise.reject(new Error("no files")),
    } as unknown as IRunnerPlugin;
    await new OCamlEvaluator(conductor).evaluateFile("/p/main.ml", "let () = print_int (1 + 1)");
    expect(outputs).toEqual(["2"]);
  });
});
