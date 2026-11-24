#!/usr/bin/env bash
# Builds the OCaml toplevel to JavaScript and copies it to dist/ocaml-toplevel.js.
# Needs the opam switch (see CLAUDE.md): OCaml 5.5.2, js_of_ocaml 6.5.0, menhir.
set -euo pipefail
cd "$(dirname "$0")/.."
dune build --root . --profile release ./ocaml/toplevel/toplevel.bc.js
mkdir -p dist
cp -f _build/default/ocaml/toplevel/toplevel.bc.js dist/ocaml-toplevel.js
chmod u+w dist/ocaml-toplevel.js
echo "built dist/ocaml-toplevel.js ($(wc -c < dist/ocaml-toplevel.js) bytes)"
