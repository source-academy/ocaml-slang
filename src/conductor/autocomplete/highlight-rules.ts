import type { AceRules } from "@sourceacademy/common-autocomplete";

/** The keywords of OCaml 5.5 (the manual, "Lexical conventions"; `effect` since 5.3). */
const keywords = [
  "and", "as", "assert", "asr", "begin", "class", "constraint", "do", "done", "downto", "effect",
  "else", "end", "exception", "external", "for", "fun", "function", "functor", "if", "in",
  "include", "inherit", "initializer", "land", "lazy", "let", "lor", "lsl", "lsr", "lxor", "match",
  "method", "mod", "module", "mutable", "new", "nonrec", "object", "of", "open", "or", "private",
  "rec", "sig", "struct", "then", "to", "try", "type", "val", "virtual", "when", "while", "with",
]; // prettier-ignore

/** The types that Stdlib predefines. */
const types = [
  "int", "float", "bool", "char", "string", "bytes", "unit", "list", "array", "option", "result",
  "exn", "int32", "int64", "nativeint", "format", "lazy_t",
]; // prettier-ignore

const escape =
  "\\\\(?:[\\\\\"'ntbr ]|[0-9]{3}|x[0-9a-fA-F]{2}|o[0-7]{3}|u\\{[0-9a-fA-F]{1,6}\\}|$)";
const digits = "[0-9][0-9_]*";
const suffix = "[lLn]?";

/**
 * Ace highlight rules for OCaml, written for this evaluator. Comments nest (`(* (* *) *)`) and
 * `(*)` is not a comment but the operator `( * )`; `{|...|}` and `{id|...|id}` are quoted strings
 * (a `{id|` string ends at any `|id2}`, as a rule cannot remember the `id`).
 */
export default function ocamlHighlightRules(): AceRules {
  return {
    start: [
      { token: "comment", regex: "\\(\\*(?!\\))", push: "comment" },
      { token: "string", regex: '"', next: "string" },
      { token: "string", regex: "\\{\\|", next: "quotedstring" },
      { token: "string", regex: "\\{[a-z_]+\\|", next: "quotedstringid" },
      // a character: 'a', '\n', '\'' (but not a type variable 'a, or a prime in x')
      { token: "string", regex: "'(?:[^\\\\'\\n]|" + escape + ")'" },
      {
        token: "constant.numeric",
        regex: "0[xX][0-9a-fA-F][0-9a-fA-F_]*(?:\\.[0-9a-fA-F_]*)?(?:[pP][+-]?[0-9_]+)?" + suffix,
      },
      { token: "constant.numeric", regex: "0[oO][0-7][0-7_]*" + suffix },
      { token: "constant.numeric", regex: "0[bB][01][01_]*" + suffix },
      {
        token: "constant.numeric",
        regex: digits + "(?:\\.[0-9_]*)?(?:[eE][+-]?[0-9_]+)?" + suffix,
      },
      { token: "variable.parameter", regex: "'[a-z_][\\w']*" }, // type variable
      { token: "constant.language", regex: "`[A-Za-z_][\\w']*" }, // polymorphic variant
      { token: "variable.parameter", regex: "[~?][a-z_][\\w']*:?" }, // labels
      { token: "support.other", regex: "\\[@{1,3}[A-Za-z_][\\w.']*" }, // attributes
      { token: "support.class", regex: "[A-Z][\\w']*" }, // modules and constructors
      {
        token: {
          map: {
            keyword: keywords.join("|"),
            "constant.language": "true|false",
            "storage.type": types.join("|"),
          },
          defaultToken: "identifier",
        },
        regex: "[a-z_][\\w']*",
      },
      { token: "punctuation", regex: ";;|->|,|;|:|\\.\\.|\\.|::" },
      { token: "keyword.operator", regex: "[-+*/%^<>=!@|&$~?#:.]+" },
      { token: "paren.lparen", regex: "\\[\\||\\[<|\\[>|[\\[({]" },
      { token: "paren.rparen", regex: "\\|\\]|[\\])}]" },
      { token: "text", regex: "\\s+" },
    ],
    comment: [
      { token: "comment", regex: "\\(\\*(?!\\))", push: "comment" },
      { token: "comment", regex: "\\*\\)", next: "pop" },
      { defaultToken: "comment" },
    ],
    string: [
      { token: "constant.language.escape", regex: escape },
      { token: "string", regex: '"', next: "start" },
      { defaultToken: "string" },
    ],
    quotedstring: [{ token: "string", regex: "\\|\\}", next: "start" }, { defaultToken: "string" }],
    quotedstringid: [
      { token: "string", regex: "\\|[a-z_]+\\}", next: "start" },
      { defaultToken: "string" },
    ],
  };
}
