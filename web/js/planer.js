// Planer-Logik als reine Funktionen (kein DOM, kein Speicher) – Format siehe SPEC 6.6.
// Phase 5: Grundgerüst (Wochen, Slots, Tagessummen). Phase 6 ergänzt Hinweise, Reste, Einkaufsliste.
import { datumIso, isoZuDatum } from './format.js';

export const PLAN_VERSION = 1;
export const SLOTS = ['fruehstueck', 'mittag', 'abend', 'snack'];
export const SLOT_NAMEN = { fruehstueck: 'Frühstück', mittag: 'Mittag', abend: 'Abend', snack: 'Snack' };
const MAKROS = ['kcal', 'protein', 'fett', 'kh'];

/** ISO-Kalenderwoche { jahr, kw } eines Datums */
export function isoWoche(datum) {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  const tag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - tag);
  const jahresStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { jahr: d.getUTCFullYear(), kw: Math.ceil(((d - jahresStart) / 86400000 + 1) / 7) };
}

export function wochenSchluessel(jahr, kw) { return `${jahr}-W${String(kw).padStart(2, '0')}`; }

/** Montag der ISO-Woche (lokales Datum) */
export function montagDerWoche(jahr, kw) {
  const jan4 = new Date(jahr, 0, 4, 12);
  const tag = jan4.getDay() || 7;
  const montag = new Date(jan4);
  montag.setDate(jan4.getDate() - tag + 1 + (kw - 1) * 7);
  return montag;
}

export function tageDerWoche(jahr, kw) {
  const m = montagDerWoche(jahr, kw);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(m); d.setDate(m.getDate() + i); return datumIso(d); });
}

const WOCHENTAG_INDEX = { Montag: 0, Dienstag: 1, Mittwoch: 2, Donnerstag: 3, Freitag: 4, Samstag: 5, Sonntag: 6 };

/** Neuer, leerer Wochenplan. Einkaufstage aus profil.einkauf.einkaufstage (gelten für die Vorwoche-Samstage etc.). */
export function leererPlan(jahr, kw, profil = null) {
  const tage = tageDerWoche(jahr, kw).map((datum) => ({
    datum, slots: { fruehstueck: null, mittag: null, abend: null, snack: null }, extras: [], auswaerts: null, notiz: '',
  }));
  const einkauf = [];
  for (const e of (profil && profil.einkauf && profil.einkauf.einkaufstage) || []) {
    const idx = WOCHENTAG_INDEX[e.wochentag];
    if (idx === undefined) continue;
    // Einkauf am Wochentag VOR der Planwoche (z. B. Samstag vor Montag) bzw. innerhalb der Woche
    const montag = montagDerWoche(jahr, kw);
    const d = new Date(montag);
    d.setDate(montag.getDate() + idx - (idx >= 5 ? 7 : 0));
    einkauf.push({ datum: datumIso(d), art: e.art });
  }
  return { version: PLAN_VERSION, kw, jahr, einkauf, tage, vorrat: [] };
}

export function tagFinden(plan, datum) { return plan.tage.find((t) => t.datum === datum) || null; }

/** Gibt einen neuen Plan zurück, in dem `slot` am `datum` mit `eintrag` belegt ist (null = leeren). */
export function slotSetzen(plan, datum, slot, eintrag) {
  const kopie = structuredClone(plan);
  const tag = tagFinden(kopie, datum);
  if (!tag) throw new Error(`Datum ${datum} gehört nicht zu KW ${plan.kw}/${plan.jahr}`);
  tag.slots[slot] = eintrag;
  return kopie;
}

export function rezeptEintrag(rezeptId, faktor = 1, menge = 1) {
  return { typ: 'rezept', rezept: rezeptId, faktor, art: 'kochen', menge };
}

/** Makros eines Slots: { kcal, protein, fett, kh, fehlt } – fehlt = Rezept-ID unbekannt */
export function slotWerte(eintrag, rezepteMap) {
  const null4 = { kcal: 0, protein: 0, fett: 0, kh: 0, fehlt: false };
  if (!eintrag) return null4;
  if (eintrag.typ === 'auswaerts') return { kcal: eintrag.kcal || 0, protein: eintrag.protein || 0, fett: eintrag.fett || 0, kh: eintrag.kh || 0, fehlt: false };
  const r = rezepteMap[eintrag.rezept];
  if (!r) return { ...null4, fehlt: true };
  const f = eintrag.faktor ?? 1;
  const w = { fehlt: false };
  for (const k of MAKROS) w[k] = r.naehrwerte[k] * f;
  return w;
}

/** Tagessumme aller Slots + Extras */
export function tagesSumme(tag, rezepteMap, extrasMap = {}) {
  const s = { kcal: 0, protein: 0, fett: 0, kh: 0 };
  if (!tag) return s;
  for (const slot of SLOTS) {
    const w = slotWerte(tag.slots[slot], rezepteMap);
    for (const k of MAKROS) s[k] += w[k];
  }
  for (const x of tag.extras || []) {
    const e = extrasMap[x.extra];
    if (!e) continue;
    for (const k of MAKROS) s[k] += e.naehrwerte[k] * (x.faktor ?? 1);
  }
  return s;
}

export function restMakros(summe, ziele) {
  const r = {};
  for (const k of MAKROS) r[k] = ziele[k] - summe[k];
  return r;
}

export function morgen(datum) { const d = isoZuDatum(datum); d.setDate(d.getDate() + 1); return datumIso(d); }
