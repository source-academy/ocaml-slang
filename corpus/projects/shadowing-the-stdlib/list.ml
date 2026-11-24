(* A file of the program shadows the Stdlib module of its name, as in dune; it reaches the Stdlib's through Stdlib. *)
let length _ = 99
let map = Stdlib.List.map
let rev _ = [0]
