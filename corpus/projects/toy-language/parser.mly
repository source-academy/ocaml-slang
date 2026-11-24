%{ open Ast %}

%token <int> INT
%token <string> IDENT
%token TRUE FALSE IF ELSE WHILE PRINT
%token PLUS MINUS TIMES DIV LT EQEQ AND OR NOT
%token ASSIGN SEMI LPAREN RPAREN LBRACE RBRACE EOF

%left OR
%left AND
%nonassoc LT EQEQ
%left PLUS MINUS
%left TIMES DIV
%nonassoc UMINUS NOT

%start <Ast.program> program
%%

program: ss = list(stmt) EOF { ss }

block: LBRACE ss = list(stmt) RBRACE { ss }

stmt:
  | x = IDENT ASSIGN e = expr SEMI { Assign (x, e) }
  | IF LPAREN c = expr RPAREN t = block ELSE f = block { If (c, t, f) }
  | IF LPAREN c = expr RPAREN t = block { If (c, t, []) }
  | WHILE LPAREN c = expr RPAREN b = block { While (c, b) }
  | PRINT e = expr SEMI { Print e }

expr:
  | n = INT { Int n }
  | TRUE { Bool true } | FALSE { Bool false }
  | x = IDENT { Var x }
  | LPAREN e = expr RPAREN { e }
  | a = expr PLUS b = expr { Binop (Add, a, b) }
  | a = expr MINUS b = expr { Binop (Sub, a, b) }
  | a = expr TIMES b = expr { Binop (Mul, a, b) }
  | a = expr DIV b = expr { Binop (Div, a, b) }
  | a = expr LT b = expr { Binop (Lt, a, b) }
  | a = expr EQEQ b = expr { Binop (Eq, a, b) }
  | a = expr AND b = expr { Binop (And, a, b) }
  | a = expr OR b = expr { Binop (Or, a, b) }
  | MINUS e = expr %prec UMINUS { Neg e }
  | NOT e = expr { Not e }
