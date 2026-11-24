type shape = Circle of float | Rect of float * float | Square of float | Unit_shape
let area = function
  | Circle r -> 3.14159 *. r *. r
  | Rect (w, h) -> w *. h
  | Square s -> s *. s
  | Unit_shape -> 1.0
let () = List.iter (fun s -> Printf.printf "%.2f\n" (area s)) [Circle 1.0; Rect (2.0, 3.0); Square 4.0; Unit_shape]
type 'a tree = Leaf | Node of 'a tree * 'a * 'a tree
let rec insert x = function
  | Leaf -> Node (Leaf, x, Leaf)
  | Node (l, v, r) as t -> if x < v then Node (insert x l, v, r) else if x > v then Node (l, v, insert x r) else t
let rec to_list = function Leaf -> [] | Node (l, v, r) -> to_list l @ [v] @ to_list r
let rec depth = function Leaf -> 0 | Node (l, _, r) -> 1 + max (depth l) (depth r)
let t = List.fold_left (fun t x -> insert x t) Leaf [5; 2; 8; 1; 9; 3; 5]
let () = print_endline (String.concat " " (List.map string_of_int (to_list t)))
let () = Printf.printf "depth %d\n" (depth t)
;;
Node (Leaf, 1, Node (Leaf, 2, Leaf));;
