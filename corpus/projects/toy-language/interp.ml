(* The driver: parse a program and run it. *)
open Ast

type value = VInt of int | VBool of bool

let rec eval env = function
  | Int n -> VInt n
  | Bool b -> VBool b
  | Var x -> (try Hashtbl.find env x with Not_found -> failwith ("unbound " ^ x))
  | Neg e -> (match eval env e with VInt n -> VInt (-n) | _ -> failwith "neg")
  | Not e -> (match eval env e with VBool b -> VBool (not b) | _ -> failwith "not")
  | Binop (op, a, b) ->
    (match op, eval env a, eval env b with
     | Add, VInt x, VInt y -> VInt (x + y)
     | Sub, VInt x, VInt y -> VInt (x - y)
     | Mul, VInt x, VInt y -> VInt (x * y)
     | Div, VInt x, VInt y -> VInt (x / y)
     | Lt, VInt x, VInt y -> VBool (x < y)
     | Eq, x, y -> VBool (x = y)
     | And, VBool x, VBool y -> VBool (x && y)
     | Or, VBool x, VBool y -> VBool (x || y)
     | _ -> failwith "type error")

let rec exec env = function
  | Assign (x, e) -> Hashtbl.replace env x (eval env e)
  | If (c, t, f) -> (match eval env c with VBool true -> List.iter (exec env) t | _ -> List.iter (exec env) f)
  | While (c, b) as w -> (match eval env c with VBool true -> List.iter (exec env) b; exec env w | _ -> ())
  | Print e -> (match eval env e with VInt n -> print_int n | VBool b -> print_string (string_of_bool b)); print_newline ()

let run (src : string) =
  let lexbuf = Lexing.from_string src in
  let prog =
    try Parser.program Lexer.token lexbuf
    with Parser.Error ->
      let p = Lexing.lexeme_start_p lexbuf in
      failwith (Printf.sprintf "syntax error at line %d, column %d" p.pos_lnum (p.pos_cnum - p.pos_bol))
  in
  List.iter (exec (Hashtbl.create 16)) prog
