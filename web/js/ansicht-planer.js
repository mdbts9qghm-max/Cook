// Planer-Baukasten (SPEC 8.1–8.4): Heute, Woche, Tag, Slot-Menü, Rezeptauswahl, Kopieren, Vorlagen
import { datumDe, isoZuDatum, minuten, WOCHENTAGE, WOCHENTAGE_KURZ, zahl } from './format.js';
import { escapeHtml, inlineMd, rezeptText } from './rezept.js';
import * as P from './planer.js';
import * as S from './speicher.js';
import { oeffnen as kochmodusOeffnen } from './kochmodus.js';
import { filtern, FILTER_STANDARD } from './ansicht-rezepte.js';
import {
  $, $$, D, ampel, bewertung, ctx, datumKurz, dialog, einstellungen, fuss, heuteIso, kopf, meldung, planFuerDatum, planLaden,
  planSpeichern, restZeile, sterne, tagesBalken, vorrat, vorTage,
} from './ui.js';

const SLOT_MAHLZEIT = { fruehstueck: 'Frühstück', mittag: 'Mittag/Abend', abend: 'Mittag/Abend', snack: 'Snack' };
let verschiebeQuelle = null;     // { datum, slot } während „Gedrückthalten zum Verschieben“

function wocheAusHash(arg) {
  const m = /^(\d{4})-W(\d{2})$/.exec(arg || '');
  if (m) return { jahr: Number(m[1]), kw: Number(m[2]) };
  return S.lesen('planer_woche', null) || P.wocheVon(heuteIso());
}
const wocheHash = (w) => `#/planer/${P.wochenSchluessel(w.jahr, w.kw)}`;

// ---------- Bausteine ----------
function slotInhalt(e) {
  if (!e) return '<span class="muted">+ hinzufügen</span>';
  if (e.typ === 'auswaerts') return `<b>Auswärts</b> <span class="muted">${zahl(e.kcal)} kcal · ${zahl(e.protein)} g P</span>`;
  const r = D.map[e.rezept];
  if (!r) return '<i>Rezept nicht mehr vorhanden</i>';
  const w = P.slotWerte(e, D.map);
  const badges = [
    e.art === 'rest' ? '<span class="tag">Rest</span>' : '',
    (e.menge ?? 1) > 1 ? `<span class="tag">×${e.menge} kochen</span>` : '',
    (e.faktor ?? 1) !== 1 ? `<span class="tag">Portion ×${zahl(e.faktor, 2)}</span>` : '',
    (e.personen ?? 2) === 1 ? '<span class="tag">nur ich</span>' : '',
  ].join('');
  return `<b>${escapeHtml(r.name)}</b> ${badges}<br><span class="muted klein zahl">${zahl(w.kcal)} kcal · ${zahl(w.protein, 1)} g P</span>`;
}
function slotZeilen(plan, tag) {
  return P.SLOTS.map((s) => {
    const e = tag.slots[s];
    const markiert = verschiebeQuelle && verschiebeQuelle.datum === tag.datum && verschiebeQuelle.slot === s;
    return `<button type="button" class="slot${e ? ' belegt' : ''}${markiert ? ' markiert' : ''}" data-datum="${tag.datum}" data-slot="${s}">
      <span class="slot-name">${P.SLOT_NAMEN[s]}</span><span class="slot-inhalt">${slotInhalt(e)}</span></button>`;
  }).join('') +
    `<div class="extras">${(tag.extras || []).map((x, i) => { const ex = D.extrasMap[x.extra]; return `<button type="button" class="chip" data-extra-weg="${i}" data-datum="${tag.datum}" aria-label="Extra entfernen">${ex ? escapeHtml(ex.name) : x.extra} ×</button>`; }).join('')}
      <button type="button" class="chip" data-extra-neu="${tag.datum}">+ Extra</button></div>`;
}

function hinweisListe(h, datum) {
  if (!h || !h.liste.length) return '<p class="klein muted">Keine Hinweise – passt.</p>';
  return `<ul class="hinweise">${h.liste.map((x, i) => `<li class="h-${x.stufe}">${escapeHtml(x.text)}${x.aktion && x.aktion.typ === 'tk' ? ` <button type="button" class="knopf mini" data-tk="${escapeHtml(x.aktion.zutat)}" data-datum="${datum}">TK kaufen</button>` : ''}</li>`).join('')}</ul>`;
}

function speichernUndNeu(plan, neuZeichnen) { planSpeichern(plan); neuZeichnen(); }

// ---------- Slot-Interaktion (gemeinsam für Woche und Tag) ----------
function slotKlick(plan, datum, slot, neuZeichnen) {
  if (verschiebeQuelle) {
    const q = verschiebeQuelle; verschiebeQuelle = null;
    document.querySelector('.banner.verschieben')?.remove();
    if (q.datum === datum && q.slot === slot) return neuZeichnen();
    const zielPlan = P.wocheVon(datum);
    if (zielPlan.kw !== plan.kw || zielPlan.jahr !== plan.jahr) return neuZeichnen();
    speichernUndNeu(P.verschieben(plan, q, { datum, slot }), neuZeichnen);
    return meldung('Verschoben');
  }
  const e = P.slotLesen(plan, datum, slot);
  if (!e) return slotLeerDialog(plan, datum, slot, neuZeichnen);
  slotDialog(plan, datum, slot, neuZeichnen);
}

