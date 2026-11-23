# Phase 0 spike

Go/no-go for running the real OCaml toplevel, Menhir and ocamllex in a web worker (#2, #3, #4, #5).
Not production code: it is kept on the `spike/phase-0` branch as the record of what was tried.

## What is here

* `toplevel/`: the OCaml 5.5.2 toplevel compiled with js_of_ocaml 6.5.0 (`--toplevel`), with
  MenhirLib linked in. It sets `globalThis.ocaml` with `exec(code)`, `writeFile(path, text)` and
  `modUse(path)` (`#mod_use`). `stubs.js` works around a js_of_ocaml bug (below).
* `tools/fsexport.js`: a runtime stub that lets the host read the files a js_of_ocaml program wrote
  to its in-memory file system (Menhir's `parser.ml`).
* `build.sh`: fetches Menhir 20260209 (GPL-2.0) and ocamllex (from OCaml 5.5.2, LGPL-2.1) with
  `opam source` rather than vendoring them, adds a JS mode to their dune files, and builds all three.
* `toy/`: a CS4212-style language: `ast.ml`, `lexer.mll`, `parser.mly` (and `parser_conflicts.mly`,
  the same grammar without precedence declarations), `interp.ml`, `sample.toy`.
* `harness/`: `basic.cjs` and `depth.cjs` (the toplevel under Node), `e2e.cjs` (the whole chain under
  Node), `browsers.cjs` (the whole chain in a web worker in Chromium, Firefox and WebKit, through
  Playwright; set `PLAYWRIGHT` to a Playwright package). `browser/` is the page and the worker.

```
./build.sh
node harness/e2e.cjs _build/default/toplevel/toplevel.bc.js vendor/menhir/_build/default/executable/stage2/main.bc.js vendor/ocamllex/_build/default/main.bc.js out
PLAYWRIGHT=/path/to/node_modules/playwright node harness/browsers.cjs
```

## Results (2026-11-23, js_of_ocaml 6.5.0, release profile)

**Go.** In a web worker in Chromium 153, Firefox 155 and WebKit 26.6: `ocamllex -ml` and
`menhir --table --explain` generate the toy language's lexer and parser; the toplevel loads
`ast.ml`, `parser.ml`, `lexer.ml` and `interp.ml` as modules and runs the sample program, with the
same output as native OCaml. Syntax errors of the toy language and OCaml's type errors come with
their locations. A grammar with conflicts gives Menhir's warnings and the full `.conflicts` report.
The same works under Node (as the grader would run it).

| | Chromium | Firefox | WebKit |
|---|---|---|---|
| toplevel startup | 140 ms | 400 ms | 190 ms |
| ocamllex | 25 ms | 30 ms | 45 ms |
| menhir `--table` | 55 ms | 105 ms | 75 ms |
| `mod_use` of the generated parser + lexer | 0.4 s | 2.5 s | 0.8 s |
| deepest non-tail recursion | 5,000 | 10,000 | 2,000 |

Sizes: toplevel 7.5 MB raw, 3.6 MB gzip, 3.2 MB brotli (most of it compiler-libs and the embedded
`.cmi` files); menhir 0.9 MB raw, 0.2 MB brotli; ocamllex 0.2 MB raw, 0.05 MB brotli.

## Findings

1. **js_of_ocaml bug: `caml_ensure_stack_capacity`.** The bytecode compiler emits this primitive for
   functions with large stack frames (Menhir's tables). js_of_ocaml compiles it as a no-op in whole
   programs (`parse_bytecode.ml`), but the runtime lacks it for code that the toplevel compiles at run
   time, so loading a Menhir parser fails with "The external function caml_ensure_stack_capacity is
   not available". Worked around with a stub (`toplevel/stubs.js`); worth reporting upstream.
2. **Each js_of_ocaml program installs globals** (`jsoo_runtime`, `jsoo_create_file`, ...). Running
   Menhir in the same worker as the toplevel replaced the toplevel's runtime; the worker saves the
   globals before running a tool and restores them after. A production version should run each tool
   in a scope of its own (or a nested worker).
3. **Tools in a worker.** Arguments go in through `globalThis.scriptArgs` (the runtime's QuickJS
   path, which does not touch the file system setup), input files through `globalThis.jsoo_fs_tmp`,
   outputs come back through `fsexport.js`, and `exit` through a `globalThis.quit` that throws. Each
   run re-evaluates the tool's script, so it starts with fresh state.
4. **Menhir's `Unix` use** is only on paths that `--table` does not take (`--infer` spawns `ocamlc`;
   `Unix.times` for statistics). js_of_ocaml links them as missing primitives.
5. **`int` is 32 bits** under js_of_ocaml (`max_int = 2147483647`), not 63 as in native OCaml. For a
   compiler course this shows (constant folding, hashing, overflow). wasm_of_ocaml has 31-bit ints.
   Neither matches native OCaml; to be documented, or checked against what CS4212 assignments need.
6. **Deep non-tail recursion** overflows at 2,000–10,000 frames in browser workers, where native
   OCaml 5 handles millions. Node takes `--stack-size` (and the grader can set it), browsers cannot.
   `List.map` and friends are tail-recursive modulo cons in OCaml 5 and handle a million elements.
   This is the main risk for compiler code that recurses over long lists or deep ASTs.
7. **Firefox compiles large modules slowly** (1.3 s for the generated parser).

## Not done yet

* wasm_of_ocaml: needs Binaryen (`brew install binaryen`). To measure: size, startup, stack depth
  (finding 6), and its 31-bit ints.
* Memory per tab.
