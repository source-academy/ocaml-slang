(* Corners of the language that the toplevel should handle without special support. *)
type _ term = Int : int -> int term | Bool : bool -> bool term | If : bool term * 'a term * 'a term -> 'a term | Add : int term * int term -> int term
let rec eval : type a. a term -> a = function
  | Int n -> n
  | Bool b -> b
  | If (c, t, e) -> if eval c then eval t else eval e
  | Add (a, b) -> eval a + eval b
let () = Printf.printf "%d\n" (eval (If (Bool true, Add (Int 1, Int 2), Int 0)))
class counter = object
  val mutable n = 0
  method incr = n <- n + 1
  method get = n
end
let c = new counter
let () = c#incr; c#incr
;;
c#get;;
