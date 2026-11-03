// UI- und Logik-Tests der Web-App mit Playwright (iPhone-Format 390 × 844).
// Aufruf: node tests/ui/ui_test.cjs <web-ordner> <erwartete-texte.json> [<screenshot-ordner>]
// Ausgabe: JSON mit Ergebnissen; Exit-Code 1 bei Fehlern.
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log(JSON.stringify({ skip: 'playwright fehlt' })); process.exit(0); }

const [webRoot, erwartetPfad, shotDir] = process.argv.slice(2);
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function server() {
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

const ergebnisse = [];
async function pruefe(name, fn) {
  try { await fn(); ergebnisse.push({ name, ok: true }); } catch (e) { ergebnisse.push({ name, ok: false, fehler: String(e && e.stack || e).slice(0, 800) }); }
}
function erwarte(bed, meldung) { if (!bed) throw new Error(meldung); }

(async () => {
  const srv = await server();
  const basis = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  const jsFehler = [];
  page.on('pageerror', (e) => jsFehler.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') jsFehler.push(m.text()); });
  const erwartet = JSON.parse(fs.readFileSync(erwartetPfad, 'utf-8'));
  const shot = async (name) => { if (shotDir) { fs.mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: path.join(shotDir, name + '.png') }); } };
  const gehe = async (hash) => { await page.goto(basis + 'index.html' + hash); await page.waitForSelector('#inhalt :is(h1,h2,.liste,.karte,p)'); await page.waitForTimeout(150); };

  await pruefe('Alle Ansichten laden ohne JavaScript-Fehler', async () => {
    for (const h of ['#/heute', '#/rezepte', '#/rezept/marry-me-chicken', '#/planer', '#/einkauf', '#/mehr', '#/rezept/gibt-es-nicht']) {
      await gehe(h);
    }
    await page.goto(basis + 'rezepte/fruehstuecks-brownie.html');
    await page.waitForSelector('h1');
    erwarte(jsFehler.length === 0, 'JS-Fehler: ' + jsFehler.join(' | '));
  });

  await pruefe('Platzhalter: JS-Rendering = Python-Rendering (alle Rezepte, alle Texte)', async () => {
    await gehe('#/rezepte');
    const abweichungen = await page.evaluate(async (erw) => {
      const R = await import('./js/rezept.js');
      const { D } = window.__app;
      const fehler = [];
      for (const [id, texte] of Object.entries(erw)) {
        const r = D.map[id];
        if (!r) { fehler.push(id + ': fehlt'); continue; }
        for (const [roh, soll] of texte) {
          const ist = R.rezeptText(r, roh, 1);
          if (ist !== soll) fehler.push(`${id}: „${ist}“ ≠ „${soll}“`);
        }
      }
      return fehler;
    }, erwartet.texte);
    erwarte(abweichungen.length === 0, abweichungen.slice(0, 5).join('\n'));
  });

  await pruefe('Rezeptbuch: Suche, Filter, Favorit bleibt nach Neuladen', async () => {
    await gehe('#/rezepte');
    await page.fill('#q', 'brownie');
    await page.waitForTimeout(100);
    const titel = await page.$$eval('#treffer .titel', (l) => l.map((x) => x.textContent));
    erwarte(titel.length === 2 && titel.some((t) => t.includes('Frühstücks-Brownie')), 'Suche brownie: ' + titel.join(', '));
    await page.fill('#q', '');
    await page.click('[data-mahlzeit="Snack"]');
    const snacks = await page.$$eval('#treffer .rezept-kachel', (l) => l.length);
    erwarte(snacks === 10, 'Snacks: ' + snacks);
    await page.click('[data-mahlzeit=""]');
    await page.click('[data-herz="marry-me-chicken"]');
    await page.reload(); await page.waitForSelector('#treffer .rezept-kachel');
    const gedrueckt = await page.getAttribute('[data-herz="marry-me-chicken"]', 'aria-pressed');
    erwarte(gedrueckt === 'true', 'Favorit nicht gespeichert');
    await page.click('#nur-fav');
    const fav = await page.$$eval('#treffer .rezept-kachel', (l) => l.length);
    erwarte(fav === 1, 'Favoritenfilter: ' + fav);
    await page.click('#nur-fav');
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('1-rezeptbuch');
  });

  await pruefe('Rezeptseite: Portionsrechner skaliert Mengen', async () => {
    await gehe('#/rezept/marry-me-chicken');
    const vorher = await page.$eval('table tbody tr td.r', (t) => t.textContent);
    erwarte(vorher.trim() === '140 g', 'Start: ' + vorher);
    await page.click('[data-portion="1"]'); await page.click('[data-portion="1"]');
    const nachher = await page.$eval('table tbody tr td.r', (t) => t.textContent);
    erwarte(nachher.trim() === '280 g', '4 Portionen: ' + nachher);
    erwarte((await page.textContent('#portionen')).includes('4'), 'Portionsanzeige');
    const stueck = await page.textContent('#inhalt');
    erwarte(stueck.includes('4 Hähnchenbrustfilets (800 g)'), 'Stückangabe skaliert nicht');
    await page.click('[data-portion="-1"]'); await page.click('[data-portion="-1"]');
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('2-rezeptseite');
    await page.evaluate(() => document.querySelector('#naehrwerte').scrollIntoView());
    await shot('3-rezeptseite-naehrwerte');
  });

  await pruefe('Kochmodus: Schritt 1 bis n, Timer startet', async () => {
    await gehe('#/rezept/marry-me-chicken');
    await page.click('[data-aktion="kochen"]');
    await page.waitForSelector('.koch');
    const n = (await page.$$('.koch-punkte span')).length;
    erwarte(n === 5, 'Seiten: ' + n);
    erwarte((await page.textContent('.koch .fortschritt')).includes('Schritt 1 von 5'), 'Start');
    await page.click('[data-aktion="weiter"]');
    erwarte((await page.textContent('.koch h2')).includes('Reis aufsetzen'), 'Schritt 2');
    await page.click('[data-aktion="timer"]');
    await page.waitForSelector('.koch-timer .t');
    const t = await page.textContent('.koch-timer .t');
    erwarte(/1[12]:\d\d/.test(t), 'Timer: ' + t);
    await page.click('[data-aktion="weiter"]');
    await page.click('[data-aktion="weiter"]');
    erwarte((await page.$$('.koch-timer .t')).length === 1, 'Timer läuft beim Blättern nicht weiter');
    await shot('4-kochmodus');
    await page.click('[data-aktion="weiter"]');
    erwarte((await page.textContent('[data-aktion="weiter"]')).includes('Fertig'), 'Letzter Schritt');
    await page.click('[data-aktion="weiter"]');
    erwarte((await page.$('.koch')) === null, 'Kochmodus schließt nicht');
  });

  await pruefe('In Planer eintragen → Heute zeigt Mahlzeit und Tagesbalken', async () => {
    await gehe('#/rezept/fruehstuecks-brownie');
    await page.click('[data-aktion="planen"]');
    await page.selectOption('#pl-faktor', '1.25');
    await page.click('#pl-ok');
    await page.click('[data-schliessen].knopf.primaer');
    await gehe('#/rezept/marry-me-chicken');
    await page.click('[data-aktion="planen"]');
    await page.click('#pl-ok');
    await page.click('[data-schliessen].knopf.primaer');
    await gehe('#/heute');
    const txt = await page.textContent('#inhalt');
    erwarte(txt.includes('Frühstück: Frühstücks-Brownie') && txt.includes('Abend: Marry Me Chicken'), 'Mahlzeiten fehlen');
    const kcal = erwartet.heute_kcal;   // 620 × 1,25 + 700
    erwarte(txt.includes(`${kcal} / 2.275 kcal`), 'Tagessumme falsch, erwartet ' + kcal);
    await shot('5-heute');
  });

  await pruefe('planer.js: Tagessumme mit Faktor, unbekannte Rezept-ID stürzt nicht ab', async () => {
    const r = await page.evaluate(async () => {
      const P = await import('./js/planer.js');
      const { D } = window.__app;
      let plan = P.leererPlan(2026, 45, D.profil);
      plan = P.slotSetzen(plan, '2026-11-02', 'abend', P.rezeptEintrag('marry-me-chicken', 1.25));
      plan = P.slotSetzen(plan, '2026-11-02', 'mittag', P.rezeptEintrag('gibt-es-nicht', 1));
      const s = P.tagesSumme(P.tagFinden(plan, '2026-11-02'), D.map, D.extrasMap);
      return { s, tage: plan.tage.map((t) => t.datum), einkauf: plan.einkauf, kw: P.isoWoche(new Date(2026, 10, 2)) };
    });
    erwarte(Math.abs(r.s.kcal - 875) < 0.01, 'kcal ' + r.s.kcal);
    erwarte(Math.abs(r.s.protein - 65.3 * 1.25) < 0.01, 'Protein ' + r.s.protein);
    erwarte(r.tage[0] === '2026-11-02' && r.tage[6] === '2026-11-08', 'Wochentage ' + r.tage);
    erwarte(r.kw.kw === 45 && r.kw.jahr === 2026, 'KW ' + JSON.stringify(r.kw));
    erwarte(r.einkauf.length === 1 && r.einkauf[0].datum === '2026-10-31', 'Einkaufstag ' + JSON.stringify(r.einkauf));
  });

  await pruefe('Offline nach dem ersten Laden (Service Worker)', async () => {
    await gehe('#/rezepte');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); await page.waitForTimeout(300);
    await ctx.setOffline(true);
    await page.goto(basis + 'index.html#/rezept/protein-pancakes');
    await page.waitForSelector('#inhalt h1');
    const h = await page.textContent('#inhalt h1');
    await ctx.setOffline(false);
    erwarte(h.includes('Protein-Pancakes'), 'Offline: ' + h);
  });

  // Dunkelmodus-Screenshot der Rezeptliste
  if (shotDir) {
    const dunkel = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, colorScheme: 'dark', locale: 'de-DE' });
    const p2 = await dunkel.newPage();
    await p2.goto(basis + 'index.html#/rezept/fruehstuecks-brownie'); await p2.waitForSelector('#inhalt h1'); await p2.waitForTimeout(200);
    await p2.screenshot({ path: path.join(shotDir, '6-rezeptseite-dunkel.png') });
    await dunkel.close();
  }

  await browser.close();
  srv.close();
  console.log(JSON.stringify({ ergebnisse }));
  process.exit(ergebnisse.every((e) => e.ok) ? 0 : 1);
})().catch((e) => { console.log(JSON.stringify({ ergebnisse, absturz: String(e.stack || e) })); process.exit(1); });
