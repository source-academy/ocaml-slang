import type { SyntaxHighlightData } from "@sourceacademy/common-autocomplete";
import ocamlHighlightRules from "./highlight-rules";

/** The Ace mode for OCaml, which the evaluator sends to the frontend. */
export default function ocamlMode(): SyntaxHighlightData {
  return {
    highlightRules: ocamlHighlightRules(),
    // folds the brackets, braces and parentheses that a line opens
    foldingRules: { hookFrom: "ace/mode/folding/cstyle", args: [] },
    // OCaml has no line comments
    lineCommentStart: "",
    // `'` is also a type variable and a prime in a name: never pair it
    pairQuotesAfter: { "'": /(?!)/ },
    // Ace's own OCaml mode (the frontend includes it, as it does Python's)
    indents: { hookFrom: "ace/mode/ocaml" },
    outdents: { hookFrom: "ace/mode/ocaml" },
    autoOutdent: { hookFrom: "ace/mode/ocaml" },
    id: "ace/mode/ocamlslang",
  };
}
