let safe_div a b = if b = 0 then Error "division by zero" else Ok (a / b)
let show = function Ok n -> "ok " ^ string_of_int n | Error e -> "error " ^ e
let () = print_endline (show (safe_div 10 2)); print_endline (show (safe_div 1 0))
let () = print_endline (show (Result.bind (safe_div 100 5) (fun n -> safe_div n 2)))
let () = print_endline (match Option.map (fun x -> x + 1) (Some 1) with Some n -> string_of_int n | None -> "none")
let () = Printf.printf "%d %d\n" (Option.value ~default:0 None) (Option.value ~default:0 (Some 7))
let () = print_endline (string_of_bool (Option.is_none None))
;;
safe_div 7 2;;
