{ let tokens = ref 0 }
rule token = parse
  | ['a'-'z']+ { incr tokens; "word" ^ 1 }
  | eof { "" }
