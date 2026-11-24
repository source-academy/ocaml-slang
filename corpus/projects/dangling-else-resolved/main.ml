(* if 1 then if 2 then 3 else 4: which if does the else belong to? *)
let input = ref [ Parser.IF; NUM 1; THEN; IF; NUM 2; THEN; NUM 3; ELSE; NUM 4; EOF ]

let lexer _ =
  match !input with
  | t :: rest -> input := rest; t
  | [] -> Parser.EOF

let () = print_endline (Parser.main lexer (Lexing.from_string ""))
