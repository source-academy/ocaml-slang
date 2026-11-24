let s = "Hello, World"
let () = Printf.printf "%d %s %s\n" (String.length s) (String.sub s 7 5) (String.uppercase_ascii s)
let () = print_endline (String.concat "|" (String.split_on_char ',' "a,b,,c"))
let () = Printf.printf "%c %d %c\n" s.[1] (Char.code 'A') (Char.chr 98)
let () = print_endline (String.make 3 'x' ^ String.trim "  pad  " ^ "!")
let () = Printf.printf "%b %b %d\n" (String.equal "a" "a") ("abc" < "abd") (compare "b" "a")
let b = Buffer.create 16
let () = for i = 1 to 5 do Buffer.add_string b (string_of_int i); Buffer.add_char b ';' done
;;
Buffer.contents b;;
