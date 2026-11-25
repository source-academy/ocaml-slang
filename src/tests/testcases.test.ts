import { ConductorError } from "@sourceacademy/conductor/common";
import { Conduit, type ILink } from "@sourceacademy/conductor/conduit";
import { BasicHostPlugin } from "@sourceacademy/conductor/host";
import { RunnerStatus } from "@sourceacademy/conductor/types";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { Worker } from "worker_threads";
import { OCamlEvaluator } from "../conductor/OCamlEvaluator";

// Testcases (ocaml-slang#21). The frontend (runTestCase.ts) and the grader (pythonGrader.ts) both
// make one program of a question, `prepend`, the student's code, `postpend` and the testcase, joined by
// newlines, run it as a file, and compare the last line it printed with the answer. These tests do the
// same with the evaluator.

const bundle = resolve(__dirname, "../../dist/ocaml-toplevel.js");

/** What the frontend and the grader send: the parts of a question and a testcase, in one program. */
const assemble = (...parts: string[]) => parts.filter(p => p.trim() !== "").join("\n");

/** The lines the evaluator prints, and the errors, of one program. */
async function grade(program: string) {
  if (!existsSync(bundle)) throw new Error(`${bundle} is missing: run 'yarn build:ocaml' first`);
  (globalThis as { OCAML_SLANG_TOPLEVEL_URL?: string }).OCAML_SLANG_TOPLEVEL_URL = bundle;
  const outputs: string[] = [];
  const errors: ConductorError[] = [];
  const conductor = {
    sendOutput: (m: string) => outputs.push(m),
    sendError: (e: ConductorError) => errors.push(e),
  } as unknown as IRunnerPlugin;
  await new OCamlEvaluator(conductor).evaluateFile("/testcase.ml", program);
  return { outputs, errors, last: outputs[outputs.length - 1] };
}

const fact = "let rec fact n = if n = 0 then 1 else n * fact (n - 1)";

describe("a testcase is the end of the program, and its result is the last line", () => {
  test("the value of the last phrase, without its type (decided in #6)", async () => {
    const r = await grade(assemble("", fact, "", ";; fact 5"));
    expect(r.errors).toEqual([]);
    expect(r.last).toBe("120");
  });

  test("the testcase sees what prepend and postpend define", async () => {
    const r = await grade(
      assemble("let offset = 100", "let f x = x + offset", "let check x = f x * 2", ";; check 1"),
    );
    expect(r.last).toBe("202");
  });

  test("a testcase can print instead: the last line that the program printed", async () => {
    const r = await grade(assemble(fact, ";; print_endline (string_of_int (fact 4))"));
    expect(r.errors).toEqual([]);
    expect(r.last).toBe("24");
  });

  test("values print as the toplevel prints them", async () => {
    expect((await grade(assemble(";; [1; 2; 3]"))).last).toBe("[1; 2; 3]");
    expect((await grade(assemble(';; "text"'))).last).toBe('"text"');
    expect((await grade(assemble(";; (1, true)"))).last).toBe("(1, true)");
    expect((await grade(assemble(";; Some 3.5"))).last).toBe("Some 3.5");
  });

  test("output of the student's program comes before the testcase's result", async () => {
    const r = await grade(assemble('let () = print_endline "student"', ";; 1 + 1"));
    expect(r.outputs).toEqual(["student", "2"]);
  });

  test("a failing testcase is an error, which the grader reports as an error", async () => {
    const r = await grade(assemble(fact, ';; fact "five"'));
    expect(r.errors).toHaveLength(1);
  });

  test("an exception in a testcase is an error", async () => {
    const r = await grade(assemble(fact, ";; List.hd []"));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain("Failure");
  });

  test("a testcase must start with `;;`: joined by a newline, an expression is read as part of the last definition", async () => {
    // `fact 5` after the let-binding without `;;` is `n * fact (n - 1) fact 5`, a type error.
    const r = await grade(assemble(fact, "fact 5"));
    expect(r.errors).toHaveLength(1);
  });
});

describe("the evaluator's toplevel runs in a Node worker thread, as in the grader's host", () => {
  const run = (code: string, timeoutMs: number, maxOldGenerationSizeMb?: number) =>
    new Promise<{ value?: string | null; timedOut: boolean }>((resolveRun, reject) => {
      const worker = new Worker(
        `
        const { parentPort, workerData } = require("worker_threads");
        require(workerData.bundle);
        const wait = () =>
          globalThis.ocaml
            ? parentPort.postMessage({ value: globalThis.ocaml.run(workerData.code, () => {}).value })
            : setTimeout(wait, 2);
        wait();
      `,
        { eval: true, workerData: { bundle, code }, resourceLimits: { maxOldGenerationSizeMb } },
      );
      const timer = setTimeout(() => {
        void worker.terminate();
        resolveRun({ timedOut: true });
      }, timeoutMs);
      worker.on("message", m => {
        clearTimeout(timer);
        void worker.terminate();
        resolveRun({ ...m, timedOut: false });
      });
      worker.on("error", e => {
        clearTimeout(timer);
        reject(e);
      });
    });

  test("loads from a file, with 128 MB of heap, and answers", async () => {
    const r = await run(`${fact};; fact 5;;`, 20000, 128);
    expect(r).toEqual({ value: "120", timedOut: false });
  });

  test("an endless loop is stopped by terminating the thread", async () => {
    const r = await run("let rec loop () = loop ();; loop ();;", 1500);
    expect(r.timedOut).toBe(true);
  });
});

