# Instructions for AI agents

OCaml for Source Academy: a conductor evaluator that runs the real OCaml toplevel. Plan:
`docs/ocaml-slang.md`. Work is tracked in https://github.com/orgs/source-academy/projects/63.

## Layout

* `ocaml/toplevel/`: the OCaml toplevel (compiler-libs, Stdlib, MenhirLib), compiled to one JavaScript
  file with js_of_ocaml (`dune`).
* `src/conductor/`: the TypeScript conductor evaluator `OCamlEvaluator`.
* `src/tests/`: Jest tests, which run the built toplevel in Node.
* `dist/`: build output, published to GitHub Pages: `OCamlEvaluator.js` and `ocaml-toplevel.js`.
* `experiments/`: nothing; spikes are not committed (their results go on the issue).

## Commands

Use the scripts in `package.json`, not the tools directly.

* Build everything: `yarn build`. Only the OCaml toplevel: `yarn build:ocaml`. Only the evaluator: `yarn build:evaluator`.
* Test: `yarn test` (Jest; needs `dist/ocaml-toplevel.js`, so run `yarn build:ocaml` first).
* Lint and types: `yarn lint`, `yarn typecheck`. Format: `yarn format` (`yarn format:ci` lists unformatted files).
* After changing `dune-project`: `dune build @install --auto-promote` regenerates `ocaml-slang.opam`.

## OCaml environment

* The OCaml version and every package are pinned: OCaml 5.5.2, js_of_ocaml 6.5.0, Menhir 20260209
  (`ocaml-slang.opam.locked`). Set up with
  `opam switch create . --deps-only --locked --no-install && opam install . --deps-only --locked`
  (or `opam install . --deps-only --locked` in an existing 5.5.2 switch).
* Build the toplevel with `--profile release` (`yarn build:ocaml` does): the default dev profile
  makes a much larger file.
* On macOS, Anaconda's `patch` on the PATH breaks `opam update`; put `/usr/bin` first.
* js_of_ocaml's `int` is 32 bits, not 63 as in native OCaml.
* In a git worktree, install the dependencies there first (`yarn install`, and an opam switch).
