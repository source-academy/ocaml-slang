let describe = function
  | [] -> "empty"
  | [x] -> "one " ^ string_of_int x
  | x :: y :: _ when x = y -> "starts with a pair"
  | (1 | 2) :: _ -> "starts with 1 or 2"
  | _ :: rest as l -> Printf.sprintf "%d elements, %d after the first" (List.length l) (List.length rest)
let () = List.iter (fun l -> print_endline (describe l)) [[]; [7]; [4; 4; 1]; [2; 9]; [5; 6; 7]]
let classify (a, b) = match a, b with
  | 0, 0 -> "origin"
  | 0, _ | _, 0 -> "axis"
  | _ -> "plane"
let () = List.iter (fun p -> print_endline (classify p)) [(0, 0); (0, 3); (2, 0); (1, 1)]
let opt = function Some x when x > 0 -> "positive" | Some _ -> "non-positive" | None -> "nothing"
;;
List.map opt [Some 1; Some 0; None];;
