let () = print_int (Parser.main (fun _ -> Parser.EOF) (Lexing.from_string ""))
