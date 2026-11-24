#!/usr/bin/env bash
# Builds menhir and ocamllex to JavaScript: dist/menhir.js and dist/ocamllex.js, which the evaluator runs
# on the .mly and .mll files of a program. The sources are fetched, not copied here: Menhir is GPL-2.0
# (its library, MenhirLib, has a linking exception), and ocamllex is part of OCaml (LGPL-2.1).
# Needs the opam switch (see AGENTS.md), with the versions of ocaml-slang.opam.locked.
set -euo pipefail
cd "$(dirname "$0")/.."
MENHIR=menhir.20260209
OCAML=ocaml-compiler.5.5.2
WORK=.tools
mkdir -p "$WORK" dist

# Menhir: its stage 2 executable, built to JS as well, with the host stub.
if [ ! -d "$WORK/menhir" ]; then
  opam source "$MENHIR" --dir "$WORK/menhir"
  sed -i.bak 's/^  (name main)$/  (name main)\n  (modes exe js)\n  (js_of_ocaml (javascript_files jsoo-host.js))/' "$WORK/menhir/executable/stage2/dune"
  rm -f "$WORK/menhir/executable/stage2/dune.bak"
  grep -q jsoo-host.js "$WORK/menhir/executable/stage2/dune"
fi
cp tools/jsoo-host.js "$WORK/menhir/executable/stage2/"
(cd "$WORK/menhir" && dune build --root . --profile release ./executable/stage2/main.bc.js)
cp -f "$WORK/menhir/_build/default/executable/stage2/main.bc.js" dist/menhir.js

# ocamllex: the sources of OCaml's lex/, as a program of its own.
if [ ! -d "$WORK/ocamllex" ]; then
  opam source "$OCAML" --dir "$WORK/ocaml-src"
  mkdir -p "$WORK/ocamllex"
  cp "$WORK"/ocaml-src/lex/*.{ml,mli,mll,mly} "$WORK/ocamllex/"
  echo '(lang dune 3.25)' > "$WORK/ocamllex/dune-project"
  printf '(ocamlyacc parser)\n(ocamllex lexer)\n(executable\n (name main)\n (modes byte exe js)\n (js_of_ocaml (javascript_files jsoo-host.js)))\n' > "$WORK/ocamllex/dune"
fi
cp tools/jsoo-host.js "$WORK/ocamllex/"
(cd "$WORK/ocamllex" && dune build --root . --profile release ./main.bc.js)
cp -f "$WORK/ocamllex/_build/default/main.bc.js" dist/ocamllex.js
chmod u+w dist/menhir.js dist/ocamllex.js
echo "built dist/menhir.js ($(wc -c < dist/menhir.js) bytes) and dist/ocamllex.js ($(wc -c < dist/ocamllex.js) bytes)"
