%token <int> NUM
%token PLUS EOF
%left PLUS
%start <int> main
%%
main: e = expr EOF { e }
expr: n = NUM { n } | a = expr PLUS b = expr { a + b }
