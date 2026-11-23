require(require('path').resolve(process.argv[2]));
const top = globalThis.ocaml;
top.exec('let rec len = function [] -> 0 | _ :: t -> 1 + len t;;');
let ok = 0;
for (const n of [1000, 5000, 10000, 20000, 50000, 100000, 300000, 1000000]) {
  const out = top.exec(`len (List.init ${n} Fun.id);;`);
  console.log(n, JSON.stringify(out.trim()).slice(0, 80));
}
console.log('map:', JSON.stringify(top.exec('List.length (List.map succ (List.init 1000000 Fun.id));;')));
console.log('after:', JSON.stringify(top.exec('1 + 1;;')));
