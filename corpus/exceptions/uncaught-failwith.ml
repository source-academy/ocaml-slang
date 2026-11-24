let () = print_endline "before"
let () = failwith "boom"
let () = print_endline "never printed"
