// Gemeinsame Oberflächen-Hilfen und Zugriff auf Daten & Browser-Speicher
import { datumIso, isoZuDatum, zahl } from './format.js';
import { escapeHtml } from './rezept.js';
import * as P from './planer.js';
import * as S from './speicher.js';

export const D = { rezepte: [], map: {}, profil: null, extras: [], extrasMap: {}, packungen: {}, version: '' };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const KAT = { 'high-protein': 'High Protein', schnell: 'Schnell', 'meal-prep': 'Meal Prep', kalorienarm: 'Kalorienarm', 'fruehstueck-snacks': 'Frühstück & Snacks' };
export const HINWEIS = 'Nährwerte sind berechnete Schätzwerte auf Basis von Durchschnittswerten und können je nach Produkt abweichen. Die Hinweise im Planer sind Orientierung und ersetzen keine Ernährungs- oder ärztliche Beratung.';

const ICON = {
  heute: '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
  rezepte: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  planer: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  einkauf: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20.5" r="1"/><circle cx="17" cy="20.5" r="1"/>',
  mehr: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  herz: '<path d="M12 20s-7-4.4-9.2-8.6C1.3 8.5 3 5 6.4 5c2 0 3.3 1.1 4 2.3h3.2C14.3 6.1 15.6 5 17.6 5 21 5 22.7 8.5 21.2 11.4 19 15.6 12 20 12 20z"/>',
};
export const svg = (name, fill = false) => `<svg viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

export async function laden() {
  const [r, p, x, pk] = await Promise.all(['rezepte', 'profil', 'extras', 'packungen'].map((n) => fetch(`daten/${n}.json`).then((a) => a.json())));
  D.rezepte = r.rezepte; D.version = r.version;
  D.map = Object.fromEntries(D.rezepte.map((z) => [z.id, z]));
  D.profil = p; D.extras = x; D.extrasMap = Object.fromEntries(x.map((e) => [e.id, e])); D.packungen = pk;
}

// ---------- Kopf, Tabs, Dialoge ----------
export function kopf(titel, zurueck = null, zurueckZiel = '#/rezepte') {
  $('#kopf').innerHTML = (zurueck ? `<button class="zurueck" type="button" data-zurueck>‹ ${escapeHtml(zurueck)}</button>` : '') + `<h1>${escapeHtml(titel)}</h1>`;
  const b = $('[data-zurueck]');
  if (b) b.addEventListener('click', () => (history.length > 1 ? history.back() : (location.hash = zurueckZiel)));
}
export function tabsMarkieren(tab) {
  for (const a of $$('.tabs a')) { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
}
export const fuss = () => `<p class="fuss">${HINWEIS}</p>`;
export const sterne = (b) => (b && b.sterne ? '★'.repeat(b.sterne) + '☆'.repeat(5 - b.sterne) : '');
export function bewertung(id) { const lokal = S.lesen('bewertungen', {})[id]; return lokal || (D.map[id] && D.map[id].bewertung) || null; }
/** Lokale Bewertung speichern (sterne 1–5) oder löschen (sterne null) – SPEC 11.2 */
export function bewertungSetzen(id, sterneZahl, kommentar = '') {
  const alle = S.lesen('bewertungen', {});
  if (!sterneZahl) delete alle[id];
  else alle[id] = { sterne: sterneZahl, kommentar: String(kommentar || '').trim() || null, datum: heuteIso() };
  S.schreiben('bewertungen', alle);
}
const STERNE_TEXT = ['', 'nicht nochmal – wird aussortiert', 'eher nicht – wird aussortiert', 'okay – max. 1× pro Woche', 'gut', 'super!'];
export function bewertungDialog(r, nachher = () => {}, titel = 'Bewerten') {
  const lokal = S.lesen('bewertungen', {})[r.id];
  const b = bewertung(r.id) || {};
  let wahl = b.sterne || 0;
  const hg = dialog(`<h2 style="margin-top:0">${escapeHtml(titel)}</h2><p class="muted">${escapeHtml(r.name)}</p>
    <div class="sterne-wahl" role="radiogroup" aria-label="Sterne">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" data-stern="${n}" aria-label="${n} Stern${n > 1 ? 'e' : ''}">★</button>`).join('')}</div>
    <p class="klein muted" id="bw-text"></p>
    <label>Kommentar (optional)<textarea id="bw-kommentar" rows="3" placeholder="z. B. zu trocken, mehr Sauce">${escapeHtml(b.kommentar || '')}</textarea></label>
    <p class="klein muted">Wird in diesem Browser gespeichert und ist in der Sicherung enthalten. Schick mir die Sicherung, dann übernehme ich Sterne und Kommentar ins Rezept.</p>
    <div class="knopf-reihe">${lokal ? '<button class="knopf" type="button" id="bw-loeschen">Löschen</button>' : '<button class="knopf" type="button" data-schliessen>Später</button>'}
    <button class="knopf primaer" type="button" id="bw-ok" disabled>Speichern</button></div>`);
  const zeigen = () => {
    for (const s of $$('[data-stern]', hg)) { const n = +s.dataset.stern; s.classList.toggle('an', n <= wahl); s.setAttribute('aria-checked', String(n === wahl)); }
    $('#bw-text', hg).textContent = wahl ? `${wahl} ★ – ${STERNE_TEXT[wahl]}` : 'Tippe auf die Sterne.';
    $('#bw-ok', hg).disabled = !wahl;
  };
  hg.addEventListener('click', (e) => {
    const s = e.target.closest('[data-stern]');
    if (s) { wahl = +s.dataset.stern; zeigen(); }
    if (e.target.id === 'bw-ok') { bewertungSetzen(r.id, wahl, $('#bw-kommentar', hg).value); hg.schliessen(); meldung(`${r.name}: ${wahl} ★ gespeichert`); nachher(); }
    if (e.target.id === 'bw-loeschen') { bewertungSetzen(r.id, null); hg.schliessen(); meldung('Bewertung gelöscht'); nachher(); }
  });
  zeigen();
  return hg;
}

export function dialog(html, beimSchliessen = null) {
  const hg = document.createElement('div');
  hg.className = 'modal-hg';
  hg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(hg);
  const zu = () => { hg.remove(); if (beimSchliessen) beimSchliessen(); };
  hg.addEventListener('click', (e) => { if (e.target === hg || e.target.closest('[data-schliessen]')) zu(); });
  hg.schliessen = zu;
  return hg;
}
export function meldung(text) {
  for (const alt of document.querySelectorAll('.banner[role="status"]')) alt.remove();   // nie übereinander
  const m = document.createElement('div');
  m.className = 'banner'; m.setAttribute('role', 'status');
  m.innerHTML = `<span>${escapeHtml(text)}</span>`;
  document.body.appendChild(m);
  setTimeout(() => m.remove(), 2600);
}
export function balken(label, ist, ziel, farbe, einheit) {
  const pct = ziel ? Math.min(100, (ist / ziel) * 100) : 0;
  const diff = ist - ziel;
  return `<div class="balken"><div class="zeile"><span>${label}</span><span class="zahl">${zahl(ist)} / ${zahl(ziel)} ${einheit}
    <span class="muted">(${diff >= 0 ? '+' : '−'}${zahl(Math.abs(diff))}${ziel ? `, ${diff >= 0 ? '+' : '−'}${zahl(Math.abs(diff / ziel) * 100)} %` : ''})</span></span></div>
    <div class="spur"><div class="fuell" style="width:${pct}%;background:${farbe}"></div></div></div>`;
}
export function tagesBalken(summe) {
  const z = D.profil.tagesziele;
  return balken('Kalorien', summe.kcal, z.kcal, 'var(--bar-c)', 'kcal') + balken('Protein', summe.protein, z.protein, 'var(--bar-p)', 'g') +
    balken('Fett', summe.fett, z.fett, 'var(--bar-f)', 'g') + balken('Kohlenhydrate', summe.kh, z.kh, 'var(--bar-k)', 'g');
}
export function restZeile(summe) {
  const r = P.restMakros(summe, D.profil.tagesziele);
  const f = (v) => (v >= 0 ? zahl(v) : `−${zahl(-v)}`);
  return `<p class="klein muted">Noch offen: ${f(r.kcal)} kcal · ${f(r.protein)} g Protein · ${f(r.fett)} g Fett · ${f(r.kh)} g KH</p>`;
}
export const ampel = (stufe) => `<span class="ampel ampel-${stufe}" aria-label="${{ ok: 'passt', gelb: 'Hinweise', rot: 'Achtung', leer: 'leer' }[stufe] || ''}"></span>`;

// ---------- Persönliche Daten ----------
export const heuteIso = () => datumIso(new Date());
export function einstellungen() {
  const std = {
    abteilungen: D.profil.einkauf.abteilungen,
    essenszeiten: Object.fromEntries(D.profil.mahlzeiten.filter((m) => m.uhrzeit).map((m) => [m.slot, m.uhrzeit])),
  };
  const e = S.lesen('einstellungen', {});
  return { ...std, ...e, essenszeiten: { ...std.essenszeiten, ...(e.essenszeiten || {}) } };
}
export function ctx(extra = {}) {
  const e = einstellungen();
  return { rezepteMap: D.map, extrasMap: D.extrasMap, packungen: D.packungen, profil: D.profil, abteilungen: e.abteilungen, bewertungen: S.lesen('bewertungen', {}), ...extra };
}
export function alleplaene() {
  const roh = S.lesen('plaene', {});
  const out = {};
  for (const [k, p] of Object.entries(roh)) out[k] = P.migrierePlan(p);
  return out;
}
export function planLaden(jahr, kw, anlegen = true) {
  const key = P.wochenSchluessel(jahr, kw);
  const p = alleplaene()[key];
  return p || (anlegen ? P.leererPlan(jahr, kw, D.profil) : null);
}
export function planSpeichern(plan) {
  const roh = S.lesen('plaene', {});
  roh[P.wochenSchluessel(plan.jahr, plan.kw)] = plan;
  S.schreiben('plaene', roh);
}
export function planFuerDatum(datum, anlegen = true) { const { jahr, kw } = P.wocheVon(datum); return planLaden(jahr, kw, anlegen); }
/** Tage der Woche plus Vorwoche (für Reste und Vergleiche über den Montag hinweg) */
export function vorTage(plan) { const { jahr, kw } = P.nachbarWoche(plan.jahr, plan.kw, -1); const v = planLaden(jahr, kw, false); return v ? v.tage : []; }
export function aktuelleWoche() {
  const w = S.lesen('planer_woche', null);
  return w || P.wocheVon(heuteIso());
}
export const favoriten = () => new Set(S.lesen('favoriten', []));
export function favoritUmschalten(id) {
  const f = favoriten(); f.has(id) ? f.delete(id) : f.add(id); S.schreiben('favoriten', [...f]); return f.has(id);
}
export const vorrat = () => S.lesen('vorrat', []);
export const datumKurz = (iso) => { const d = isoZuDatum(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`; };
