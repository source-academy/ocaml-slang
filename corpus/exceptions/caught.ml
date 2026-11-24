exception Parse_error of string * int
exception Empty
let parse s = if s = "" then raise Empty else if s = "bad" then raise (Parse_error (s, 3)) else String.length s
let attempt s =
  try Printf.sprintf "ok %d" (parse s) with
  | Empty -> "empty"
  | Parse_error (m, n) -> Printf.sprintf "parse error %s at %d" m n
let () = List.iter (fun s -> print_endline (attempt s)) [""; "bad"; "fine"]
let () = print_endline (try List.assoc 3 [(1, "a")] with Not_found -> "not found")
let () = print_endline (try ignore (int_of_string "x"); "" with Failure m -> m)
let () = print_endline (try invalid_arg "negative" with Invalid_argument m -> m)
let () = print_endline (try string_of_int (1 / 0) with Division_by_zero -> "div by zero")
let () = print_endline (try List.hd [] with Failure m -> m)
let r = try Ok (parse "") with e -> Error (Printexc.to_string e)
;;
r;;
