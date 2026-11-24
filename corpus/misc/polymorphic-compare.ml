type t = A | B of int | C of string list
let () = Printf.printf "%b %b %b\n" (A < B 0) (B 1 < B 2) (C ["a"] = C ["a"])
let () = Printf.printf "%d %d\n" (compare [1; 2; 3] [1; 2; 4]) (compare "z" "a")
let () = Printf.printf "%b\n" (List.sort compare [C []; B 3; A; B 1] = [A; B 1; B 3; C []])
;;
List.sort compare [3.5; 1.5; 2.5];;
