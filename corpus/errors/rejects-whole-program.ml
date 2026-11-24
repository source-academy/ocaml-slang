(* A type error anywhere rejects the program: nothing runs, so nothing is printed. *)
let () = print_endline "printed?"
let () = print_endline 42
