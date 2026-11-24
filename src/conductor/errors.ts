import { ConductorError } from "@sourceacademy/conductor/common";
import type { ToplevelError } from "./toplevel";

/**
 * The number of UTF-16 code units (what the editor counts as columns) in the first `byteColumn` bytes
 * of the UTF-8 encoding of line `line` (1-based) of `source`. OCaml counts columns in bytes; the two
 * differ after a non-ASCII character in a string, a comment or an identifier.
 */
export function editorColumn(source: string, line: number, byteColumn: number): number {
  const text = source.split("\n")[line - 1] ?? "";
  const bytes = new TextEncoder().encode(text);
  // A cut in the middle of a character would decode to a replacement character: back up to its start.
  let end = Math.min(byteColumn, bytes.length);
  while (end > 0 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
  return new TextDecoder().decode(bytes.subarray(0, end)).length;
}

/**
 * An error of OCaml's, for the frontend: `line` and `column` (1-based and 0-based, the column in
 * editor characters) are what it shows; `message` is OCaml's own, without the location.
 */
export class OCamlError extends ConductorError {
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  rawMessage: string;

  /** `source` is the text that was run, to convert the columns from bytes to editor characters. */
  constructor(error: ToplevelError, source: string) {
    super(error.message);
    this.name = "OCamlError";
    this.rawMessage = error.message;
    if (error.line > 0) {
      this.line = error.line;
      this.column = editorColumn(source, error.line, error.column);
      this.endLine = error.endLine;
      this.endColumn = editorColumn(source, error.endLine, error.endColumn);
    }
  }
}
