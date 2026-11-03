// Planer- und Einkaufslogik als reine Funktionen (kein DOM, kein Speicher) – SPEC 6.6, 8.1–8.6.
// Alle Funktionen geben neue Objekte zurück und verändern ihre Eingaben nicht.
import { datumIso, isoZuDatum, WOCHENTAGE_KURZ, zahl, gramm } from './format.js';

export const PLAN_VERSION = 1;
export const SLOTS = ['fruehstueck', 'mittag', 'abend', 'snack'];
export const SLOT_NAMEN = { fruehstueck: 'Frühstück', mittag: 'Mittag', abend: 'Abend', snack: 'Snack' };
export const MAKROS = ['kcal', 'protein', 'fett', 'kh'];
export const STUFEN = { ok: 0, info: 0, gelb: 1, rot: 2 };
const KLEINMENGEN = new Set(['Salz', 'Backpulver', 'Bourbon-Vanillezucker', 'Süßstoff flüssig', 'Speisestärke']);
const WOCHENTAG_INDEX = { Montag: 0, Dienstag: 1, Mittwoch: 2, Donnerstag: 3, Freitag: 4, Samstag: 5, Sonntag: 6 };
const kopie = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------------------------- Kalender
export function isoWoche(datum) {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  const tag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - tag);
  const jahresStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { jahr: d.getUTCFullYear(), kw: Math.ceil(((d - jahresStart) / 86400000 + 1) / 7) };
}
export function wochenSchluessel(jahr, kw) { return `${jahr}-W${String(kw).padStart(2, '0')}`; }
export function montagDerWoche(jahr, kw) {
  const jan4 = new Date(jahr, 0, 4, 12);
  const tag = jan4.getDay() || 7;
  const m = new Date(jan4);
  m.setDate(jan4.getDate() - tag + 1 + (kw - 1) * 7);
  return m;
}
export function tageDerWoche(jahr, kw) {
  const m = montagDerWoche(jahr, kw);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(m); d.setDate(m.getDate() + i); return datumIso(d); });
}
export function plusTage(datum, n) { const d = isoZuDatum(datum); d.setDate(d.getDate() + n); return datumIso(d); }
export function morgen(datum) { return plusTage(datum, 1); }
export function tageZwischen(a, b) { return Math.round((isoZuDatum(b) - isoZuDatum(a)) / 86400000); }
export function wocheVon(datum) { return isoWoche(isoZuDatum(datum)); }
export function nachbarWoche(jahr, kw, delta) { return wocheVon(plusTage(tageDerWoche(jahr, kw)[0], 7 * delta)); }
export function kurzTag(datum) { return WOCHENTAGE_KURZ[isoZuDatum(datum).getDay()]; }
export function slotRef(datum, slot) { return `${datum}/${slot}`; }
export function refTeilen(ref) { const [datum, slot] = String(ref || '').split('/'); return { datum, slot }; }

// ---------------------------------------------------------------------------------- Plan-Grundgerüst
function leererTag(datum) {
  return { datum, slots: { fruehstueck: null, mittag: null, abend: null, snack: null }, extras: [], auswaerts: null, notiz: '', wenig_zeit: false };
}
export function standardEinkauf(jahr, kw, profil) {
  const out = [];
  const montag = montagDerWoche(jahr, kw);
  for (const e of (profil && profil.einkauf && profil.einkauf.einkaufstage) || []) {
    const idx = WOCHENTAG_INDEX[e.wochentag];
    if (idx === undefined) continue;
    const d = new Date(montag);
    // Sa/So zählen als Einkauf VOR der Woche (Wochenendeinkauf für die kommende Woche)
    d.setDate(montag.getDate() + idx - (idx >= 5 ? 7 : 0));
    out.push({ datum: datumIso(d), art: e.art });
  }
  return out.sort((a, b) => a.datum.localeCompare(b.datum));
}
export function leererPlan(jahr, kw, profil = null) {
  return { version: PLAN_VERSION, kw, jahr, einkauf: standardEinkauf(jahr, kw, profil), tage: tageDerWoche(jahr, kw).map(leererTag), vorrat: [], tk_ersatz: [] };
}
export function tagFinden(plan, datum) { return (plan && plan.tage.find((t) => t.datum === datum)) || null; }
export function slotLesen(plan, datum, slot) { const t = tagFinden(plan, datum); return t ? t.slots[slot] : null; }

export function slotSetzen(plan, datum, slot, eintrag) {
  const p = kopie(plan);
  const tag = tagFinden(p, datum);
  if (!tag) throw new Error(`Datum ${datum} gehört nicht zu KW ${plan.kw}/${plan.jahr}`);
  tag.slots[slot] = eintrag ? kopie(eintrag) : null;
  return p;
}
export function slotAendern(plan, datum, slot, aenderung) {
  const e = slotLesen(plan, datum, slot);
  if (!e) return plan;
  return slotSetzen(plan, datum, slot, { ...e, ...aenderung });
}
export function tagAendern(plan, datum, aenderung) {
  const p = kopie(plan);
  const t = tagFinden(p, datum);
  if (t) Object.assign(t, kopie(aenderung));
  return p;
}
export function rezeptEintrag(rezeptId, faktor = 1, menge = 1) {
  return { typ: 'rezept', rezept: rezeptId, faktor, art: 'kochen', menge, personen: 2 };
}
export function auswaertsEintrag(profil, werte = {}) {
  const std = (profil && profil.hinweise && profil.hinweise.auswaerts_platzhalter) || { kcal: 950, protein: 40, fett: 45, kh: 90 };
  return { typ: 'auswaerts', kcal: std.kcal, protein: std.protein, fett: std.fett, kh: std.kh, ...werte };
}
export function extraHinzufuegen(plan, datum, extraId, faktor = 1) {
  const p = kopie(plan); const t = tagFinden(p, datum);
  if (t) t.extras.push({ extra: extraId, faktor });
  return p;
}
export function extraEntfernen(plan, datum, index) {
  const p = kopie(plan); const t = tagFinden(p, datum);
  if (t) t.extras.splice(index, 1);
  return p;
}

