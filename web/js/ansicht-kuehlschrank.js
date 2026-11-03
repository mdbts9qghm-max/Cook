// Kühlschrank-Modus (SPEC 11.1): Zutaten wählen → passende Rezepte mit Faktor-Vorschlag für die Restmakros des Tages
import { zahl } from './format.js';
import { escapeHtml } from './rezept.js';
import * as P from './planer.js';
import * as S from './speicher.js';
import { $, D, fuss, heuteIso, kopf } from './ui.js';
import { planenDialog } from './ansicht-rezepte.js';

const MAX_TREFFER = 15;
const HAEUFIG = 18;

/** Offene Makros und Mahlzeiten für heute (ohne Plan: ganzer Tag offen) */
function heuteOffen() {
  const datum = heuteIso();
  const { jahr, kw } = P.wocheVon(datum);
  const plaene = S.lesen('plaene', {});
  const roh = plaene[P.wochenSchluessel(jahr, kw)];
  const tag = roh ? P.tagFinden(P.migrierePlan(roh), datum) : null;
  const summe = tag ? P.tagesSumme(tag, D.map, D.extrasMap) : { kcal: 0, protein: 0, fett: 0, kh: 0 };
  const leer = ['fruehstueck', 'mittag', 'abend'].filter((s) => !tag || !tag.slots[s]);
  return { datum, tag, rest: P.restMakros(summe, D.profil.tagesziele), offene: Math.max(1, leer.length), leer };
}

function slotFuer(r, leer) {
  if (r.mahlzeit === 'Frühstück') return 'fruehstueck';
  if (r.mahlzeit === 'Snack') return 'snack';
  return leer.includes('abend') ? 'abend' : leer.includes('mittag') ? 'mittag' : 'abend';
}

