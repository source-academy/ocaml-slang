let f x = let unused = 1 in x + 1
let () = Printf.printf "%d\n" (f 1)
