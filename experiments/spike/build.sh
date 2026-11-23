#!/usr/bin/env bash
# Spike build: the toplevel (js_of_ocaml), and menhir and ocamllex compiled to JS.
# Sources of Menhir (GPL-2.0) and of ocamllex (part of OCaml, LGPL-2.1) are fetched, not vendored.
# Needs the project's opam switch (OCaml 5.5.2) with dune, js_of_ocaml(-toplevel,-ppx) 6.5.0, menhir and menhirLib.
set -euo pipefail
cd "$(dirname "$0")"
eval "$(opam env --switch=../.. --set-switch)"
PROFILE=${PROFILE:-release}
mkdir -p vendor
if [ ! -d vendor/menhir ]; then
  opam source menhir.20260209 --dir vendor/menhir
  # Build menhir's main program to JS too, with a stub that lets the host read the files it writes.
  sed -i.bak 's/^  (name main)$/  (name main)\n  (modes exe js)\n  (js_of_ocaml (javascript_files fsexport.js))/' vendor/menhir/executable/stage2/dune
fi
cp tools/fsexport.js vendor/menhir/executable/stage2/
if [ ! -d vendor/ocamllex ]; then
  opam source ocaml-compiler.5.5.2 --dir vendor/ocaml-src
  mkdir -p vendor/ocamllex
  cp vendor/ocaml-src/lex/*.{ml,mli,mll,mly} vendor/ocaml-src/LICENSE vendor/ocamllex/
  echo '(lang dune 3.25)' > vendor/ocamllex/dune-project
  printf '(ocamlyacc parser)\n(ocamllex lexer)\n(executable\n (name main)\n (modes byte exe js)\n (js_of_ocaml (javascript_files fsexport.js)))\n' > vendor/ocamllex/dune
fi
cp tools/fsexport.js vendor/ocamllex/
dune build --profile "$PROFILE" ./toplevel/toplevel.bc.js
(cd vendor/menhir && dune build --root . --profile "$PROFILE" ./executable/stage2/main.bc.js)
(cd vendor/ocamllex && dune build --root . --profile "$PROFILE" ./main.bc.js)
echo "built: _build/default/toplevel/toplevel.bc.js vendor/menhir/_build/default/executable/stage2/main.bc.js vendor/ocamllex/_build/default/main.bc.js"
