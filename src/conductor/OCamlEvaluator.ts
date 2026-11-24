import { ConductorError } from "@sourceacademy/conductor/common";
import { BasicEvaluator, type IRunnerPlugin } from "@sourceacademy/conductor/runner";

/** What the OCaml toplevel bundle (ocaml/toplevel/toplevel.ml) puts on globalThis.ocaml. */
export interface Toplevel {
  /**
   * Runs the phrases of a chunk, all or none: a syntax or type error rejects the chunk before any
   * phrase runs. `output` is everything printed (output, values, errors); `ok` is false for a
   * rejected chunk and for one that raised an exception.
   */
  run(code: string): { ok: boolean; output: string };
  /** Runs toplevel phrases; returns `run(code).output`. */
  exec(code: string): string;
  /** Starts a new session: the environment as it was when the toplevel started. */
  reset(): void;
  writeFile(path: string, content: string): void;
  modUse(path: string): string;
}

/**
 * The conductor evaluator (ocaml-slang#9). A chunk is a sequence of toplevel phrases, run in one
 * session, so a chunk sees what earlier chunks defined, as in `ocaml`. A chunk with a syntax or type
 * error is rejected as a whole and leaves the session unchanged. Running a file starts a new session.
 *
 * What a run and a chunk show, and the errors' lines and columns, are #10; loading the bundle lazily
 * from a blob: URL is #11.
 */
export class OCamlEvaluator extends BasicEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor);
  }

  private toplevel(): Toplevel {
    const top = (globalThis as { ocaml?: Toplevel }).ocaml;
    if (!top) throw new ConductorError("The OCaml toplevel is not loaded");
    return top;
  }

  async evaluateFile(_fileName: string, fileContent: string): Promise<void> {
    try {
      this.toplevel().reset();
    } catch (e) {
      return this.fail(e);
    }
    return this.evaluateChunk(fileContent);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- the toplevel runs synchronously
  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const { ok, output } = this.toplevel().run(chunk);
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
    this.conductor.sendError(e instanceof ConductorError ? e : new ConductorError(String(e)));
  }
}
