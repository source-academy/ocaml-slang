let parse toks =
  let toks = ref toks in
  Parser.main (fun _ -> match !toks with t :: r -> toks := r; t | [] -> Parser.EOF) (Lexing.from_string "")
let () = Printf.printf "%d\n" (parse Parser.[NUM 1; PLUS; NUM 2; EOF])
