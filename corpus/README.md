# The corpus

OCaml programs with what the evaluator sends for them (ocaml-slang#12). It is the check for every
upgrade of OCaml, js_of_ocaml, Menhir or the toplevel code: `yarn test corpus` runs all of it.

* `name.ml` is run as the editor's program. `name.repl` is a session: chunks separated by a line
  `(* --- *)`, each sent as a chunk after a new session starts.
* `name.ml.expected` lists the messages in the order they were sent: `out: text` for output and
  results (further lines of a message indented by 4 spaces), `error L:C-L:C: text` for an error
  (1-based lines, 0-based columns in editor characters), `--- chunk N` between the chunks of a session.
* The groups: `core`, `records-variants`, `exceptions`, `modules`, `printf`, `errors` (syntax, type and
  other errors, warnings, columns after non-ASCII text), `repl`, `misc` (int width, MenhirLib, a hand-written
  lexer and parser, ...).

When a change is meant to alter the output, run `UPDATE_CORPUS=1 yarn test corpus`, and look at the diff of
the `.expected` files. When a program or an `.expected` file is added or changed, check that the program
prints what native OCaml prints: `python3 scripts/check-corpus-against-native.py` (needs `ocaml`).

Programs must not depend on the history of the toplevel: no weak type variables in a result (`'_weak5`
counts up over the whole run), no hash table order, no timing.

Known differences from native OCaml that the corpus pins: `int` has 32 bits (`misc/int-width.ml`);
`Assert_failure` and `Match_failure` name the file `//toplevel//`; output is flushed at a newline from
`print_endline` and at the end of each phrase, so a message is what was flushed together.
