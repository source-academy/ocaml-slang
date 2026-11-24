import { ConductorError } from "@sourceacademy/conductor/common";
import { BasicEvaluator, type IRunnerPlugin } from "@sourceacademy/conductor/runner";

/** What the OCaml toplevel bundle (ocaml/toplevel/toplevel.ml) puts on globalThis.ocaml. */
export interface Toplevel {
  /** Runs toplevel phrases; returns everything printed (output, values, errors). */
  exec(code: string): string;
  writeFile(path: string, content: string): void;
  modUse(path: string): string;
}

/**
 * Skeleton of the conductor evaluator (ocaml-slang#8): it hands each chunk to the OCaml toplevel
 * and sends back what the toplevel printed. Chunks as toplevel phrases with proper output and
 * errors are #9 and #10; loading the bundle lazily from a blob: URL is #11.
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

  // eslint-disable-next-line @typescript-eslint/require-await -- the toplevel runs synchronously
  async evaluateChunk(chunk: string): Promise<void> {
    try {
      this.conductor.sendOutput(this.toplevel().exec(chunk));
    } catch (e) {
      this.conductor.sendError(e instanceof ConductorError ? e : new ConductorError(String(e)));
    }
  }
}
