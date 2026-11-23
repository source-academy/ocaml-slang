// Spike harness: load the toplevel and run a few phrases.
const path = process.argv[2];
let t0 = performance.now();
require(require('path').resolve(path));
const top = globalThis.ocaml;
console.log(`startup: ${(performance.now() - t0).toFixed(0)} ms`);
const run = (code) => {
  const t = performance.now();
  const out = top.exec(code);
  console.log(`--- (${(performance.now() - t).toFixed(0)} ms) ${code.split('\n')[0]}\n${out}`);
};
run('let rec fact n = if n = 0 then 1 else n * fact (n - 1);;');
run('fact 20;;');
run('let x : int = "five";;');
run('let f = function Some x -> x;;');
run('module type S = sig type t val zero : t end\nmodule M (X : S) = struct let z = [X.zero; X.zero] end\nmodule I = M (struct type t = int let zero = 0 end);;');
run('I.z;;');
run('Printf.printf "%d %s\\n" 42 "printf works";;');
run('MenhirLib.Convert.Simplified.traditional2revised;;');
run('max_int;;');
run('let rec len = function [] -> 0 | _ :: t -> 1 + len t;; len (List.init 100000 Fun.id);;');
run('len (List.init 1000000 Fun.id);;');
run('List.length (List.map succ (List.init 1000000 Fun.id));;');
