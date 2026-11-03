// Rezeptbuch-App – Oberfläche. Logik liegt in format.js, rezept.js, planer.js (reine Funktionen).
import { datumDe, datumIso, isoZuDatum, minuten, WOCHENTAGE, WOCHENTAGE_KURZ, zahl } from './format.js';
import { escapeHtml, inlineMd, macroFactorText, menge, rezeptText } from './rezept.js';
import * as P from './planer.js';
import * as S from './speicher.js';
import { oeffnen as kochmodusOeffnen } from './kochmodus.js';

const D = { rezepte: [], map: {}, profil: null, extras: [], extrasMap: {}, version: '' };
const $ = (sel, root = document) => root.querySelector(sel);
const KAT = { 'high-protein': 'High Protein', schnell: 'Schnell', 'meal-prep': 'Meal Prep', kalorienarm: 'Kalorienarm', 'fruehstueck-snacks': 'Frühstück & Snacks' };
const HINWEIS = 'Nährwerte sind berechnete Schätzwerte auf Basis von Durchschnittswerten und können je nach Produkt abweichen. Die Hinweise im Planer sind Orientierung und ersetzen keine Ernährungs- oder ärztliche Beratung.';

const ICON = {
  heute: '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
  rezepte: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  planer: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  einkauf: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20.5" r="1"/><circle cx="17" cy="20.5" r="1"/>',
  mehr: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  herz: '<path d="M12 20s-7-4.4-9.2-8.6C1.3 8.5 3 5 6.4 5c2 0 3.3 1.1 4 2.3h3.2C14.3 6.1 15.6 5 17.6 5 21 5 22.7 8.5 21.2 11.4 19 15.6 12 20 12 20z"/>',
};
const svg = (name, fill = false) => `<svg viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

// ---------- Daten laden ----------
async function laden() {
  const [r, p, x] = await Promise.all(['rezepte', 'profil', 'extras'].map((n) => fetch(`daten/${n}.json`).then((a) => a.json())));
  D.rezepte = r.rezepte; D.version = r.version;
  D.map = Object.fromEntries(D.rezepte.map((z) => [z.id, z]));
  D.profil = p; D.extras = x; D.extrasMap = Object.fromEntries(x.map((e) => [e.id, e]));
}

// ---------- Persönliche Daten ----------
const favoriten = () => new Set(S.lesen('favoriten', []));
function favoritUmschalten(id) {
  const f = favoriten();
  f.has(id) ? f.delete(id) : f.add(id);
  S.schreiben('favoriten', [...f]);
  return f.has(id);
}
function planFuer(datumIsoStr, anlegen = false) {
  const { jahr, kw } = P.isoWoche(isoZuDatum(datumIsoStr));
  const key = P.wochenSchluessel(jahr, kw);
  const alle = S.lesen('plaene', {});
  if (!alle[key] && anlegen) alle[key] = P.leererPlan(jahr, kw, D.profil);
  return { key, plan: alle[key] || null, alle };
}
function planSpeichern(key, plan) { const alle = S.lesen('plaene', {}); alle[key] = plan; S.schreiben('plaene', alle); }

// ---------- Hilfen ----------
const heuteIso = () => datumIso(new Date());
function kopf(titel, zurueck = null) {
  $('#kopf').innerHTML = (zurueck ? `<button class="zurueck" type="button" data-zurueck>‹ ${escapeHtml(zurueck)}</button>` : '') + `<h1>${escapeHtml(titel)}</h1>`;
  const b = $('[data-zurueck]');
  if (b) b.addEventListener('click', () => (history.length > 1 ? history.back() : (location.hash = '#/rezepte')));
}
function tabsMarkieren(tab) {
  for (const a of document.querySelectorAll('.tabs a')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}
const fuss = () => `<p class="fuss">${HINWEIS}</p>`;
const sterne = (b) => (b && b.sterne ? '★'.repeat(b.sterne) + '☆'.repeat(5 - b.sterne) : '');

function balken(label, ist, ziel, farbe, einheit) {
  const pct = ziel ? Math.min(100, (ist / ziel) * 100) : 0;
  const diff = ist - ziel;
  return `<div class="balken"><div class="zeile"><span>${label}</span><span class="zahl">${zahl(ist)} / ${zahl(ziel)} ${einheit}
    <span class="muted">(${diff >= 0 ? '+' : '−'}${zahl(Math.abs(diff))})</span></span></div>
    <div class="spur"><div class="fuell" style="width:${pct}%;background:${farbe}"></div></div></div>`;
}

// ---------- Ansicht: Heute ----------
function ansichtHeute() {
  kopf('Heute');
  const datum = heuteIso();
  const d = new Date();
  const { plan } = planFuer(datum);
  const tag = plan ? P.tagFinden(plan, datum) : null;
  const ziele = D.profil.tagesziele;
  const belegt = tag && P.SLOTS.some((s) => tag.slots[s]);
  let html = `<p class="muted">${WOCHENTAGE[d.getDay()]}, ${datumDe(d)}</p>`;
  if (!belegt) {
    html += `<div class="karte"><h2 style="margin-top:0">Für heute ist noch nichts geplant</h2>
      <p class="muted">Lege in der Rezeptsammlung Gerichte für heute fest oder plane gleich die ganze Woche.</p>
      <div class="knopf-reihe"><a class="knopf primaer" href="#/planer">Woche planen</a><a class="knopf" href="#/rezepte">Rezepte ansehen</a></div></div>`;
  } else {
    const summe = P.tagesSumme(tag, D.map, D.extrasMap);
    const rest = P.restMakros(summe, ziele);
    html += '<div class="karte"><h2 style="margin-top:0">Deine Mahlzeiten</h2><div class="liste">';
    let kochen = null;
    for (const s of P.SLOTS) {
      const e = tag.slots[s];
      if (!e) continue;
      const r = D.map[e.rezept];
      const w = P.slotWerte(e, D.map);
      if (r && !kochen && e.art !== 'rest') kochen = { r, f: e.faktor ?? 1 };
      html += `<a class="rezept-kachel" href="${r ? `#/rezept/${r.id}` : '#/planer'}"><span class="titel">${P.SLOT_NAMEN[s]}: ${r ? escapeHtml(r.name) : 'Rezept nicht mehr vorhanden'}</span><span></span>
        <span class="meta"><span><b>${zahl(w.kcal)}</b> kcal</span><span><b>${zahl(w.protein, 1)}</b> g Protein</span>${(e.faktor ?? 1) !== 1 ? `<span>× ${zahl(e.faktor, 2)}</span>` : ''}</span></a>`;
    }
    html += '</div></div><div class="karte"><h2 style="margin-top:0">Tagesbilanz</h2>' +
      balken('Kalorien', summe.kcal, ziele.kcal, 'var(--bar-c)', 'kcal') +
      balken('Protein', summe.protein, ziele.protein, 'var(--bar-p)', 'g') +
      balken('Fett', summe.fett, ziele.fett, 'var(--bar-f)', 'g') +
      balken('Kohlenhydrate', summe.kh, ziele.kh, 'var(--bar-k)', 'g') +
      `<p class="klein muted">Noch offen: ${zahl(Math.max(0, rest.kcal))} kcal · ${zahl(Math.max(0, rest.protein))} g Protein · ${zahl(Math.max(0, rest.fett))} g Fett · ${zahl(Math.max(0, rest.kh))} g KH</p></div>`;
    if (kochen) html += `<div class="knopf-reihe"><button class="knopf primaer" type="button" id="jetzt-kochen">Jetzt kochen: ${escapeHtml(kochen.r.name)}</button></div>`;
    setTimeout(() => { const b = $('#jetzt-kochen'); if (b) b.onclick = () => kochmodusOeffnen(kochen.r, kochen.f); });
  }
  // Erinnerungen für morgen
  const mDatum = P.morgen(datum);
  const { plan: mPlan } = planFuer(mDatum);
  const mTag = mPlan ? P.tagFinden(mPlan, mDatum) : null;
  const erinnerungen = [];
  if (mTag) for (const s of P.SLOTS) { const e = mTag.slots[s]; const r = e && D.map[e.rezept]; if (r && e.art !== 'rest') for (const v of r.vortag || []) erinnerungen.push(rezeptText(r, v)); }
  if (erinnerungen.length) html += `<div class="karte"><h2 style="margin-top:0">Für morgen vorbereiten</h2><ul class="punkte">${erinnerungen.map((t) => `<li>${inlineMd(t)}</li>`).join('')}</ul></div>`;
  html += `<div class="karte"><h2 style="margin-top:0">Deine Tagesziele</h2><p class="zahl">${zahl(ziele.kcal)} kcal · ${zahl(ziele.protein)} g Protein · ${zahl(ziele.fett)} g Fett · ${zahl(ziele.kh)} g KH</p><p class="klein muted">Stand MacroFactor ${datumDe(isoZuDatum(String(ziele.stand)))}</p></div>`;
  $('#inhalt').innerHTML = html + fuss();
}

// ---------- Ansicht: Rezeptbuch ----------
const FILTER_STANDARD = { q: '', mahlzeit: '', kategorie: '', kueche: '', protein: '', zeit: '', bewertung: '', fav: false, sort: 'name' };
function rezeptKachel(r, fav) {
  const p = r.naehrwerte;
  const aus = r.bewertung && r.bewertung.sterne && r.bewertung.sterne <= 2;
  return `<a class="rezept-kachel${aus ? ' aussortiert' : ''}" href="#/rezept/${r.id}" data-id="${r.id}">
    <span class="titel">${escapeHtml(r.name)}</span>
    <button class="herz" type="button" data-herz="${r.id}" aria-pressed="${fav}" aria-label="Favorit">${svg('herz', fav)}</button>
    <span class="meta"><span><b>${p.kcal}</b> kcal</span><span><b>${zahl(p.protein, 1)}</b> g P</span><span>${minuten(r.zeit.gesamt)}</span><span>${escapeHtml(r.kueche)}</span>${sterne(r.bewertung) ? `<span>${sterne(r.bewertung)}</span>` : ''}</span></a>`;
}
function filtern(f) {
  const q = f.q.trim().toLowerCase();
  const fav = favoriten();
  let l = D.rezepte.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.zutaten.some((z) => z.zutat.toLowerCase().includes(q)) || r.kueche.toLowerCase().includes(q))) return false;
    if (f.mahlzeit && r.mahlzeit !== f.mahlzeit) return false;
    if (f.kategorie && !r.kategorien.includes(f.kategorie)) return false;
    if (f.kueche && r.kueche !== f.kueche) return false;
    if (f.protein && r.hauptprotein !== f.protein) return false;
    if (f.zeit && r.zeit.gesamt > Number(f.zeit)) return false;
    const s = r.bewertung && r.bewertung.sterne;
    if (f.bewertung === 'aus' && s && s <= 2) return false;
    if (f.bewertung && f.bewertung !== 'aus' && (!s || s < Number(f.bewertung))) return false;
    if (f.fav && !fav.has(r.id)) return false;
    return true;
  });
  const sort = { name: (a, b) => a.name.localeCompare(b.name, 'de'), kcal: (a, b) => a.naehrwerte.kcal - b.naehrwerte.kcal, protein: (a, b) => b.naehrwerte.protein - a.naehrwerte.protein, zeit: (a, b) => a.zeit.gesamt - b.zeit.gesamt };
  return l.sort(sort[f.sort] || sort.name);
}
function ansichtRezepte() {
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
    <dt>Bewertung</dt><dd>${sterne(r.bewertung) || 'noch nicht bewertet'}</dd>
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

function ansichtRezept(id) {
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

// ---------- Dialoge ----------
function dialog(html) {
  const hg = document.createElement('div');
  hg.className = 'modal-hg';
  hg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(hg);
  hg.addEventListener('click', (e) => { if (e.target === hg || e.target.closest('[data-schliessen]')) hg.remove(); });
  return hg;
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
    const { key, plan } = planFuer(datum, true);
    const neu = P.slotSetzen(plan, datum, $('#pl-slot', hg).value, P.rezeptEintrag(r.id, Number($('#pl-faktor', hg).value)));
    planSpeichern(key, neu);
    hg.querySelector('.modal').innerHTML = `<h2 style="margin-top:0">Eingetragen ✅</h2><p>${escapeHtml(r.name)} am ${datumDe(isoZuDatum(datum))}.</p>
      <div class="knopf-reihe"><a class="knopf" href="#/planer" data-schliessen>Zum Planer</a><button class="knopf primaer" type="button" data-schliessen>OK</button></div>`;
  });
}

// ---------- Ansicht: Planer (Wochenübersicht – der volle Baukasten folgt in Phase 6) ----------
function ansichtPlaner() {
  kopf('Planer');
  const heute = new Date();
  const { jahr, kw } = P.isoWoche(heute);
  const { plan } = planFuer(datumIso(heute));
  const tage = P.tageDerWoche(jahr, kw);
  let html = `<p class="muted">KW ${kw} · ${datumDe(isoZuDatum(tage[0]))} – ${datumDe(isoZuDatum(tage[6]))}</p>`;
  for (const datum of tage) {
    const d = isoZuDatum(datum);
    const tag = plan ? P.tagFinden(plan, datum) : null;
    const summe = P.tagesSumme(tag, D.map, D.extrasMap);
    html += `<div class="karte"><b>${WOCHENTAGE_KURZ[d.getDay()]}, ${datumDe(d)}</b> <span class="muted klein">${zahl(summe.kcal)} kcal · ${zahl(summe.protein)} g P</span><ul class="punkte">`;
    for (const s of P.SLOTS) {
      const e = tag && tag.slots[s];
      const r = e && D.map[e.rezept];
      html += `<li>${P.SLOT_NAMEN[s]}: ${e ? (r ? `<a href="#/rezept/${r.id}">${escapeHtml(r.name)}</a>` : '<i>Rezept nicht mehr vorhanden</i>') : '<span class="muted">–</span>'}</li>`;
    }
    html += '</ul></div>';
  }
  html += '<p class="hinweis">Gerichte trägst du über „In Planer eintragen“ auf der Rezeptseite ein. Der volle Baukasten (Slots antippen, Reste, Hinweise, Vorlagen, Drag & Drop) kommt im nächsten Ausbauschritt.</p>';
  $('#inhalt').innerHTML = html + fuss();
}

function ansichtEinkauf() {
  kopf('Einkauf');
  $('#inhalt').innerHTML = '<div class="karte"><h2 style="margin-top:0">Einkaufsliste</h2><p class="muted">Die Einkaufsliste wird automatisch aus deinem Wochenplan berechnet – nach Abteilungen sortiert, auf Packungsgrößen gerundet, mit Vorratsabzug. Sie folgt im nächsten Ausbauschritt.</p></div>' + fuss();
}

function ansichtMehr() {
  kopf('Mehr');
  const z = D.profil.tagesziele;
  $('#inhalt').innerHTML = `
    <div class="karte"><h2 style="margin-top:0">Tagesziele</h2><p class="zahl">${zahl(z.kcal)} kcal · ${zahl(z.protein)} g Protein · ${zahl(z.fett)} g Fett · ${zahl(z.kh)} g KH</p>
      <p class="klein muted">Neue Ziele aus MacroFactor? Im Chat „Ziele: …“ schreiben – die App wird neu erzeugt.</p></div>
    <div class="karte"><h2 style="margin-top:0">Rezeptbuch</h2><p>${D.rezepte.length} Rezepte · Datenstand ${escapeHtml(D.version)}</p>
      <p class="klein muted">Vorrat, Vorlagen, Einstellungen und Sicherung (Export/Import) folgen mit dem Planer.</p></div>
    <div class="karte"><h2 style="margin-top:0">Zum Home-Bildschirm</h2><p class="klein">In Safari auf „Teilen“ tippen → „Zum Home-Bildschirm“. Danach startet das Rezeptbuch wie eine App und funktioniert auch offline.</p></div>` + fuss();
}

// ---------- Router ----------
function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'heute';
  const [teil, arg] = h.split('/');
  window.scrollTo(0, 0);
  $('#inhalt').onclick = null;
  const tab = { heute: 'heute', rezepte: 'rezepte', rezept: 'rezepte', kochen: 'rezepte', planer: 'planer', einkauf: 'einkauf', mehr: 'mehr' }[teil] || 'heute';
  tabsMarkieren(tab);
  if (teil === 'rezepte') ansichtRezepte();
  else if (teil === 'rezept') ansichtRezept(decodeURIComponent(arg || ''));
  else if (teil === 'kochen') { ansichtRezept(decodeURIComponent(arg || '')); const r = D.map[arg]; if (r) kochmodusOeffnen(r, 1); }
  else if (teil === 'planer') ansichtPlaner();
  else if (teil === 'einkauf') ansichtEinkauf();
  else if (teil === 'mehr') ansichtMehr();
  else ansichtHeute();
}

// ---------- Service Worker / Update-Hinweis ----------
function updateBanner(worker) {
  if ($('.banner')) return;
  const b = document.createElement('div');
  b.className = 'banner';
  b.innerHTML = '<span>Neue Rezepte verfügbar</span><button type="button">Neu laden</button>';
  b.querySelector('button').onclick = () => worker.postMessage('SKIP_WAITING');
  document.body.appendChild(b);
}
function serviceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) updateBanner(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) updateBanner(w); });
    });
  }).catch(() => { /* still */ });
  // Nur neu laden, wenn ein bestehender Service Worker durch eine neue Version ersetzt wurde –
  // nicht beim allerersten Laden (clients.claim() löst dort ebenfalls controllerchange aus).
  const hatteController = !!navigator.serviceWorker.controller;
  let neu = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hatteController && !neu) { neu = true; location.reload(); } });
}

async function start() {
  document.querySelector('.tabs').innerHTML = [['heute', 'Heute'], ['rezepte', 'Rezepte'], ['planer', 'Planer'], ['einkauf', 'Einkauf'], ['mehr', 'Mehr']]
    .map(([t, n]) => `<a href="#/${t}" data-tab="${t}">${svg(t)}<span>${n}</span></a>`).join('');
  try { await laden(); } catch (e) {
    $('#inhalt').innerHTML = '<p>Die Rezeptdaten konnten nicht geladen werden. Bitte mit Internet einmal neu laden.</p>';
    return;
  }
  window.addEventListener('hashchange', route);
  route();
  serviceWorker();
}

window.__app = { D, P };   // für Tests
start();
