let words s = Words.scan (Lexing.from_string s)
let () = print_endline (String.concat "|" (words "Hello, lexer world: 42 times!"))
let () = Printf.printf "%d words\n" !Words.count
