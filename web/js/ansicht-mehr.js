// Mehr: Vorrat, Vorlagen, Einstellungen, Sicherung (SPEC 8.6, 10.2)
import { datumDe, isoZuDatum, zahl, gramm } from './format.js';
import { escapeHtml } from './rezept.js';
import * as P from './planer.js';
import * as S from './speicher.js';
import { $, D, aktuelleWoche, datumKurz, dialog, einstellungen, fuss, heuteIso, kopf, meldung, planLaden, vorrat } from './ui.js';

export function ansichtMehr() {
  kopf('Mehr');
  const z = D.profil.tagesziele;
  const letzte = S.lesen('letzte_sicherung', null);
  $('#inhalt').innerHTML = `
    <nav class="menue">
      <a href="#/kuehlschrank"><b>Kühlschrank-Modus</b><span class="muted klein">Was kann ich mit dem kochen, was da ist?</span></a>
      <a href="#/vorrat"><b>Vorrat</b><span class="muted klein">${vorrat().length} Einträge – wird von der Einkaufsliste abgezogen</span></a>
      <a href="#/vorlagen"><b>Vorlagen</b><span class="muted klein">${S.lesen('vorlagen', []).length} gespeicherte Wochen</span></a>
      <a href="#/einstellungen"><b>Einstellungen</b><span class="muted klein">Abteilungsreihenfolge, Essenszeiten</span></a>
      <a href="#/befehle"><b>Chat-Befehle</b><span class="muted klein">Was du Claude schreiben kannst – zum Kopieren</span></a>
      <a href="#/sicherung"><b>Sicherung</b><span class="muted klein">${letzte ? `Letzte Sicherung ${datumDe(new Date(letzte))}` : 'Noch keine Sicherung'}</span></a>
    </nav>
    <div class="karte"><h2 style="margin-top:0">Tagesziele</h2><p class="zahl">${zahl(z.kcal)} kcal · ${zahl(z.protein)} g Protein · ${zahl(z.fett)} g Fett · ${zahl(z.kh)} g KH</p>
      <p class="klein muted">Neue Ziele aus MacroFactor? Im Chat „Ziele: …“ schreiben – die App wird neu erzeugt, deine Pläne bleiben erhalten.</p></div>
    <div class="karte"><h2 style="margin-top:0">Zum Home-Bildschirm</h2><p class="klein">In Safari auf „Teilen“ tippen → „Zum Home-Bildschirm“. Danach startet das Rezeptbuch wie eine App und funktioniert auch offline.</p></div>
    <p class="klein muted">${D.rezepte.length} Rezepte · Datenstand ${escapeHtml(D.version)}</p>` + fuss();
}

// ---------- Vorrat ----------
export function ansichtVorrat() {
  kopf('Vorrat', 'Mehr', '#/mehr');
  const namen = Object.keys(D.packungen).filter((n) => D.packungen[n].packung_g > 0).sort((a, b) => a.localeCompare(b, 'de'));
  const zeichnen = () => {
    const v = vorrat();
    const heute = heuteIso();
    $('#inhalt').innerHTML = `<p class="klein muted">Was du schon zu Hause hast, wird von der Einkaufsliste abgezogen. Rezepte, die Vorrat verbrauchen, sind in der Rezeptauswahl markiert.</p>
      <form class="karte" id="vr-form"><label>Zutat<input list="vr-namen" id="vr-zutat" placeholder="z. B. Feta" autocomplete="off"></label>
        <datalist id="vr-namen">${namen.map((n) => `<option value="${escapeHtml(n)}">`).join('')}</datalist>
        <div class="filter-raster"><label>Menge (g)<input type="number" inputmode="numeric" min="1" id="vr-g"></label><label>Haltbar bis (optional)<input type="date" id="vr-bis"></label></div>
        <button class="knopf primaer" type="submit">Hinzufügen</button><p class="klein h-rot" id="vr-fehler"></p></form>
      ${v.length ? `<ul class="einkauf karte">${v.map((x, i) => `<li class="ek"><span><b>${escapeHtml(x.zutat)}</b> ${gramm(x.g)} g${x.haltbar_bis ? ` <span class="klein ${x.haltbar_bis < heute ? 'h-rot' : 'muted'}">bis ${datumKurz(x.haltbar_bis)}</span>` : ''}</span><button type="button" class="knopf mini" data-weg="${i}" aria-label="Entfernen">×</button></li>`).join('')}</ul>` : '<p class="muted">Noch nichts im Vorrat.</p>'}` + fuss();
    $('#vr-form').onsubmit = (ev) => {
      ev.preventDefault();
      const zutat = $('#vr-zutat').value.trim(), g = Number($('#vr-g').value);
      if (!D.packungen[zutat]) { $('#vr-fehler').textContent = 'Bitte eine Zutat aus der Liste wählen.'; return; }
      if (!(g > 0)) { $('#vr-fehler').textContent = 'Bitte eine Menge in Gramm angeben.'; return; }
      S.schreiben('vorrat', [...vorrat(), { zutat, g, haltbar_bis: $('#vr-bis').value || null }]);
      zeichnen();
    };
    $('#inhalt').onclick = (ev) => {
      const b = ev.target.closest('[data-weg]'); if (!b) return;
      S.schreiben('vorrat', vorrat().filter((_, i) => i !== Number(b.dataset.weg))); zeichnen();
    };
  };
  zeichnen();
}