/** Zwei Slots tauschen (auch über Tage hinweg). Rest-Verweise auf verschobene Kochslots werden mitgezogen. */
export function verschieben(plan, von, nach) {
  let p = kopie(plan);
  const a = slotLesen(p, von.datum, von.slot), b = slotLesen(p, nach.datum, nach.slot);
  p = slotSetzen(p, nach.datum, nach.slot, a);
  p = slotSetzen(p, von.datum, von.slot, b);
  const refA = slotRef(von.datum, von.slot), refB = slotRef(nach.datum, nach.slot);
  for (const t of p.tage) for (const s of SLOTS) {
    const e = t.slots[s];
    if (e && e.art === 'rest') { if (e.von === refA) e.von = refB; else if (e.von === refB) e.von = refA; }
  }
  return p;
}

// ---------------------------------------------------------------------------------- Makros
export function slotWerte(eintrag, rezepteMap) {
  const leer = { kcal: 0, protein: 0, fett: 0, kh: 0, fehlt: false };
  if (!eintrag) return leer;
  if (eintrag.typ === 'auswaerts') return { kcal: +eintrag.kcal || 0, protein: +eintrag.protein || 0, fett: +eintrag.fett || 0, kh: +eintrag.kh || 0, fehlt: false };
  const r = rezepteMap[eintrag.rezept];
  if (!r) return { ...leer, fehlt: true };
  const f = eintrag.faktor ?? 1;
  const w = { fehlt: false };
  for (const k of MAKROS) w[k] = r.naehrwerte[k] * f;
  return w;
}
export function tagesSumme(tag, rezepteMap, extrasMap = {}) {
  const s = { kcal: 0, protein: 0, fett: 0, kh: 0 };
  if (!tag) return s;
  for (const slot of SLOTS) { const w = slotWerte(tag.slots[slot], rezepteMap); for (const k of MAKROS) s[k] += w[k]; }
  if (tag.auswaerts) for (const k of MAKROS) s[k] += +tag.auswaerts[k] || 0;
  for (const x of tag.extras || []) {
    const e = extrasMap[x.extra];
    if (e) for (const k of MAKROS) s[k] += e.naehrwerte[k] * (x.faktor ?? 1);
  }
  return s;
}
export function restMakros(summe, ziele) { const r = {}; for (const k of MAKROS) r[k] = ziele[k] - summe[k]; return r; }
export function tagBelegt(tag) { return !!tag && (SLOTS.some((s) => tag.slots[s]) || (tag.extras || []).length > 0); }

/** Mengenänderung pro Portion bei Faktor-Wechsel, z. B. „Basmatireis 88 g statt 70 g pro Portion“ */
export function mengenAenderung(rezept, faktor) {
  return rezept.zutaten.filter((z) => z.mitrechnen !== false && z.zutat !== 'Wasser').sort((a, b) => b.g - a.g).slice(0, 3)
    .map((z) => `${z.name || z.zutat} ${gramm((z.g / 2) * faktor)} g statt ${gramm(z.g / 2)} g pro Portion`);
}

/** Wie gut passt ein Rezept zu den noch offenen Makros? Kleiner = besser. */
export function passtZuRest(rezept, rest, offeneMahlzeiten = 1) {
  const n = Math.max(1, offeneMahlzeiten);
  const ziel = { kcal: Math.max(150, rest.kcal / n), protein: Math.max(10, rest.protein / n), fett: Math.max(3, rest.fett / n), kh: Math.max(10, rest.kh / n) };
  const p = rezept.naehrwerte;
  const d = (k, w) => w * ((p[k] - ziel[k]) / ziel[k]) ** 2;
  return d('kcal', 1) + d('protein', 1.5) + d('fett', 0.5) + d('kh', 0.5);
}

// ---------------------------------------------------------------------------------- Reste
const personen = (e) => e.personen ?? 2;
export function restEintrag(vonRef, quelle, anzahlPersonen = 2) {
  return { typ: 'rezept', rezept: quelle.rezept, faktor: quelle.faktor ?? 1, art: 'rest', von: vonRef, personen: anzahlPersonen };
}

