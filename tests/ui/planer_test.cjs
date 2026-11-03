// Planer-, Einkaufs- und Speicher-Tests (SPEC 12.2) mit Testplänen + UI-Abläufe im iPhone-Format.
// Aufruf: node tests/ui/planer_test.cjs <web-ordner> [<screenshot-ordner>]
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
  const shot = async (name) => { if (shotDir) { fs.mkdirSync(shotDir, { recursive: true }); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(shotDir, name + '.png') }); } };
  const gehe = async (hash) => { await page.goto(basis + 'index.html' + hash); await page.waitForSelector('#inhalt :is(h1,h2,.liste,.karte,p,.slot)'); await page.waitForTimeout(120); };
  await gehe('#/rezepte');

  // Hilfsfunktion im Browser: Testplan KW 45/2026 (Mo 02.11. – So 08.11., Einkauf Sa 31.10.)
  const logik = (fn, arg) => page.evaluate(async ([quelle, a]) => {
    const P = await import('./js/planer.js');
    const { D } = window.__app;
    const ctx = (extra = {}) => ({ rezepteMap: D.map, extrasMap: D.extrasMap, packungen: D.packungen, profil: D.profil, abteilungen: D.profil.einkauf.abteilungen, ...extra });
    const neu = () => P.leererPlan(2026, 45, D.profil);
    const setze = (p, datum, slot, id, opt = {}) => P.slotSetzen(p, datum, slot, { ...P.rezeptEintrag(id), ...opt });
    // eslint-disable-next-line no-new-func
    return new Function('P', 'D', 'ctx', 'neu', 'setze', 'a', quelle)(P, D, ctx, neu, setze, a);
  }, [fn.toString().replace(/^[^{]*{|}$/g, ''), arg]);

  await pruefe('Tagessumme mit Faktor 1,25 skaliert Mengen und Makros', async () => {
    const r = await logik(() => {
      const p = setze(neu(), '2026-11-02', 'abend', 'marry-me-chicken', { faktor: 1.25 });
      const s = P.tagesSumme(P.tagFinden(p, '2026-11-02'), D.map);
      const huhn = P.bedarfe(p, ctx()).filter((b) => b.zutat === 'Hähnchenbrustfilet roh').reduce((x, b) => x + b.g, 0);
      return { s, huhn, p: D.map['marry-me-chicken'].naehrwerte };
    });
    erwarte(Math.abs(r.s.kcal - r.p.kcal * 1.25) < 1e-9 && Math.abs(r.s.protein - r.p.protein * 1.25) < 1e-9, 'Makros ' + JSON.stringify(r.s));
    erwarte(r.huhn === 500, 'Hähnchen ' + r.huhn);
  });

  await pruefe('Auswärts wird gerechnet und erzeugt keine Zutaten', async () => {
    const r = await logik(() => {
      const p = P.slotSetzen(neu(), '2026-11-03', 'abend', P.auswaertsEintrag(D.profil));
      return { s: P.tagesSumme(P.tagFinden(p, '2026-11-03'), D.map), b: P.bedarfe(p, ctx()).length };
    });
    erwarte(r.s.kcal === 950 && r.s.protein === 40 && r.s.fett === 45 && r.s.kh === 90, JSON.stringify(r.s));
    erwarte(r.b === 0, 'Bedarfe: ' + r.b);
  });

  await pruefe('Reste erzeugen keine Zutaten, doppelt gekochtes Rezept zählt doppelt', async () => {
    const r = await logik(() => {
      let p = setze(neu(), '2026-11-02', 'abend', 'marry-me-chicken', { menge: 2 });
      p = P.restMorgenMittags(p, '2026-11-02', 'abend');
      const b = P.bedarfe(p, ctx()).filter((x) => x.zutat === 'Hähnchenbrustfilet roh');
      const q = P.resteAnalyse(p.tage, D.map)['2026-11-02/abend'];
      return { g: b.reduce((x, y) => x + y.g, 0), n: b.length, rest: P.slotLesen(p, '2026-11-03', 'mittag'), q };
    });
    erwarte(r.g === 800 && r.n === 1, `Hähnchen ${r.g} g in ${r.n} Bedarfen`);
    erwarte(r.rest && r.rest.art === 'rest' && r.rest.von === '2026-11-02/abend', 'Rest-Eintrag ' + JSON.stringify(r.rest));
    erwarte(r.q.gekocht === 4 && r.q.uebrig === 0, 'Portionen ' + JSON.stringify(r.q));
  });

  await pruefe('Hinweise: Protein (gelb/rot), Fett < 70, gleiche Küche/Proteinquelle, 1–2 ★', async () => {
    const r = await logik(() => {
      let p = neu();
      p = setze(p, '2026-11-02', 'fruehstueck', 'fruehstuecks-brownie');
      p = setze(p, '2026-11-02', 'abend', 'marry-me-chicken');
      p = setze(p, '2026-11-03', 'fruehstueck', 'fruehstuecks-brownie');
      p = setze(p, '2026-11-03', 'abend', 'high-protein-lasagne');
      p = setze(p, '2026-11-03', 'snack', 'quarkcreme-erdbeeren');
      p = setze(p, '2026-11-04', 'abend', 'spaghetti-bolognese');
      p = setze(p, '2026-11-06', 'fruehstueck', 'fruehstuecks-brownie');
      p = setze(p, '2026-11-06', 'mittag', 'marry-me-chicken');
      p = setze(p, '2026-11-06', 'snack', 'quarkcreme-erdbeeren');
      const h = P.hinweiseWoche(p, ctx({ bewertungen: { 'marry-me-chicken': { sterne: 2 } } }));
      return Object.fromEntries(Object.entries(h).map(([d, x]) => [d, { stufe: x.stufe, t: x.liste.map((l) => `${l.stufe}: ${l.text}`) }]));
    });
    const mo = r['2026-11-02'].t.join(' | '), fr = r['2026-11-06'].t.join(' | '), mi = r['2026-11-04'].t.join(' | ');
    erwarte(/rot: Protein .* unter 130/.test(mo), 'Protein rot: ' + mo);
    erwarte(/rot: Fett .* unter 70/.test(mo), 'Fett rot: ' + mo);
    erwarte(/nur 2 ★/.test(mo), '2 Sterne: ' + mo);
    erwarte(r['2026-11-02'].stufe === 'rot', 'Ampel Mo');
    erwarte(/gelb: Protein 144 g – unter 145/.test(fr), 'Protein gelb Fr: ' + fr);
    erwarte(/wieder Italienisch/.test(mi) && /wieder Rind/.test(mi), 'Küche/Protein Mi: ' + mi);
    erwarte(r['2026-11-05'].stufe === 'leer', 'leerer Tag');
  });

  await pruefe('Hinweise: Fisch/Hack später als 2 Tage nach Einkauf → „TK kaufen“; Rest zu alt; Rest ohne Portionen', async () => {
    const r = await logik(() => {
      let p = neu();   // Einkauf Sa 31.10.
      p = setze(p, '2026-11-05', 'abend', 'lachs-penne');
      p = setze(p, '2026-11-04', 'mittag', 'spaghetti-bolognese');
      p = setze(p, '2026-11-02', 'abend', 'marry-me-chicken', { menge: 2 });
      p = P.slotSetzen(p, '2026-11-06', 'mittag', P.restEintrag('2026-11-02/abend', P.slotLesen(p, '2026-11-02', 'abend')));
      p = setze(p, '2026-11-07', 'abend', 'chili-con-carne');
      p = P.slotSetzen(p, '2026-11-08', 'mittag', P.restEintrag('2026-11-07/abend', P.slotLesen(p, '2026-11-07', 'abend')));
      const h1 = P.hinweiseWoche(p, ctx());
      const mitTk = { ...p, tk_ersatz: ['Lachsfilet ohne Haut roh'] };
      const h2 = P.hinweiseWoche(mitTk, ctx());
      return { do: h1['2026-11-05'].liste, mi: h1['2026-11-04'].liste.map((x) => x.text), fr: h1['2026-11-06'].liste.map((x) => `${x.stufe}: ${x.text}`), so: h1['2026-11-08'].liste.map((x) => `${x.stufe}: ${x.text}`), do2: h2['2026-11-05'].liste.map((x) => x.text) };
    });
    const lachs = r.do.find((x) => /Lachsfilet/.test(x.text));
    erwarte(lachs && lachs.aktion && lachs.aktion.typ === 'tk' && /TK-Lachsfilet/.test(lachs.text), 'Lachs: ' + JSON.stringify(r.do));
    erwarte(r.mi.some((t) => /Rinderhackfleisch/.test(t)), 'Hack: ' + r.mi.join(' | '));
    erwarte(!r.do2.some((t) => /Lachsfilet/.test(t)), 'TK-Ersatz entfernt Hinweis nicht');
    erwarte(r.fr.some((t) => /^rot: .*4 Tage alt/.test(t)), 'Rest zu alt: ' + r.fr.join(' | '));
    erwarte(r.so.some((t) => /^rot: .*Nicht genug Portionen/.test(t)), 'Rest ohne Portionen: ' + r.so.join(' | '));
  });

  await pruefe('Erinnerungen für morgen: Vortag-Texte und Auftauen', async () => {
    const r = await logik(() => {
      let p = neu();
      p = setze(p, '2026-11-03', 'fruehstueck', 'overnight-oats-cheesecake');
      p = setze(p, '2026-11-03', 'abend', 'lachs-penne');
      return P.erinnerungen(p.tage, '2026-11-03', ctx({ tkErsatz: ['Lachsfilet ohne Haut roh'] })).map((x) => x.text);
    });
    erwarte(r.some((t) => /Overnight Oats .* am Abend ansetzen/.test(t)), 'Vortag: ' + r.join(' | '));
    erwarte(r.some((t) => /TK-Lachsfilet .* auftauen/.test(t)), 'Auftauen: ' + r.join(' | '));
  });

  await pruefe('Einkaufsliste: Kontrollrechnung, Packungen, Vorrat, Abteilungen, zwei Termine, Reste', async () => {
    const r = await logik(() => {
      let p = neu();
      p.einkauf = [{ datum: '2026-10-31', art: 'gross' }, { datum: '2026-11-04', art: 'frisch' }];
      p = setze(p, '2026-11-02', 'abend', 'marry-me-chicken', { faktor: 1.25 });     // 500 g Hähnchen (Termin 1)
      p = setze(p, '2026-11-05', 'abend', 'haehnchen-geschnetzeltes');               // 400 g Hähnchen (Termin 2, frisch)
      p = setze(p, '2026-11-03', 'fruehstueck', 'fruehstuecks-brownie', { menge: 2 });
      p = P.extraHinzufuegen(p, '2026-11-03', 'skyr-honig');
      const vorrat = [{ zutat: 'Basmatireis ungekocht', g: 100 }, { zutat: 'Magerquark', g: 200 }];
      const l = P.einkaufsliste(p, ctx(), vorrat);
      const alle = l.termine.flatMap((t, i) => t.artikel.map((a) => ({ ...a, termin: i })));
      const abt = D.profil.einkauf.abteilungen;
      const sortiert = l.termine.every((t) => t.artikel.every((a, i, arr) => i === 0 || abt.indexOf(arr[i - 1].abteilung) <= abt.indexOf(a.abteilung)));
      return { kontrolle: l.kontrolle, alle, sortiert, rest: l.restNachWoche, kosten: l.kosten, text: P.einkaufText(l) };
    });
    erwarte(r.kontrolle.ok, 'Kontrollrechnung ' + JSON.stringify(r.kontrolle));
    const huhn = r.alle.filter((a) => a.zutat === 'Hähnchenbrustfilet roh');
    erwarte(huhn.length === 2, 'Hähnchen auf zwei Termine: ' + JSON.stringify(huhn));
    const h1 = huhn.find((a) => a.termin === 0), h2 = huhn.find((a) => a.termin === 1);
    erwarte(h1.bedarf_g === 500 && h1.packungen === 2 && h1.kauf_g === 800, 'Termin 1 Hähnchen: ' + JSON.stringify(h1));
    erwarte(h2.bedarf_g === 400 && h2.packungen === 1, 'Termin 2 Hähnchen: ' + JSON.stringify(h2));
    const reis = r.alle.filter((a) => a.zutat === 'Basmatireis ungekocht');
    erwarte(reis.length === 1 && reis[0].termin === 0 && reis[0].vorrat_g === 100 && reis[0].bedarf_g === 215, 'Reis (lange haltbar → Termin 1, Vorratsabzug): ' + JSON.stringify(reis));
    const quark = r.alle.find((a) => a.zutat === 'Magerquark');
    erwarte(quark && quark.vorrat_g === 200 && quark.bedarf_g === 300 && quark.packungen === 1, 'Quark ×2 Brownie: ' + JSON.stringify(quark));
    erwarte(r.alle.some((a) => a.zutat === 'Skyr natur'), 'Extras zählen mit');
    erwarte(!r.alle.some((a) => a.zutat === 'Wasser'), 'Wasser darf nicht auf die Liste');
    erwarte(r.sortiert, 'Sortierung nach Abteilungen');
    const huhnRest = r.rest.find((x) => x.zutat === 'Hähnchenbrustfilet roh');
    erwarte(huhnRest && huhnRest.g === 300, 'Rest nach der Woche: ' + JSON.stringify(r.rest));
    erwarte(r.kosten.gesamt > 0 && /Hähnchenbrustfilet roh: 2 × 400-g-Packung/.test(r.text), 'Text/Kosten');
  });

  await pruefe('Export → Import ergibt identischen Plan; alter Format wird migriert; unbekannte ID stürzt nicht ab', async () => {
    const r = await logik(() => {
      let p = setze(neu(), '2026-11-02', 'abend', 'marry-me-chicken', { menge: 2 });
      p = P.restMorgenMittags(p, '2026-11-02', 'abend');
      const s = P.sicherungEinlesen(JSON.parse(JSON.stringify(P.sicherungErstellen({ plaene: { '2026-W45': p } }))));
      const e = P.sicherungEinlesen(JSON.parse(JSON.stringify(P.planExport(p, []))));
      const alt = { kw: 45, jahr: 2026, tage: [{ datum: '2026-11-02', slots: { abend: 'marry-me-chicken' }, auswaerts: { mahlzeit: 'mittag', kcal: 900, protein: 35, fett: 40, kh: 80 } }] };
      const m = P.migrierePlan(alt);
      const fremd = setze(neu(), '2026-11-02', 'abend', 'gibt-es-nicht');
      const h = P.hinweiseWoche(fremd, ctx());
      return { gleich: JSON.stringify(s.daten.plaene['2026-W45']) === JSON.stringify(P.migrierePlan(p)), gleich2: JSON.stringify(e.plan) === JSON.stringify(P.migrierePlan({ ...p, vorrat: [] })),
        typ: [s.typ, e.typ], m, fremd: h['2026-11-02'].liste.map((x) => x.text), summe: P.tagesSumme(P.tagFinden(fremd, '2026-11-02'), D.map), liste: P.einkaufsliste(fremd, ctx()).kontrolle };
    });
    erwarte(r.gleich && r.gleich2 && r.typ.join() === 'alles,plan', 'Export/Import ' + JSON.stringify(r.typ));
    erwarte(r.m.version === 1 && r.m.tage[0].slots.abend.typ === 'rezept' && r.m.tage[0].slots.mittag.typ === 'auswaerts' && r.m.tage[0].slots.mittag.kcal === 900 && r.m.tage[0].slots.fruehstueck === null, 'Migration ' + JSON.stringify(r.m.tage[0]));
    erwarte(r.fremd.some((t) => /nicht mehr vorhanden/.test(t)) && r.summe.kcal === 0 && r.liste.ok, 'Unbekannte ID');
  });

  await pruefe('UI: Rezept über Rezeptauswahl eintragen → Tagesbalken aktualisiert sich', async () => {
    await gehe('#/planer/2026-W47');
    await page.click('.slot[data-datum="2026-11-17"][data-slot="abend"]');
    await page.click('a.knopf.primaer[href^="#/auswahl/"]');
    await page.waitForSelector('#treffer [data-waehlen]');
    const erster = await page.getAttribute('#treffer [data-waehlen]', 'data-waehlen');
    erwarte(erster, 'Auswahl leer');
    await page.fill('#q', 'Marry');
    await page.click('[data-waehlen="marry-me-chicken"]');
    await page.waitForSelector('.slot[data-datum="2026-11-17"][data-slot="abend"].belegt');
    const t = await page.textContent('.slot[data-datum="2026-11-17"][data-slot="abend"]');
    erwarte(t.includes('Marry Me Chicken'), 'Slot: ' + t);
    await gehe('#/tag/2026-11-17');
    const inh = await page.textContent('#inhalt');
    erwarte(inh.includes('700 / 2.275 kcal'), 'Tagesbalken');
  });

  await pruefe('UI: doppelt kochen + „Rest morgen mittags“, Verschieben über Menü', async () => {
    await gehe('#/planer/2026-W47');
    await page.click('.slot[data-datum="2026-11-17"][data-slot="abend"]');
    await page.click('[data-menge="2"]');
    await page.click('#sl-rest');
    await page.waitForTimeout(150);
    const t = await page.textContent('.slot[data-datum="2026-11-18"][data-slot="mittag"]');
    erwarte(t.includes('Rest') && t.includes('Marry'), 'Rest Mi: ' + t);
    await page.click('.slot[data-datum="2026-11-18"][data-slot="mittag"]');
    await page.click('#sl-verschieben');
    await page.selectOption('#vs-tag', '2026-11-19');
    await page.click('#vs-ok');
    await page.waitForTimeout(150);
    const ziel = await page.textContent('.slot[data-datum="2026-11-19"][data-slot="mittag"]');
    erwarte(ziel.includes('Rest'), 'Verschoben: ' + ziel);
    await page.click('.slot[data-datum="2026-11-18"][data-slot="fruehstueck"]');
    await page.click('a.knopf.primaer[href^="#/auswahl/"]');
    await page.waitForSelector('#treffer [data-waehlen]');
    await page.click('[data-waehlen="protein-pancakes"]');
    await page.waitForSelector('.slot[data-datum="2026-11-18"][data-slot="fruehstueck"].belegt');
    await shot('7-planer-woche');
    await gehe('#/tag/2026-11-17');
    await shot('8-tagesansicht');
  });

  await pruefe('UI: Einkaufsliste rechnet aus dem Plan und merkt sich Haken nach Neuladen', async () => {
    await gehe('#/einkauf');
    const txt = await page.textContent('#inhalt');
    erwarte(txt.includes('Hähnchenbrustfilet roh') && txt.includes('800 g → 2 × 400-g-Packung'), 'Hähnchen fehlt/falsch');
    erwarte((await page.getAttribute('#kontrolle', 'data-ok')) === 'true', 'Kontrollrechnung');
    const id = await page.getAttribute('ul.einkauf input[data-haken]', 'data-haken');
    await page.check(`input[data-haken="${id}"]`);
    await page.waitForTimeout(400);
    await page.reload(); await page.waitForSelector('ul.einkauf');
    erwarte(await page.isChecked(`input[data-haken="${id}"]`), 'Haken weg nach Neuladen');
    await page.fill('#eigen-text', 'Spülmittel'); await page.click('#eigen-form button');
    erwarte((await page.textContent('#inhalt')).includes('Spülmittel'), 'Eigener Artikel');
    await shot('9-einkaufsliste');
  });

  await pruefe('UI: Plan mit unbekannter Rezept-ID und neue App-Version lassen gespeicherte Pläne unverändert', async () => {
    const vorher = await page.evaluate(() => {
      const roh = JSON.parse(localStorage.getItem('cook.plaene'));
      roh['2026-W48'] = { version: 1, kw: 48, jahr: 2026, einkauf: [], vorrat: [], tk_ersatz: [], tage: ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'].map((d) => ({ datum: d, slots: { fruehstueck: null, mittag: null, abend: d === '2026-11-23' ? { typ: 'rezept', rezept: 'umbenanntes-rezept', faktor: 1, art: 'kochen', menge: 1, personen: 2 } : null, snack: null }, extras: [], auswaerts: null, notiz: '', wenig_zeit: false })) };
      localStorage.setItem('cook.plaene', JSON.stringify(roh));
      return localStorage.getItem('cook.plaene');
    });
    await gehe('#/planer/2026-W48');
    erwarte((await page.textContent('#inhalt')).includes('Rezept nicht mehr vorhanden'), 'Anzeige fehlt');
    await gehe('#/einkauf'); await gehe('#/tag/2026-11-23'); await gehe('#/heute');
    // „neue App-Version“: zusätzliches Rezept in den Daten, Ansichten neu zeichnen
    await page.evaluate(() => { const { D } = window.__app; const r = { ...D.map['marry-me-chicken'], id: 'neues-rezept', name: 'Neues Rezept' }; D.rezepte.push(r); D.map[r.id] = r; location.hash = '#/planer/2026-W47'; });
    await page.waitForTimeout(200);
    const nachher = await page.evaluate(() => localStorage.getItem('cook.plaene'));
    erwarte(nachher === vorher, 'Gespeicherte Pläne wurden verändert');
    erwarte(jsFehler.length === 0, 'JS-Fehler: ' + jsFehler.join(' | '));
  });

  await pruefe('UI: Wochenplan-Datei importieren (Sicherung)', async () => {
    const plan = await logik(() => { return P.planExport(setze(P.leererPlan(2026, 50, D.profil), '2026-12-07', 'abend', 'chili-con-carne'), []); });
    const datei = path.join(require('os').tmpdir(), `kw50-${Date.now()}.json`);
    fs.writeFileSync(datei, JSON.stringify(plan));
    await gehe('#/sicherung');
    await page.setInputFiles('#imp-datei', datei);
    await page.waitForFunction(() => document.querySelector('#imp-status').textContent.length > 0);
    erwarte((await page.textContent('#imp-status')).includes('KW 50'), await page.textContent('#imp-status'));
    await gehe('#/planer/2026-W50');
    erwarte((await page.textContent('.slot[data-datum="2026-12-07"][data-slot="abend"]')).includes('Chili'), 'Import nicht im Planer');
  });

  await pruefe('UI: Heute zeigt Plan, Bilanz, Zeitplan', async () => {
    const heute = await page.evaluate(async () => {
      const P = await import('./js/planer.js'); const F = await import('./js/format.js');
      const d = F.datumIso(new Date()); const { jahr, kw } = P.wocheVon(d);
      const roh = JSON.parse(localStorage.getItem('cook.plaene') || '{}');
      let p = roh[P.wochenSchluessel(jahr, kw)] || P.leererPlan(jahr, kw, window.__app.D.profil);
      p = P.slotSetzen(p, d, 'fruehstueck', P.rezeptEintrag('protein-pancakes'));
      p = P.slotSetzen(p, d, 'mittag', P.rezeptEintrag('burrito-bowl-haehnchen'));
      p = P.slotSetzen(p, d, 'abend', P.rezeptEintrag('zitronen-lachs-ofenkartoffeln'));
      p = P.extraHinzufuegen(p, d, 'nuesse');
      roh[P.wochenSchluessel(jahr, kw)] = p; localStorage.setItem('cook.plaene', JSON.stringify(roh));
      localStorage.setItem('cook.letzte_sicherung', JSON.stringify(new Date().toISOString()));
      return d;
    });
    await gehe('#/heute');
    const t = await page.textContent('#inhalt');
    erwarte(t.includes('Zeitplan') && t.includes('Essen') && t.includes('Tagesbilanz'), 'Heute unvollständig');
    await shot('10-heute');
    erwarte(jsFehler.length === 0, 'JS-Fehler: ' + jsFehler.join(' | ') + heute);
  });

  await browser.close();
  srv.close();
  console.log(JSON.stringify({ ergebnisse }));
  process.exit(ergebnisse.every((e) => e.ok) ? 0 : 1);
})().catch((e) => { console.log(JSON.stringify({ absturz: String(e.stack || e) })); process.exit(1); });
