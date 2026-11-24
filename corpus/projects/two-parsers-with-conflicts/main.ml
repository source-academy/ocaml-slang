let run main =
  let tokens = ref [ Pa.NUM 1; Pa.PLUS; Pa.NUM 2; Pa.EOF ] in
  main (fun _ -> match !tokens with t :: r -> tokens := r; t | [] -> Pa.EOF) (Lexing.from_string "")

let () = print_endline (string_of_int (run Pa.main))
let _ = Pb.main
