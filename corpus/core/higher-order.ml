let compose f g x = f (g x)
let add x y = x + y
let incr_all = List.map (add 1)
let rec apply_n f n x = if n = 0 then x else apply_n f (n - 1) (f x)
let scale ~by x = x * by
let greet ?(greeting = "Hello") name = greeting ^ ", " ^ name
let () = Printf.printf "%d\n" (compose (( * ) 2) (add 3) 4)
let () = print_endline (String.concat " " (List.map string_of_int (incr_all [1; 2; 3])))
let () = Printf.printf "%d\n" (apply_n (fun x -> x * 2) 10 1)
let () = Printf.printf "%d %s %s\n" (scale ~by:3 5) (greet "OCaml") (greet ~greeting:"Hi" "you")
let () = print_endline (string_of_int ((fun x -> x + 1) 1) ^ string_of_int (List.fold_right (fun _ acc -> acc + 1) [1; 2; 3] 0))
;;
(fun f -> f 20) (add 1);;