function slotLeerDialog(plan, datum, slot, neuZeichnen) {
  const reste = P.verfuegbareReste([...vorTage(plan), ...plan.tage], D.map, datum);
  const hg = dialog(`<h2 style="margin-top:0">${P.SLOT_NAMEN[slot]} · ${WOCHENTAGE_KURZ[isoZuDatum(datum).getDay()]} ${datumKurz(datum)}</h2>
    <div class="knopf-spalte">
      <a class="knopf primaer" href="#/auswahl/${datum}/${slot}" data-schliessen>Rezept wählen</a>
      ${reste.length ? `<p class="klein muted">Verfügbare Reste</p>${reste.map((q) => `<button class="knopf" type="button" data-rest="${q.ref}">Rest: ${escapeHtml(q.name)} <span class="muted klein">(${q.uebrig} Port., ${P.kurzTag(q.datum)})</span></button>`).join('')}` : ''}
      <button class="knopf" type="button" data-auswaerts>Auswärts essen</button>
      <button class="knopf" type="button" data-schliessen>Abbrechen</button></div>`);
  hg.addEventListener('click', (ev) => {
    const r = ev.target.closest('[data-rest]');
    if (r) {
      const alle = [...vorTage(plan), ...plan.tage];
      const { datum: qd, slot: qs } = P.refTeilen(r.dataset.rest);
      const quelle = alle.find((t) => t.datum === qd).slots[qs];
      hg.schliessen();
      return speichernUndNeu(P.slotSetzen(plan, datum, slot, P.restEintrag(r.dataset.rest, quelle)), neuZeichnen);
    }
    if (ev.target.closest('[data-auswaerts]')) { hg.schliessen(); auswaertsDialog(plan, datum, slot, null, neuZeichnen); }
  });
}

function auswaertsDialog(plan, datum, slot, e, neuZeichnen) {
  const w = e || P.auswaertsEintrag(D.profil);
  const feld = (k, t) => `<label>${t}<input type="number" inputmode="numeric" min="0" id="aw-${k}" value="${w[k]}"></label>`;
  const hg = dialog(`<h2 style="margin-top:0">Auswärts · ${P.SLOT_NAMEN[slot]}</h2><p class="klein muted">Platzhalter-Werte – anpassen, wenn du mehr weißt. Erzeugt keine Zutaten.</p>
    <div class="filter-raster">${feld('kcal', 'kcal')}${feld('protein', 'Protein (g)')}${feld('fett', 'Fett (g)')}${feld('kh', 'KH (g)')}</div>
    <div class="knopf-reihe"><button class="knopf" type="button" data-schliessen>Abbrechen</button><button class="knopf primaer" type="button" id="aw-ok">Speichern</button></div>`);
  $('#aw-ok', hg).onclick = () => {
    const neu = { typ: 'auswaerts' };
    for (const k of P.MAKROS) neu[k] = Number($(`#aw-${k}`, hg).value) || 0;
    hg.schliessen();
    speichernUndNeu(P.slotSetzen(plan, datum, slot, neu), neuZeichnen);
  };
}

function slotDialog(plan, datum, slot, neuZeichnen) {
  const e = P.slotLesen(plan, datum, slot);
  if (e.typ === 'auswaerts') {
    const hg = dialog(`<h2 style="margin-top:0">Auswärts · ${P.SLOT_NAMEN[slot]}</h2><div class="knopf-spalte">
      <button class="knopf" type="button" id="aw-bearbeiten">Werte bearbeiten</button>
      <button class="knopf" type="button" id="sl-verschieben">Verschieben nach …</button>
      <button class="knopf gefahr" type="button" id="sl-weg">Entfernen</button><button class="knopf" type="button" data-schliessen>Schließen</button></div>`);
    $('#aw-bearbeiten', hg).onclick = () => { hg.schliessen(); auswaertsDialog(plan, datum, slot, e, neuZeichnen); };
    $('#sl-verschieben', hg).onclick = () => { hg.schliessen(); verschiebenDialog(plan, datum, slot, neuZeichnen); };
    $('#sl-weg', hg).onclick = () => { hg.schliessen(); speichernUndNeu(P.slotSetzen(plan, datum, slot, null), neuZeichnen); };
    return;
  }
  const r = D.map[e.rezept];
  let zustand = { ...e };
  const morgenImPlan = !!P.tagFinden(plan, P.morgen(datum));
  const hg = dialog('');
  const modal = $('.modal', hg);
  const zeichnen = () => {
    const f = zustand.faktor ?? 1;
    modal.innerHTML = `<h2 style="margin-top:0">${r ? escapeHtml(r.name) : 'Rezept nicht mehr vorhanden'}</h2>
      <p class="klein muted">${P.SLOT_NAMEN[slot]} · ${WOCHENTAGE[isoZuDatum(datum).getDay()]} ${datumKurz(datum)}${zustand.art === 'rest' ? ' · Rest' : ''}</p>
      ${r ? `<p class="zahl"><b>${zahl(r.naehrwerte.kcal * f)} kcal</b> · ${zahl(r.naehrwerte.protein * f, 1)} g P · ${zahl(r.naehrwerte.fett * f, 1)} g F · ${zahl(r.naehrwerte.kh * f, 1)} g KH</p>
      <label class="feld">Meine Portion<div class="portionen"><button type="button" data-f="-0.25" aria-label="Kleiner">−</button><output class="zahl">× ${zahl(f, 2)}</output><button type="button" data-f="0.25" aria-label="Größer">+</button></div></label>
      ${f !== 1 ? `<p class="klein muted">${P.mengenAenderung(r, f).map(escapeHtml).join(' · ')}</p>` : ''}` : ''}
      ${zustand.art !== 'rest' && r ? `<label class="feld">Wie oft kochen?<div class="chips">${[1, 2, 3, 4].map((n) => `<button type="button" class="chip" data-menge="${n}" aria-pressed="${(zustand.menge ?? 1) === n}">${n === 1 ? 'einfach' : n === 2 ? 'doppelt' : `×${n} (Prep)`}</button>`).join('')}</div></label>
        <p class="klein muted">Ergibt ${2 * (zustand.menge ?? 1)} Portionen – ${2 * (zustand.menge ?? 1) - (zustand.personen ?? 2)} bleiben als Rest.</p>` : ''}
      <label class="feld">Wer isst?<div class="chips"><button type="button" class="chip" data-personen="2" aria-pressed="${(zustand.personen ?? 2) === 2}">wir beide</button><button type="button" class="chip" data-personen="1" aria-pressed="${zustand.personen === 1}">nur ich</button></div></label>
      <div class="knopf-spalte">
        <button class="knopf primaer" type="button" id="sl-ok">Übernehmen</button>
        ${zustand.art !== 'rest' && (zustand.menge ?? 1) > 1 && morgenImPlan ? '<button class="knopf" type="button" id="sl-rest">Rest morgen mittags eintragen</button>' : ''}
        <button class="knopf" type="button" id="sl-verschieben">Verschieben nach …</button>
        ${r ? `<a class="knopf" href="#/rezept/${r.id}" data-schliessen>Rezept ansehen</a><button class="knopf" type="button" id="sl-kochen">Kochmodus</button>` : ''}
        <button class="knopf gefahr" type="button" id="sl-weg">Entfernen</button>
        <button class="knopf" type="button" data-schliessen>Abbrechen</button></div>`;
  };
  zeichnen();
  modal.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.f) { zustand.faktor = Math.min(2, Math.max(0.5, (zustand.faktor ?? 1) + Number(b.dataset.f))); return zeichnen(); }
    if (b.dataset.menge) { zustand.menge = Number(b.dataset.menge); return zeichnen(); }
    if (b.dataset.personen) { zustand.personen = Number(b.dataset.personen); return zeichnen(); }
    if (b.id === 'sl-ok') { hg.schliessen(); return speichernUndNeu(P.slotSetzen(plan, datum, slot, zustand), neuZeichnen); }
    if (b.id === 'sl-rest') {
      hg.schliessen();
      let p = P.slotSetzen(plan, datum, slot, zustand);
      if (P.slotLesen(p, P.morgen(datum), 'mittag') && !confirm('Morgen Mittag ist schon belegt – ersetzen?')) return;
      p = P.restMorgenMittags(p, datum, slot);
      speichernUndNeu(p, neuZeichnen); return meldung('Rest für morgen Mittag eingetragen');
    }
    if (b.id === 'sl-verschieben') { hg.schliessen(); return verschiebenDialog(plan, datum, slot, neuZeichnen); }
    if (b.id === 'sl-kochen') { hg.schliessen(); return kochmodusOeffnen(r, zustand.faktor ?? 1); }
    if (b.id === 'sl-weg') { hg.schliessen(); return speichernUndNeu(P.slotSetzen(plan, datum, slot, null), neuZeichnen); }
  });
}

