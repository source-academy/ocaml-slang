(* The toplevel runs synchronously: reading from stdin finds the end of the input (ocaml-slang#36). *)
let () = print_endline "reading"
let _ = read_line ()
