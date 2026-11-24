let first = function Some x -> x
let () = print_endline "the program still runs"
let () = Printf.printf "%d\n" (first (Some 4))
