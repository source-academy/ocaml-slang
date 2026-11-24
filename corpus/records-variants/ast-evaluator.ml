(* The shape of a CS4212 exercise: an abstract syntax tree, an evaluator and a printer. *)
type expr =
  | Num of int
  | Var of string
  | Add of expr * expr
  | Mul of expr * expr
  | Let of string * expr * expr
let rec eval env = function
  | Num n -> n
  | Var x -> (try List.assoc x env with Not_found -> failwith ("unbound " ^ x))
  | Add (a, b) -> eval env a + eval env b
  | Mul (a, b) -> eval env a * eval env b
  | Let (x, e, body) -> eval ((x, eval env e) :: env) body
let rec show = function
  | Num n -> string_of_int n
  | Var x -> x
  | Add (a, b) -> "(" ^ show a ^ " + " ^ show b ^ ")"
  | Mul (a, b) -> show a ^ " * " ^ show b
  | Let (x, e, b) -> "let " ^ x ^ " = " ^ show e ^ " in " ^ show b
let prog = Let ("x", Add (Num 1, Num 2), Mul (Var "x", Add (Var "x", Num 4)))
let () = print_endline (show prog)
let () = Printf.printf "= %d\n" (eval [] prog)
let () = print_endline (try string_of_int (eval [] (Var "y")) with Failure m -> m)
;;
eval [] prog;;
