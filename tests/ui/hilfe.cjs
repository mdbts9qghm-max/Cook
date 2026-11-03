// Gemeinsame Hilfen für die Playwright-Tests: statischer Server, Prüf-Protokoll
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function server(webRootRoh) {
  const webRoot = path.resolve(webRootRoh);
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(webRoot, p);
      if (!f.startsWith(path.resolve(webRoot)) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nicht gefunden'); }
      res.writeHead(200, { 'Content-Type': TYPEN[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

function protokoll() {
  const ergebnisse = [];
  return {
    ergebnisse,
    async pruefe(name, fn) {
      try { await fn(); ergebnisse.push({ name, ok: true }); } catch (e) { ergebnisse.push({ name, ok: false, fehler: String((e && e.stack) || e).slice(0, 900) }); }
    },
  };
}
function erwarte(bed, meldung) { if (!bed) throw new Error(meldung); }

module.exports = { server, protokoll, erwarte };
