let () = print_int (Parser.main (fun _ -> Parser.A) (Lexing.from_string ""))