/** Alle Kochvorgänge mit Portionen, Verbrauch und Haltbarkeit. `tage` darf mehrere Wochen umfassen. */
export function resteAnalyse(tage, rezepteMap) {
  const quellen = {};
  const sortiert = [...tage].sort((a, b) => a.datum.localeCompare(b.datum));
  for (const t of sortiert) for (const s of SLOTS) {
    const e = t.slots[s];
    if (e && e.typ === 'rezept' && e.art !== 'rest') {
      const r = rezepteMap[e.rezept];
      const gekocht = 2 * (e.menge ?? 1);
      const a = r ? r.aufbewahrung : {};
      quellen[slotRef(t.datum, s)] = {
        ref: slotRef(t.datum, s), datum: t.datum, slot: s, rezept: e.rezept, name: r ? r.name : e.rezept, faktor: e.faktor ?? 1,
        gekocht, verbraucht: personen(e), verbraucher: [], kuehlschrank_tage: a.kuehlschrank_tage ?? 0, einfrierbar: !!a.einfrierbar,
        haltbar_bis: plusTage(t.datum, a.kuehlschrank_tage ?? 0),
      };
    }
  }
  for (const t of sortiert) for (const s of SLOTS) {
    const e = t.slots[s];
    if (e && e.art === 'rest') {
      const q = quellen[e.von];
      if (q) { q.verbraucht += personen(e); q.verbraucher.push({ ref: slotRef(t.datum, s), datum: t.datum, personen: personen(e) }); }
    }
  }
  for (const q of Object.values(quellen)) q.uebrig = q.gekocht - q.verbraucht;
  return quellen;
}
export function verfuegbareReste(tage, rezepteMap, datum) {
  return Object.values(resteAnalyse(tage, rezepteMap)).filter((q) => q.uebrig > 0 && q.datum <= datum);
}
/** „Rest morgen mittags eintragen“ – Komfort-Button, plant nur auf ausdrücklichen Wunsch. */
export function restMorgenMittags(plan, datum, slot, anzahlPersonen = 2) {
  const quelle = slotLesen(plan, datum, slot);
  if (!quelle || quelle.typ !== 'rezept') throw new Error('Kein Rezept in diesem Slot');
  const ziel = morgen(datum);
  if (!tagFinden(plan, ziel)) throw new Error('Morgen liegt in der nächsten Woche');
  return slotSetzen(plan, ziel, 'mittag', restEintrag(slotRef(datum, slot), quelle, anzahlPersonen));
}

// ---------------------------------------------------------------------------------- Hinweise (8.3)
function zutatenMitFrische(rezept, packungen) {
  return rezept.zutaten.filter((z) => packungen[z.zutat] && packungen[z.zutat].max_tage_nach_einkauf);
}
export function einkaufVor(plan, datum) {
  const liste = (plan.einkauf || []).filter((e) => e.datum <= datum).sort((a, b) => b.datum.localeCompare(a.datum));
  return liste[0] || null;
}

/**
 * Hinweise für alle Tage der Woche: { datum: { stufe: 'ok'|'gelb'|'rot'|'leer', liste: [{stufe, text, aktion?}] } }
 * ctx = { rezepteMap, extrasMap, packungen, profil, vorTage (Tage der Vorwoche für Reste/Vergleiche), bewertungen }
 */
export function hinweiseWoche(plan, ctx) {
  const { rezepteMap, packungen = {}, profil } = ctx;
  const H = profil.hinweise, z = profil.tagesziele;
  const alleTage = [...(ctx.vorTage || []), ...plan.tage];
  const reste = resteAnalyse(alleTage, rezepteMap);
  const sterne = (id) => { const b = (ctx.bewertungen && ctx.bewertungen[id]) || (rezepteMap[id] && rezepteMap[id].bewertung); return b && b.sterne; };
  const dreiSterne = {};
  const out = {};
  for (const tag of plan.tage) {
    const liste = [];
    const add = (stufe, text, aktion = null) => liste.push({ stufe, text, aktion });
    const belegt = tagBelegt(tag);
    for (const s of SLOTS) {
      const e = tag.slots[s];
      if (!e || e.typ !== 'rezept') continue;
      const r = rezepteMap[e.rezept];
      if (!r) { add('rot', `${SLOT_NAMEN[s]}: Rezept nicht mehr vorhanden (${e.rezept})`); continue; }
      if (s === 'fruehstueck' && r.geschmack === 'herzhaft') add('info', `Frühstück ist herzhaft: ${r.name}`);
      const st = sterne(r.id);
      if (st && st <= H.sterne_ausblenden_bis) add('gelb', `${r.name} hat nur ${st} ★`);
      if (st === 3 && e.art !== 'rest') {
        dreiSterne[r.id] = (dreiSterne[r.id] || 0) + 1;
        if (dreiSterne[r.id] > H.drei_sterne_max_pro_woche) add('gelb', `${r.name} (3 ★) ist diese Woche schon eingeplant`);
      }
      if (e.art === 'rest') {
        const q = reste[e.von];
        if (!q) add('rot', `${SLOT_NAMEN[s]}: Rest von ${r.name}, aber dazu ist kein Kochen eingeplant`);
        else {
          if (q.uebrig < 0) add('rot', `${SLOT_NAMEN[s]}: Nicht genug Portionen von ${r.name} gekocht (${q.gekocht} gekocht, ${q.verbraucht} eingeplant) – „doppelt kochen“ wählen`);
          const alter = tageZwischen(q.datum, tag.datum);
          if (alter > q.kuehlschrank_tage) add('rot', `${SLOT_NAMEN[s]}: Rest von ${r.name} ist ${alter} Tage alt – im Kühlschrank nur ${q.kuehlschrank_tage} Tage haltbar${q.einfrierbar ? ' (einfrieren und rechtzeitig auftauen)' : ''}`);
        }
      } else {
        if (tag.wenig_zeit && r.zeit.aktiv > H.wenig_zeit_max_minuten) add('gelb', `Wenig Zeit, aber ${r.name} braucht ${r.zeit.aktiv} min`);
        const ek = einkaufVor(plan, tag.datum);
        if (ek) for (const zu of zutatenMitFrische(r, packungen)) {
          const pk = packungen[zu.zutat];
          const abstand = tageZwischen(ek.datum, tag.datum);
          if (abstand > pk.max_tage_nach_einkauf && !(plan.tk_ersatz || []).includes(zu.zutat)) {
            add('gelb', `${zu.zutat}: ${abstand} Tage nach dem Einkauf (${kurzTag(ek.datum)}) – frisch max. ${pk.max_tage_nach_einkauf} Tage.${pk.tk_alternative ? ` Vorschlag: ${pk.tk_alternative} kaufen.` : ''}`,
              pk.tk_alternative ? { typ: 'tk', zutat: zu.zutat } : null);
          }
        }
      }
    }
    if (tag.slots.abend && tag.slots.abend.typ === 'rezept') {
      const vor = alleTage.find((t) => t.datum === plusTage(tag.datum, -1));
      const a = rezepteMap[tag.slots.abend.rezept], b = vor && vor.slots.abend && rezepteMap[vor.slots.abend.rezept];
      if (a && b && tag.slots.abend.art !== 'rest') {
        if (a.kueche === b.kueche) add('gelb', `Abendessen wieder ${a.kueche} wie gestern`);
        if (a.hauptprotein === b.hauptprotein) add('gelb', `Abendessen wieder ${a.hauptprotein} wie gestern`);
      }
    }
    if (belegt) {
      const sm = tagesSumme(tag, rezepteMap, ctx.extrasMap || {});
      if (sm.protein < H.protein.rot_unter) add('rot', `Protein ${zahl(sm.protein)} g – unter ${H.protein.rot_unter} g`);
      else if (sm.protein < H.protein.gelb_unter) add('gelb', `Protein ${zahl(sm.protein)} g – unter ${H.protein.gelb_unter} g`);
      if (Math.abs(sm.kcal - H.kcal.ziel) > H.kcal.toleranz) add('gelb', `Kalorien ${zahl(sm.kcal)} – Ziel ${zahl(H.kcal.ziel)} ± ${H.kcal.toleranz}`);
      if (sm.fett < H.fett.rot_unter) add('rot', `Fett ${zahl(sm.fett)} g – unter ${H.fett.rot_unter} g`);
      else if (Math.abs(sm.fett - H.fett.ziel) > H.fett.toleranz) add('gelb', `Fett ${zahl(sm.fett)} g – Ziel ${H.fett.ziel} ± ${H.fett.toleranz} g`);
      if (Math.abs(sm.kh - H.kh.ziel) > H.kh.toleranz) add('gelb', `Kohlenhydrate ${zahl(sm.kh)} g – Ziel ${H.kh.ziel} ± ${H.kh.toleranz} g`);
    }
    const stufe = !belegt && !liste.length ? 'leer' : liste.reduce((m, h) => (STUFEN[h.stufe] > STUFEN[m] ? h.stufe : m), 'ok');
    out[tag.datum] = { stufe: stufe === 'info' ? 'ok' : stufe, liste };
  }
  return out;
}

