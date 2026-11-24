(* js_of_ocaml's int has 32 bits, not 63 as native OCaml (ocaml-slang#3): this documents it. If a new
   js_of_ocaml or a move to wasm_of_ocaml changes these numbers, this test shows it. *)
let () = Printf.printf "%d %d\n" max_int min_int
let () = Printf.printf "%d\n" (max_int + 1)
let () = Printf.printf "%d\n" (1 lsl 31)
let () = Printf.printf "%d\n" (46341 * 46341)
;;
Int32.to_int Int32.max_int;;
