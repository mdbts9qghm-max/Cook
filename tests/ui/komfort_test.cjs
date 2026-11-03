// Phase 7: Kühlschrank-Modus und Bewertungen (SPEC 11.1, 11.2) – Logik + UI im iPhone-Format.
// Aufruf: node tests/ui/komfort_test.cjs <web-ordner> [<screenshot-ordner>]
const fs = require('fs');
const path = require('path');
const { server, protokoll, erwarte } = require('./hilfe.cjs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log(JSON.stringify({ skip: 'playwright fehlt' })); process.exit(0); }

const [webRoot, shotDir] = process.argv.slice(2);

(async () => {
  const srv = await server(webRoot);
  const basis = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  const jsFehler = [];
  page.on('pageerror', (e) => jsFehler.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') jsFehler.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  const { ergebnisse, pruefe } = protokoll();
  const shot = async (name, oben = true) => { if (shotDir) { fs.mkdirSync(shotDir, { recursive: true }); if (oben) await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(shotDir, name + '.png') }); } };
  const gehe = async (hash) => { await page.goto(basis + 'index.html' + hash); await page.waitForSelector('#inhalt :is(h1,h2,.liste,.karte,p)'); await page.waitForTimeout(120); };
  await gehe('#/heute');
  const logik = (fn, arg) => page.evaluate(async ([quelle, a]) => {
    const P = await import('./js/planer.js');
    const { D } = window.__app;
    // eslint-disable-next-line no-new-func
    return new Function('P', 'D', 'a', quelle)(P, D, a);
  }, [fn.toString().replace(/^[^{]*{|}$/g, ''), arg]);

  // ---------- Kühlschrank-Logik ----------
  await pruefe('Kühlschrank: Sortierung nach Treffern, dann wenig Fehlendem; Basics und Vorrat gelten als vorhanden', async () => {
    const r = await logik(() => {
      const aus = ['Hähnchenbrustfilet roh', 'Basmatireis ungekocht', 'Skyr natur'];
      const t = P.kuehlschrank(aus, D.rezepte, { packungen: D.packungen });
      const mitVorrat = P.kuehlschrank(aus, D.rezepte, { packungen: D.packungen, vorrat: [{ zutat: 'Knoblauch', g: 50 }] });
      const sortiert = t.every((x, i) => i === 0 || t[i - 1].hat.length > x.hat.length || (t[i - 1].hat.length === x.hat.length && t[i - 1].fehlt.length <= x.fehlt.length));
      const salzFehlt = t.some((x) => x.fehlt.includes('Salz') || x.fehlt.some((z) => D.packungen[z] && D.packungen[z].abteilung === 'Gewürze & Öle'));
      const alleNutzen = t.every((x) => x.hat.length >= 1 && x.hat.every((z) => aus.includes(z)));
      const knoblauch = mitVorrat.some((x) => x.fehlt.includes('Knoblauch'));
      return { n: t.length, erste: t[0], sortiert, salzFehlt, alleNutzen, knoblauch, leer: P.kuehlschrank([], D.rezepte).length };
    });
    erwarte(r.n > 5 && r.sortiert && r.alleNutzen, 'Sortierung/Treffer ' + JSON.stringify(r.erste));
    erwarte(r.erste.hat.length === 3, 'bester Treffer nutzt alle drei: ' + JSON.stringify(r.erste));
    erwarte(!r.salzFehlt, 'Gewürze dürfen nicht als fehlend gelten');
    erwarte(!r.knoblauch, 'Vorrat zählt als vorhanden');
    erwarte(r.leer === 0, 'leere Auswahl → keine Treffer');
  });

  await pruefe('Kühlschrank: Faktor-Vorschlag passt zu den Restmakros, aussortierte Rezepte ausgeblendet', async () => {
    const r = await logik(() => {
      const mmc = D.map['marry-me-chicken'];
      const gross = P.faktorVorschlag(mmc, { kcal: 1800, protein: 130, fett: 60, kh: 180 }, 1);
      const klein = P.faktorVorschlag(mmc, { kcal: 380, protein: 35, fett: 10, kh: 35 }, 1);
      const genau = P.faktorVorschlag(mmc, mmc.naehrwerte, 1);
      const aus = ['Hähnchenbrustfilet roh'];
      const mit = P.kuehlschrank(aus, D.rezepte, { packungen: D.packungen }).some((x) => x.rezept === 'marry-me-chicken');
      const ohne = P.kuehlschrank(aus, D.rezepte, { packungen: D.packungen, bewertungen: { 'marry-me-chicken': { sterne: 2 } } }).some((x) => x.rezept === 'marry-me-chicken');
      return { gross, klein, genau, mit, ohne };
    });
    erwarte(r.gross === 2 && r.klein === 0.5 && r.genau === 1, 'Faktoren ' + JSON.stringify(r));
    erwarte(r.mit && !r.ohne, 'aussortiert ' + JSON.stringify(r));
  });

  await pruefe('Export: Wochenplan enthält Bewertungen, Import trennt sie wieder ab', async () => {
    const r = await logik(() => {
      const p = P.leererPlan(2026, 47, D.profil);
      const ex = P.planExport(p, [], { 'marry-me-chicken': { sterne: 4 } });
      const ein = P.sicherungEinlesen(JSON.parse(JSON.stringify(ex)));
      return { ex: ex.bewertungen, ein: ein.bewertungen, imPlan: 'bewertungen' in ein.plan };
    });
    erwarte(r.ex['marry-me-chicken'].sterne === 4 && r.ein['marry-me-chicken'].sterne === 4 && !r.imPlan, JSON.stringify(r));
  });

  // ---------- Kühlschrank-UI ----------
  await pruefe('Kühlschrank-Ansicht: Zutaten wählen, Treffer, Einplanen mit Faktor', async () => {
    await page.evaluate(() => { localStorage.removeItem('cook.kuehlschrank'); localStorage.removeItem('cook.plaene'); });
    await gehe('#/mehr');
    await page.click('a[href="#/kuehlschrank"]');
    await page.waitForSelector('#ks-suche');
    erwarte((await page.textContent('#inhalt')).includes('Wähle ein paar Zutaten'), 'Leerzustand fehlt');
    await page.fill('#ks-suche', 'hähnchenbrust');
    await page.press('#ks-suche', 'Enter');
    await page.waitForSelector('[data-weg="Hähnchenbrustfilet roh"]');
    await page.click('#ks-haeufig summary');
    await page.click('[data-dazu="Basmatireis ungekocht"]');
    await page.click('[data-dazu="Skyr natur"]');
    await page.waitForSelector('.ks-treffer');
    const erste = await page.$eval('.ks-treffer', (el) => el.textContent);
    erwarte(erste.includes('✓') && erste.includes('Vorschlag für heute'), 'Treffer-Karte: ' + erste.slice(0, 200));
    const gespeichert = await page.evaluate(() => JSON.parse(localStorage.getItem('cook.kuehlschrank')));
    erwarte(gespeichert.length === 3, 'Auswahl gespeichert: ' + JSON.stringify(gespeichert));
    await page.evaluate(() => { localStorage.setItem('cook.kuehlschrank_offen', 'false'); });
    await page.reload(); await page.waitForSelector('.ks-treffer');
    await shot('11-kuehlschrank');
    const breite = await page.evaluate(() => document.documentElement.scrollWidth);
    erwarte(breite <= 390, 'horizontal scrollbar: ' + breite);
    // Einplanen übernimmt den Faktor-Vorschlag
    const f = await page.$eval('.ks-treffer [data-planen]', (b) => ({ id: b.dataset.planen, f: Number(b.dataset.faktor) }));
    await page.click('.ks-treffer [data-planen]');
    await page.waitForSelector('#pl-ok');
    erwarte(Number(await page.inputValue('#pl-faktor')) === f.f, 'Faktor im Dialog');
    await page.click('#pl-ok');
    const eintrag = await page.evaluate(([id]) => {
      const roh = JSON.parse(localStorage.getItem('cook.plaene') || '{}');
      for (const p of Object.values(roh)) for (const t of p.tage) for (const e of Object.values(t.slots)) if (e && e.rezept === id) return e;
      return null;
    }, [f.id]);
    erwarte(eintrag && eintrag.faktor === f.f, 'Eintrag ' + JSON.stringify(eintrag));
    await page.click('.modal button[data-schliessen]');
    // Entfernen per Chip
    await page.click('[data-weg="Skyr natur"]');
    erwarte((await page.evaluate(() => JSON.parse(localStorage.getItem('cook.kuehlschrank')))).length === 2, 'Chip entfernen');
  });

  // ---------- Bewertungen ----------
  await pruefe('Bewerten auf der Rezeptseite: 2 ★ → aussortiert, Kommentar, Löschen', async () => {
    await page.evaluate(() => localStorage.removeItem('cook.bewertungen'));
    await gehe('#/rezept/marry-me-chicken');
    await page.click('[data-aktion="bewerten"]');
    await page.waitForSelector('.sterne-wahl');
    erwarte(await page.isDisabled('#bw-ok'), 'Speichern ohne Sterne gesperrt');
    await page.click('[data-stern="2"]');
    erwarte((await page.textContent('#bw-text')).includes('aussortiert'), 'Hinweis aussortiert');
    await page.fill('#bw-kommentar', 'zu trocken');
    await shot('12-bewerten', false);
    await page.click('#bw-ok');
    const b = await page.evaluate(() => JSON.parse(localStorage.getItem('cook.bewertungen'))['marry-me-chicken']);
    erwarte(b.sterne === 2 && b.kommentar === 'zu trocken' && /^\d{4}-\d\d-\d\d$/.test(b.datum), JSON.stringify(b));
    const t = await page.textContent('.kopf-info');
    erwarte(t.includes('★★☆☆☆') && t.includes('aussortiert') && t.includes('zu trocken'), 'Anzeige: ' + t.slice(0, 200));
    // Planer-Auswahl blendet aus
    await gehe('#/auswahl/2026-11-17/abend');
    erwarte(!(await page.textContent('#inhalt')).includes('Marry Me Chicken'), 'Planer-Auswahl zeigt aussortiertes Rezept');
    // Löschen
    await gehe('#/rezept/marry-me-chicken');
    await page.click('[data-aktion="bewerten"]');
    await page.click('#bw-loeschen');
    erwarte(!(await page.evaluate(() => JSON.parse(localStorage.getItem('cook.bewertungen'))['marry-me-chicken'])), 'gelöscht');
  });

  await pruefe('Kochmodus fertig → „Wie war’s?“, Abbrechen fragt nicht', async () => {
    await gehe('#/rezept/protein-pancakes');
    await page.click('[data-aktion="kochen"]');
    await page.waitForSelector('.koch');
    await page.click('.koch [data-aktion="schliessen"]');
    await page.waitForTimeout(150);
    erwarte(!(await page.$('.sterne-wahl')), 'Abbrechen darf nicht nach Bewertung fragen');
    await page.click('[data-aktion="kochen"]');
    await page.waitForSelector('.koch');
    for (let i = 0; i < 40 && (await page.$('.koch')); i++) await page.click('.koch [data-aktion="weiter"]');
    await page.waitForSelector('.sterne-wahl');
    erwarte((await page.textContent('.modal')).includes('Wie war'), 'Titel');
    await page.click('[data-stern="5"]');
    await page.click('#bw-ok');
    const b = await page.evaluate(() => JSON.parse(localStorage.getItem('cook.bewertungen'))['protein-pancakes']);
    erwarte(b && b.sterne === 5, JSON.stringify(b));
    erwarte(jsFehler.length === 0, 'JS-Fehler: ' + jsFehler.join(' | '));
  });

  await pruefe('Chat-Befehle unter Mehr: alle Befehle aus SPEC 14 sichtbar, Kopieren', async () => {
    await gehe('#/mehr');
    await page.click('a[href="#/befehle"]');
    await page.waitForSelector('.befehl');
    const window_profil_link = await page.evaluate(() => window.__app.D.profil.claude_chat);
    const t = await page.textContent('#inhalt');
    for (const b of ['Import', 'Import: [Link oder Text]', 'Kühlschrank: [Zutaten]', 'bewerten [Rezept] [Sterne] [Kommentar]', 'neue Rezepte', 'Küche: [Name]',
      'trending', 'anpassen [Rezept]', 'Extra: [Name, Zutaten]', 'Ziele: [kcal, P, F, KH]', 'Plan prüfen', 'App-Wunsch: [Beschreibung]', 'Web-App aktualisieren']) {
      erwarte(t.includes(b), 'fehlt: ' + b);
    }
    const breite = await page.evaluate(() => document.documentElement.scrollWidth);
    erwarte(breite <= 390, 'horizontal scrollbar: ' + breite);
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.click('[data-kopieren="Kühlschrank: Hähnchen, Reis, Skyr"]');
    await page.waitForSelector('.banner');
    await shot('13-befehle');
    // Link zum Chat (Profil, in den Einstellungen änderbar)
    const href = await page.getAttribute('.chat-knopf', 'href');
    erwarte(/^https:\/\/claude\.ai\//.test(href) && href === window_profil_link, 'Chat-Link: ' + href);
    await gehe('#/einstellungen');
    await page.fill('#chat-link-feld', 'https://claude.ai/chat/test-123');
    await page.press('#chat-link-feld', 'Tab');
    await gehe('#/mehr');
    erwarte((await page.getAttribute('#chat-link', 'href')) === 'https://claude.ai/chat/test-123', 'eigener Link');
    await gehe('#/einstellungen');
    await page.fill('#chat-link-feld', 'kein link');
    await page.press('#chat-link-feld', 'Tab');
    erwarte((await page.evaluate(() => JSON.parse(localStorage.getItem('cook.einstellungen')).chat_link)) === 'https://claude.ai/chat/test-123', 'ungültiger Link darf nicht gespeichert werden');
    erwarte(jsFehler.length === 0, 'JS-Fehler: ' + jsFehler.join(' | '));
  });

  await browser.close();
  srv.close();
  console.log(JSON.stringify({ ergebnisse }));
  process.exit(ergebnisse.every((e) => e.ok) ? 0 : 1);
})().catch((e) => { console.log(JSON.stringify({ absturz: String(e.stack || e) })); process.exit(1); });
