let with_cleanup f =
  let log = ref [] in
  let result = (try Ok (f log) with e -> Error e) in
  log := "cleanup" :: !log;
  (result, List.rev !log)
let () =
  let r, log = with_cleanup (fun log -> log := "work" :: !log; 42) in
  print_endline (String.concat "," log ^ " " ^ (match r with Ok n -> string_of_int n | Error _ -> "failed"))
let () =
  let r, log = with_cleanup (fun log -> log := "work" :: !log; failwith "inner") in
  print_endline (String.concat "," log ^ " " ^ (match r with Ok n -> string_of_int n | Error e -> Printexc.to_string e))
let () = try (try failwith "a" with Failure m -> raise (Failure (m ^ "b"))) with Failure m -> print_endline m
