// Go/no-go: ocamllex.js and menhir.js generate the front end of the toy language; the JS toplevel
// loads ast, parser, lexer and interp as modules and runs a program. All in one Node process.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [toplevel, menhir, ocamllex, dir] = process.argv.slice(2).map((p) => path.resolve(p));
const t = () => performance.now();
let t0 = t();
execFileSync('node', [ocamllex, '-ml', '-q', 'lexer.mll'], { cwd: dir, stdio: 'inherit' });
console.log(`ocamllex.js: ${(t() - t0).toFixed(0)} ms`);
t0 = t();
execFileSync('node', [menhir, '--table', 'parser.mly'], { cwd: dir, stdio: 'inherit' });
console.log(`menhir.js --table: ${(t() - t0).toFixed(0)} ms`);
t0 = t();
require(toplevel);
const top = globalThis.ocaml;
console.log(`toplevel startup: ${(t() - t0).toFixed(0)} ms`);
for (const m of ['ast', 'parser', 'lexer', 'interp']) {
  t0 = t();
  const out = top.modUse(path.join(dir, m + '.ml'));
  console.log(`mod_use ${m}.ml: ${(t() - t0).toFixed(0)} ms${out.trim() ? '\n' + out : ''}`);
}
const sample = fs.readFileSync(path.join(dir, 'sample.toy'), 'utf8');
t0 = t();
console.log(top.exec(`Interp.run ${JSON.stringify(sample)};;`));
console.log(`run: ${(t() - t0).toFixed(0)} ms`);
console.log(top.exec('Interp.run "x = 1 +;";;'));
