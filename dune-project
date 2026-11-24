(lang dune 3.25)

(name ocaml-slang)

(generate_opam_files true)

(license Apache-2.0)

(authors "Source Academy")

(maintainers "Source Academy")

(source
 (github source-academy/ocaml-slang))

(package
 (name ocaml-slang)
 (allow_empty)
 (synopsis "OCaml for Source Academy: the OCaml toplevel compiled to JavaScript")
 (depends
  (ocaml
   (= 5.5.2))
  (dune
   (>= 3.25))
  (js_of_ocaml
   (= 6.5.0))
  (js_of_ocaml-compiler
   (= 6.5.0))
  (js_of_ocaml-ppx
   (= 6.5.0))
  (js_of_ocaml-toplevel
   (= 6.5.0))
  (menhir
   (= 20260209))
  (menhirLib
   (= 20260209))))
