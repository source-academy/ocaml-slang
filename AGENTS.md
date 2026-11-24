# Instructions for AI agents

OCaml for Source Academy: a conductor evaluator that runs the real OCaml toplevel. Plan:
`docs/ocaml-slang.md`. Work is tracked in https://github.com/orgs/source-academy/projects/63.

## Layout

* `ocaml/toplevel/`: the OCaml toplevel (compiler-libs, Stdlib, MenhirLib), compiled to one JavaScript
  file with js_of_ocaml (`dune`).
* `src/conductor/`: the TypeScript conductor evaluator `OCamlEvaluator`; `autocomplete/` is its
  syntax-highlighting plugin for the frontend.
* `tools/`: what is linked into menhir and ocamllex when they are built to JavaScript.
* `src/tests/`: Jest tests, which run the built toplevel in Node. `src/tests/corpus.test.ts` runs the
  programs of `corpus/` and compares what the evaluator sends with their `.expected` files (see
  `corpus/README.md`; `UPDATE_CORPUS=1 yarn test corpus` rewrites them, and
  `scripts/check-corpus-against-native.py` checks the programs against native OCaml).
* `dist/`: build output, published to GitHub Pages: `OCamlEvaluator.js` and `ocaml-toplevel.js`.
* `experiments/`: nothing; spikes are not committed (their results go on the issue).

## Commands

Use the scripts in `package.json`, not the tools directly.

* Build everything: `yarn build`. Only the OCaml toplevel: `yarn build:ocaml`. Menhir and ocamllex as
  JavaScript (`dist/menhir.js`, `dist/ocamllex.js`, from fetched sources in `.tools/`): `yarn build:tools`.
  Only the evaluator: `yarn build:evaluator`.
* Test: `yarn test` (Jest; needs `dist/ocaml-toplevel.js`, `dist/menhir.js` and `dist/ocamllex.js`, so run `yarn build` first).
* Lint and types: `yarn lint`, `yarn typecheck`. Format: `yarn format` (`yarn format:ci` lists unformatted files).
* After changing `dune-project`: `dune build @install --auto-promote` regenerates `ocaml-slang.opam`.

## Loading the toplevel

The evaluator fetches `ocaml-toplevel.js` when it starts (`src/conductor/loader.ts`): from
`TOPLEVEL_URL` on GitHub Pages, or from `globalThis.OCAML_SLANG_TOPLEVEL_URL` (under Node also a file
path, which the tests use). `menhir.js` and `ocamllex.js` are fetched from the same directory when a
program has a `.mly` or `.mll`. In a worker it runs the script from a `blob:` URL with `importScripts`;
under Node as a function given Node's `require`. A failed load is an error of that run, and the next run tries again.

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
