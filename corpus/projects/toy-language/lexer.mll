{
  open Parser
  exception Error of string
}

let digit = ['0'-'9']
let ident = ['a'-'z' '_'] ['a'-'z' 'A'-'Z' '0'-'9' '_']*

rule token = parse
  | [' ' '\t' '\r'] { token lexbuf }
  | '\n' { Lexing.new_line lexbuf; token lexbuf }
  | "//" [^ '\n']* { token lexbuf }
  | digit+ as n { INT (int_of_string n) }
  | "true" { TRUE } | "false" { FALSE }
  | "if" { IF } | "else" { ELSE } | "while" { WHILE } | "print" { PRINT }
  | ident as x { IDENT x }
  | "+" { PLUS } | "-" { MINUS } | "*" { TIMES } | "/" { DIV }
  | "<" { LT } | "==" { EQEQ } | "&&" { AND } | "||" { OR } | "!" { NOT }
  | "=" { ASSIGN } | ";" { SEMI }
  | "(" { LPAREN } | ")" { RPAREN } | "{" { LBRACE } | "}" { RBRACE }
  | eof { EOF }
  | _ as c { raise (Error (Printf.sprintf "unexpected character %C" c)) }
