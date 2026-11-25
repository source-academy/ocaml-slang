import type { SyntaxHighlightData } from "@sourceacademy/common-autocomplete";
import ocamlHighlightRules from "./highlight-rules";

/** The Ace mode for OCaml, which the evaluator sends to the frontend. */
export default function ocamlMode(): SyntaxHighlightData {
  return {
    highlightRules: ocamlHighlightRules(),
    // OCaml has no folding for now. Ace has no OCaml folding mode, and `cstyle` is defined only in
    // the files of other languages' modes (JavaScript, C++), which the frontend loads only for a
    // language that hooks into them. The frontend then builds the mode without folding. The
    // protocol requires the field, so this names the nearest fit.
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
