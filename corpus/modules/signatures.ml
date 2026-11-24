module type COUNTER = sig
  type t
  val create : unit -> t
  val incr : t -> t
  val value : t -> int
end
module Counter : COUNTER = struct
  type t = int
  let create () = 0
  let incr n = n + 1
  let value n = n
end
module type SHOW = sig
  type t
  val show : t -> string
end
module IntShow : SHOW with type t = int = struct
  type t = int
  let show = string_of_int
end
let c = Counter.(incr (incr (create ())))
let () = Printf.printf "%d\n" (Counter.value c)
let () = print_endline (IntShow.show 42)
;;
Counter.value c;;
