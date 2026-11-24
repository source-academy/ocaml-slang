exception Oops of int * string
let () = print_endline "start"
let _ = raise (Oops (3, "x"))
