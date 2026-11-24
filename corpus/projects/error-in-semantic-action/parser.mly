%token <int> NUM
%token EOF
%start <int> main
%%
main: n = NUM EOF { n ^ "text" }