describe("a program cannot reach the machine that the toplevel runs on under Node", () => {
  // The grader runs students' programs under Node. js_of_ocaml's runtime would use the real file
  // system and shell there, unless the loader starts it as a browser does (loader.ts, runInNode).
  const dir = mkdtempSync(join(tmpdir(), "ocaml-slang-sandbox-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test("Sys.command runs nothing", async () => {
    const marker = join(dir, "from-sys-command");
    const r = await grade(`;; Sys.command "touch ${marker}"`);
    expect(r.last).toBe("127");
    expect(existsSync(marker)).toBe(false);
  });

  test("a file outside the program's own file system cannot be read", async () => {
    const secret = join(dir, "secret.txt");
    writeFileSync(secret, "hunter2");
    const r = await grade(`;; In_channel.with_open_text "${secret}" In_channel.input_all`);
    expect(r.errors).toHaveLength(1);
    expect(r.outputs.join("")).not.toContain("hunter2");
  });

  test("a file that the program writes is in memory, not on the machine", async () => {
    const written = join(dir, "written.txt");
    const r = await grade(
      `let () = Out_channel.with_open_text "${written}" (fun oc -> output_string oc "x")\n;; 1`,
    );
    expect(r.errors).toEqual([]);
    expect(existsSync(written)).toBe(false);
  });

  test("the program's own files still work, and so does the next program", async () => {
    const r = await grade(
      `let () = Out_channel.with_open_text "/note.txt" (fun oc -> output_string oc "ok")\n;; In_channel.with_open_text "/note.txt" In_channel.input_all`,
    );
    expect(r.last).toBe('"ok"');
  });
});

describe("the evaluator bundle runs under a conductor host in a Node worker thread", () => {
  const evaluator = resolve(__dirname, "../../dist/OCamlEvaluator.js");

  /** A host, as the grader's will be: it starts the evaluator in a worker thread and runs a file. */
  function runFile(program: string, timeoutMs: number) {
    return new Promise<{ outputs: string[]; errors: string[]; timedOut: boolean }>(
      (resolveRun, reject) => {
        const worker = new Worker(evaluator, {
          env: { ...process.env, OCAML_SLANG_TOPLEVEL_URL: bundle },
        });
        const outputs: string[] = [];
        const errors: string[] = [];
        const finish = (timedOut: boolean) => {
          clearTimeout(timer);
          void worker.terminate();
          resolveRun({ outputs, errors, timedOut });
        };
        const timer = setTimeout(() => finish(true), timeoutMs);
        worker.on("error", e => {
          clearTimeout(timer);
          reject(e);
        });
        // a Node worker has no addEventListener; the conduit sends message ports, which are transferred
        const link = {
          postMessage: (m: unknown, transfer: never) => worker.postMessage(m, transfer),
          addEventListener: (_: string, f: (e: { data: unknown }) => void) =>
            worker.on("message", data => f({ data })),
        } as unknown as ILink;
        // (methods, not fields: the base class binds requestFile in its constructor)
        class Host extends BasicHostPlugin {
          requestFile(name: string) {
            return Promise.resolve(name === "/main.ml" ? program : undefined);
          }
          async requestLoadPlugin() {}
          queryPluginResolutions() {
            return {};
          }
          receiveOutput(m: string) {
            outputs.push(m);
          }
          receiveError(e: ConductorError) {
            errors.push(e.message);
          }
          // the evaluator is ready again when the file has been run
          receiveStatusUpdate(status: RunnerStatus, active: boolean) {
            if (status === RunnerStatus.EVAL_READY && active) finish(false);
          }
        }
        const conduit = new Conduit(link, true);
        const host = conduit.registerPlugin(Host);
        host.startEvaluator("/main.ml");
      },
    );
  }

  beforeAll(() => {
    if (!existsSync(evaluator))
      throw new Error(`${evaluator} is missing: run 'yarn build:evaluator'`);
  });

  test("runs a testcase and sends its result", async () => {
    const r = await runFile(assemble(fact, ";; fact 5"), 20000);
    expect(r).toEqual({ outputs: ["120"], errors: [], timedOut: false });
  });

  test("sends an error as an error", async () => {
    const r = await runFile(assemble(fact, ';; fact "five"'), 20000);
    expect(r.errors).toHaveLength(1);
  });
});
