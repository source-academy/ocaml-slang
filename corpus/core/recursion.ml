let rec fact n = if n = 0 then 1 else n * fact (n - 1)
let rec fib n = if n < 2 then n else fib (n - 1) + fib (n - 2)
let rec gcd a b = if b = 0 then a else gcd b (a mod b)
let rec is_even n = if n = 0 then true else is_odd (n - 1)
and is_odd n = if n = 0 then false else is_even (n - 1)
let rec sum_to acc n = if n = 0 then acc else sum_to (acc + n) (n - 1)
let rec count_up acc n = if n = 0 then acc else count_up (acc + 1) (n - 1)
let () = Printf.printf "%d %d %d\n" (fact 10) (fib 20) (gcd 48 18)
let () = Printf.printf "%b %b\n" (is_even 10) (is_odd 7)
;;
let () = Printf.printf "%d\n" (sum_to 0 60_000)
;;
count_up 0 1_000_000;;
