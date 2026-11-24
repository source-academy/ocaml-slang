let () = Printf.printf "%d\n" (List.length [1; 2; 3])
let () = print_endline (String.concat "," (List.map string_of_int (List.rev [1; 2; 3])))