/** Vorschläge zum Auffüllen eines Tages (nur Vorschläge – der Nutzer tippt zum Übernehmen). */
export function auffuellVorschlaege(tag, ctx) {
  const { rezepteMap, extrasMap = {}, profil } = ctx;
  if (!tagBelegt(tag)) return [];
  const rest = restMakros(tagesSumme(tag, rezepteMap, extrasMap), profil.tagesziele);
  const out = [];
  const bedarf = [];
  if (rest.protein > profil.tagesziele.protein - profil.hinweise.protein.gelb_unter) bedarf.push('protein');
  if (rest.fett > profil.hinweise.fett.toleranz) bedarf.push('fett');
  if (rest.kh > profil.hinweise.kh.toleranz) bedarf.push('kh');
  for (const k of bedarf) {
    const kandidaten = Object.values(extrasMap).filter((x) => (x.fuellt || []).includes(k) && x.naehrwerte.kcal <= rest.kcal + profil.hinweise.kcal.toleranz);
    kandidaten.sort((a, b) => Math.abs(a.naehrwerte[k] - rest[k]) - Math.abs(b.naehrwerte[k] - rest[k]));
    if (kandidaten[0]) out.push({ typ: 'extra', extra: kandidaten[0].id, text: `${kandidaten[0].name} (+${zahl(kandidaten[0].naehrwerte.kcal)} kcal, +${zahl(kandidaten[0].naehrwerte[k], 1)} g ${{ protein: 'Protein', fett: 'Fett', kh: 'KH' }[k]})` });
  }
  if (rest.kcal > 250) {
    let bester = null;
    for (const s of SLOTS) {
      const e = tag.slots[s];
      if (!e || e.typ !== 'rezept' || !rezepteMap[e.rezept] || (e.faktor ?? 1) >= 2) continue;
      const kcal = rezepteMap[e.rezept].naehrwerte.kcal * 0.25;
      if (!bester || kcal > bester.kcal) bester = { s, e, kcal };
    }
    if (bester) out.push({ typ: 'faktor', slot: bester.s, faktor: (bester.e.faktor ?? 1) + 0.25, text: `${SLOT_NAMEN[bester.s]} auf × ${zahl((bester.e.faktor ?? 1) + 0.25, 2)} erhöhen (+${zahl(bester.kcal)} kcal)` });
    if (!tag.slots.snack) out.push({ typ: 'snack', text: 'Einen Snack ergänzen' });
  }
  return out;
}

