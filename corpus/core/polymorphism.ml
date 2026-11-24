let id x = x
let swap (a, b) = (b, a)
let rec length_of = function [] -> 0 | _ :: t -> 1 + length_of t
let pair_up f x = (f x, f x)
let () = Printf.printf "%d %s\n" (id 3) (id "three")
let () = let a, b = swap (1, "x") in Printf.printf "%s %d\n" a b
let () = Printf.printf "%d %d\n" (length_of [1; 2; 3]) (length_of ["a"])
let () = let a, b = pair_up string_of_int 5 in print_endline (a ^ b)
let () = Printf.printf "%b %b %b\n" ([1; 2] = [1; 2]) (compare (1, "a") (1, "b") < 0) (max "a" "b" = "b")
;;
swap;;
