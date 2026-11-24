let xs = [5; 3; 8; 1; 9; 2]
let () = print_endline (String.concat "," (List.map string_of_int (List.sort compare xs)))
let () = Printf.printf "%d %d\n" (List.length xs) (List.fold_left ( + ) 0 xs)
let () = List.iter (fun x -> Printf.printf "<%d>" x) (List.filter (fun x -> x mod 2 = 1) xs); print_newline ()
let () = print_endline (String.concat " " (List.map string_of_int (List.rev ([1; 2] @ [3; 4]))))
let () = Printf.printf "%s\n" (match List.assoc_opt "b" [("a", 1); ("b", 2)] with Some n -> string_of_int n | None -> "none")
let () = Printf.printf "%b %b\n" (List.mem 3 xs) (List.exists (fun x -> x > 8) xs)
;;
List.init 5 (fun i -> i * i);;
