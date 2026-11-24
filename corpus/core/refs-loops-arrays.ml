let counter = ref 0
let () = for i = 1 to 10 do counter := !counter + i done
let () = Printf.printf "%d\n" !counter
let () = let i = ref 0 in while !i < 3 do print_string (string_of_int !i ^ " "); incr i done; print_newline ()
let a = Array.make 5 0
let () = Array.iteri (fun i _ -> a.(i) <- i * 10) a
let () = Array.sort (fun x y -> compare y x) a
let () = Array.iter (fun x -> Printf.printf "%d " x) a; print_newline ()
let () = Printf.printf "%d %d\n" (Array.length a) (Array.fold_left ( + ) 0 a)
let m = Array.make_matrix 2 3 1
;;
m;;
