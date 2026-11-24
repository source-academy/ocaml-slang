import { ConductorError } from "@sourceacademy/conductor/common";
import { BasicEvaluator, type IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { OCamlError } from "./errors";
import { loadToplevel } from "./loader";
import type { Toplevel } from "./toplevel";

/**
 * The conductor evaluator (ocaml-slang#9). A chunk is a sequence of toplevel phrases, run in one
 * session, so a chunk sees what earlier chunks defined, as in `ocaml`. A chunk with a syntax or type
 * error is rejected as a whole and leaves the session unchanged. Running a file starts a new session.
 *
 * The toplevel bundle is fetched when the evaluator starts (loader.ts), so that loading overlaps with
 * the student typing. A run shows what the program prints and the value of its last phrase; a chunk
 * shows what the program prints and the results as the toplevel does (#10). Errors carry OCaml's
 * message and its line and column.
 */
export class OCamlEvaluator extends BasicEvaluator {
  private loading?: Promise<Toplevel>;

  constructor(conductor: IRunnerPlugin) {
    super(conductor);
    // Start loading at once, so that the toplevel is there when the first program runs; a failure
    // is reported by that run, not here.
    this.toplevel().catch(() => undefined);
  }

  /** The toplevel, loaded when first asked for. A load that failed is dropped, and the next run tries again. */
  private toplevel(): Promise<Toplevel> {
    const loading = (this.loading ??= loadToplevel());
    loading.catch(() => {
      if (this.loading === loading) this.loading = undefined;
    });
    return loading;
  }

  /** A run of the editor's program: a new session; shows what the program prints, and the value of its last phrase. */
  async evaluateFile(_fileName: string, fileContent: string): Promise<void> {
    try {
      (await this.toplevel()).reset();
    } catch (e) {
      return this.fail(e);
    }
    return this.run(fileContent, "file");
  }

  /** A phrase or more typed in the REPL: shows what the program prints, and the results as the toplevel does. */
  evaluateChunk(chunk: string): Promise<void> {
    return this.run(chunk, "chunk");
  }

  private async run(code: string, mode: "file" | "chunk"): Promise<void> {
    try {
      const top = await this.toplevel();
      // What the program prints goes out as it is flushed. Each message is an entry of the REPL, so
      // the newline that ends it is dropped.
      const out = (text: string) => {
        if (text !== "") this.conductor.sendOutput(text.replace(/\n$/, ""));
      };
      const r = top.run(code, out);
      if (r.error) {
        if (mode === "chunk") out(r.result);
        this.conductor.sendError(new OCamlError(r.error, code));
      } else {
        // A value whose printer prints nothing is still the result: send it, though it is empty.
        if (mode === "file") {
          if (r.value !== null) this.conductor.sendOutput(r.value.replace(/\n$/, ""));
        } else {
          out(r.result);
        }
      }
    } catch (e) {
      this.fail(e);
    }
  }

  private fail(e: unknown): void {
    this.conductor.sendError(
      e instanceof ConductorError
        ? e
        : new ConductorError(e instanceof Error ? e.message : String(e)),
    );
  }
}