// ---------- Vorlagen ----------
export function ansichtVorlagen() {
  kopf('Vorlagen', 'Mehr', '#/mehr');
  const zeichnen = () => {
    const v = S.lesen('vorlagen', []);
    const w = aktuelleWoche();
    $('#inhalt').innerHTML = `<p class="klein muted">Vorlagen speicherst du im Planer über „Kopieren & Vorlagen“. Hier kannst du sie in die gewählte Woche (KW ${w.kw}) einsetzen oder löschen.</p>
      ${v.length ? v.map((x, i) => `<div class="karte"><b>${escapeHtml(x.name)}</b><p class="klein muted">${x.tage.reduce((n, t) => n + P.SLOTS.filter((s) => t.slots[s]).length, 0)} Mahlzeiten</p>
        <div class="knopf-reihe"><button class="knopf" type="button" data-einsetzen="${i}">In KW ${w.kw} einsetzen</button><button class="knopf gefahr" type="button" data-loeschen="${i}">Löschen</button></div></div>`).join('') : '<p class="muted">Noch keine Vorlagen.</p>'}` + fuss();
    $('#inhalt').onclick = (ev) => {
      const e = ev.target.closest('[data-einsetzen]'), l = ev.target.closest('[data-loeschen]');
      if (e) {
        const alt = planLaden(w.jahr, w.kw);
        if (alt.tage.some(P.tagBelegt) && !confirm(`KW ${w.kw} ersetzen?`)) return;
        const neu = P.vorlageEinsetzen(v[Number(e.dataset.einsetzen)], w.jahr, w.kw, D.profil); neu.einkauf = alt.einkauf;
        const roh = S.lesen('plaene', {}); roh[P.wochenSchluessel(w.jahr, w.kw)] = neu; S.schreiben('plaene', roh);
        meldung('Vorlage eingesetzt'); location.hash = '#/planer';
      }
      if (l && confirm('Vorlage löschen?')) { S.schreiben('vorlagen', v.filter((_, i) => i !== Number(l.dataset.loeschen))); zeichnen(); }
    };
  };
  zeichnen();
}

// ---------- Einstellungen ----------
export function ansichtEinstellungen() {
  kopf('Einstellungen', 'Mehr', '#/mehr');
  const zeichnen = () => {
    const e = einstellungen();
    $('#inhalt').innerHTML = `<div class="karte"><h2 style="margin-top:0">Abteilungsreihenfolge</h2><p class="klein muted">So, wie du durch deinen Markt läufst.</p>
      <ol class="sortier">${e.abteilungen.map((a, i) => `<li><span>${escapeHtml(a)}</span><span><button type="button" class="knopf mini" data-hoch="${i}" aria-label="nach oben"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="knopf mini" data-runter="${i}" aria-label="nach unten"${i === e.abteilungen.length - 1 ? ' disabled' : ''}>↓</button></span></li>`).join('')}</ol></div>
      <div class="karte"><h2 style="margin-top:0">Essenszeiten</h2><p class="klein muted">Für den Rückwärts-Zeitplan an Kochtagen (einzelne Tage änderst du in der Tagesansicht).</p>
      <div class="filter-raster">${P.SLOTS.filter((s) => s !== 'snack').map((s) => `<label>${P.SLOT_NAMEN[s]}<input type="time" data-zeit="${s}" value="${e.essenszeiten[s] || ''}"></label>`).join('')}</div></div>
      <button class="knopf" type="button" id="zuruecksetzen">Auf Standard zurücksetzen</button>` + fuss();
    const speichern = (aenderung) => { S.schreiben('einstellungen', { ...S.lesen('einstellungen', {}), ...aenderung }); zeichnen(); };
    $('#inhalt').onclick = (ev) => {
      const h = ev.target.closest('[data-hoch]'), r = ev.target.closest('[data-runter]');
      if (h || r) {
        const l = [...einstellungen().abteilungen]; const i = Number((h || r).dataset[h ? 'hoch' : 'runter']); const j = h ? i - 1 : i + 1;
        [l[i], l[j]] = [l[j], l[i]]; speichern({ abteilungen: l });
      }
      if (ev.target.id === 'zuruecksetzen') { S.schreiben('einstellungen', {}); zeichnen(); }
    };
    $('#inhalt').onchange = (ev) => { const s = ev.target.dataset.zeit; if (s) speichern({ essenszeiten: { ...einstellungen().essenszeiten, [s]: ev.target.value } }); };
  };
  zeichnen();
}

