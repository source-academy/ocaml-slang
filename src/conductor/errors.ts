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
 * Where an error is, for a reader of the message alone: the header with the line, the source line,
 * and a line of `^` under the span (as py-slang's errors do). A span over several lines is marked to
 * the end of its first line. `startColumn` and `endColumn` are in editor characters.
 */
export function locationSnippet(
  source: string,
  line: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
): string {
  const text = source.split("\n")[line - 1] ?? "";
  const header =
    endLine > line
      ? `Error at lines ${line}-${endLine}:`
      : `Error at line ${line}, characters ${startColumn}-${endColumn}:`;
  if (text === "") return header;
  const to = endLine > line ? text.length : endColumn;
  // Keep tabs in the margin, so that the marks line up whatever the width of a tab.
  const margin = text.slice(0, startColumn).replace(/[^\t]/g, " ");
  const marks = "^".repeat(Math.max(1, to - startColumn));
  return `${header}\n\n    ${text}\n    ${margin}${marks}`;
}

/**
 * An error of OCaml's, for the frontend. `line` and `column` (1-based and 0-based, the column in
 * editor characters) are what it shows, and `rawMessage` is OCaml's own message without the location.
 * Only `message` is certain to arrive: the conductor sends the error with `postMessage`, and the
 * structured clone keeps the message of an `Error` and drops its other properties. So the message
 * has the location in it, with the source line (`locationSnippet`).
 */
export class OCamlError extends ConductorError {
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  /** The file of the error, if it is not the entry (`lexer.ml`); then there is no `line` and `column`. */
  file?: string;
  rawMessage: string;

  /**
   * `source` is the text of the entry (or the chunk), to convert the columns from bytes to editor
   * characters; `others` has the text of the other files by name. An error in another file names
   * the file in its message (as OCaml does) and has no line and column: the editor shows the entry,
   * so a line number of another file would point at the wrong place.
   */
  constructor(error: ToplevelError, source: string, others: Record<string, string> = {}) {
    const foreign = error.file !== "" && error.file !== undefined && error.line > 0;
    const text = foreign ? (others[error.file] ?? "") : source;
    const start = editorColumn(text, error.line, error.column);
    const end = editorColumn(text, error.endLine, error.endColumn);
    const message = foreign
      ? `File "${error.file}", ${
          error.line === error.endLine
            ? `line ${error.line}`
            : `lines ${error.line}-${error.endLine}`
        }, characters ${start}-${end}:\n${error.message}`
      : error.message;
    const located = !foreign && error.line > 0;
    super(
      located
        ? `${locationSnippet(text, error.line, start, error.endLine, end)}\n\n${message}`
        : message,
    );
    this.name = "OCamlError";
    this.rawMessage = message;
    if (foreign) {
      this.file = error.file;
    } else if (error.line > 0) {
      this.line = error.line;
      this.column = start;
      this.endLine = error.endLine;
      this.endColumn = end;
    }
  }
}
