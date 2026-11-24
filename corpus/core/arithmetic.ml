let () = Printf.printf "%d %d %d %d\n" (7 / 2) (7 mod 3) (-7 / 2) (-7 mod 3)
let () = Printf.printf "%d %d\n" (abs (-5)) (min 3 4)
let () = Printf.printf "%.3f %.3f\n" (sqrt 2.0) (3.0 ** 2.0)
let () = Printf.printf "%d %s %s\n" (int_of_float 3.99) (string_of_int 42) (string_of_float 1.5)
let () = Printf.printf "%b %b\n" (1 < 2 && 2 < 3) (not (1 = 1) || false)
let () = print_endline (string_of_float (float_of_int 3 /. 2.0))
;;
1 + 2 * 3;;