// ---------- Sicherung ----------
const SCHLUESSEL = ['plaene', 'vorlagen', 'vorrat', 'haken', 'eigene_artikel', 'einstellungen', 'favoriten', 'bewertungen'];
export function alleDaten() { const d = {}; for (const k of SCHLUESSEL) d[k] = S.lesen(k, null); return d; }

async function dateiAnbieten(name, obj) {
  const text = JSON.stringify(obj, null, 1);
  const blob = new Blob([text], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return true;
}

export function ansichtSicherung() {
  kopf('Sicherung', 'Mehr', '#/mehr');
  const zeichnen = () => {
    const letzte = S.lesen('letzte_sicherung', null);
    const w = aktuelleWoche();
    $('#inhalt').innerHTML = `<div class="karte"><p>Deine Pläne, Vorlagen, Vorrat und Haken liegen nur in diesem Browser. Werden die Website-Daten gelöscht, sind sie weg – deshalb regelmäßig sichern (z. B. in iCloud Drive).</p>
      <p class="klein muted">${letzte ? `Letzte Sicherung: ${datumDe(new Date(letzte))}` : 'Noch keine Sicherung.'}</p>
      <div class="knopf-spalte"><button class="knopf primaer" type="button" id="exp-alles">Alles sichern (Datei)</button>
      <button class="knopf" type="button" id="exp-plan">Nur KW ${w.kw} exportieren</button></div></div>
      <div class="karte"><h2 style="margin-top:0">Wiederherstellen</h2><p class="klein muted">Eine Sicherung ersetzt deine Daten in diesem Browser; ein einzelner Wochenplan ersetzt nur diese Woche.</p>
      <input type="file" id="imp-datei" accept="application/json,.json"><p class="klein" id="imp-status"></p></div>` + fuss();
    $('#exp-alles').onclick = async () => {
      if (await dateiAnbieten(`rezeptbuch-sicherung-${heuteIso()}.json`, P.sicherungErstellen(alleDaten()))) { S.schreiben('letzte_sicherung', new Date().toISOString()); zeichnen(); }
    };
    $('#exp-plan').onclick = () => dateiAnbieten(`KW-${String(w.kw).padStart(2, '0')}-${w.jahr}.json`, P.planExport(planLaden(w.jahr, w.kw), vorrat(), S.lesen('bewertungen', {})));
    $('#imp-datei').onchange = async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      try {
        const erg = P.sicherungEinlesen(JSON.parse(await f.text()));
        if (erg.typ === 'alles') {
          if (!confirm('Alle Daten in diesem Browser durch die Sicherung ersetzen?')) return;
          for (const [k, v] of Object.entries(erg.daten)) if (SCHLUESSEL.includes(k) && v !== null && v !== undefined) S.schreiben(k, v);
          $('#imp-status').textContent = '✅ Sicherung wiederhergestellt.';
        } else {
          const roh = S.lesen('plaene', {});
          if (roh[erg.schluessel] && !confirm(`KW ${erg.plan.kw} ist schon geplant – ersetzen?`)) return;
          roh[erg.schluessel] = erg.plan; S.schreiben('plaene', roh);
          $('#imp-status').textContent = `✅ Wochenplan KW ${erg.plan.kw}/${erg.plan.jahr} importiert.`;
        }
      } catch (e) { $('#imp-status').textContent = `❌ ${e.message || 'Datei konnte nicht gelesen werden'}`; }
    };
  };
  zeichnen();
}

