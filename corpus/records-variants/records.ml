type point = { x : int; y : int }
type person = { name : string; mutable age : int }
let origin = { x = 0; y = 0 }
let moved = { origin with y = 5 }
let p = { name = "Ada"; age = 36 }
let () = p.age <- p.age + 1
let () = Printf.printf "(%d,%d) (%d,%d) %s %d\n" origin.x origin.y moved.x moved.y p.name p.age
let dist { x; y } = sqrt (float_of_int (x * x + y * y))
let () = Printf.printf "%.2f\n" (dist { x = 3; y = 4 })
;;
moved;;
