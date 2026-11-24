module type ORDERED = sig
  type t
  val compare : t -> t -> int
end
module MakeSortedList (O : ORDERED) = struct
  let sort = List.sort O.compare
  let max_of l = List.fold_left (fun a b -> if O.compare a b >= 0 then a else b) (List.hd l) l
end
module IntSorted = MakeSortedList (Int)
module StringSorted = MakeSortedList (String)
module ByLength = MakeSortedList (struct type t = string let compare a b = compare (String.length a) (String.length b) end)
let () = print_endline (String.concat " " (List.map string_of_int (IntSorted.sort [3; 1; 2])))
let () = print_endline (String.concat " " (StringSorted.sort ["pear"; "apple"; "fig"]))
let () = print_endline (String.concat " " (ByLength.sort ["pear"; "apple"; "fig"]))
let () = print_endline (ByLength.max_of ["pear"; "apple"; "fig"])
module IntSet = Set.Make (Int)
module StringMap = Map.Make (String)
let () = print_endline (String.concat " " (List.map string_of_int (IntSet.elements (IntSet.of_list [5; 1; 3; 1; 5]))))
let m = StringMap.(empty |> add "b" 2 |> add "a" 1 |> add "c" 3)
let () = StringMap.iter (fun k v -> Printf.printf "%s=%d " k v) m; print_newline ()
;;
StringMap.cardinal m;;
