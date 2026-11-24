type t = Num of int | Add of t * t | Mul of t * t
val eval : t -> int
val show : t -> string
