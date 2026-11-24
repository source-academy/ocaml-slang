(* A lexer and a recursive descent parser by hand, as an exercise before Menhir. *)
type token = NUM of int | PLUS | TIMES | LPAREN | RPAREN | EOF
let lex s =
  let n = String.length s in
  let rec go i acc =
    if i >= n then List.rev (EOF :: acc)
    else match s.[i] with
      | ' ' -> go (i + 1) acc
      | '+' -> go (i + 1) (PLUS :: acc)
      | '*' -> go (i + 1) (TIMES :: acc)
      | '(' -> go (i + 1) (LPAREN :: acc)
      | ')' -> go (i + 1) (RPAREN :: acc)
      | '0' .. '9' ->
          let j = ref i in
          while !j < n && s.[!j] >= '0' && s.[!j] <= '9' do incr j done;
          go !j (NUM (int_of_string (String.sub s i (!j - i))) :: acc)
      | c -> failwith (Printf.sprintf "unexpected %c at %d" c i)
  in
  go 0 []
type ast = Lit of int | Sum of ast * ast | Prod of ast * ast
let rec expr toks =
  let t, rest = term toks in
  match rest with PLUS :: rest' -> let e, r = expr rest' in (Sum (t, e), r) | _ -> (t, rest)
and term toks =
  let f, rest = factor toks in
  match rest with TIMES :: rest' -> let t, r = term rest' in (Prod (f, t), r) | _ -> (f, rest)
and factor = function
  | NUM n :: rest -> (Lit n, rest)
  | LPAREN :: rest -> (match expr rest with e, RPAREN :: r -> (e, r) | _ -> failwith "expected )")
  | _ -> failwith "unexpected token"
let rec eval = function Lit n -> n | Sum (a, b) -> eval a + eval b | Prod (a, b) -> eval a * eval b
let run s = match expr (lex s) with e, [EOF] -> eval e | _ -> failwith "trailing input"
let () = List.iter (fun s -> Printf.printf "%s = %d\n" s (run s)) ["1 + 2 * 3"; "(1 + 2) * 3"; "2 * (3 + 4) * 5"]
let () = print_endline (try string_of_int (run "1 + $") with Failure m -> m)
;;
run "10 * 10 + 1";;
