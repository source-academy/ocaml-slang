(* The shape of a CS4212 program: abstract syntax, a lexer, a parser and a driver in files. *)
let () =
  List.iter
    (fun src ->
      match Parser.parse (Lexer.tokens src) with
      | Ok e -> Printf.printf "%s = %d\n" (Ast.show e) (Ast.eval e)
      | Error msg -> Printf.printf "%S: %s\n" src msg)
    ["1 + 2 * 3"; "(1 + 2) * 3"; "2 * (3 + 4) * 5"; "1 + "; "4 $ 4"]
