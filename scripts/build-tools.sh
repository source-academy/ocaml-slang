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

# The work directories are named by the versions, so that sources of an older pin are not reused.
MENHIR_DIR="$WORK/$MENHIR"
OCAMLLEX_DIR="$WORK/ocamllex-$OCAML"

# Menhir: its stage 2 executable, built to JS as well, with the host stub.
if [ ! -d "$MENHIR_DIR" ]; then
  opam source "$MENHIR" --dir "$MENHIR_DIR"
  sed -i.bak 's/^  (name main)$/  (name main)\n  (modes exe js)\n  (js_of_ocaml (javascript_files jsoo-host.js))/' "$MENHIR_DIR/executable/stage2/dune"
  rm -f "$MENHIR_DIR/executable/stage2/dune.bak"
  grep -q jsoo-host.js "$MENHIR_DIR/executable/stage2/dune"
fi
cp tools/jsoo-host.js "$MENHIR_DIR/executable/stage2/"
(cd "$MENHIR_DIR" && dune build --root . --profile release ./executable/stage2/main.bc.js)
cp -f "$MENHIR_DIR/_build/default/executable/stage2/main.bc.js" dist/menhir.js

# ocamllex: the sources of OCaml's lex/, as a program of its own.
if [ ! -d "$OCAMLLEX_DIR" ]; then
  SRC="$WORK/$OCAML"
  rm -rf "$SRC"
  opam source "$OCAML" --dir "$SRC"
  mkdir -p "$OCAMLLEX_DIR"
  cp "$SRC"/lex/*.{ml,mli,mll,mly} "$OCAMLLEX_DIR/"
  echo '(lang dune 3.25)' > "$OCAMLLEX_DIR/dune-project"
  printf '(ocamlyacc parser)\n(ocamllex lexer)\n(executable\n (name main)\n (modes byte exe js)\n (js_of_ocaml (javascript_files jsoo-host.js)))\n' > "$OCAMLLEX_DIR/dune"
fi
cp tools/jsoo-host.js "$OCAMLLEX_DIR/"
(cd "$OCAMLLEX_DIR" && dune build --root . --profile release ./main.bc.js)
cp -f "$OCAMLLEX_DIR/_build/default/main.bc.js" dist/ocamllex.js
chmod u+w dist/menhir.js dist/ocamllex.js
echo "built dist/menhir.js ($(wc -c < dist/menhir.js) bytes) and dist/ocamllex.js ($(wc -c < dist/ocamllex.js) bytes)"
