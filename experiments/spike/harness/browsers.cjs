// Serves browser/ (+ the built JS and the toy sources) and runs the worker in Chromium, Firefox, WebKit.
const http = require('http'), fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const routes = {
  '/toplevel.js': '_build/default/toplevel/toplevel.bc.js',
  '/menhir.js': 'vendor/menhir/_build/default/executable/stage2/main.bc.js',
  '/ocamllex.js': 'vendor/ocamllex/_build/default/main.bc.js',
};
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const f = routes[u] || (u.startsWith('/toy/') ? u.slice(1) : 'browser' + (u === '/' ? '/index.html' : u));
  fs.readFile(path.join(root, f), (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'text/javascript' });
    res.end(data);
  });
}).listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  for (const name of (process.argv[2] || 'chromium,firefox,webkit').split(',')) {
    const browser = await pw[name].launch();
    const page = await browser.newPage();
    await page.goto(url);
    const t = Date.now();
    const r = await page.evaluate(() => window.runSpike());
    console.log(`\n=== ${name} ${browser.version()} (total ${Date.now() - t} ms): ${r.ok ? 'OK' : 'FAILED'}`);
    for (const l of r.log || []) console.log('  ' + l);
    if (r.error) console.log('  ERROR: ' + r.error);
    await browser.close();
  }
  server.close();
});