// ---------------------------------------------------------------------------------- Tagesansicht (8.4)
/** Erinnerungen am Vortag für `datum` (z. B. heute abend für morgen) */
export function erinnerungen(alleTage, datum, ctx) {
  const { rezepteMap, packungen = {} } = ctx;
  const tag = alleTage.find((t) => t.datum === datum);
  if (!tag) return [];
  const out = [];
  const reste = resteAnalyse(alleTage, rezepteMap);
  const tk = new Set([...(ctx.tkErsatz || [])]);
  for (const s of SLOTS) {
    const e = tag.slots[s];
    if (!e || e.typ !== 'rezept') continue;
    const r = rezepteMap[e.rezept];
    if (!r) continue;
    if (e.art === 'rest') {
      const q = reste[e.von];
      if (q && tageZwischen(q.datum, datum) > q.kuehlschrank_tage && q.einfrierbar) out.push({ text: `Meal-Prep-Box ${r.name} aus dem Gefrierfach in den Kühlschrank legen`, rezept: r.id });
      continue;
    }
    for (const v of r.vortag || []) out.push({ text: v, rezept: r.id, platzhalter: true });
    const hatAuftauHinweis = (r.vortag || []).some((v) => /auftauen/i.test(v));
    for (const z of r.zutaten) {
      const pk = packungen[z.zutat];
      const istTk = pk && (pk.frische === 'tk' || tk.has(z.zutat));
      const fleischFisch = /Garnelen|Lachs|Hähnchen|Puten|Rinder|Schweine/.test(z.zutat);
      if (istTk && fleischFisch && !hatAuftauHinweis)
        out.push({ text: `${tk.has(z.zutat) && pk.tk_alternative ? pk.tk_alternative : z.zutat} für ${r.name} über Nacht im Kühlschrank auftauen`, rezept: r.id });
    }
  }
  const gesehen = new Set();
  return out.filter((x) => (gesehen.has(x.text) ? false : gesehen.add(x.text)));
}

function zeitText(min) { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function zeitMin(t) { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); }

/** Rückwärts-Zeitplan für die Kochslots eines Tages. essenszeiten = { fruehstueck: '08:00', mittag: '13:00', abend: '19:00' } */
export function zeitplan(tag, ctx, essenszeiten) {
  const { rezepteMap } = ctx;
  const out = [];
  if (!tag) return out;
  for (const s of SLOTS) {
    const e = tag.slots[s];
    const r = e && e.typ === 'rezept' && e.art !== 'rest' && rezepteMap[e.rezept];
    if (!r || !essenszeiten[s]) continue;
    const essen = zeitMin(essenszeiten[s]);
    const kurzeWarte = r.zeit.wartezeit <= 60 ? r.zeit.wartezeit : 0;
    const start = essen - r.zeit.vorbereitung - r.zeit.kochen - kurzeWarte;
    const schritte = [];
    const vorheizen = (r.mise_en_place || []).find((m) => /vorheizen/i.test(m));
    schritte.push({ zeit: zeitText(start), text: vorheizen ? 'Ofen/Airfryer vorheizen und Mise en place' : 'Mise en place – alles vorbereiten' });
    let t = start + r.zeit.vorbereitung;
    const timer = r.schritte.filter((x) => x.timer_min);
    if (timer.length) schritte.push({ zeit: zeitText(t), text: `Kochen starten: ${r.schritte[0].titel}` });
    const lang = timer.slice().sort((a, b) => b.timer_min - a.timer_min)[0];
    if (lang && lang !== r.schritte[0]) schritte.push({ zeit: zeitText(essen - kurzeWarte - lang.timer_min), text: `${lang.titel} (${lang.timer_min} min)` });
    if (kurzeWarte) schritte.push({ zeit: zeitText(essen - kurzeWarte), text: `Ruhen/Kühlen (${kurzeWarte} min)` });
    schritte.push({ zeit: zeitText(essen), text: 'Essen 🍽️' });
    schritte.sort((a, b) => zeitMin(a.zeit) - zeitMin(b.zeit));
    out.push({ slot: s, rezept: r.id, name: r.name, schritte, wartezeit_lang: r.zeit.wartezeit > 60 ? r.zeit.wartezeit : 0 });
  }
  return out;
}

export function geraet(text) {
  if (/Airfryer/.test(text)) return 'Airfryer';
  if (/\b(Back)?[Oo]fen\b|backen/.test(text)) return 'Ofen';
  if (/Stufe \d|Pfanne|Topf|Wok|köcheln|braten|aufkochen/.test(text)) return 'Herd';
  return 'Kalt';
}
/** Meal-Prep-Ablauf: alle Rezepte eines Tages, die mehr als eine Mahlzeit ergeben. */
export function mealPrepAblauf(alleTage, datum, ctx) {
  const { rezepteMap } = ctx;
  const tag = alleTage.find((t) => t.datum === datum);
  if (!tag) return null;
  const reste = resteAnalyse(alleTage, rezepteMap);
  const rezepte = [];
  const gruppen = { Ofen: [], Airfryer: [], Herd: [], Kalt: [] };
  for (const s of SLOTS) {
    const e = tag.slots[s];
    const r = e && e.typ === 'rezept' && e.art !== 'rest' && rezepteMap[e.rezept];
    if (!r || (e.menge ?? 1) < 2) continue;
    const q = reste[slotRef(datum, s)];
    rezepte.push({ slot: s, rezept: r.id, name: r.name, menge: e.menge, boxen: q ? q.verbraucher : [], uebrig: q ? q.uebrig : 0 });
    for (const x of r.schritte) gruppen[geraet(x.text)].push({ rezept: r.name, titel: x.titel, minuten: x.timer_min || 0 });
  }
  if (!rezepte.length) return null;
  const summe = (g) => gruppen[g].reduce((a, x) => a + x.minuten, 0);
  const vorb = rezepte.reduce((a, x) => a + rezepteMap[x.rezept].zeit.vorbereitung, 0);
  return { rezepte, gruppen, dauer_min: vorb + Math.max(summe('Ofen'), summe('Herd'), summe('Airfryer')) + Math.ceil(summe('Kalt') / 2) };
}