function verschiebenDialog(plan, datum, slot, neuZeichnen) {
  const hg = dialog(`<h2 style="margin-top:0">Verschieben nach …</h2><p class="klein muted">Ist das Ziel belegt, werden die beiden Mahlzeiten getauscht. Tipp: Mahlzeit gedrückt halten und dann das Ziel antippen.</p>
    <label>Tag<select id="vs-tag">${plan.tage.map((t) => `<option value="${t.datum}"${t.datum === datum ? ' selected' : ''}>${WOCHENTAGE[isoZuDatum(t.datum).getDay()]} ${datumKurz(t.datum)}</option>`).join('')}</select></label>
    <label>Mahlzeit<select id="vs-slot">${P.SLOTS.map((s) => `<option value="${s}"${s === slot ? ' selected' : ''}>${P.SLOT_NAMEN[s]}</option>`).join('')}</select></label>
    <div class="knopf-reihe"><button class="knopf" type="button" data-schliessen>Abbrechen</button><button class="knopf primaer" type="button" id="vs-ok">Verschieben</button></div>`);
  $('#vs-ok', hg).onclick = () => {
    const ziel = { datum: $('#vs-tag', hg).value, slot: $('#vs-slot', hg).value };
    hg.schliessen();
    speichernUndNeu(P.verschieben(plan, { datum, slot }, ziel), neuZeichnen);
  };
}

function extraDialog(plan, datum, neuZeichnen) {
  const tag = P.tagFinden(plan, datum);
  const rest = P.restMakros(P.tagesSumme(tag, D.map, D.extrasMap), D.profil.tagesziele);
  const hg = dialog(`<h2 style="margin-top:0">Extra hinzufügen</h2><p class="klein muted">Noch offen: ${zahl(rest.kcal)} kcal · ${zahl(rest.protein)} g P · ${zahl(rest.fett)} g F · ${zahl(rest.kh)} g KH</p>
    <div class="knopf-spalte">${D.extras.map((x) => `<button class="knopf links" type="button" data-x="${x.id}"><span>${escapeHtml(x.name)}</span><span class="muted klein zahl">${zahl(x.naehrwerte.kcal)} kcal · ${zahl(x.naehrwerte.protein, 1)} P · ${zahl(x.naehrwerte.fett, 1)} F · ${zahl(x.naehrwerte.kh, 1)} KH</span></button>`).join('')}
    <button class="knopf" type="button" data-schliessen>Abbrechen</button></div>`);
  hg.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-x]'); if (!b) return;
    hg.schliessen();
    speichernUndNeu(P.extraHinzufuegen(plan, datum, b.dataset.x), neuZeichnen);
  });
}

