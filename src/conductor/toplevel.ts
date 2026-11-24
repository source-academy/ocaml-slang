/** An error of the OCaml toplevel: its message and where it is (`line` is 0 if there is no location). */
export interface ToplevelError {
  message: string;
  /** 1-based. */
  line: number;
  /** 0-based, in bytes of the UTF-8 source (OCaml's own). */
  column: number;
  endLine: number;
  endColumn: number;
}

export interface RunResult {
  /** False if the chunk was rejected (syntax or type error) or an exception stopped it. */
  ok: boolean;
  /** The results of the phrases in the toplevel's own style: `val f : int -> int = <fun>`, `- : int = 6`. */
  result: string;
  /** The value of the last phrase, without its type (`6`), if it is an expression that is not of type unit. */
  value: string | null;
  error: ToplevelError | null;
}

/** What the OCaml toplevel bundle (ocaml/toplevel/toplevel.ml) puts on globalThis.ocaml. */
export interface Toplevel {
  /**
   * Runs the phrases of a chunk, all or none: a syntax or type error rejects the chunk before any
   * phrase runs. What the program prints, and the warnings, go to `onOutput` as they are flushed.
   */
  run(code: string, onOutput: (text: string) => void): RunResult;
  /** Starts a new session: the environment and settings as they were when the toplevel started. */
  reset(): void;
  writeFile(path: string, content: string): void;
  modUse(path: string): string;
}