// ---------------------------------------------------------------------------------- Einkaufsliste (8.5)
/** Alle Bedarfe der Woche: [{ zutat, g, datum, slot, wofuer }] – nur gekochte Rezepte und Extras, keine Reste/Auswärts. */
export function bedarfe(plan, ctx) {
  const { rezepteMap, extrasMap = {}, packungen = {} } = ctx;
  const out = [];
  for (const t of plan.tage) {
    for (const s of SLOTS) {
      const e = t.slots[s];
      if (!e || e.typ !== 'rezept' || e.art === 'rest') continue;
      const r = rezepteMap[e.rezept];
      if (!r) continue;
      const f = (e.faktor ?? 1) * (e.menge ?? 1);
      for (const z of r.zutaten) {
        if (packungen[z.zutat] && packungen[z.zutat].packung_g === 0) continue;
        out.push({ zutat: z.zutat, g: z.g * f, datum: t.datum, slot: s, wofuer: `${kurzTag(t.datum)} ${SLOT_NAMEN[s]}${(e.menge ?? 1) > 1 ? ` (×${e.menge})` : ''}` });
      }
    }
    for (const x of t.extras || []) {
      const ex = extrasMap[x.extra];
      if (!ex) continue;
      for (const z of ex.zutaten) {
        if (packungen[z.zutat] && packungen[z.zutat].packung_g === 0) continue;
        out.push({ zutat: z.zutat, g: z.g * (x.faktor ?? 1), datum: t.datum, slot: 'extra', wofuer: `${kurzTag(t.datum)} ${ex.name}` });
      }
    }
  }
  return out;
}

const runde = (x) => Math.round(x * 10) / 10;

/**
 * Einkaufsliste aus dem Plan berechnen.
 * ctx = { rezepteMap, extrasMap, packungen, profil, abteilungen (Reihenfolge) }, vorrat = [{ zutat, g, haltbar_bis }]
 */