// ---------- Chat-Befehle (SPEC 14) ----------
// Was ich im Chat mit Claude schreiben kann – zum Nachschlagen und Kopieren.
export const BEFEHLE = [
  { gruppe: 'Rezepte holen', liste: [
    { befehl: 'Import', text: 'Übernimmt alles Neue aus dem Ordner import/ (Screenshots, Texte, Links) als Rezepte – angepasst an deine Makros, in eigenen Worten.', beispiel: 'Import' },
    { befehl: 'Import: [Link oder Text]', text: 'Ein einzelnes Rezept direkt aus dem Chat übernehmen. Klappt ein Instagram-Link nicht, lieber Screenshot oder kopierten Text schicken.', beispiel: 'Import: ' },
    { befehl: 'neue Rezepte', text: 'Claude fragt Kategorien und Küchen ab und schlägt 3–5 neue Rezepte vor.', beispiel: 'neue Rezepte' },
    { befehl: 'Küche: [Name]', text: '3–5 neue Rezepte einer Küche.', beispiel: 'Küche: Italienisch' },
    { befehl: 'trending', text: 'Aktuelle High-Protein-Trends von TikTok/Instagram suchen und 5 passende Ideen vorschlagen.', beispiel: 'trending' },
  ] },
  { gruppe: 'Kochen & Bewerten', liste: [
    { befehl: 'Kühlschrank: [Zutaten]', text: '2–3 Gerichte aus dem, was da ist – erst aus dem Rezeptbuch, sonst neue; Portion passend zu deinen Restmakros. (In der App: Mehr → Kühlschrank-Modus.)', beispiel: 'Kühlschrank: Hähnchen, Reis, Skyr' },
    { befehl: 'bewerten [Rezept] [Sterne] [Kommentar]', text: 'Bewertung ins Rezept schreiben. Kommentare wie „zu trocken“ setzt Claude im Rezept um. Oder einfach die Sicherungsdatei schicken – dann werden alle Sterne aus der App übernommen.', beispiel: 'bewerten Marry Me Chicken 4 etwas zu trocken' },
    { befehl: 'anpassen [Rezept]', text: 'Rezept ändern (z. B. mehr Protein, weniger Fett, ohne Ofen), Nährwerte neu rechnen, Unterschied zeigen.', beispiel: 'anpassen Butter Chicken mit mehr Protein' },
  ] },
  { gruppe: 'Planen & Ziele', liste: [
    { befehl: 'Plan prüfen + Exportdatei', text: 'Wochenplan exportieren (Mehr → Sicherung → „Nur KW … exportieren“), Datei schicken – du bekommst Hinweise und Vorschläge, der Plan wird nicht verändert.', beispiel: 'Plan prüfen' },
    { befehl: 'Extra: [Name, Zutaten]', text: 'Neues Extra für den Planer anlegen (z. B. dein Lieblings-Shake).', beispiel: 'Extra: Schoko-Shake, 30 g Whey Schoko, 300 ml Milch 1,5 %' },
    { befehl: 'Ziele: [kcal, P, F, KH]', text: 'Neue Tagesziele aus MacroFactor übernehmen; die App wird neu erzeugt, deine Pläne bleiben.', beispiel: 'Ziele: 2300, 150, 100, 195' },
  ] },
  { gruppe: 'App', liste: [
    { befehl: 'App-Wunsch: [Beschreibung]', text: 'Neue Funktion oder Änderung an der App.', beispiel: 'App-Wunsch: ' },
    { befehl: 'Web-App aktualisieren', text: 'Alles prüfen, neu erzeugen und veröffentlichen. In der App erscheint dann „Neue Rezepte verfügbar – Neu laden“.', beispiel: 'Web-App aktualisieren' },
  ] },
];

export function ansichtBefehle() {
  kopf('Chat-Befehle', 'Mehr', '#/mehr');
  let html = '<p class="muted">Diese Befehle schreibst du im Chat mit Claude. Tippe auf „Kopieren“, dann im Chat einfügen und ergänzen.</p>';
  for (const g of BEFEHLE) {
    html += `<h2>${escapeHtml(g.gruppe)}</h2><div class="liste">`;
    for (const b of g.liste) {
      html += `<div class="karte befehl"><b>${escapeHtml(b.befehl)}</b><p class="klein" style="margin:4px 0 8px">${escapeHtml(b.text)}</p>
        <div class="befehl-zeile"><code>${escapeHtml(b.beispiel.trim() || b.befehl)}</code><button class="knopf" type="button" data-kopieren="${escapeHtml(b.beispiel)}">Kopieren</button></div></div>`;
    }
    html += '</div>';
  }
  html += '<p class="klein muted">Dateien (Screenshots, Sicherung, Wochenplan) schickst du einfach als Anhang im Chat mit.</p>';
  $('#inhalt').innerHTML = html + fuss();
  $('#inhalt').onclick = async (e) => {
    const k = e.target.closest('[data-kopieren]');
    if (!k) return;
    try { await navigator.clipboard.writeText(k.dataset.kopieren); meldung('Kopiert – jetzt im Chat einfügen'); } catch (_) { meldung(k.dataset.kopieren); }
  };
}
