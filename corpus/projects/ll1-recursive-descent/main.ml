(* LL(1): E -> T E'   E' -> + T E' | eps   T -> F T'   T' -> * F T' | eps   F -> NUM | ( E ) *)
let lexbuf = Lexing.from_string "2 + 3 * (4 + 1) * 2"
let look = ref (Lexer.token lexbuf)
let advance () = look := Lexer.token lexbuf
let expect t = if !look = t then advance () else failwith "unexpected token"

let rec expr () = expr' (term ())
and expr' acc =
  match !look with
  | Lexer.PLUS -> advance (); expr' (acc + term ())
  | _ -> acc
and term () = term' (factor ())
and term' acc =
  match !look with
  | Lexer.TIMES -> advance (); term' (acc * factor ())
  | _ -> acc
and factor () =
  match !look with
  | Lexer.NUM n -> advance (); n
  | Lexer.LPAREN -> advance (); let v = expr () in expect Lexer.RPAREN; v
  | _ -> failwith "expected a number or ("

let () = Printf.printf "%d\n" (expr ())
