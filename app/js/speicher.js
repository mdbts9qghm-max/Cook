// Browser-Speicher mit stillem Fallback (privates Fenster, gesperrter Speicher …)
const PREFIX = 'cook.';
const fluechtig = new Map();   // Fallback, falls localStorage nicht verfügbar ist

export function lesen(schluessel, standard = null) {
  try {
    const roh = localStorage.getItem(PREFIX + schluessel);
    if (roh !== null) return JSON.parse(roh);
  } catch (_) { /* still */ }
  return fluechtig.has(schluessel) ? fluechtig.get(schluessel) : standard;
}

export function schreiben(schluessel, wert) {
  fluechtig.set(schluessel, wert);
  try {
    localStorage.setItem(PREFIX + schluessel, JSON.stringify(wert));
    return true;
  } catch (_) {
    return false;
  }
}

export function alleSchluessel() {
  const s = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) s.push(k.slice(PREFIX.length));
    }
  } catch (_) { /* still */ }
  for (const k of fluechtig.keys()) if (!s.includes(k)) s.push(k);
  return s;
}
