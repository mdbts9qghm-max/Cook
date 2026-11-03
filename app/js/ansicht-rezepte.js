// Rezeptbuch und Rezeptseite
import { datumDe, isoZuDatum, minuten, zahl } from './format.js';
import { escapeHtml, inlineMd, macroFactorText, menge, rezeptText } from './rezept.js';
import * as P from './planer.js';
import * as S from './speicher.js';
import { oeffnen as kochmodusOeffnen } from './kochmodus.js';
import { $, D, KAT, bewertung, dialog, favoriten, favoritUmschalten, fuss, heuteIso, kopf, planFuerDatum, planSpeichern, sterne, svg } from './ui.js';

// ---------- Ansicht: Rezeptbuch ----------
export const FILTER_STANDARD = { q: '', mahlzeit: '', kategorie: '', kueche: '', protein: '', zeit: '', bewertung: '', fav: false, sort: 'name' };
export function rezeptKachel(r, fav) {
  const p = r.naehrwerte;
  const bw = bewertung(r.id); const aus = bw && bw.sterne && bw.sterne <= 2;
  return `<a class="rezept-kachel${aus ? ' aussortiert' : ''}" href="#/rezept/${r.id}" data-id="${r.id}">
    <span class="titel">${escapeHtml(r.name)}</span>
    <button class="herz" type="button" data-herz="${r.id}" aria-pressed="${fav}" aria-label="Favorit">${svg('herz', fav)}</button>
    <span class="meta"><span><b>${p.kcal}</b> kcal</span><span><b>${zahl(p.protein, 1)}</b> g P</span><span>${minuten(r.zeit.gesamt)}</span><span>${escapeHtml(r.kueche)}</span>${sterne(bewertung(r.id)) ? `<span>${sterne(bewertung(r.id))}</span>` : ''}</span></a>`;
}
export function filtern(f, liste = D.rezepte) {
  const q = f.q.trim().toLowerCase();
  const fav = favoriten();
  let l = liste.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.zutaten.some((z) => z.zutat.toLowerCase().includes(q)) || r.kueche.toLowerCase().includes(q))) return false;
    if (f.mahlzeit && r.mahlzeit !== f.mahlzeit) return false;
    if (f.kategorie && !r.kategorien.includes(f.kategorie)) return false;
    if (f.kueche && r.kueche !== f.kueche) return false;
    if (f.protein && r.hauptprotein !== f.protein) return false;
    if (f.zeit && r.zeit.gesamt > Number(f.zeit)) return false;
    const b = bewertung(r.id); const s = b && b.sterne;
    if (f.bewertung === 'aus' && s && s <= 2) return false;
    if (f.bewertung && f.bewertung !== 'aus' && (!s || s < Number(f.bewertung))) return false;
    if (f.fav && !fav.has(r.id)) return false;
    return true;
  });
  const sort = { name: (a, b) => a.name.localeCompare(b.name, 'de'), kcal: (a, b) => a.naehrwerte.kcal - b.naehrwerte.kcal, protein: (a, b) => b.naehrwerte.protein - a.naehrwerte.protein, zeit: (a, b) => a.zeit.gesamt - b.zeit.gesamt };
  return l.sort(sort[f.sort] || sort.name);
}
export function ansichtRezepte() {
  kopf('Rezepte');
  const f = { ...FILTER_STANDARD, ...S.lesen('filter', {}) };
  const werte = (feld) => [...new Set(D.rezepte.map((r) => r[feld]))].sort((a, b) => a.localeCompare(b, 'de'));
  const opt = (v, t, akt) => `<option value="${escapeHtml(v)}"${v === akt ? ' selected' : ''}>${escapeHtml(t)}</option>`;
  const mahlzeiten = [['', 'Alle'], ['Frühstück', 'Frühstück'], ['Mittag/Abend', 'Mittag/Abend'], ['Snack', 'Snacks']];
  $('#inhalt').innerHTML = `
    <div class="suche"><input type="search" id="q" placeholder="Rezept oder Zutat suchen" value="${escapeHtml(f.q)}" aria-label="Suche"></div>
    <div class="chips" role="group" aria-label="Mahlzeit">${mahlzeiten.map(([v, t]) => `<button class="chip" type="button" data-mahlzeit="${v}" aria-pressed="${f.mahlzeit === v}">${t}</button>`).join('')}
      <button class="chip" type="button" id="nur-fav" aria-pressed="${f.fav}">♥ Favoriten</button></div>
    <details id="filter-details"${['kategorie', 'kueche', 'protein', 'zeit', 'bewertung'].some((k) => f[k]) ? ' open' : ''}><summary class="muted" style="min-height:44px;display:flex;align-items:center">Filter & Sortierung</summary>
    <div class="filter-raster">
      <label>Kategorie<select id="f-kategorie">${opt('', 'Alle', f.kategorie)}${Object.entries(KAT).map(([k, t]) => opt(k, t, f.kategorie)).join('')}</select></label>
      <label>Küche<select id="f-kueche">${opt('', 'Alle', f.kueche)}${werte('kueche').map((k) => opt(k, k, f.kueche)).join('')}</select></label>
      <label>Hauptprotein<select id="f-protein">${opt('', 'Alle', f.protein)}${werte('hauptprotein').map((k) => opt(k, k, f.protein)).join('')}</select></label>
      <label>Max. Zeit<select id="f-zeit">${[['', 'Egal'], ['15', '15 min'], ['25', '25 min'], ['45', '45 min'], ['60', '1 h']].map(([v, t]) => opt(v, t, f.zeit)).join('')}</select></label>
      <label>Bewertung<select id="f-bewertung">${[['', 'Alle'], ['aus', 'Aussortierte ausblenden'], ['3', 'ab 3 ★'], ['4', 'ab 4 ★']].map(([v, t]) => opt(v, t, f.bewertung)).join('')}</select></label>
      <label>Sortierung<select id="f-sort">${[['name', 'Name'], ['kcal', 'kcal (aufsteigend)'], ['protein', 'Protein (absteigend)'], ['zeit', 'Zeit']].map(([v, t]) => opt(v, t, f.sort)).join('')}</select></label>
    </div><button class="knopf" type="button" id="f-reset">Filter zurücksetzen</button></details>
    <p class="muted klein" id="anzahl"></p><div class="liste" id="treffer"></div>` + fuss();

  const zeichnen = () => {
    const l = filtern(f);
    const fav = favoriten();
    $('#anzahl').textContent = `${l.length} von ${D.rezepte.length} Rezepten`;
    $('#treffer').innerHTML = l.map((r) => rezeptKachel(r, fav.has(r.id))).join('') || '<p class="muted">Keine Treffer – Filter lockern?</p>';
    S.schreiben('filter', f);
  };
  $('#q').addEventListener('input', (e) => { f.q = e.target.value; zeichnen(); });
  for (const b of document.querySelectorAll('[data-mahlzeit]')) b.addEventListener('click', () => {
    f.mahlzeit = b.dataset.mahlzeit;
    document.querySelectorAll('[data-mahlzeit]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    zeichnen();
  });
  $('#nur-fav').addEventListener('click', (e) => { f.fav = !f.fav; e.currentTarget.setAttribute('aria-pressed', f.fav); zeichnen(); });
  for (const k of ['kategorie', 'kueche', 'protein', 'zeit', 'bewertung', 'sort']) $(`#f-${k}`).addEventListener('change', (e) => { f[k] = e.target.value; zeichnen(); });
  $('#f-reset').addEventListener('click', () => { Object.assign(f, FILTER_STANDARD); S.schreiben('filter', f); ansichtRezepte(); });
  $('#treffer').addEventListener('click', (e) => {
    const h = e.target.closest('[data-herz]');
    if (!h) return;
    e.preventDefault();
    const an = favoritUmschalten(h.dataset.herz);
    h.setAttribute('aria-pressed', an); h.innerHTML = svg('herz', an);
    if (f.fav) zeichnen();
  });
  zeichnen();
}

// ---------- Ansicht: Rezeptseite ----------
function rezeptHtml(r, portionen) {
  const f = portionen / 2;
  const p = r.naehrwerte, z = D.profil.tagesziele;
  const t = (s) => inlineMd(rezeptText(r, s, f));
  const pr = (k) => `${zahl((p[k] / z[k]) * 100)} %`;
  const e4 = 4 * p.protein, e9 = 9 * p.fett, ek = 4 * p.kh, es = e4 + e9 + ek || 1;
  let gruppe = null, zut = '';
  for (const e of r.zutaten) {
    if (e.gruppe !== gruppe) {
      if (gruppe !== null || zut) zut += '</tbody></table>';
      gruppe = e.gruppe;
      zut += `${gruppe ? `<p class="gruppe">${escapeHtml(gruppe)}</p>` : ''}<table><thead><tr><th>Zutat</th><th class="r">Menge</th></tr></thead><tbody>`;
    }
    const hinweis = [e.hinweis, e.mitrechnen === false ? 'nicht mitgerechnet' : ''].filter(Boolean).join('; ');
    zut += `<tr><td>${escapeHtml(e.zutat)}${hinweis ? `<br><span class="muted klein">${escapeHtml(hinweis)}</span>` : ''}</td><td class="r zahl">${escapeHtml(menge(e, f))}</td></tr>`;
  }
  zut += '</tbody></table>';
  const a = r.aufbewahrung;
  const insp = r.inspiration ? `<dt>Inspiration</dt><dd>${escapeHtml(r.inspiration.quelle)} – ${escapeHtml(r.inspiration.aenderungen)}</dd>` : '';
  return `
  <p>${r.kategorien.map((k) => `<span class="tag">${KAT[k]}</span>`).join('')}</p>
  <dl class="kopf-info">
    <dt>Bewertung</dt><dd>${sterne(bewertung(r.id)) || 'noch nicht bewertet'}</dd>
    <dt>Küche</dt><dd>${escapeHtml(r.kueche)}</dd>${insp}
    <dt>Mahlzeit</dt><dd>${escapeHtml(r.mahlzeit)} (${escapeHtml(r.geschmack)})</dd>
    <dt>Hauptprotein</dt><dd>${escapeHtml(r.hauptprotein)}</dd>
    <dt>Schwierigkeit</dt><dd>${escapeHtml(r.schwierigkeit)}</dd>
    <dt>Zeit</dt><dd>Vorbereitung ${r.zeit.vorbereitung} min · Kochen ${r.zeit.kochen} min · Wartezeit ${minuten(r.zeit.wartezeit)} · <b>Gesamt ${minuten(r.zeit.gesamt)}</b></dd>
    <dt>Ausstattung</dt><dd>${escapeHtml(r.ausstattung.join(', '))}</dd>
    ${r.vortag && r.vortag.length ? `<dt>Am Vortag</dt><dd>${r.vortag.map(t).join('; ')}</dd>` : ''}
  </dl>
  <div class="knopf-reihe aktionen">
    <button class="knopf primaer" type="button" data-aktion="kochen">Kochmodus starten</button>
    <button class="knopf" type="button" data-aktion="planen">Einplanen</button>
    <button class="knopf" type="button" data-aktion="macrofactor" aria-label="Für MacroFactor kopieren">Für MacroFactor</button>
  </div>

  <h2 id="naehrwerte">Nährwerte pro Portion</h2>
  <div class="naehr-raster">
    <div><b class="zahl">${p.kcal}</b><span>kcal</span><i>${pr('kcal')}</i></div>
    <div><b class="zahl">${zahl(p.protein, 1)} g</b><span>Protein</span><i>${pr('protein')}</i></div>
    <div><b class="zahl">${zahl(p.fett, 1)} g</b><span>Fett</span><i>${pr('fett')}</i></div>
    <div><b class="zahl">${zahl(p.kh, 1)} g</b><span>KH</span><i>${pr('kh')}</i></div>
  </div>
  <p class="klein muted">davon gesättigt ${zahl(p.gesaettigt, 1)} g · Zucker ${zahl(p.zucker, 1)} g · Ballaststoffe ${zahl(p.ballaststoffe, 1)} g · Salz ${zahl(p.salz, 2)} g</p>
  <p class="klein">Protein pro 100 kcal: <b>${zahl((p.protein / p.kcal) * 100, 1)} g</b> · Makroverteilung: P ${zahl((e4 / es) * 100)} % · F ${zahl((e9 / es) * 100)} % · KH ${zahl((ek / es) * 100)} %</p>
  <p class="klein">Gewicht fertig: gesamt ca. ${zahl(r.gargewicht_gesamt)} g · pro Portion ca. <b>${zahl(r.gargewicht_portion)} g</b> (${r.gargewicht_gemessen ? 'gemessen' : 'geschätzt'})</p>
  <p class="hinweis">Fertiges Gericht wiegen und als Gesamtgewicht in MacroFactor eintragen, dann kannst du nach Gramm loggen. Orientierung: ca. ${zahl(r.gargewicht_gesamt)} g für 2 Portionen.</p>

  <h2>Zutaten</h2>
  <div class="portionen"><button type="button" data-portion="-1" aria-label="Weniger Portionen">−</button><output id="portionen" class="zahl">${portionen} ${portionen === 1 ? 'Portion' : 'Portionen'}</output><button type="button" data-portion="1" aria-label="Mehr Portionen">+</button></div>
  ${zut}

  <h2>Mise en place</h2><ul class="punkte">${r.mise_en_place.map((s) => `<li>${t(s)}</li>`).join('')}</ul>
  <h2>Zubereitung</h2><ol class="schritte">${r.schritte.map((s) => `<li><b>${escapeHtml(s.titel)}</b><br>${t(s.text)}${s.timer_min ? `<br><span class="timer-hinweis">⏱️ Timer ${s.timer_min} min</span>` : ''}</li>`).join('')}</ol>
  <h2>Zeitablauf</h2><ul class="punkte">${(r.zeitablauf.length ? r.zeitablauf : ['Keine parallelen Arbeitsschritte nötig.']).map((s) => `<li>${t(s)}</li>`).join('')}</ul>
  <h2>Häufige Fehler</h2><ul class="punkte">${r.fehler.map((s) => `<li>${t(s)}</li>`).join('')}</ul>
  <h2>Anrichten</h2><p>${t(r.anrichten)}</p>
  <h2>Meal Prep & Aufbewahrung</h2><ul class="punkte">
    <li><b>Kühlschrank:</b> ${a.kuehlschrank_tage ? `${a.kuehlschrank_tage} Tag${a.kuehlschrank_tage === 1 ? '' : 'e'}` : 'nicht vorgesehen'}</li>
    <li><b>Einfrierbar:</b> ${a.einfrierbar ? `ja${a.einfrieren_monate ? `, bis ${a.einfrieren_monate} Monat${a.einfrieren_monate === 1 ? '' : 'e'}` : ''}` : 'nein'}</li>
    <li><b>Aufwärmen:</b> ${escapeHtml(a.aufwaermen)}</li>${a.separat ? `<li><b>Separat lagern:</b> ${escapeHtml(a.separat)}</li>` : ''}</ul>
  <h2>Varianten & Austausch</h2><ul class="punkte">${r.varianten.map((s) => `<li>${t(s)}</li>`).join('')}</ul>
  <h2>Tipps</h2><ul class="punkte">${r.tipps.map((s) => `<li>${t(s)}</li>`).join('')}</ul>
  <h2>Nährwert-Berechnung</h2><p class="klein muted">Für 2 Portionen (Rohgewichte)</p>
  <div class="tabelle-scroll"><table><thead><tr><th>Zutat</th><th class="r">g</th><th class="r">kcal</th><th class="r">P</th><th class="r">F</th><th class="r">KH</th></tr></thead><tbody>
  ${r.zutaten.map((e) => e.mitrechnen === false ? `<tr><td>${escapeHtml(e.zutat)}</td><td class="r">${zahl(e.g)}</td><td class="r muted" colspan="4">nicht mitgerechnet</td></tr>`
    : `<tr><td>${escapeHtml(e.zutat)}</td><td class="r zahl">${zahl(e.g, e.g < 10 && !Number.isInteger(e.g) ? 1 : 0)}</td><td class="r zahl">${zahl(e.werte.kcal)}</td><td class="r zahl">${zahl(e.werte.protein, 1)}</td><td class="r zahl">${zahl(e.werte.fett, 1)}</td><td class="r zahl">${zahl(e.werte.kh, 1)}</td></tr>`).join('')}
  <tr><td><b>Summe</b></td><td></td><td class="r"><b>${zahl(r.gesamt.kcal)}</b></td><td class="r"><b>${zahl(r.gesamt.protein, 1)}</b></td><td class="r"><b>${zahl(r.gesamt.fett, 1)}</b></td><td class="r"><b>${zahl(r.gesamt.kh, 1)}</b></td></tr>
  <tr><td><b>pro Portion</b></td><td></td><td class="r"><b>${zahl(p.kcal)}</b></td><td class="r"><b>${zahl(p.protein, 1)}</b></td><td class="r"><b>${zahl(p.fett, 1)}</b></td><td class="r"><b>${zahl(p.kh, 1)}</b></td></tr></tbody></table></div>
  <p class="klein">Plausibilitätscheck (4 × P + 4 × KH + 9 × F + 2 × Ballaststoffe): ${r.plausi.abweichung >= 0 ? '+' : '−'}${zahl(Math.abs(r.plausi.abweichung), 1)} % ${r.plausi.ok ? '✅ bestanden' : '❌'}</p>
  <p class="klein muted"><a href="${r.url}">Statische Rezeptseite (für den Link-Import in MacroFactor)</a></p>`;
}

export function ansichtRezept(id) {
  const r = D.map[id];
  if (!r) { kopf('Rezept', 'Rezepte'); $('#inhalt').innerHTML = '<p>Dieses Rezept gibt es nicht (mehr).</p><a class="knopf" href="#/rezepte">Zum Rezeptbuch</a>'; return; }
  kopf(r.name, 'Rezepte');
  let portionen = 2;
  const zeichnen = () => {
    $('#inhalt').innerHTML = `<h1>${escapeHtml(r.name)}</h1>` + rezeptHtml(r, portionen) + fuss();
  };
  zeichnen();
  $('#inhalt').onclick = async (e) => {
    const pb = e.target.closest('[data-portion]');
    if (pb) {
      portionen = Math.min(6, Math.max(1, portionen + Number(pb.dataset.portion)));
      const y = window.scrollY; zeichnen(); window.scrollTo(0, y); return;
    }
    const b = e.target.closest('[data-aktion]');
    if (!b) return;
    if (b.dataset.aktion === 'kochen') kochmodusOeffnen(r, portionen / 2);
    if (b.dataset.aktion === 'planen') planenDialog(r);
    if (b.dataset.aktion === 'macrofactor') {
      const text = `${r.name} (${portionen} Portionen)\n${macroFactorText(r, portionen / 2)}`;
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (_) { /* Fallback unten */ }
      dialog(`<h2 style="margin-top:0">${ok ? 'Kopiert ✅' : 'Zum Kopieren markieren'}</h2>
        <p class="klein muted">In MacroFactor: Rezept anlegen → Zutaten aus Text einfügen. Danach das fertige Gericht wiegen und als Gesamtgewicht eintragen.</p>
        <textarea rows="10" readonly id="mf-text">${escapeHtml(text)}</textarea>
        <div class="knopf-reihe"><button class="knopf primaer" type="button" data-schliessen>Fertig</button></div>`);
      const ta = $('#mf-text'); if (ta && !ok) { ta.focus(); ta.select(); }
    }
  };
}

function planenDialog(r) {
  const vorschlag = r.mahlzeit === 'Frühstück' ? 'fruehstueck' : r.mahlzeit === 'Snack' ? 'snack' : 'abend';
  const hg = dialog(`<h2 style="margin-top:0">In Planer eintragen</h2><p class="muted">${escapeHtml(r.name)}</p>
    <label>Tag<input type="date" id="pl-datum" value="${heuteIso()}"></label>
    <label>Mahlzeit<select id="pl-slot">${P.SLOTS.map((s) => `<option value="${s}"${s === vorschlag ? ' selected' : ''}>${P.SLOT_NAMEN[s]}</option>`).join('')}</select></label>
    <label>Portionsfaktor<select id="pl-faktor">${[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((x) => `<option value="${x}"${x === 1 ? ' selected' : ''}>× ${zahl(x, 2)} (${zahl(r.naehrwerte.kcal * x)} kcal)</option>`).join('')}</select></label>
    <div class="knopf-reihe"><button class="knopf" type="button" data-schliessen>Abbrechen</button><button class="knopf primaer" type="button" id="pl-ok">Eintragen</button></div>`);
  $('#pl-ok', hg).addEventListener('click', () => {
    const datum = $('#pl-datum', hg).value;
    if (!datum) return;
    const plan = planFuerDatum(datum, true);
    const neu = P.slotSetzen(plan, datum, $('#pl-slot', hg).value, P.rezeptEintrag(r.id, Number($('#pl-faktor', hg).value)));
    planSpeichern(neu);
    hg.querySelector('.modal').innerHTML = `<h2 style="margin-top:0">Eingetragen ✅</h2><p>${escapeHtml(r.name)} am ${datumDe(isoZuDatum(datum))}.</p>
      <div class="knopf-reihe"><a class="knopf" href="#/planer" data-schliessen>Zum Planer</a><button class="knopf primaer" type="button" data-schliessen>OK</button></div>`;
  });
}

