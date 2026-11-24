%token <int> NUM
%token PLUS TIMES LPAREN RPAREN EOF
%left PLUS
%left TIMES
%start <int> main
%%
main: e = expr EOF { e }
expr:
  | n = NUM { n }
  | a = expr PLUS b = expr { a + b }
  | a = expr TIMES b = expr { a * b }
  | LPAREN e = expr RPAREN { e }
