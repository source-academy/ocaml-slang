let rec nats n () = Seq.Cons (n, nats (n + 1))
let () = print_endline (String.concat " " (List.map string_of_int (List.of_seq (Seq.take 5 (nats 1)))))
let squares = Seq.map (fun x -> x * x) (nats 1)
let () = print_endline (String.concat " " (List.map string_of_int (List.of_seq (Seq.take 5 squares))))
let evens = Seq.filter (fun x -> x mod 2 = 0) (nats 1)
;;
List.of_seq (Seq.take 3 evens);;
