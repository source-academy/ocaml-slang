let c = Counter.(incr (incr (create ())))
let () = Printf.printf "%d\n" (Counter.value c)
let () = print_endline (Shape.describe (Shape.make 3))
