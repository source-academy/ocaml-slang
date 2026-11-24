(* A small imperative language, of the kind CS4212 assignments use. *)
type binop = Add | Sub | Mul | Div | Lt | Eq | And | Or

type expr =
  | Int of int
  | Bool of bool
  | Var of string
  | Binop of binop * expr * expr
  | Neg of expr
  | Not of expr

type stmt =
  | Assign of string * expr
  | If of expr * stmt list * stmt list
  | While of expr * stmt list
  | Print of expr

type program = stmt list
