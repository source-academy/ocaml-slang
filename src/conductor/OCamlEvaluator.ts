import { ConductorError } from "@sourceacademy/conductor/common";
import { BasicEvaluator, type IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { loadToplevel } from "./loader";
import type { Toplevel } from "./toplevel";

/**
 * The conductor evaluator (ocaml-slang#9). A chunk is a sequence of toplevel phrases, run in one
 * session, so a chunk sees what earlier chunks defined, as in `ocaml`. A chunk with a syntax or type
 * error is rejected as a whole and leaves the session unchanged. Running a file starts a new session.
 *
 * The toplevel bundle is fetched when the evaluator starts (loader.ts), so that loading overlaps with
 * the student typing. What a run and a chunk show, and the errors' lines and columns, are #10.
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

  async evaluateFile(_fileName: string, fileContent: string): Promise<void> {
    try {
      (await this.toplevel()).reset();
    } catch (e) {
      return this.fail(e);
    }
    return this.evaluateChunk(fileContent);
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const { ok, output } = (await this.toplevel()).run(chunk);
      if (ok) {
        if (output !== "") this.conductor.sendOutput(output);
      } else {
        this.conductor.sendError(new ConductorError(output.trim()));
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
