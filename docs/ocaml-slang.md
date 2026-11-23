# OCaml in Source Academy

Status: project plan. GitHub project: [ocaml-slang](https://github.com/orgs/source-academy/projects/63).

## Goal

Add **OCaml** as a Source Academy language, first for **CS4212** (Compiler Design, NUS). Students
write multi-file OCaml programs in the playground and in assessments: an AST, a lexer
(`lexer.mll`, ocamllex), a parser (`parser.mly`, Menhir), and the middle and back end of a compiler.
Their submissions are autograded.

What CS4212 needs, and what decides the approach:

* **Full OCaml**: modules, signatures, functors, records, variants, exceptions, `ref`, `Printf`, and
  the standard library. A compiler course goes well beyond core ML.
* **A robust type checker** with OCaml's own type errors and exhaustiveness warnings.
* **Menhir and ocamllex in the browser.** The course teaches LL(1), LR, and "parsing using Menhir",
  so students should see real Menhir output: conflicts, `--explain`, and the generated parser.
* **Autograding** of submissions, as for the other Source Academy languages.

Performance is not critical.

## Approach: run the real OCaml front end, don't write one

The evaluator is OCaml's own toplevel (parser, type checker, and bytecode compiler from
`compiler-libs`), compiled to the browser with js_of_ocaml or wasm_of_ocaml, and run in a
[conductor](https://github.com/source-academy/conductor) evaluator worker. This is how the browser
OCaml playgrounds, Learn-OCaml, and [x-ocaml](https://github.com/art-w/x-ocaml) work. Menhir and
ocamllex are ordinary OCaml programs, so they are compiled the same way and run in the same worker.

We don't hand-write a parser, type checker, or evaluator in TypeScript for v1. The alternative, a
py-slang-style implementation of core ML, was estimated at 1 to 1.5 times the effort of py-slang
without modules, and at 2 times or more with a module system. It would still not run
Menhir-generated code: Menhir's `--table` back-end needs functors (MenhirLib), and its code back-end
needs OCaml type inference. This is the same choice that Python §4 Typed made, where the type checker
is an embedded browser build of pyright
([py-slang docs/typed-python-4.md](https://github.com/source-academy/py-slang/blob/main/docs/typed-python-4.md)).
Several of its solutions carry over: lazy loading from a `blob:` URL, worker hosting in Node for the
tests and the grader, and errors reported with line and column through `conductor.sendError`.

A TypeScript evaluator for a core-ML sublanguage, with the CSE machine, is a later phase (see
"Later"). It would take its input from the real type checker (a lowered Typedtree), so the type
checker is never ours to maintain.

## Decisions

| Question | Decision |
|---|---|
| Evaluator | The real OCaml toplevel in a conductor worker. CSE machine and sublanguages come later. |
| OCaml version | Pinned. The newest OCaml 5.x release that js_of_ocaml, wasm_of_ocaml, Menhir, and the CS4212 toolchain all support, chosen in phase 0. (js_of_ocaml 6.4 supports OCaml 5.5.) Upgrading is a deliberate change with its own issue. |
| js_of_ocaml or wasm_of_ocaml | Decided in phase 0 by measurement: bundle size, startup, stack depth for deep non-tail recursion, and effects. Since 6.4 the toplevel runs on the Wasm backend too. |
| Repository | `source-academy/ocaml-slang`, public: the OCaml build (dune), the TypeScript conductor wrapper, tests, and deployment of the evaluators to GitHub Pages. |
| Libraries | `Stdlib` and MenhirLib are preloaded. No `Unix` and no `Thread`. Others (`Str`) are added on request. |
| Menhir back-end | `--table` with the preloaded MenhirLib by default. The code back-end needs Menhir's `--infer-write-query`/`--infer-read-reply` protocol answered by the in-browser type checker (a later phase). |
| Autograding | Part of v1, including answers of several files. |
| Error messages | OCaml's own errors and warnings, unchanged. For a compiler course these are the right messages to learn. |

### Decided with the CS4212 teaching team (#6)

* **What a run shows.** A run of the editor's program shows only what the program prints, plus the
  value of its last phrase if that phrase is an expression (`fact 5` or `fact 5;;`, not
  `let _ = fact 5`), printed by OCaml's toplevel printer without its type: `120`, `"abc"`, `[1; 2]`.
  A phrase typed in the REPL is shown toplevel style, as `ocaml` shows it: `- : int = 6`,
  `val fact : int -> int = <fun>`. The *result* of a run, which testcases compare against, is that
  last value, so a testcase `fact 5` with answer `120` passes.
* **Multi-file programs: the entry point is the file open in the editor.** A run compiles the files
  of the folder that the open file depends on, directly or not (`.ml` with its `.mli`, and the `.ml`
  files generated from `.mll` and `.mly`), as modules in dependency order, and runs the open file last,
  as `dune exec` would with it as the executable. There is no configuration file.
* **Multi-file answers in assessments are part of v1.** A CS4212 question can have several files
  (lexer, parser, AST, driver), some given and fixed, some for the student to write. This is a
  Source Academy feature that is not specific to OCaml (Python's folder imports can use it too), and it
  needs work in the backend, the frontend and the grader: see "Multi-file assessments" under phase 4.
* **The backend tells the grader the language.** The grader dispatches on the event's `language`, as
  it does for `javascript`. backend#1367 (conductor assessments, open) already sends the library's
  `(language, evaluator)` pair to the grader, so OCaml questions use a conductor library with
  `language: "ocaml"`; the grader does not depend on the order of the language directory.

## Architecture

```
frontend (language-agnostic)
  └─ evaluator worker: OCamlEvaluator.js              (blob: URL, created by the frontend)
       ├─ TypeScript conductor wrapper (chunks, output, errors, files)
       └─ OCaml toplevel (js_of_ocaml or wasm_of_ocaml, lazily fetched, several MB)
            ├─ compiler-libs: parse, type check, compile, run each phrase
            ├─ preloaded: Stdlib, MenhirLib (.cmi files and code)
            ├─ menhir and ocamllex, compiled to JS/Wasm, run on the in-memory file system
            └─ in-memory file system: the program's files, generated .ml files, Menhir reports
grader (AWS Lambda, Node)
  └─ ocamlGrader: the same toplevel, hosted in Node worker_threads
```

* **Chunks.** A conductor chunk is a sequence of toplevel phrases, so the REPL keeps one toplevel
  session across chunks, as `ocaml` does.
* **Errors.** OCaml locations are 1-based lines and 0-based columns, which is what Source errors use.
  Type errors and syntax errors stop the run. Warnings (non-exhaustive match, unused variable) are
  shown and don't stop it.
* **Loading.** As for Python §4 Typed: the bundle is published next to the evaluator on GitHub Pages,
  fetched when the evaluator starts, and started from a `blob:` URL. Fetching overlaps with the
  student typing.
* **Non-termination and stack overflow.** The frontend stops a runaway evaluator by terminating its
  worker. Deep non-tail recursion is limited by the JS stack under js_of_ocaml, which is one of the
  phase 0 measurements.

## Phases

### Phase 0: spike and decisions (about 1 week)

A go/no-go spike, kept in `experiments/spike/`:

1. Build the OCaml toplevel with js_of_ocaml and with wasm_of_ocaml for the chosen OCaml 5.x
   version, with MenhirLib preloaded. Run it in a web worker (Chromium, Firefox, WebKit) and under
   Node.
2. Build `menhir` and `ocamllex` the same way. In the worker, run `menhir --table --explain` and
   `ocamllex -ml` on a typical CS4212 grammar and lexer, load the generated `.ml` files with the
   student's AST and driver into the toplevel, and parse a program.
3. Measure bundle size (raw, gzip, brotli), worker startup, first and later phrase times, memory, and
   the deepest non-tail recursion (`List.map` on a long list, a recursive descent over a deep
   expression).

**Go** if step 2 works end to end in all three browsers. Record the numbers and the
js_of_ocaml/wasm_of_ocaml and version decisions in this document. (The questions for the CS4212
teaching team are settled: see "Decided with the CS4212 teaching team".)

### Phase 1: repository and the OCaml evaluator (about 2 weeks)

* Repository setup: dune for the OCaml side, TypeScript and rollup for the conductor wrapper, CI
  (build, tests in Node, lint), and deployment of `OCamlEvaluator.js` and the toplevel bundle to
  GitHub Pages.
* The conductor evaluator: chunks run as toplevel phrases in one session; output from
  `print_string`, `Printf`, and friends goes to the REPL; errors and warnings carry line and column;
  results print as decided above (output only for a run, toplevel style in the REPL); `read_line` maps to conductor input if the conductor supports
  it.
* Lazy loading from a `blob:` URL, and a Node host for the tests.
* Tests: a corpus of OCaml programs with expected output and errors, run in Node in CI.

### Phase 2: multi-file programs (about 1 week)

* Files come from the frontend's folder mode through the conductor's file requests.
* `.ml`/`.mli` pairs become modules, compiled in dependency order. Cycles are reported as errors.
* Errors name the file as well as the line and column.

### Phase 3: Menhir and ocamllex (about 2 weeks)

* `.mll` and `.mly` files in a program are run through ocamllex and Menhir (`--table`) before
  compilation, on the worker's in-memory file system. The generated modules are compiled with the rest.
* Menhir's errors and conflict warnings are reported with file, line, and column. The `.conflicts`
  report (`--explain`) is shown to the student.
* The generated `.ml` files can be viewed, since students should be able to read what Menhir
  produced.
* Tests: CS4212-style grammars with and without conflicts, and a lexer and parser for a toy language
  run end to end.

### Phase 4: autograding (about 2.5 weeks)

* **Testcase semantics**: a testcase is OCaml phrases run after the program (prepend, student
  program, postpend; or, for a question of several files, after the entry file), in the same toplevel
  session. Its result is the value of its last phrase, printed as decided above, and is compared with
  the expected answer.
* **Frontend**: testcase grading currently always runs under Python §4
  (`frontend/src/features/directory/testCaseLanguage.ts`). It must use the assessment's language
  (frontend#4560).
* **Grader** (`source-academy/grader`): an `ocamlGrader` next to `pythonGrader` and `sourceGrader`,
  running the toplevel in Node `worker_threads` with a timeout, dispatched on `language: "ocaml"`
  (grader#415).
* **Backend**: OCaml questions use a conductor library, whose `(language, evaluator)` the autograder
  sends to the grader (backend#1367, backend#1388).

#### Multi-file assessments

Today a programming question has one template, prepend and postpend, and an answer is one string
(`ProgrammingAnswer.code`); the assessment workspace uses only the first editor tab (its code has
TODOs saying that folder mode needs a refactoring). The design, *proposed* and settled in #22:

* **Question**: an optional list of `files`, each with a `path`, its `content`, and whether the
  student may edit it. Fixed files (a given AST or driver) play the part of prepend and postpend;
  editable files are the template. An `entry` path names the file that runs (and after which the
  testcases run). A question has `files` or the single template, prepend and postpend, not both, so
  existing questions are unchanged.
* **Answer**: `files`, a map from path to content, of the editable files only, next to `code`
  (one or the other, like the format check of backend#1367).
* **Assessment format**: the XML of a question (`xml_parser.ex`) gets a way to give the files.
* **Frontend**: the assessment workspace in folder mode with the question's files (fixed ones
  read-only); saving and submitting `files`; the grading view and the editing workspace showing them;
  testcase runs giving the files to the evaluator through the conductor's file requests, as the
  playground's folder mode does.
* **Grader**: the event carries `files` and `entry`; `ocamlGrader` runs them as the evaluator does.

Not OCaml-specific: Python with folder imports can use the same questions.

### Phase 5: language directory, documentation, release (about 3 days)

* language-directory: `src/languages/ocaml/` with the language "OCaml" and its evaluator, and
  OCaml syntax highlighting (Ace has an OCaml mode) through `editorConfig` or the frontend.
* Documentation: what is supported (the version, `Stdlib`, MenhirLib, ocamllex, Menhir and its
  options), what is not (`Unix`, threads, Source Academy modules), and how multi-file programs and
  generated parsers work.
* Release, in order: ocaml-slang deployed, then language-directory (merge, bump, tag), then the
  frontend's bump of the directory, then the grader and backend.

### Later (not in v1)

* **Menhir's code back-end**: answer `--infer-write-query`/`--infer-read-reply` with the in-browser
  type checker. Semantic actions are then type-checked against the student's AST types, with better
  errors.
* **Teaching tools for LR parsing**: an interactive viewer for the LR(1) automaton (`--dump`),
  `--interpret` for trying token sentences without writing OCaml, and `--compile-errors` with
  `.messages` files for syntax-error reporting. These are good student projects.
* **An LL(1) tool**: FIRST and FOLLOW sets and the LL(1) table for a grammar, with conflicts
  highlighted. Menhir doesn't cover LL(1). This is a self-contained FYP or UROP project.
* **Merlin in the browser** (as in x-ocaml and merlin-js): types on hover, completion, and errors
  while typing. This needs a conductor feature that sends diagnostics without running the program,
  shared with Python §4 Typed's "squiggles while typing".
* **Core-ML sublanguages with the CSE machine**: a TypeScript evaluator over a lowered Typedtree,
  validated by a pass over the Parsetree that rejects constructs outside each sublanguage.
* **Source Academy modules** (runes and others) from OCaml, using the language-neutral module type
  descriptions (modules#997).

## Effort

About **10 weeks** of work for one experienced developer: phase 0, 1 week; phase 1, 2 weeks;
phase 2, 1 week; phase 3, 2 weeks; phase 4, 2.5 weeks (1 for the OCaml grading, 1.5 for multi-file
assessments across the backend, frontend and grader); phase 5, 3 days. The target is 2 December 2026,
so the work has to run in parallel: phase 4's backend, frontend and grader work starts now, against
the design above, alongside phases 0 to 3.

## Risks

* **Menhir in the browser.** Menhir may reach for something that js_of_ocaml or wasm_of_ocaml can't
  provide (process spawning, some `Unix` call) on some code path. `--infer` runs `ocamlc`, which is
  why we use `--table` and later the infer protocol. Phase 0 checks this first.
* **Stack depth.** Deep non-tail recursion may overflow the JS stack sooner than native OCaml. Compiler
  code recurses over ASTs and long lists. Measure in phase 0, and prefer wasm_of_ocaml if it is better.
* **Bundle size and memory.** The toplevel with `compiler-libs`, `Stdlib`, MenhirLib, and Menhir is
  several MB. It is loaded lazily, and only by OCaml users.
* **Version drift.** The toplevel, js_of_ocaml, and Menhir are pinned together, and an upgrade is a
  deliberate change with the test corpus as its check.
* **Multi-file assessments** are the largest piece outside this repository: a new question and answer
  format in the backend, folder mode in the assessment workspace, and the grader. They are on the
  critical path to 2 December, and depend on backend#1367 being merged.
