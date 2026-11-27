import { locationSnippet, OCamlError } from "../conductor/errors";

const at = (
  line: number,
  endLine: number,
  column: number,
  endColumn: number,
  message = "Error: x",
) => ({ message, line, endLine, column, endColumn, file: "" });

describe("an OCaml error says where it is in its message (#49)", () => {
  test("a span on one line has the line and ^ under the span", () => {
    expect(locationSnippet("let a = 1\nlet b = ;;", 2, 8, 2, 10)).toBe(
      "Error at line 2, characters 8-10:\n\n    let b = ;;\n            ^^",
    );
  });

  test("an empty span still has one ^", () => {
    expect(locationSnippet("let a = 1 +", 1, 11, 1, 11)).toBe(
      "Error at line 1, characters 11-11:\n\n    let a = 1 +\n               ^",
    );
  });

  test("a span over several lines is marked to the end of its first line", () => {
    expect(locationSnippet("let x =\n  1 +\n  2", 1, 4, 3, 3)).toBe(
      "Error at lines 1-3:\n\n    let x =\n        ^^^",
    );
  });

  test("tabs in front of the span stay tabs, so that the marks line up", () => {
    expect(locationSnippet("\tlet y = ;;", 1, 9, 1, 11)).toBe(
      "Error at line 1, characters 9-11:\n\n    \tlet y = ;;\n    \t        ^^",
    );
  });

  test("a line that is not there (the end of the program) has only the header", () => {
    expect(locationSnippet("let a = 1\n", 3, 0, 3, 0)).toBe("Error at line 3, characters 0-0:");
  });

  test("columns are counted in editor characters after non-ASCII text", () => {
    const e = new OCamlError(at(1, 1, 14, 15), 'let s = "é" ;; )');
    expect(e.message).toBe(
      'Error at line 1, characters 13-14:\n\n    let s = "é" ;; )\n                 ^\n\nError: x',
    );
    expect(e.column).toBe(13);
  });

  test("the message of OCaml's own is kept as rawMessage, and an error in another file is not changed", () => {
    const e = new OCamlError(at(1, 1, 0, 1, "Error: y"), "x");
    expect(e.rawMessage).toBe("Error: y");
    const foreign = new OCamlError({ ...at(2, 2, 3, 4, "Error: z"), file: "lib.ml" }, "main", {
      "lib.ml": "a\nbcde",
    });
    expect(foreign.message).toBe('File "lib.ml", line 2, characters 3-4:\nError: z');
    expect(foreign.line).toBeUndefined();
  });

  test("an error with no location is its message", () => {
    expect(new OCamlError(at(0, 0, 0, 0, "Error: none"), "x").message).toBe("Error: none");
  });
});
