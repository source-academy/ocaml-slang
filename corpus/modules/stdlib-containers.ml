let h = Hashtbl.create 16
let () = List.iter (fun (k, v) -> Hashtbl.replace h k v) [("one", 1); ("two", 2); ("three", 3); ("two", 22)]
let () = List.iter (fun k -> Printf.printf "%s=%d " k (Hashtbl.find h k)) ["one"; "two"; "three"]; print_newline ()
let () = Printf.printf "%d %b\n" (Hashtbl.length h) (Hashtbl.mem h "four")
let q = Queue.create ()
let () = List.iter (fun x -> Queue.add x q) [1; 2; 3]
let () = Printf.printf "%d %d\n" (Queue.take q) (Queue.length q)
let st = Stack.create ()
let () = List.iter (fun x -> Stack.push x st) [1; 2; 3]
let () = Printf.printf "%d %d\n" (Stack.pop st) (Stack.length st)
let () = print_endline (String.concat "," (List.map string_of_int (List.of_seq (Seq.take 3 (Seq.ints 10)))))
let l = lazy (print_endline "forced"; 7)
let () = Printf.printf "%d %d\n" (Lazy.force l) (Lazy.force l)
;;
Hashtbl.find h "two";;
