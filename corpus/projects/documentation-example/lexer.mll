{ open Parser }
rule token = parse
  | [' ' '\n'] { token lexbuf }
  | ['0'-'9']+ as n { NUM (int_of_string n) }
  | '+' { PLUS } | eof { EOF }
