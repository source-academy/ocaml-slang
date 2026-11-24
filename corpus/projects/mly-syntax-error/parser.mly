%token A B
%start <int> main
%%
main: A B { 1 }
  | A %% { 2 }
