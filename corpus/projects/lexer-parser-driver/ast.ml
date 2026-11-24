type t = Num of int | Add of t * t | Mul of t * t
let rec eval = function Num n -> n | Add (a, b) -> eval a + eval b | Mul (a, b) -> eval a * eval b
let rec show = function
  | Num n -> string_of_int n
  | Add (a, b) -> "(" ^ show a ^ " + " ^ show b ^ ")"
  | Mul (a, b) -> show a ^ " * " ^ show b
