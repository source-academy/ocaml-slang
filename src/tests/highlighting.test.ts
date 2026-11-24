import type { AceRules, KeywordMapperArgs } from "@sourceacademy/common-autocomplete";
import OCamlAutoCompletePlugin from "../conductor/autocomplete";
import ocamlMode from "../conductor/autocomplete/mode";

// ace-builds has no types for this path
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
const ace = require("ace-builds/src-noconflict/ace") as { require: (id: string) => any };
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

// The frontend (AutocompletePlugin.loadHighlightRules) turns the rules that the evaluator sends into an
// Ace highlighter; this does the same, and tokenizes with Ace's own tokenizer.
const acequire = ace.require;

function tokenizer() {
  const { TextHighlightRules } = acequire("ace/mode/text_highlight_rules");
  const { Tokenizer } = acequire("ace/tokenizer");
  const data = structuredClone(ocamlMode().highlightRules) as AceRules;
  function Rules(this: {
    $rules: AceRules;
    normalizeRules(): void;
    createKeywordMapper(m: unknown, d: unknown): unknown;
  }) {
    for (const state of Object.values(data)) {
      for (const rule of state) {
        if ("token" in rule && typeof rule.token === "object" && "map" in rule.token) {
          const { map, defaultToken } = rule.token as KeywordMapperArgs;
          rule.token = this.createKeywordMapper(map, defaultToken) as never;
        }
      }
    }
    this.$rules = data;
    this.normalizeRules();
  }
  acequire("ace/lib/oop").inherits(Rules, TextHighlightRules);
  return new Tokenizer(new (Rules as unknown as new () => { getRules(): unknown })().getRules());
}

/** The tokens of the lines of `code`, as `type:text`, with whitespace left out. */
function tokens(code: string): string[][] {
  const t = tokenizer();
  let state = "start";
  return code.split("\n").map(line => {
    const r = t.getLineTokens(line, state) as {
      tokens: { type: string; value: string }[];
      state: string | string[];
    };
    state = r.state as string;
    return r.tokens.filter(x => x.type !== "text").map(x => `${x.type}:${x.value}`);
  });
}
const line = (code: string) => tokens(code)[0];

describe("OCaml highlighting", () => {
  test("keywords, identifiers, constructors and constants", () => {
    expect(line("let rec f x = Some x")).toEqual([
      "keyword:let",
      "keyword:rec",
      "identifier:f",
      "identifier:x",
      "keyword.operator:=",
      "support.class:Some",
      "identifier:x",
    ]);
    expect(line("true false")).toEqual(["constant.language:true", "constant.language:false"]);
    expect(line("effect")).toEqual(["keyword:effect"]); // OCaml 5
  });

  test("comments nest, and run over lines", () => {
    expect(tokens("1 (* a (* b *) c *) 2")[0].map(x => x.split(":")[0])).toEqual([
      "constant.numeric",
      "comment",
      "constant.numeric",
    ]);
    const lines = tokens("(* one\n (* two *)\n still *) let");
    expect(lines.map(l => l[0].split(":")[0])).toEqual(["comment", "comment", "comment"]);
    expect(lines[2][lines[2].length - 1]).toBe("keyword:let");
  });

  test("(*) is the operator ( * ), not a comment", () => {
    expect(line("(*)")).toEqual(["paren.lparen:(", "keyword.operator:*", "paren.rparen:)"]);
  });

  test("strings, with escapes, and quoted strings", () => {
    expect(line('"a\\nb"')).toEqual(['string:"a', "constant.language.escape:\\n", 'string:b"']);
    expect(line('{|a "q" |id} b|} x')).toEqual(['string:{|a "q" |id} b|}', "identifier:x"]);
    expect(line('{id|a "q" |} b|id} x')).toEqual(['string:{id|a "q" |} b|id}', "identifier:x"]);
  });

  test("a character is a string; a type variable and a prime are not", () => {
    expect(line("'a' '\\n' '\\''")).toEqual(["string:'a'", "string:'\\n'", "string:'\\''"]);
    expect(line("'a list")).toEqual(["variable.parameter:'a", "storage.type:list"]);
    expect(line("x' y'")).toEqual(["identifier:x'", "identifier:y'"]);
  });

  test("numbers, labels, polymorphic variants and attributes", () => {
    expect(line("1_000 0xFF 0b101 1.5e3 3l")).toEqual([
      "constant.numeric:1_000",
      "constant.numeric:0xFF",
      "constant.numeric:0b101",
      "constant.numeric:1.5e3",
      "constant.numeric:3l",
    ]);
    expect(line("f ~x:1 ?y `Red [@inline]")).toEqual([
      "identifier:f",
      "variable.parameter:~x:",
      "constant.numeric:1",
      "variable.parameter:?y",
      "constant.language:`Red",
      "support.other:[@inline",
      "paren.rparen:]",
    ]);
  });

  test("operators and punctuation", () => {
    expect(line("a |> f ;; x :: y -> z")).toEqual([
      "identifier:a",
      "keyword.operator:|>",
      "identifier:f",
      "punctuation:;;",
      "identifier:x",
      "punctuation:::",
      "identifier:y",
      "punctuation:->",
      "identifier:z",
    ]);
  });
});

describe("the mode the evaluator sends", () => {
  test("has its own id, and uses Ace's OCaml mode for indentation", () => {
    const mode = ocamlMode();
    expect(mode.id).toBe("ace/mode/ocamlslang");
    expect(mode.indents).toEqual({ hookFrom: "ace/mode/ocaml" });
    expect(mode.outdents).toEqual({ hookFrom: "ace/mode/ocaml" });
    expect(mode.autoOutdent).toEqual({ hookFrom: "ace/mode/ocaml" });
  });

  test("can be sent to the frontend (structured clone)", () => {
    expect(() => structuredClone(ocamlMode())).not.toThrow();
  });

  test("offers no completions yet", () => {
    expect(OCamlAutoCompletePlugin.prototype.autocomplete()).toEqual([]);
  });
});
