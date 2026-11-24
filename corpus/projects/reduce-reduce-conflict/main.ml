let tokens = ref [ Parser.NUM 1; Parser.EOF ]

let lexer _ =
  match !tokens with
  | t :: rest -> tokens := rest; t
  | [] -> Parser.EOF

let () = print_endline (string_of_int (Parser.main lexer (Lexing.from_string "")))
