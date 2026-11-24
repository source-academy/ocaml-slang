let rec expr = function
  | toks ->
      let t, rest = term toks in
      (match rest with Lexer.PLUS :: r -> let e, r = expr r in (Ast.Add (t, e), r) | _ -> (t, rest))
and term toks =
  let f, rest = factor toks in
  match rest with Lexer.TIMES :: r -> let t, r = term r in (Ast.Mul (f, t), r) | _ -> (f, rest)
and factor = function
  | Lexer.NUM n :: r -> (Ast.Num n, r)
  | Lexer.LPAREN :: r -> (match expr r with e, Lexer.RPAREN :: r -> (e, r) | _ -> failwith "expected )")
  | _ -> failwith "unexpected token"
let parse = function
  | Error m -> Error m
  | Ok toks -> (match expr toks with e, [] -> Ok e | _ -> Error "trailing input" | exception Failure m -> Error m)
