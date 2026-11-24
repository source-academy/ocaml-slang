(* Non-tail recursion to a depth that every browser handles; browsers overflow from about 2,000 frames
   of simple recursion (ocaml-slang#3), the grader's Node host can raise its stack. *)
let rec count n = if n = 0 then 0 else 1 + count (n - 1)
let rec build n = if n = 0 then [] else n :: build (n - 1)
let () = Printf.printf "%d\n" (count 1000)
;;
List.length (build 1500);;
