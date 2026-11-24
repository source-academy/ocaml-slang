(* The tokens come from the parser's interface, which Menhir made: Parser.token. *)
let tokens = function
  | "1 + 2 * 3" -> Parser.[NUM 1; PLUS; NUM 2; TIMES; NUM 3; EOF]
  | "(1 + 2) * 3" -> Parser.[LPAREN; NUM 1; PLUS; NUM 2; RPAREN; TIMES; NUM 3; EOF]
  | _ -> Parser.[NUM 1; PLUS; EOF]
let parse s =
  let toks = ref (tokens s) in
  let next _ = match !toks with t :: r -> toks := r; t | [] -> Parser.EOF in
  Parser.main next (Lexing.from_string "")
let () = List.iter (fun s -> Printf.printf "%s = %d\n" s (parse s)) ["1 + 2 * 3"; "(1 + 2) * 3"]
let () = try ignore (parse "incomplete") with Parser.Error -> print_endline "syntax error"