/** Klicks, Gedrückthalten (Verschieben), Extras, TK-Hinweise im Planer-Inhalt verdrahten */
function interaktionen(root, planHolen, neuZeichnen) {
  root.onclick = (ev) => {
    const plan = planHolen();
    const tk = ev.target.closest('[data-tk]');
    if (tk) {
      const p = JSON.parse(JSON.stringify(plan)); p.tk_ersatz = [...new Set([...(p.tk_ersatz || []), tk.dataset.tk])];
      speichernUndNeu(p, neuZeichnen); return meldung('TK-Variante kommt auf die Einkaufsliste – Auftau-Erinnerung ist aktiv');
    }
    const xn = ev.target.closest('[data-extra-neu]'); if (xn) return extraDialog(plan, xn.dataset.extraNeu, neuZeichnen);
    const xw = ev.target.closest('[data-extra-weg]'); if (xw) return speichernUndNeu(P.extraEntfernen(plan, xw.dataset.datum, Number(xw.dataset.extraWeg)), neuZeichnen);
    const vo = ev.target.closest('[data-vorschlag]');
    if (vo) {
      const v = JSON.parse(vo.dataset.vorschlag), d = vo.dataset.datum;
      if (v.typ === 'extra') speichernUndNeu(P.extraHinzufuegen(plan, d, v.extra), neuZeichnen);
      if (v.typ === 'faktor') speichernUndNeu(P.slotAendern(plan, d, v.slot, { faktor: v.faktor }), neuZeichnen);
      if (v.typ === 'snack') location.hash = `#/auswahl/${d}/snack`;
      return;
    }
    const s = ev.target.closest('.slot');
    if (s && !s.dataset.langGedrueckt) slotKlick(plan, s.dataset.datum, s.dataset.slot, neuZeichnen);
    if (s) delete s.dataset.langGedrueckt;
  };
  // Gedrückthalten = Mahlzeit zum Verschieben aufnehmen, dann Ziel antippen
  let timer = null;
  const start = (ev) => {
    const s = ev.target.closest('.slot.belegt'); if (!s) return;
    timer = setTimeout(() => {
      s.dataset.langGedrueckt = '1';
      verschiebeQuelle = { datum: s.dataset.datum, slot: s.dataset.slot };
      try { navigator.vibrate && navigator.vibrate(30); } catch (_) { /* still */ }
      s.classList.add('markiert');
      if (!document.querySelector('.banner.verschieben')) {
        const b = document.createElement('div'); b.className = 'banner verschieben';
        b.innerHTML = '<span>Ziel-Mahlzeit antippen</span><button type="button">Abbrechen</button>';
        b.querySelector('button').onclick = () => { verschiebeQuelle = null; b.remove(); neuZeichnen(); };
        document.body.appendChild(b);
      }
    }, 450);
  };
  const stopp = () => { clearTimeout(timer); timer = null; };
  const kontext = (e) => { if (e.target.closest('.slot')) e.preventDefault(); };
  if (root._aufraeumen) root._aufraeumen();
  root.addEventListener('touchstart', start, { passive: true });
  root.addEventListener('mousedown', start);
  for (const ev of ['touchend', 'touchmove', 'mouseup', 'mouseleave']) root.addEventListener(ev, stopp, { passive: true });
  root.addEventListener('contextmenu', kontext);
  root._aufraeumen = () => {
    root.removeEventListener('touchstart', start); root.removeEventListener('mousedown', start);
    for (const ev of ['touchend', 'touchmove', 'mouseup', 'mouseleave']) root.removeEventListener(ev, stopp);
    root.removeEventListener('contextmenu', kontext);
    root._aufraeumen = null;
  };
}

// ---------- Ansicht: Woche ----------
export function ansichtPlaner(arg) {
  const w = wocheAusHash(arg);
  S.schreiben('planer_woche', w);
  kopf('Planer');
  const zeichnen = () => {
    const plan = planLaden(w.jahr, w.kw);
    const c = ctx({ vorTage: vorTage(plan) });
    const h = P.hinweiseWoche(plan, c);
    const st = P.wochenStatistik(plan, c);
    const liste = P.einkaufsliste(plan, c, vorrat());
    const reste = Object.values(P.resteAnalyse([...c.vorTage, ...plan.tage], D.map)).filter((q) => q.datum >= plan.tage[0].datum && (q.gekocht > 2 || q.verbraucher.length));
    const vor = P.nachbarWoche(w.jahr, w.kw, -1), nach = P.nachbarWoche(w.jahr, w.kw, 1);
    let html = `<div class="wochen-nav"><a class="knopf" href="${wocheHash(vor)}" aria-label="Vorige Woche">‹</a>
      <div><b>KW ${w.kw}</b><br><span class="klein muted">${datumKurz(plan.tage[0].datum)}–${datumKurz(plan.tage[6].datum)}${w.jahr}</span></div>
      <a class="knopf" href="${wocheHash(nach)}" aria-label="Nächste Woche">›</a></div>
      <div class="karte woche-info">
        <p class="zahl"><b>Ø pro geplantem Tag:</b> ${zahl(st.durchschnitt.kcal)} kcal · ${zahl(st.durchschnitt.protein)} g P · ${zahl(st.durchschnitt.fett)} g F · ${zahl(st.durchschnitt.kh)} g KH</p>
        <p class="klein muted">${st.geplanteTage} Tage geplant · ${st.kochtage} Kochtage · ca. ${minuten(st.kochzeit_min)} Kochzeit · Einkauf ca. ${zahl(liste.kosten.gesamt, 2)} €${liste.kosten.budget ? ` von ${zahl(liste.kosten.budget)} €` : ''}${liste.kosten.ueberBudget ? ' ⚠️' : ''}</p>
        <p class="klein">Einkauf: ${plan.einkauf.length ? plan.einkauf.map((e) => `${P.kurzTag(e.datum)} ${datumKurz(e.datum)} (${e.art === 'gross' ? 'groß' : 'frisch'})`).join(', ') : 'kein Termin'} <button type="button" class="knopf mini" id="ek-tage">ändern</button></p>
        <div class="knopf-reihe"><a class="knopf" href="#/einkauf">Einkaufsliste</a><button class="knopf" type="button" id="wo-menue">Kopieren & Vorlagen</button></div>
      </div>`;
    for (const tag of plan.tage) {
      const sm = P.tagesSumme(tag, D.map, D.extrasMap);
      const d = isoZuDatum(tag.datum);
      html += `<section class="karte wochentag${tag.datum === heuteIso() ? ' heute' : ''}" data-tag="${tag.datum}">
        <a class="tag-kopf" href="#/tag/${tag.datum}">${ampel(h[tag.datum].stufe)}<b>${WOCHENTAGE_KURZ[d.getDay()]}, ${datumKurz(tag.datum)}</b>
          <span class="muted klein zahl">${P.tagBelegt(tag) ? `${zahl(sm.kcal)} kcal · ${zahl(sm.protein)} g P` : ''}${h[tag.datum].liste.length ? ` · ${h[tag.datum].liste.length} Hinweis${h[tag.datum].liste.length > 1 ? 'e' : ''}` : ''}</span><span class="pfeil">›</span></a>
        ${tag.notiz ? `<p class="klein muted">📝 ${escapeHtml(tag.notiz)}</p>` : ''}
        ${slotZeilen(plan, tag)}</section>`;
    }
    if (reste.length) {
      html += `<div class="karte"><h2 style="margin-top:0">Reste & Meal Prep dieser Woche</h2><table><thead><tr><th>Gericht</th><th class="r">Portionen</th></tr></thead><tbody>${reste.map((q) => `<tr><td><b>${escapeHtml(q.name)}</b><br><span class="klein muted">gekocht ${P.kurzTag(q.datum)} ${datumKurz(q.datum)} · gegessen: ${[P.kurzTag(q.datum), ...q.verbraucher.map((v) => P.kurzTag(v.datum))].join(', ')} · Kühlschrank bis ${P.kurzTag(q.haltbar_bis)} ${datumKurz(q.haltbar_bis)}${q.einfrierbar ? ', einfrierbar' : ''}</span></td>
        <td class="r zahl ${q.uebrig < 0 ? 'h-rot' : ''}">${q.gekocht} gekocht<br>${q.uebrig >= 0 ? `${q.uebrig} übrig` : `${-q.uebrig} fehlen`}</td></tr>`).join('')}</tbody></table></div>`;
    }
    $('#inhalt').innerHTML = html + fuss();
    $('#ek-tage').onclick = () => einkaufstageDialog(plan, zeichnen);
    $('#wo-menue').onclick = () => wochenMenue(plan, zeichnen);
  };
  interaktionen($('#inhalt'), () => planLaden(w.jahr, w.kw), zeichnen);
  zeichnen();
}

