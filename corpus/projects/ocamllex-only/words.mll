{
  let count = ref 0
}
let letter = ['a'-'z' 'A'-'Z']
rule scan = parse
  | letter+ as w { incr count; w :: scan lexbuf }
  | eof { [] }
  | _ { scan lexbuf }
