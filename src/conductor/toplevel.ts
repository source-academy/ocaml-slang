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
