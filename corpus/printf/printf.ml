let () = Printf.printf "[%d] [%5d] [%-5d] [%05d] [%+d]\n" 42 42 42 42 42
let () = Printf.printf "[%x] [%X] [%o] [%c] [%s] [%S]\n" 255 255 8 'z' "str" "q\"uote"
let () = Printf.printf "[%f] [%.2f] [%8.3f] [%e] [%g]\n" 3.14159 3.14159 3.14159 31415.9 0.0001
let () = Printf.printf "[%b] [%%] [%10s] [%-10s]|\n" true "right" "left"
let () = print_endline (Printf.sprintf "%d-%s-%.1f" 1 "two" 3.0)
let () = Printf.printf "%s %s\n" (string_of_int 7) (string_of_bool false)
let () = Printf.printf "%d items\n%!" 3
let () = print_string "no newline here"
let () = print_newline ()
let () = prerr_endline "to stderr"
let () = print_int 5; print_char ' '; print_float 2.5; print_newline ()
;;
Printf.sprintf "%03d" 7;;
