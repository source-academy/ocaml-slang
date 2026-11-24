# ocaml-slang

OCaml for [Source Academy](https://sourceacademy.org): the real OCaml toplevel, Menhir and ocamllex,
compiled to the browser and run as a [conductor](https://github.com/source-academy/conductor)
evaluator. First user: CS4212 (Compiler Design, NUS).

Status: early development (phase 1). The plan is [docs/ocaml-slang.md](docs/ocaml-slang.md); the work is
tracked in the GitHub project [ocaml-slang](https://github.com/orgs/source-academy/projects/63).

## Build

You need [opam](https://opam.ocaml.org) and Node 22 with Corepack.

```sh
opam switch create . --deps-only --locked --no-install   # OCaml 5.5.2 (once)
opam install . --deps-only --locked                      # js_of_ocaml 6.5.0, Menhir, ... as locked
eval $(opam env)
corepack enable && yarn install
yarn build      # dist/ocaml-toplevel.js (dune) and dist/OCamlEvaluator.js (rollup)
yarn test       # runs the built toplevel in Node
```

`yarn lint`, `yarn typecheck` and `yarn format` check the TypeScript. `AGENTS.md` has the details.

## Layout

* `ocaml/toplevel/`: the OCaml toplevel, with MenhirLib, compiled with js_of_ocaml.
* `src/conductor/`: the conductor evaluator.
* `docs/`: the plan.

Pushes to `main` publish `OCamlEvaluator.js` and `ocaml-toplevel.js` to GitHub Pages, next to each other.

## Licence

Apache-2.0. Menhir (GPL-2.0) and ocamllex (LGPL-2.1) are built from their sources and not copied here.
