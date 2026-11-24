%token <int> NUM
%token EOF
%start <int> main
%%
main: e = a EOF { e } | e = b EOF { e }
a: n = NUM { n }
b: n = NUM { n + 1 }