function einkaufstageDialog(plan, neuZeichnen) {
  let liste = plan.einkauf.map((e) => ({ ...e }));
  const hg = dialog('');
  const m = $('.modal', hg);
  const zeichnen = () => {
    m.innerHTML = `<h2 style="margin-top:0">Einkaufstage KW ${plan.kw}</h2><p class="klein muted">Bei zwei Terminen kommt frische Ware automatisch auf die spätere Liste, wenn sie erst danach gebraucht wird.</p>
      ${liste.map((e, i) => `<div class="zeile-form"><input type="date" data-i="${i}" value="${e.datum}"><select data-art="${i}"><option value="gross"${e.art === 'gross' ? ' selected' : ''}>groß</option><option value="frisch"${e.art === 'frisch' ? ' selected' : ''}>frisch</option></select><button type="button" class="knopf mini" data-weg="${i}" aria-label="Entfernen">×</button></div>`).join('')}
      <div class="knopf-reihe"><button class="knopf" type="button" id="ek-neu">+ Termin</button></div>
      <div class="knopf-reihe"><button class="knopf" type="button" data-schliessen>Abbrechen</button><button class="knopf primaer" type="button" id="ek-ok">Speichern</button></div>`;
  };
  zeichnen();
  m.addEventListener('change', (ev) => {
    if (ev.target.dataset.i) liste[ev.target.dataset.i].datum = ev.target.value;
    if (ev.target.dataset.art) liste[ev.target.dataset.art].art = ev.target.value;
  });
  m.addEventListener('click', (ev) => {
    if (ev.target.dataset.weg) { liste.splice(Number(ev.target.dataset.weg), 1); zeichnen(); }
    if (ev.target.id === 'ek-neu') { liste.push({ datum: plan.tage[2].datum, art: 'frisch' }); zeichnen(); }
    if (ev.target.id === 'ek-ok') {
      const p = JSON.parse(JSON.stringify(plan));
      p.einkauf = liste.filter((e) => e.datum).sort((a, b) => a.datum.localeCompare(b.datum));
      hg.schliessen(); speichernUndNeu(p, neuZeichnen);
    }
  });
}

function wochenMenue(plan, neuZeichnen) {
  const vorlagen = S.lesen('vorlagen', []);
  const hg = dialog(`<h2 style="margin-top:0">Kopieren & Vorlagen</h2><div class="knopf-spalte">
    <button class="knopf" type="button" id="wo-kopie">Woche in nächste Woche kopieren</button>
    <button class="knopf" type="button" id="wo-vorlage">Woche als Vorlage speichern</button>
    ${vorlagen.length ? `<p class="klein muted">Vorlage einsetzen (ersetzt diese Woche)</p>${vorlagen.map((v, i) => `<button class="knopf" type="button" data-vorlage="${i}">${escapeHtml(v.name)}</button>`).join('')}` : '<p class="klein muted">Noch keine Vorlagen gespeichert.</p>'}
    <button class="knopf gefahr" type="button" id="wo-leeren">Woche leeren</button>
    <button class="knopf" type="button" data-schliessen>Schließen</button></div>`);
  hg.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'wo-kopie') {
      const n = P.nachbarWoche(plan.jahr, plan.kw, 1);
      const vorhanden = planLaden(n.jahr, n.kw, false);
      if (vorhanden && vorhanden.tage.some(P.tagBelegt) && !confirm(`KW ${n.kw} ist schon geplant – überschreiben?`)) return;
      planSpeichern(P.wocheKopieren(plan, n.jahr, n.kw, D.profil));
      hg.schliessen(); meldung(`In KW ${n.kw} kopiert`);
    }
    if (b.id === 'wo-vorlage') {
      const name = prompt('Name der Vorlage', `Woche KW ${plan.kw}`);
      if (!name) return;
      S.schreiben('vorlagen', [...S.lesen('vorlagen', []), P.vorlageAusPlan(plan, name)]);
      hg.schliessen(); meldung('Vorlage gespeichert');
    }
    if (b.dataset.vorlage) {
      if (plan.tage.some(P.tagBelegt) && !confirm('Diese Woche wird durch die Vorlage ersetzt. Fortfahren?')) return;
      const neu = P.vorlageEinsetzen(vorlagen[Number(b.dataset.vorlage)], plan.jahr, plan.kw, D.profil);
      neu.einkauf = plan.einkauf;
      hg.schliessen(); speichernUndNeu(neu, neuZeichnen);
    }
    if (b.id === 'wo-leeren') {
      if (!confirm('Alle Mahlzeiten dieser Woche entfernen?')) return;
      const neu = P.leererPlan(plan.jahr, plan.kw, D.profil); neu.einkauf = plan.einkauf;
      hg.schliessen(); speichernUndNeu(neu, neuZeichnen);
    }
  });
}

