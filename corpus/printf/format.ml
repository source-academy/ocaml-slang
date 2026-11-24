let () = Format.printf "@[<v>first@,second@]@."
let () = Format.printf "@[<hov 2>%s@ %s@ %s@]@." "a" "b" "c"
let () = print_endline (Format.asprintf "%d and %s" 1 "two")
let pp_pair ppf (a, b) = Format.fprintf ppf "<%d|%d>" a b
let () = Format.printf "%a %a@." pp_pair (1, 2) pp_pair (3, 4)
let () = Format.printf "@[<h>%a@]@." (Format.pp_print_list ~pp_sep:(fun ppf () -> Format.fprintf ppf ", ") Format.pp_print_int) [1; 2; 3]
let () = Format.printf "%s@." (String.make 3 '=')
