// Spike worker: the whole CS4212 chain inside one web worker, with no network after the fetches
// and no Node APIs. js_of_ocaml programs see an in-memory file system under /static.
const ms = (t) => Math.round(performance.now() - t);
const log = [];

class Exit { constructor(code) { this.code = code; } }
globalThis.quit = (code) => { throw new Exit(code); };

async function text(url) { return (await fetch(url)).text(); }

// Run a js_of_ocaml program (menhir, ocamllex) once, with argv and input files; return its outputs.
function runTool(src, argv, inputs, outputs) {
  globalThis.scriptArgs = argv;
  globalThis.jsoo_fs_tmp = Object.entries(inputs).map(([name, content]) => ({ name: '/static/' + name, content }));
  let code = 0;
  // Each js_of_ocaml program installs its runtime in globals (jsoo_runtime, ...). Keep the toplevel's.
  const saved = new Map(Object.getOwnPropertyNames(globalThis).map((k) => [k, globalThis[k]]));
  const changed = [];
  try {
    (0, eval)(src);
  } catch (e) {
    if (e instanceof Exit) code = e.code; else throw e;
  } finally {
    delete globalThis.scriptArgs;
  }
  const files = {};
  for (const o of outputs) files[o] = globalThis.jsoo_read_file('/static/' + o);
  for (const k of Object.getOwnPropertyNames(globalThis)) {
    if (!saved.has(k)) { changed.push('+' + k); delete globalThis[k]; }
    else if (saved.get(k) !== globalThis[k]) { changed.push('~' + k); globalThis[k] = saved.get(k); }
  }
  return { code, files, changed };
}

self.onmessage = async ({ data: { files, sample } }) => {
  try {
    let t = performance.now();
    const [toplevelSrc, menhirSrc, ocamllexSrc] = await Promise.all(
      ['toplevel.js', 'menhir.js', 'ocamllex.js'].map(text));
    log.push(`fetch: ${ms(t)} ms`);

    t = performance.now();
    (0, eval)(toplevelSrc);
    const top = globalThis.ocaml;
    log.push(`toplevel startup: ${ms(t)} ms`);

    t = performance.now();
    const lex = runTool(ocamllexSrc, ['ocamllex', '-ml', '-q', '/static/lexer.mll'], { 'lexer.mll': files['lexer.mll'] }, ['lexer.ml']);
    log.push(`ocamllex: ${ms(t)} ms, exit ${lex.code}, lexer.ml ${lex.files['lexer.ml']?.length} chars; globals restored: ${lex.changed.join(' ')}`);

    t = performance.now();
    const par = runTool(menhirSrc, ['menhir', '--table', '--explain', '/static/parser.mly'], { 'parser.mly': files['parser.mly'] }, ['parser.ml', 'parser.mli', 'parser.conflicts']);
    log.push(`menhir: ${ms(t)} ms, exit ${par.code}, parser.ml ${par.files['parser.ml']?.length} chars`);

    const conf = runTool(menhirSrc, ['menhir', '--table', '--explain', '/static/parser_conflicts.mly'], { 'parser_conflicts.mly': files['parser_conflicts.mly'] }, ['parser_conflicts.conflicts']);
    log.push(`menhir (conflicts): exit ${conf.code}, .conflicts ${conf.files['parser_conflicts.conflicts']?.length} chars, first line: ${conf.files['parser_conflicts.conflicts']?.split('\n')[1]}`);

    const sources = { 'ast.ml': files['ast.ml'], 'parser.ml': par.files['parser.ml'], 'lexer.ml': lex.files['lexer.ml'], 'interp.ml': files['interp.ml'] };
    for (const [name, content] of Object.entries(sources)) {
      t = performance.now();
      top.writeFile('/static/' + name, content);
      const out = top.modUse('/static/' + name);
      const errs = out.split('\n').filter((l) => /Error|Warning/.test(l));
      log.push(`mod_use ${name}: ${ms(t)} ms${errs.length ? ' ' + errs.join(' | ') : ''}`);
    }
    t = performance.now();
    const result = top.exec(`Interp.run ${JSON.stringify(sample)};;`);
    log.push(`run: ${ms(t)} ms`);
    log.push('output: ' + JSON.stringify(result));
    log.push('syntax error: ' + JSON.stringify(top.exec('Interp.run "x = 1 +;";;').trim()));
    log.push('type error: ' + JSON.stringify(top.exec('let x : int = "five";;').trim().split('\n').slice(0, 2).join(' ')));
    top.exec('let rec len = function [] -> 0 | _ :: t -> 1 + len t;;');
    let depth = 0;
    for (const n of [1000, 2000, 5000, 10000, 20000, 50000, 100000]) {
      if (/- : int/.test(top.exec(`len (List.init ${n} Fun.id);;`))) depth = n; else break;
    }
    log.push(`deepest non-tail recursion that worked: ${depth}`);
    self.postMessage({ ok: true, log });
  } catch (e) {
    self.postMessage({ ok: false, log, error: String(e && e.stack || e) });
  }
};
