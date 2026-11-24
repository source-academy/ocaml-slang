type token = NUM of int | PLUS | TIMES | LPAREN | RPAREN
exception Error of string
let tokens s =
  let n = String.length s in
  let rec go i acc =
    if i >= n then List.rev acc
    else match s.[i] with
      | ' ' -> go (i + 1) acc
      | '+' -> go (i + 1) (PLUS :: acc)
      | '*' -> go (i + 1) (TIMES :: acc)
      | '(' -> go (i + 1) (LPAREN :: acc)
      | ')' -> go (i + 1) (RPAREN :: acc)
      | '0' .. '9' as c -> go (i + 1) (NUM (Char.code c - 48) :: acc)
      | c -> raise (Error (Printf.sprintf "unexpected %c" c))
  in
  try Ok (go 0 []) with Error m -> Error m
