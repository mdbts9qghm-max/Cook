// Platzhalter in Rezepttexten – exakt dieselbe Logik wie tools/texte.py
// {id} → Menge + Name, {id:n} → nur Name, reserviert: {portion_g}, {gesamt_g}
import { gramm, zahl } from './format.js';

export const RESERVIERT = new Set(['portion_g', 'gesamt_g']);
const PLATZHALTER = /\{([a-z0-9][a-z0-9_-]*)(:n)?\}/g;
const ZAHL_AM_ANFANG = /^(\d+(?:[.,]\d+)?)(\s*)/;

export function textName(e) { return e.name || e.zutat; }

export function skaliereAnzeige(anzeige, faktor) {
  if (faktor === 1) return anzeige;
  const m = anzeige.match(ZAHL_AM_ANFANG);
  if (!m) return anzeige;
  const n = Number(m[1].replace(',', '.')) * faktor;
  const txt = Math.abs(n - Math.round(n)) < 1e-9 ? zahl(n, 0) : zahl(n, 1);
  return txt + m[2] + anzeige.slice(m[0].length);
}

/** Spalte „Menge“ der Zutatentabelle */
export function menge(e, faktor = 1) {
  const g = e.g * faktor;
  return e.anzeige ? `${skaliereAnzeige(e.anzeige, faktor)} (${gramm(g)} g)` : `${gramm(g)} g`;
}

export function mengeMitName(e, faktor = 1) {
  const g = e.g * faktor;
  return e.anzeige ? `${skaliereAnzeige(e.anzeige, faktor)} (${gramm(g)} g)` : `${gramm(g)} g ${textName(e)}`;
}

/** Ersetzt alle Platzhalter (reiner Text, kein HTML). Unbekannte IDs bleiben sichtbar stehen. */
export function ersetze(text, eintraege, faktor = 1, extra = {}) {
  return String(text || '').replace(PLATZHALTER, (ganz, id, n) => {
    if (id in extra) return extra[id];
    const e = eintraege[id];
    if (!e) return ganz;
    return n ? textName(e) : mengeMitName(e, faktor);
  });
}

export function platzhalterIds(text) {
  return [...String(text || '').matchAll(PLATZHALTER)].map((m) => m[1]);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Escape + **fett** → <strong> */
export function inlineMd(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** Map id → Zutat-Eintrag */
export function eintragsMap(rezept) {
  const m = {};
  for (const e of rezept.zutaten) m[e.id] = e;
  return m;
}

/** Fertig ersetzter Text für ein Rezept (mit reservierten Platzhaltern), faktor bezogen auf 2 Portionen. */
export function rezeptText(rezept, text, faktor = 1) {
  const extra = {
    portion_g: zahl(rezept.gargewicht_portion),
    gesamt_g: zahl(rezept.gargewicht_gesamt * faktor),
  };
  return ersetze(text, eintragsMap(rezept), faktor, extra);
}

/** Zutatenliste als Text für MacroFactor (eine Zutat pro Zeile, Gramm + konkreter Name). */
export function macroFactorText(rezept, faktor = 1) {
  return rezept.zutaten
    .filter((e) => e.mitrechnen !== false && e.zutat !== 'Wasser')
    .map((e) => `${gramm(e.g * faktor)} g ${e.zutat}`)
    .join('\n');
}
