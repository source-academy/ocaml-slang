rule all = parse
  | ['a'-'z']+ as w { w :: all lexbuf }
  | _ { all lexbuf }
  | eof { [] }
