let () = print_endline (String.concat "," (Words.all (Lexing.from_string "a bc def")))