export function einkaufsliste(plan, ctx, vorrat = []) {
  const { packungen = {}, profil } = ctx;
  const abteilungen = ctx.abteilungen || (profil && profil.einkauf.abteilungen) || [];
  const tk = new Set(plan.tk_ersatz || []);
  const termine = (plan.einkauf && plan.einkauf.length ? [...plan.einkauf] : [{ datum: null, art: 'gross' }]).sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
  const alle = bedarfe(plan, ctx);

  // Vorrat je Zutat
  const vorratRest = {};
  for (const v of vorrat) vorratRest[v.zutat] = (vorratRest[v.zutat] || 0) + (+v.g || 0);
  const vorratAbzug = {};

  // Bedarf je Zutat und Termin
  const proZutat = {};
  for (const b of alle) {
    const pk = packungen[b.zutat] || { abteilung: 'Sonstiges', packung_g: 0, frische: 'lange_haltbar', haltbar_tage_offen: 9999 };
    let ti = 0;
    const kurzFrisch = pk.frische === 'frisch' && (pk.haltbar_tage_offen <= 5 || pk.max_tage_nach_einkauf) && !tk.has(b.zutat);
    if (kurzFrisch && termine.length > 1) for (let i = termine.length - 1; i > 0; i--) if (termine[i].datum && b.datum >= termine[i].datum) { ti = i; break; }
    const z = (proZutat[b.zutat] = proZutat[b.zutat] || { zutat: b.zutat, pk, termine: {} });
    const zt = (z.termine[ti] = z.termine[ti] || { g: 0, wofuer: [], erste: b.datum, letzte: b.datum });
    zt.g += b.g; zt.wofuer.push(b.wofuer);
    if (b.datum < zt.erste) zt.erste = b.datum;
    if (b.datum > zt.letzte) zt.letzte = b.datum;
  }

  const listen = termine.map((t) => ({ datum: t.datum, art: t.art, artikel: [], vorratPruefen: [] }));
  const restNachWoche = [];
  let summeListe = 0, summeVorrat = 0, summePruefen = 0;
  for (const z of Object.values(proZutat)) {
    for (const [ti, zt] of Object.entries(z.termine).sort((a, b) => a[0] - b[0])) {
      const pk = z.pk;
      const abzug = Math.min(zt.g, vorratRest[z.zutat] || 0);
      vorratRest[z.zutat] = (vorratRest[z.zutat] || 0) - abzug;
      vorratAbzug[z.zutat] = (vorratAbzug[z.zutat] || 0) + abzug;
      summeVorrat += abzug;
      const netto = zt.g - abzug;
      const wofuer = [...new Set(zt.wofuer)];
      const kleinmenge = pk.abteilung === 'Gewürze & Öle' || KLEINMENGEN.has(z.zutat) || (pk.frische === 'lange_haltbar' && pk.packung_g && netto < pk.packung_g * 0.15);
      if (netto <= 0.0001) continue;
      if (kleinmenge) {
        summePruefen += netto;
        listen[ti].vorratPruefen.push({ id: `${z.zutat}#p${ti}`, zutat: z.zutat, bedarf_g: runde(netto), wofuer, packung_text: pk.packung_text });
        continue;
      }
      const istTk = tk.has(z.zutat) && pk.tk_alternative;
      const n = pk.packung_g ? Math.ceil(netto / pk.packung_g - 1e-9) : 0;
      const kauf = n * pk.packung_g;
      summeListe += netto;
      const art = {
        id: `${z.zutat}#${ti}`, zutat: z.zutat, produkt: istTk ? pk.tk_alternative : z.zutat,
        abteilung: istTk ? 'Tiefkühl' : pk.abteilung, bedarf_g: runde(netto), vorrat_g: runde(abzug), packungen: n, kauf_g: kauf,
        packung_text: pk.packung_text, preis: pk.preis_eur != null ? runde(n * pk.preis_eur * 100) / 100 : null, wofuer,
        frische: istTk ? 'Tiefkühl – rechtzeitig auftauen' : pk.frische === 'frisch' ? `frisch, offen ${pk.haltbar_tage_offen} Tag${pk.haltbar_tage_offen === 1 ? '' : 'e'} haltbar${pk.max_tage_nach_einkauf ? `, max. ${pk.max_tage_nach_einkauf} Tage nach Einkauf verbrauchen` : ''}` : '',
      };
      listen[ti].artikel.push(art);
      const uebrig = kauf - netto;
      if (uebrig > 0.5 && pk.packung_g) restNachWoche.push({ zutat: z.zutat, g: Math.round(uebrig), haltbar_bis: plusTage(zt.erste, Math.min(pk.haltbar_tage_offen, 3650)) });
    }
  }
  const ordnung = (a) => { const i = abteilungen.indexOf(a); return i < 0 ? 999 : i; };
  const kosten = { proAbteilung: {}, gesamt: 0, budget: profil && profil.einkauf ? profil.einkauf.wochenbudget_eur : null };
  for (const l of listen) {
    l.artikel.sort((a, b) => ordnung(a.abteilung) - ordnung(b.abteilung) || a.produkt.localeCompare(b.produkt, 'de'));
    l.vorratPruefen.sort((a, b) => a.zutat.localeCompare(b.zutat, 'de'));
    const gruppen = [];
    for (const a of l.artikel) {
      let g = gruppen[gruppen.length - 1];
      if (!g || g.name !== a.abteilung) gruppen.push((g = { name: a.abteilung, artikel: [] }));
      g.artikel.push(a);
      if (a.preis != null) { kosten.proAbteilung[a.abteilung] = runde((kosten.proAbteilung[a.abteilung] || 0) + a.preis); kosten.gesamt += a.preis; }
    }
    l.abteilungen = gruppen;
  }
  kosten.gesamt = Math.round(kosten.gesamt * 100) / 100;
  kosten.ueberBudget = kosten.budget != null && kosten.gesamt > kosten.budget;
  const summeBedarf = alle.reduce((a, b) => a + b.g, 0);
  return {
    termine: listen, kosten, restNachWoche: restNachWoche.sort((a, b) => a.zutat.localeCompare(b.zutat, 'de')),
    kontrolle: { bedarf: runde(summeBedarf), liste: runde(summeListe), vorratPruefen: runde(summePruefen), vorrat: runde(summeVorrat),
      ok: Math.abs(summeBedarf - (summeListe + summePruefen + summeVorrat)) < 0.01 },
  };
}

export function einkaufText(liste, titel = 'Einkaufsliste', eigene = []) {
  const z = [titel];
  for (const t of liste.termine) {
    if (liste.termine.length > 1 || t.datum) z.push('', `Einkauf ${t.datum ? `${kurzTag(t.datum)} ${t.datum.split('-').reverse().join('.')}` : ''}`.trim());
    for (const g of t.abteilungen) {
      z.push('', `${g.name}:`);
      for (const a of g.artikel) z.push(`- ${a.produkt}: ${a.packungen} × ${a.packung_text} (Bedarf ${gramm(a.bedarf_g)} g)`);
    }
    if (t.vorratPruefen.length) { z.push('', 'Vorrat prüfen:'); for (const a of t.vorratPruefen) z.push(`- ${a.zutat} (${gramm(a.bedarf_g)} g)`); }
  }
  if (eigene.length) { z.push('', 'Außerdem:'); for (const e of eigene) z.push(`- ${e.text}`); }
  return z.join('\n');
}

// ---------------------------------------------------------------------------------- Woche: Statistik, Kopieren, Vorlagen
export function wochenStatistik(plan, ctx) {
  const tage = plan.tage.filter(tagBelegt);
  const s = { kcal: 0, protein: 0, fett: 0, kh: 0 };
  for (const t of tage) { const w = tagesSumme(t, ctx.rezepteMap, ctx.extrasMap || {}); for (const k of MAKROS) s[k] += w[k]; }
  const avg = {}; for (const k of MAKROS) avg[k] = tage.length ? s[k] / tage.length : 0;
  let kochzeit = 0; const kochtage = new Set();
  for (const t of plan.tage) for (const sl of SLOTS) {
    const e = t.slots[sl]; const r = e && e.typ === 'rezept' && e.art !== 'rest' && ctx.rezepteMap[e.rezept];
    if (r) { kochzeit += r.zeit.aktiv; if (sl !== 'snack') kochtage.add(t.datum); }
  }
  return { durchschnitt: avg, geplanteTage: tage.length, kochtage: kochtage.size, kochzeit_min: kochzeit };
}

