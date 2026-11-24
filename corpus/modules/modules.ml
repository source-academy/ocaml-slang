module Stack = struct
  type 'a t = 'a list
  let empty = []
  let push x s = x :: s
  let pop = function [] -> None | x :: s -> Some (x, s)
  let size = List.length
end
module Geometry = struct
  module Vec = struct
    type t = { x : float; y : float }
    let add a b = { x = a.x +. b.x; y = a.y +. b.y }
    let to_string v = Printf.sprintf "(%.1f, %.1f)" v.x v.y
  end
  let origin = { Vec.x = 0.; y = 0. }
end
module Alias = Geometry.Vec
include Stack
let s = push 3 (push 2 (push 1 empty))
let () = Printf.printf "%d\n" (size s)
let () = (match pop s with Some (x, rest) -> Printf.printf "%d %d\n" x (size rest) | None -> ())
let () = print_endline (Alias.to_string (Alias.add Geometry.origin { Alias.x = 1.5; y = 2.5 }))
let () = let open Geometry.Vec in print_endline (to_string { x = 1.; y = 2. })
;;
size s;;