// ---------- Tagesinhalte (gemeinsam für Heute und Tagesansicht) ----------
function zeitplanHtml(tag, editierbar) {
  const ess = { ...einstellungen().essenszeiten, ...(tag.essenszeiten || {}) };
  const zp = P.zeitplan(tag, ctx(), ess);
  if (!zp.length) return '';
  return `<div class="karte"><h2 style="margin-top:0">Zeitplan</h2>${zp.map((z) => `<p><b>${P.SLOT_NAMEN[z.slot]}: ${escapeHtml(z.name)}</b>
    ${editierbar ? `<label class="inline klein">Essen um <input type="time" data-essen="${z.slot}" value="${ess[z.slot]}"></label>` : ''}</p>
    <ul class="zeitplan">${z.schritte.map((s) => `<li><span class="zahl">${s.zeit}</span> ${escapeHtml(s.text)}</li>`).join('')}</ul>
    ${z.wartezeit_lang ? `<p class="klein muted">Plus ${minuten(z.wartezeit_lang)} Wartezeit – siehe Erinnerung am Vortag.</p>` : ''}`).join('')}</div>`;
}
function erinnerungenHtml(plan, datum, titel) {
  const alle = [...vorTage(plan), ...plan.tage];
  const naechste = P.nachbarWoche(plan.jahr, plan.kw, 1);
  const np = planLaden(naechste.jahr, naechste.kw, false);
  if (np) alle.push(...np.tage);
  const liste = P.erinnerungen(alle, datum, ctx({ tkErsatz: [...(plan.tk_ersatz || []), ...((np && np.tk_ersatz) || [])] }));
  if (!liste.length) return '';
  return `<div class="karte"><h2 style="margin-top:0">${titel}</h2><ul class="punkte">${liste.map((x) => `<li>${inlineMd(x.platzhalter && D.map[x.rezept] ? rezeptText(D.map[x.rezept], x.text) : x.text)}</li>`).join('')}</ul></div>`;
}
function mealPrepHtml(plan, datum) {
  const mp = P.mealPrepAblauf([...vorTage(plan), ...plan.tage], datum, ctx());
  if (!mp) return '';
  const gruppen = Object.entries(mp.gruppen).filter(([, l]) => l.length);
  return `<div class="karte"><h2 style="margin-top:0">Meal-Prep-Ablauf</h2><p class="klein muted">Geschätzte Gesamtdauer ca. ${minuten(mp.dauer_min)} (Ofen und Herd laufen parallel)</p>
    ${gruppen.map(([g, l]) => `<h3>${g}</h3><ul class="punkte">${l.map((x) => `<li>${escapeHtml(x.rezept)}: ${escapeHtml(x.titel)}${x.minuten ? ` (${x.minuten} min)` : ''}</li>`).join('')}</ul>`).join('')}
    <h3>Boxen</h3><ul class="punkte">${mp.rezepte.map((r) => `<li><b>${escapeHtml(r.name)}</b> (×${r.menge}): ${r.boxen.length ? r.boxen.map((b) => `${P.kurzTag(b.datum)} ${datumKurz(b.datum)} (${b.personen} Port.)`).join(', ') : 'noch nicht verteilt'}${r.uebrig > 0 ? ` · ${r.uebrig} Portionen noch frei` : ''}</li>`).join('')}</ul></div>`;
}

// ---------- Ansicht: Tag ----------
export function ansichtTag(datum) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum || '')) { location.hash = '#/planer'; return; }
  const w = P.wocheVon(datum);
  const d = isoZuDatum(datum);
  kopf(`${WOCHENTAGE[d.getDay()]}, ${datumDe(d)}`, 'Woche', wocheHash(w));
  const zeichnen = () => {
    const plan = planLaden(w.jahr, w.kw);
    const tag = P.tagFinden(plan, datum);
    const c = ctx({ vorTage: vorTage(plan) });
    const h = P.hinweiseWoche(plan, c)[datum];
    const sm = P.tagesSumme(tag, D.map, D.extrasMap);
    const vs = P.auffuellVorschlaege(tag, c);
    $('#inhalt').innerHTML = `
      <div class="karte">${slotZeilen(plan, tag)}</div>
      <div class="karte"><h2 style="margin-top:0">${ampel(h.stufe)} Tagesbilanz</h2>${tagesBalken(sm)}${restZeile(sm)}</div>
      <div class="karte"><h2 style="margin-top:0">Hinweise</h2>${hinweisListe(h, datum)}
        ${vs.length ? `<h3>Vorschläge zum Auffüllen</h3><div class="knopf-spalte">${vs.map((v) => `<button type="button" class="knopf links" data-vorschlag='${escapeHtml(JSON.stringify(v))}' data-datum="${datum}">+ ${escapeHtml(v.text)}</button>`).join('')}</div>` : ''}</div>
      ${zeitplanHtml(tag, true)}
      ${mealPrepHtml(plan, datum)}
      ${erinnerungenHtml(plan, P.morgen(datum), 'Für morgen vorbereiten')}
      <div class="karte"><h2 style="margin-top:0">Notiz & Optionen</h2>
        <textarea id="notiz" rows="2" placeholder="z. B. Training, Besuch, Restaurant …">${escapeHtml(tag.notiz || '')}</textarea>
        <label class="schalter"><input type="checkbox" id="wenig-zeit"${tag.wenig_zeit ? ' checked' : ''}> Wenig Zeit an diesem Tag</label>
        <div class="knopf-reihe"><button class="knopf" type="button" id="tag-kopie">Tag kopieren nach …</button></div></div>` + fuss();
    $('#notiz').onchange = (e) => planSpeichern(P.tagAendern(planLaden(w.jahr, w.kw), datum, { notiz: e.target.value }));
    $('#wenig-zeit').onchange = (e) => speichernUndNeu(P.tagAendern(planLaden(w.jahr, w.kw), datum, { wenig_zeit: e.target.checked }), zeichnen);
    for (const inp of $$('[data-essen]')) inp.onchange = () => {
      const p = planLaden(w.jahr, w.kw);
      const t = P.tagFinden(p, datum);
      speichernUndNeu(P.tagAendern(p, datum, { essenszeiten: { ...(t.essenszeiten || {}), [inp.dataset.essen]: inp.value } }), zeichnen);
    };
    $('#tag-kopie').onclick = () => {
      const hg = dialog(`<h2 style="margin-top:0">Tag kopieren nach …</h2><label>Zieltag<select id="tk-ziel">${plan.tage.filter((t) => t.datum !== datum).map((t) => `<option value="${t.datum}">${WOCHENTAGE[isoZuDatum(t.datum).getDay()]} ${datumKurz(t.datum)}</option>`).join('')}</select></label>
        <div class="knopf-reihe"><button class="knopf" type="button" data-schliessen>Abbrechen</button><button class="knopf primaer" type="button" id="tk-ok">Kopieren</button></div>`);
      $('#tk-ok', hg).onclick = () => { const ziel = $('#tk-ziel', hg).value; hg.schliessen(); speichernUndNeu(P.tagKopieren(planLaden(w.jahr, w.kw), datum, ziel), zeichnen); meldung('Tag kopiert'); };
    };
  };
  interaktionen($('#inhalt'), () => planLaden(w.jahr, w.kw), zeichnen);
  zeichnen();
}

