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
| OCaml version | **5.5.2**, the newest release; js_of_ocaml 6.5.0 supports OCaml below 5.7, and Menhir 20260209 builds with it. Upgrading is a deliberate change with its own issue. |
| js_of_ocaml or wasm_of_ocaml | **js_of_ocaml**, by the phase 0 measurements (ocaml-slang#3, #5). wasm_of_ocaml is no smaller (3.7 MB against 3.4 MB brotli), has no deeper recursion in browsers (5,000 frames in Chromium and Firefox), has 31-bit instead of 32-bit `int`, and in WebKit it overflows the stack while loading a generated parser. Memory is similar. Revisit when a new release changes this. |
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
* **Nothing outside ocaml-slang is specific to OCaml.** The backend, the frontend and the grader stay
  language-agnostic. A question names its languages and evaluators by their ids in the language
  directory, for the student, the frontend grader and the backend grader (backend#1387), and the
  backend passes them on unchanged. The grader runs whichever conductor evaluator the event names, in
  a Node host (grader#415), so there is no `ocamlGrader`: OCaml's evaluator only has to run under that
  host. The general changes that OCaml needs (#1387, frontend#4560, grader#415, and multi-file
  questions) are features for every language, tracked here as dependencies.

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
grader (AWS Lambda, Node, language-agnostic)
  └─ conductor host: runs the evaluator that the event names, e.g. OCamlEvaluator.js
```

* **Chunks.** A conductor chunk is a sequence of toplevel phrases, so the REPL keeps one toplevel
  session across chunks, as `ocaml` does.
* **Errors.** OCaml locations are 1-based lines and 0-based columns, which is what Source errors use.
  The columns (`pos_cnum - pos_bol`) count bytes of the UTF-8 source, whereas the editor counts
  characters (UTF-16 code units), so the evaluator converts each reported position by decoding
  the bytes of its line before it. Otherwise errors after a non-ASCII character in a string, comment
  or identifier are shown shifted. The corpus (#12) gets a test for it.
  Type errors and syntax errors stop the run. Warnings (non-exhaustive match, unused variable) are
  shown and don't stop it.
* **Loading.** As for Python §4 Typed: the bundle is published next to the evaluator on GitHub Pages,
  fetched when the evaluator starts, and started from a `blob:` URL. Fetching overlaps with the
  student typing.
* **Non-termination and stack overflow.** The frontend stops a runaway evaluator by terminating its
  worker. Deep non-tail recursion is limited by the JS stack: the phase 0 spike measured 2,000 (WebKit) to
  10,000 (Firefox) frames of simple recursion, against millions natively. The grader's Node host can
  raise its stack (`--stack-size`, 1,000,000 frames worked), the browser cannot.

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
  results print as decided above (output only for a run, toplevel style in the REPL). Each result
  and each flush of the program's output is a conductor output message, as in Python's evaluators, so
  a testcase that prints or evaluates its answer is read from the last output. Errors carry OCaml's
  message and its line and column (the column in editor characters, converted from OCaml's bytes).
  `read_line` finds the end of the input: the conductor's input is asynchronous, which a toplevel
  that runs synchronously cannot wait for (see "Later").
* Lazy loading from a `blob:` URL, and a Node host for the tests.
* Tests: a corpus of OCaml programs with expected output and errors, run in Node in CI.

### Phase 2: multi-file programs (about 1 week)

* Files come from the frontend's folder mode through the conductor's file requests. A request is
  for a path, and nothing lists a folder, so the evaluator finds the modules as `ocamldep` does: it
  reads the names of the modules that the open file refers to (compiler-libs' `Depend`), and requests
  `foo.ml`, `foo.mli` (and `Foo.ml`, `Foo.mli`) in the directory of the open file for each, then the
  same for the files it found. A name with no file there is not a module of the program: the
  Stdlib's, or unbound, which OCaml says. Files that the program does not refer to are never read.
* The open file is the entry, and it runs last (the frontend runs the active editor tab, and a
  share link opens on the tab that was active when it was made). It is not a module: nothing can
  refer to it, and a reference to a module of its name is to the Stdlib's. A program of one file
  runs as before.
* `.ml`/`.mli` pairs become modules (`module Foo : sig <foo.mli> end = struct <foo.ml> end`, with
  the locations of the files), compiled in dependency order; every file is checked before any runs.
  A file of the program shadows the Stdlib module of its name, as in dune. A cycle, an interface
  without an implementation, and a file of the program that does not parse are errors. After a run
  the modules stay in the session, so the REPL can use them.
* Errors in the open file have a line and column. Errors and warnings in another file name it
  (`File "lib.ml", line 2, characters 17-18:`) and have no line and column for the editor, which
  shows the open file (the frontend does not yet take a file with an error).
* Not yet: files in subdirectories (dune's `include_subdirs`).

### Phase 3: Menhir and ocamllex (about 2 weeks)

* `.mll` and `.mly` files in a program are run through ocamllex (`-ml`) and Menhir (`--table`) before
  compilation, on the worker's in-memory file system. The generated modules are compiled with the rest.
  A module `Foo` may be `foo.ml`, `foo.mll` or `foo.mly` (two of them are an error); a `.mly` also
  gives the interface `foo.mli`, which has the tokens. Discovery (phase 2) finds them by the same
  requests. The generated code's line directives (`# 5 "parser.mly"`) make OCaml's errors in semantic
  actions point at the `.mly`, with line and column.
* The two tools are built to JavaScript from their sources (`scripts/build-tools.sh`; the sources are
  fetched with `opam source` and not copied here: Menhir is GPL-2.0, its library MenhirLib has a
  linking exception, ocamllex is LGPL-2.1) and published next to the toplevel as `menhir.js` (1 MB,
  0.2 MB brotli) and `ocamllex.js` (0.2 MB). The evaluator fetches one when a program first needs it, and
  runs it in the same worker or Node process, once per generation: each js_of_ocaml program installs
  its runtime in globals, which are saved and put back so that the toplevel's survive. A small stub
  linked into the tools (`tools/jsoo-host.js`) hands what a tool writes to stdout and stderr, and the
  files it made, to the evaluator. What is generated is kept by the text of its source, so only a
  changed file is generated again. What a tool says although it succeeded (Menhir's warnings about
  conflicts) is sent as output; its failure is an error with its message.
* Menhir's errors and conflict warnings are reported with file, line, and column. The `.conflicts`
  report (`--explain`) is shown to the student.
* The generated `.ml` and `.mli` files are not shown in v1 (decision on #18): the conductor and
  frontend have no place for them besides the editor tabs and the REPL, and no other tabs for now.
  What a student sees of the tools is their messages, warnings and the `--explain` report.
* Tests: CS4212-style grammars with and without conflicts, and a lexer and parser for a toy language
  run end to end.

### Phase 4: autograding (about 2.5 weeks)

* **Testcase semantics**: a testcase is OCaml phrases run after the program (prepend, student
  program, postpend; or, for a question of several files, after the entry file), in the same toplevel
  session. Its result is the value of its last phrase, printed as decided above, and is compared with
  the expected answer.
* **In ocaml-slang**: the evaluator runs under the grader's Node host (no browser-only APIs on the
  path that runs programs, the bundle loadable from a file), tested in CI (#21).
* **General dependencies**, none specific to OCaml:
  * backend#1387: languages and evaluators by id, for the student, the frontend grader and the
    backend grader, sent to the frontend and to the grader.
  * frontend#4560: testcases run under the question's frontend grader language and evaluator, instead
    of the hardcoded table in `src/features/directory/testCaseLanguage.ts`, which knows only Python.
  * grader#415: the grader runs any conductor evaluator that the event names, in a Node host, with a
    timeout, instead of one grader per language.

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
* **Grader**: the event carries `files` and `entry`; the conductor host serves the files to the
  evaluator through file requests (grader#416).

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

* **Input from the user** (`read_line`, `input_line stdin`): the toplevel runs synchronously and the
  conductor's input request is asynchronous. Options: js_of_ocaml's effect support (`--effects=cps`) to
  suspend the program while the request is open (larger and slower code), or a blocking wait on a
  `SharedArrayBuffer` in a second worker.
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
phase 2, 1 week; phase 3, 2 weeks; phase 4, 2.5 weeks (1 for the general grading changes, 1.5 for
multi-file assessments across the backend, frontend and grader); phase 5, 3 days. The target is 2 December 2026,
so the work has to run in parallel: phase 4's backend, frontend and grader work starts now, against
the design above, alongside phases 0 to 3.

## Risks

* **Menhir in the browser.** Menhir may reach for something that js_of_ocaml or wasm_of_ocaml can't
  provide (process spawning, some `Unix` call) on some code path. `--infer` runs `ocamlc`, which is
  why we use `--table` and later the infer protocol. Phase 0 checks this first.
* **Stack depth.** Deep non-tail recursion may overflow the JS stack sooner than native OCaml. Compiler
  code recurses over ASTs and long lists. Measured in phase 0: 2,000 to 10,000 frames in browsers under js_of_ocaml, and no better under
  wasm_of_ocaml. Document it for students, keep tests of the assignments inside it, and grade under Node.
  Also, `int` is 32 bits under js_of_ocaml (`max_int` is 2147483647), not 63 as natively.
* **Bundle size and memory.** The toplevel with `compiler-libs`, `Stdlib`, MenhirLib, and Menhir is
  several MB. It is loaded lazily, and only by OCaml users.
* **Version drift.** The toplevel, js_of_ocaml, and Menhir are pinned together, and an upgrade is a
  deliberate change with the test corpus as its check.
* **Multi-file assessments** are the largest piece outside this repository: a new question and answer
  format in the backend, folder mode in the assessment workspace, and the grader. They are on the
  critical path to 2 December, and depend on backend#1367 being merged.
