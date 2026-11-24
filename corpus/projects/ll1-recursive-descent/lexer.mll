{ type token = NUM of int | PLUS | TIMES | LPAREN | RPAREN | EOF }
rule token = parse
  | [' ' '\t' '\n'] { token lexbuf }
  | ['0'-'9']+ as n { NUM (int_of_string n) }
  | '+' { PLUS } | '*' { TIMES } | '(' { LPAREN } | ')' { RPAREN }
  | eof { EOF }