function verschiebeRefs(tage, deltaTage) {
  for (const t of tage) for (const s of SLOTS) { const e = t.slots[s]; if (e && e.von) { const r = refTeilen(e.von); e.von = slotRef(plusTage(r.datum, deltaTage), r.slot); } }
}
export function tagKopieren(plan, vonDatum, nachDatum) {
  const quelle = tagFinden(plan, vonDatum);
  if (!quelle) return plan;
  const ziel = kopie(quelle); ziel.datum = nachDatum;
  verschiebeRefs([ziel], tageZwischen(vonDatum, nachDatum));
  const p = kopie(plan); const i = p.tage.findIndex((t) => t.datum === nachDatum);
  if (i < 0) throw new Error('Zieltag liegt nicht in dieser Woche');
  p.tage[i] = ziel;
  return p;
}
export function wocheKopieren(plan, jahr, kw, profil) {
  const neu = leererPlan(jahr, kw, profil);
  const delta = tageZwischen(plan.tage[0].datum, neu.tage[0].datum);
  neu.tage = plan.tage.map((t) => ({ ...kopie(t), datum: plusTage(t.datum, delta) }));
  verschiebeRefs(neu.tage, delta);
  neu.tk_ersatz = [...(plan.tk_ersatz || [])];
  return neu;
}
export function vorlageAusPlan(plan, name) {
  const v = { name, erstellt: plan.tage[0].datum, tage: kopie(plan.tage).map((t, i) => ({ ...t, datum: `T${i}` })) };
  for (const t of v.tage) for (const s of SLOTS) { const e = t.slots[s]; if (e && e.von) { const r = refTeilen(e.von); e.von = `T${tageZwischen(plan.tage[0].datum, r.datum)}/${r.slot}`; } }
  return v;
}
export function vorlageEinsetzen(vorlage, jahr, kw, profil) {
  const p = leererPlan(jahr, kw, profil);
  const tage = p.tage.map((t) => t.datum);
  p.tage = kopie(vorlage.tage).map((t, i) => ({ ...t, datum: tage[i] }));
  for (const t of p.tage) for (const s of SLOTS) {
    const e = t.slots[s];
    if (e && e.von) { const r = refTeilen(e.von); const i = Number(String(r.datum).replace('T', '')); e.von = slotRef(plusTage(tage[0], i), r.slot); }
  }
  return p;
}

// ---------------------------------------------------------------------------------- Migration & Sicherung (8.6)
/** Bringt Pläne älterer Formate auf PLAN_VERSION. Unbekannte Rezept-IDs bleiben erhalten (Anzeige: „nicht mehr vorhanden“). */
export function migrierePlan(alt) {
  const p = kopie(alt || {});
  const v = Number(p.version || 0);
  if (v < 1) {
    // Format 0 (Entwurf): Slots konnten reine Rezept-IDs sein, Auswärts hing am Tag, extras/notiz fehlten
    for (const t of p.tage || []) {
      t.slots = t.slots || {};
      for (const s of SLOTS) {
        const e = t.slots[s];
        if (typeof e === 'string') t.slots[s] = rezeptEintrag(e);
        else if (e === undefined) t.slots[s] = null;
      }
      if (t.auswaerts && t.auswaerts.mahlzeit && SLOTS.includes(t.auswaerts.mahlzeit) && !t.slots[t.auswaerts.mahlzeit]) {
        const { mahlzeit, ...werte } = t.auswaerts;
        t.slots[mahlzeit] = { typ: 'auswaerts', ...werte };
        t.auswaerts = null;
      }
    }
    p.version = 1;
  }
  for (const t of p.tage || []) {
    t.extras = t.extras || []; t.notiz = t.notiz || ''; t.wenig_zeit = !!t.wenig_zeit;
    if (t.auswaerts === undefined) t.auswaerts = null;
    for (const s of SLOTS) {
      const e = t.slots[s];
      if (e && e.typ === 'rezept') { e.faktor = e.faktor ?? 1; e.art = e.art || 'kochen'; if (e.art === 'kochen') e.menge = e.menge ?? 1; e.personen = e.personen ?? 2; }
    }
  }
  p.einkauf = p.einkauf || []; p.vorrat = p.vorrat || []; p.tk_ersatz = p.tk_ersatz || [];
  return p;
}

export const SICHERUNG_FORMAT = 'rezeptbuch-sicherung';
export function sicherungErstellen(daten, jetzt = new Date()) {
  return { format: SICHERUNG_FORMAT, version: 1, exportiert: jetzt.toISOString(), daten: kopie(daten) };
}
export function planExport(plan, vorrat = []) { return { ...kopie(plan), vorrat: kopie(vorrat) }; }

/** Erkennt Sicherung oder einzelnen Wochenplan. Gibt { typ: 'alles'|'plan', ... } zurück oder wirft einen verständlichen Fehler. */
export function sicherungEinlesen(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Keine gültige Datei');
  if (obj.format === SICHERUNG_FORMAT) {
    const d = kopie(obj.daten || {});
    const plaene = {};
    for (const [k, p] of Object.entries(d.plaene || {})) plaene[k] = migrierePlan(p);
    d.plaene = plaene;
    return { typ: 'alles', daten: d };
  }
  if (Array.isArray(obj.tage) && obj.kw && obj.jahr) {
    const plan = migrierePlan(obj);
    return { typ: 'plan', schluessel: wochenSchluessel(plan.jahr, plan.kw), plan, vorrat: plan.vorrat || [] };
  }
  throw new Error('Unbekanntes Dateiformat – erwartet wird eine Sicherung oder ein exportierter Wochenplan');
}