// ---------- Ansicht: Rezeptauswahl für einen Slot ----------
export function ansichtAuswahl(datum, slot) {
  if (!P.SLOTS.includes(slot)) { location.hash = '#/planer'; return; }
  const w = P.wocheVon(datum);
  kopf(`${P.SLOT_NAMEN[slot]} · ${WOCHENTAGE_KURZ[isoZuDatum(datum).getDay()]} ${datumKurz(datum)}`, 'Zurück', wocheHash(w));
  const plan = planLaden(w.jahr, w.kw);
  const tag = P.tagFinden(plan, datum);
  const sm = P.tagesSumme(tag, D.map, D.extrasMap);
  const rest = P.restMakros(sm, D.profil.tagesziele);
  const offen = Math.max(1, P.SLOTS.filter((s) => s !== 'snack' && !tag.slots[s]).length);
  const vorratZutaten = new Set(vorrat().map((v) => v.zutat));
  const f = { ...FILTER_STANDARD, mahlzeit: SLOT_MAHLZEIT[slot], sort: 'rest', resteTauglich: false, alleSterne: false };
  const opt = (v, t, akt) => `<option value="${escapeHtml(v)}"${v === akt ? ' selected' : ''}>${escapeHtml(t)}</option>`;
  const werte = (feld) => [...new Set(D.rezepte.map((r) => r[feld]))].sort((a, b) => a.localeCompare(b, 'de'));
  $('#inhalt').innerHTML = `<p class="klein muted">Noch offen an diesem Tag: <b class="zahl">${zahl(rest.kcal)} kcal · ${zahl(rest.protein)} g P · ${zahl(rest.fett)} g F · ${zahl(rest.kh)} g KH</b></p>
    <div class="suche"><input type="search" id="q" placeholder="Rezept oder Zutat suchen" aria-label="Suche"></div>
    <div class="chips">${[['Frühstück', 'Frühstück'], ['Mittag/Abend', 'Mittag/Abend'], ['Snack', 'Snacks'], ['', 'Alle']].map(([v, t]) => `<button class="chip" type="button" data-mahlzeit="${v}" aria-pressed="${f.mahlzeit === v}">${t}</button>`).join('')}</div>
    <div class="filter-raster">
      <label>Sortierung<select id="a-sort">${opt('rest', 'Passt zu meinen Restmakros', f.sort)}${opt('name', 'Name', '')}${opt('kcal', 'kcal', '')}${opt('protein', 'Protein', '')}${opt('zeit', 'Zeit', '')}</select></label>
      <label>Kategorie<select id="a-kategorie">${opt('', 'Alle', '')}${Object.entries({ 'high-protein': 'High Protein', schnell: 'Schnell', 'meal-prep': 'Meal Prep', kalorienarm: 'Kalorienarm' }).map(([k, t]) => opt(k, t, '')).join('')}</select></label>
      <label>Küche<select id="a-kueche">${opt('', 'Alle', '')}${werte('kueche').map((k) => opt(k, k, '')).join('')}</select></label>
      <label>Hauptprotein<select id="a-protein">${opt('', 'Alle', '')}${werte('hauptprotein').map((k) => opt(k, k, '')).join('')}</select></label>
      <label>Max. Zeit<select id="a-zeit">${[['', 'Egal'], ['15', '15 min'], ['25', '25 min'], ['45', '45 min']].map(([v, t]) => opt(v, t, '')).join('')}</select></label>
      <label>Bewertung<select id="a-bewertung">${[['', 'Alle'], ['3', 'ab 3 ★'], ['4', 'ab 4 ★']].map(([v, t]) => opt(v, t, '')).join('')}</select></label>
    </div>
    <label class="schalter"><input type="checkbox" id="a-rest"> nur restetaugliche</label>
    <label class="schalter"><input type="checkbox" id="a-sterne"> aussortierte (1–2 ★) einblenden</label>
    <div class="liste" id="treffer"></div>`;
  const zeichnen = () => {
    let l = filtern({ ...f, sort: f.sort === 'rest' ? 'name' : f.sort });
    if (f.resteTauglich) l = l.filter((r) => r.restetauglich);
    if (!f.alleSterne) l = l.filter((r) => { const b = bewertung(r.id); return !(b && b.sterne && b.sterne <= D.profil.hinweise.sterne_ausblenden_bis); });
    if (f.sort === 'rest') l = l.map((r) => [P.passtZuRest(r, rest, slot === 'snack' ? 1 : offen), r]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    $('#treffer').innerHTML = l.map((r) => {
      const reste = r.zutaten.filter((z) => vorratZutaten.has(z.zutat)).map((z) => z.zutat);
      return `<button type="button" class="rezept-kachel auswahl" data-waehlen="${r.id}"><span class="titel">${escapeHtml(r.name)}</span><span class="plus">+</span>
        <span class="meta"><span><b>${r.naehrwerte.kcal}</b> kcal</span><span><b>${zahl(r.naehrwerte.protein, 1)}</b> g P</span><span>${zahl(r.naehrwerte.fett, 1)} F</span><span>${minuten(r.zeit.aktiv)}</span>${sterne(bewertung(r.id)) ? `<span>${sterne(bewertung(r.id))}</span>` : ''}${reste.length ? `<span class="tag">verbraucht Vorrat: ${escapeHtml([...new Set(reste)].slice(0, 2).join(', '))}</span>` : ''}</span></button>`;
    }).join('') || '<p class="muted">Keine Treffer – Filter lockern?</p>';
  };
  $('#q').oninput = (e) => { f.q = e.target.value; zeichnen(); };
  for (const b of $$('[data-mahlzeit]')) b.onclick = () => { f.mahlzeit = b.dataset.mahlzeit; $$('[data-mahlzeit]').forEach((x) => x.setAttribute('aria-pressed', x === b)); zeichnen(); };
  for (const k of ['sort', 'kategorie', 'kueche', 'protein', 'zeit', 'bewertung']) $(`#a-${k}`).onchange = (e) => { f[k] = e.target.value; zeichnen(); };
  $('#a-rest').onchange = (e) => { f.resteTauglich = e.target.checked; zeichnen(); };
  $('#a-sterne').onchange = (e) => { f.alleSterne = e.target.checked; zeichnen(); };
  $('#treffer').onclick = (ev) => {
    const b = ev.target.closest('[data-waehlen]'); if (!b) return;
    const p = planLaden(w.jahr, w.kw);
    planSpeichern(P.slotSetzen(p, datum, slot, P.rezeptEintrag(b.dataset.waehlen)));
    meldung(`${D.map[b.dataset.waehlen].name} eingetragen`);
    if (history.length > 1) history.back(); else location.hash = wocheHash(w);
  };
  zeichnen();
}

// ---------- Ansicht: Heute ----------
export function ansichtHeute() {
  kopf('Heute');
  const datum = heuteIso();
  const d = new Date();
  const plan = planFuerDatum(datum);
  const tag = P.tagFinden(plan, datum);
  const c = ctx({ vorTage: vorTage(plan) });
  let html = `<p class="muted">${WOCHENTAGE[d.getDay()]}, ${datumDe(d)}</p>`;
  const letzte = S.lesen('letzte_sicherung', null);
  const tageSeit = letzte ? P.tageZwischen(letzte.slice(0, 10), datum) : null;
  const hatPlaene = Object.keys(S.lesen('plaene', {})).length > 0;
  if (hatPlaene && (tageSeit === null || tageSeit > D.profil.hinweise.sicherung_erinnern_nach_tagen)) {
    html += `<a class="hinweis block" href="#/sicherung">💾 ${tageSeit === null ? 'Noch keine Sicherung deiner Pläne' : `Letzte Sicherung vor ${tageSeit} Tagen`} – jetzt sichern</a>`;
  }
  if (!P.tagBelegt(tag)) {
    html += `<div class="karte"><h2 style="margin-top:0">Für heute ist noch nichts geplant</h2>
      <p class="muted">Plane die Woche im Planer – oder trage direkt ein Gericht für heute ein.</p>
      <div class="knopf-reihe"><a class="knopf primaer" href="#/planer">Woche planen</a><a class="knopf" href="#/tag/${datum}">Heute planen</a></div>
      <p style="margin-bottom:0"><a href="#/kuehlschrank">🧊 Kühlschrank-Modus: Was kann ich mit dem kochen, was da ist?</a></p></div>`;
  } else {
    const sm = P.tagesSumme(tag, D.map, D.extrasMap);
    const h = P.hinweiseWoche(plan, c)[datum];
    let kochen = null;
    html += `<div class="karte"><h2 style="margin-top:0">${ampel(h.stufe)} Deine Mahlzeiten</h2><div class="liste">`;
    for (const s of P.SLOTS) {
      const e = tag.slots[s];
      if (!e) continue;
      const w = P.slotWerte(e, D.map);
      const r = e.typ === 'rezept' && D.map[e.rezept];
      if (r && !kochen && e.art !== 'rest') kochen = { r, f: e.faktor ?? 1 };
      const name = e.typ === 'auswaerts' ? 'Auswärts' : r ? r.name : 'Rezept nicht mehr vorhanden';
      html += `<a class="rezept-kachel" href="${r ? `#/rezept/${r.id}` : `#/tag/${datum}`}"><span class="titel">${P.SLOT_NAMEN[s]}: ${escapeHtml(name)}${e.art === 'rest' ? ' <span class="tag">Rest</span>' : ''}</span><span></span>
        <span class="meta"><span><b>${zahl(w.kcal)}</b> kcal</span><span><b>${zahl(w.protein, 1)}</b> g Protein</span>${(e.faktor ?? 1) !== 1 ? `<span>× ${zahl(e.faktor, 2)}</span>` : ''}</span></a>`;
    }
    for (const x of tag.extras || []) { const ex = D.extrasMap[x.extra]; if (ex) html += `<p class="klein">+ ${escapeHtml(ex.name)} <span class="muted">(${zahl(ex.naehrwerte.kcal)} kcal)</span></p>`; }
    html += `</div></div><div class="karte"><h2 style="margin-top:0">Tagesbilanz</h2>${tagesBalken(sm)}${restZeile(sm)}
      ${h.liste.length ? hinweisListe(h, datum) : ''}<a class="klein" href="#/tag/${datum}">Tag bearbeiten ›</a></div>`;
    if (kochen) html += `<div class="knopf-reihe"><button class="knopf primaer" type="button" id="jetzt-kochen">Jetzt kochen: ${escapeHtml(kochen.r.name)}</button></div>`;
    html += zeitplanHtml(tag, false);
    setTimeout(() => { const b = $('#jetzt-kochen'); if (b) b.onclick = () => kochmodusOeffnen(kochen.r, kochen.f); });
  }
  html += erinnerungenHtml(plan, P.morgen(datum), 'Für morgen vorbereiten');
  if (P.tagBelegt(tag)) html += '<p class="klein"><a href="#/kuehlschrank">🧊 Kühlschrank-Modus</a></p>';
  const z = D.profil.tagesziele;
  html += `<div class="karte"><h2 style="margin-top:0">Deine Tagesziele</h2><p class="zahl">${zahl(z.kcal)} kcal · ${zahl(z.protein)} g Protein · ${zahl(z.fett)} g Fett · ${zahl(z.kh)} g KH</p><p class="klein muted">Stand MacroFactor ${datumDe(isoZuDatum(String(z.stand)))}</p></div>`;
  $('#inhalt').innerHTML = html + fuss();
  interaktionen($('#inhalt'), () => planFuerDatum(datum), ansichtHeute);
}
