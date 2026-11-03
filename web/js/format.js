// Zahlen und Datum auf Deutsch – gleiche Regeln wie tools/naehrwerte.py (zahl, gramm, runden)

/** Kaufmännisch runden (0,5 → aufrunden), robust gegen Fließkomma-Fehler (1.005 → 1.01). */
export function runden(wert, stellen = 0) {
  const n = Number(wert);
  if (!isFinite(n)) return 0;
  const vz = n < 0 ? -1 : 1;
  const r = Number(Math.round(Number(Math.abs(n) + 'e' + stellen)) + 'e-' + stellen);
  return vz * r;
}

/** 1150 → „1.150“, 48.55 → „48,6“ (stellen = 1). */
export function zahl(wert, stellen = 0) {
  const r = runden(wert, stellen);
  const [ganz, nach] = Math.abs(r).toFixed(stellen).split('.');
  const gruppiert = ganz.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (r < 0 ? '−' : '') + gruppiert + (stellen > 0 ? ',' + nach : '');
}

/** Grammangabe: ab 10 g ganzzahlig, darunter max. 1 Nachkommastelle. */
export function gramm(g) {
  const n = Number(g);
  if (n >= 10 || Number.isInteger(n)) return zahl(n, 0);
  return zahl(n, 1).replace(/,0$/, '');
}

export function zweistellig(n) { return String(n).padStart(2, '0'); }

/** Date → „TT.MM.JJJJ“ */
export function datumDe(d) {
  return `${zweistellig(d.getDate())}.${zweistellig(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Date → „JJJJ-MM-TT“ (lokale Zeit, nicht UTC) */
export function datumIso(d) {
  return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}`;
}

/** „JJJJ-MM-TT“ → Date (lokal, 12:00 Uhr, damit Zeitumstellungen nichts verschieben) */
export function isoZuDatum(s) {
  const [j, m, t] = s.split('-').map(Number);
  return new Date(j, m - 1, t, 12, 0, 0);
}

export const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const WOCHENTAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function minuten(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