export function ansichtKuehlschrank() {
  kopf('Kühlschrank', 'Mehr', '#/mehr');
  const alleZutaten = P.kuehlschrankZutaten(D.rezepte, D.packungen);
  const bekannt = new Set(alleZutaten.map((z) => z.zutat));
  let auswahl = S.lesen('kuehlschrank', []).filter((z) => bekannt.has(z));

  const speichern = () => S.schreiben('kuehlschrank', auswahl);
  const hinzu = (text) => {
    const q = String(text || '').trim().toLowerCase();
    if (!q) return false;
    const z = alleZutaten.find((x) => x.zutat.toLowerCase() === q) || alleZutaten.find((x) => x.zutat.toLowerCase().startsWith(q))
      || alleZutaten.find((x) => x.zutat.toLowerCase().includes(q));
    if (!z || auswahl.includes(z.zutat)) return !!z;
    auswahl = [...auswahl, z.zutat]; speichern(); return true;
  };

  const zeichnen = () => {
    const o = heuteOffen();
    const treffer = P.kuehlschrank(auswahl, D.rezepte, { packungen: D.packungen, rest: o.rest, offeneMahlzeiten: o.offene, bewertungen: S.lesen('bewertungen', {}), vorrat: S.lesen('vorrat', []) });
    const haeufig = alleZutaten.filter((z) => !auswahl.includes(z.zutat)).slice(0, HAEUFIG);
    const chips = `<div class="chips umbruch">${haeufig.map((z) => `<button class="chip" type="button" data-dazu="${escapeHtml(z.zutat)}">${escapeHtml(z.zutat)}</button>`).join('')}</div>`;
    let html = `<div class="karte"><h2 style="margin-top:0">Was hast du da?</h2>
      
      <div class="suche"><input type="search" id="ks-suche" aria-label="Zutat suchen" list="ks-liste" placeholder="Zutat eingeben, z. B. Hähnchen" autocomplete="off" enterkeyhint="done">
      <button class="knopf" type="button" id="ks-dazu">+</button></div>
      <datalist id="ks-liste">${alleZutaten.map((z) => `<option value="${escapeHtml(z.zutat)}">`).join('')}</datalist>
      ${auswahl.length ? `<p class="klein muted" style="margin-bottom:4px">Ausgewählt (${auswahl.length}):</p><div class="chips umbruch" id="ks-auswahl">${auswahl.map((z) => `<button class="chip" type="button" aria-pressed="true" data-weg="${escapeHtml(z)}">${escapeHtml(z)}<span class="x" aria-hidden="true">✕</span></button>`).join('')}</div>
        <button class="link-knopf klein" type="button" id="ks-leeren">Auswahl leeren</button>` : ''}
      ${auswahl.length ? `<details id="ks-haeufig"${S.lesen('kuehlschrank_offen', false) ? ' open' : ''}><summary class="klein muted" style="min-height:44px;display:flex;align-items:center">Häufige Zutaten antippen</summary>${chips}</details>`
        : `<p class="klein muted" style="margin-bottom:4px">Häufige Zutaten:</p>${chips}`}
      <p class="klein muted">Salz, Gewürze, Öle und alles aus deinem Vorrat gelten als vorhanden.</p></div>`;
    const r = o.rest;
    html += `<p class="klein muted">Heute noch offen: <b class="zahl">${zahl(Math.max(0, r.kcal))} kcal · ${zahl(Math.max(0, r.protein))} g Protein</b> für ${o.offene} Mahlzeit${o.offene > 1 ? 'en' : ''} – der Faktor-Vorschlag richtet sich danach.</p>`;
    if (!auswahl.length) html += '<p class="muted">Wähle ein paar Zutaten aus – dann zeige ich dir passende Rezepte.</p>';
    else if (!treffer.length) html += '<p class="muted">Kein Rezept nutzt diese Zutaten. Schreib mir im Chat „Kühlschrank: …“, dann schlage ich etwas Neues vor.</p>';
    else {
      html += `<h2>Passende Rezepte <span class="muted klein">(${treffer.length})</span></h2><div class="liste" id="ks-treffer">`;
      for (const t of treffer.slice(0, MAX_TREFFER)) {
        const rz = D.map[t.rezept];
        html += `<div class="karte ks-treffer" data-rezept="${rz.id}"><a href="#/rezept/${rz.id}"><b>${escapeHtml(rz.name)}</b></a>
          <div class="treffer-zeile"><span class="hat">✓ ${t.hat.map(escapeHtml).join(', ')}</span></div>
          <div class="treffer-zeile">${t.fehlt.length ? `<span class="fehlt">fehlt: ${t.fehlt.map(escapeHtml).join(', ')}</span>` : '<span class="hat"><b>alles da</b></span>'}</div>
          <p class="klein" style="margin:6px 0">Vorschlag für heute: <b>× ${zahl(t.faktor, 2)}</b> → <span class="zahl">${zahl(t.werte.kcal)} kcal · ${zahl(t.werte.protein)} g P</span> <span class="muted">· ${escapeHtml(rz.mahlzeit)} · ${rz.zeit.aktiv} min</span></p>
          <button class="knopf" type="button" data-planen="${rz.id}" data-faktor="${t.faktor}">Heute einplanen</button></div>`;
      }
      html += '</div>';
      if (treffer.length > MAX_TREFFER) html += `<p class="klein muted">… und ${treffer.length - MAX_TREFFER} weitere mit weniger Treffern.</p>`;
    }
    $('#inhalt').innerHTML = html + fuss();
    const feld = $('#ks-suche');
    const uebernehmen = () => { if (hinzu(feld.value)) { zeichnen(); $('#ks-suche').focus(); } };
    feld.addEventListener('change', uebernehmen);
    feld.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); uebernehmen(); } });
    $('#ks-dazu').onclick = uebernehmen;
    const d = $('#ks-haeufig'); if (d) d.addEventListener('toggle', () => S.schreiben('kuehlschrank_offen', d.open));
  };

  $('#inhalt').onclick = (e) => {
    const weg = e.target.closest('[data-weg]');
    if (weg) { auswahl = auswahl.filter((z) => z !== weg.dataset.weg); speichern(); return zeichnen(); }
    const dazu = e.target.closest('[data-dazu]');
    if (dazu) { auswahl = [...auswahl, dazu.dataset.dazu]; speichern(); return zeichnen(); }
    if (e.target.id === 'ks-leeren') { auswahl = []; speichern(); return zeichnen(); }
    const pl = e.target.closest('[data-planen]');
    if (pl) {
      const r = D.map[pl.dataset.planen];
      planenDialog(r, { faktor: Number(pl.dataset.faktor), slot: slotFuer(r, heuteOffen().leer) });
    }
  };
  zeichnen();
}
