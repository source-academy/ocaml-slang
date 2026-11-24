%token <int> NUM
%token IF THEN ELSE EOF
%nonassoc THEN
%nonassoc ELSE
%start <string> main
%%
main: s = stmt EOF { s }
stmt:
  | n = NUM { string_of_int n }
  | IF c = NUM THEN t = stmt { Printf.sprintf "if %d then (%s)" c t }
  | IF c = NUM THEN t = stmt ELSE f = stmt { Printf.sprintf "if %d then (%s) else (%s)" c t f }
