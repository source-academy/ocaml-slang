%token <int> NUM
%token PLUS MINUS EOF
%start <int> main
%%
main: e = expr EOF { e }
expr:
  | n = NUM { n }
  | a = expr PLUS b = expr { a + b }
  | a = expr MINUS b = expr { a - b }
