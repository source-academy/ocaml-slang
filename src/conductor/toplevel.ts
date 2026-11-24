/** An error of the OCaml toplevel: its message and where it is (`line` is 0 if there is no location). */
export interface ToplevelError {
  message: string;
  /** 1-based. */
  line: number;
  /** 0-based, in bytes of the UTF-8 source (OCaml's own). */
  column: number;
  endLine: number;
  endColumn: number;
  /** The file of the location, if it is not the entry (or a chunk): `lexer.ml`. */
  file: string;
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
  /**
   * The module names that a file refers to, as `ocamldep` finds them, or the syntax error that stops
   * that. `entry` is the file that is run, which is read as the toplevel reads a file.
   */
  dependencies(
    file: string,
    source: string,
    kind: "ml" | "mli" | "entry",
  ): { deps: string[]; error: ToplevelError | null };
  /**
   * Runs the modules of a program of several files (in the order given, dependencies first), and then
   * the entry; all are checked before any runs. `mliFiles[i]` is "" if module i has no interface.
   */
  runProgram(
    names: string[],
    files: string[],
    mls: string[],
    mliFiles: string[],
    mlis: string[],
    entry: string,
    onOutput: (text: string) => void,
  ): RunResult;
  /** Starts a new session: the environment and settings as they were when the toplevel started. */
  reset(): void;
  writeFile(path: string, content: string): void;
  modUse(path: string): string;
}
