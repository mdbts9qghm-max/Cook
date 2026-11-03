// Einkaufsliste (SPEC 8.5) – wird aus dem Plan berechnet, nicht geschrieben
import { zahl, gramm } from './format.js';
import { escapeHtml } from './rezept.js';
import * as P from './planer.js';
import * as S from './speicher.js';
import { $, ctx, datumKurz, fuss, kopf, meldung, planLaden, vorrat, vorTage, aktuelleWoche } from './ui.js';

export function ansichtEinkauf() {
  const w = aktuelleWoche();
  kopf(`Einkauf KW ${w.kw}`);
  const key = P.wochenSchluessel(w.jahr, w.kw);
  const zeichnen = () => {
    const plan = planLaden(w.jahr, w.kw);
    const liste = P.einkaufsliste(plan, ctx({ vorTage: vorTage(plan) }), vorrat());
    const haken = new Set((S.lesen('haken', {})[key]) || []);
    const eigene = (S.lesen('eigene_artikel', {})[key]) || [];
    const zeile = (a, pruefen = false) => {
      const an = haken.has(a.id);
      return `<li class="ek${an ? ' erledigt' : ''}"><label><input type="checkbox" data-haken="${escapeHtml(a.id)}"${an ? ' checked' : ''}>
        <span><b>${escapeHtml(pruefen ? a.zutat : a.produkt)}</b>${pruefen ? ` <span class="muted klein">(${gramm(a.bedarf_g)} g)</span>`
          : `<br><span class="zahl">${gramm(a.bedarf_g)} g → ${a.packungen} × ${escapeHtml(a.packung_text)}</span>${a.preis != null ? ` <span class="muted klein">· ${zahl(a.preis, 2)} €</span>` : ''}${a.vorrat_g ? ` <span class="muted klein">· ${gramm(a.vorrat_g)} g aus Vorrat</span>` : ''}`}
        <br><span class="muted klein">${escapeHtml(a.wofuer.join(', '))}</span>${a.frische ? `<br><span class="klein frisch">${escapeHtml(a.frische)}</span>` : ''}</span></label></li>`;
    };
    let html = `<div class="wochen-nav"><a class="knopf" href="#/einkauf" data-woche="-1" aria-label="Vorige Woche">‹</a><div><b>KW ${w.kw}</b><br><span class="klein muted">${datumKurz(plan.tage[0].datum)}–${datumKurz(plan.tage[6].datum)}${w.jahr}</span></div><a class="knopf" href="#/einkauf" data-woche="1" aria-label="Nächste Woche">›</a></div>`;
    const leer = liste.termine.every((t) => !t.artikel.length && !t.vorratPruefen.length);
    if (leer) html += '<div class="karte"><p>Für diese Woche ist noch nichts gekocht geplant. Die Einkaufsliste entsteht automatisch aus dem Planer.</p><a class="knopf primaer" href="#/planer">Zum Planer</a></div>';
    for (const t of liste.termine) {
      if (!t.artikel.length && !t.vorratPruefen.length) continue;
      if (liste.termine.length > 1 || t.datum) html += `<h2>Einkauf ${t.datum ? `${P.kurzTag(t.datum)} ${datumKurz(t.datum)}` : ''} <span class="muted klein">${t.art === 'gross' ? 'groß' : 'frisch'}</span></h2>`;
      const offen = [], fertig = [];
      for (const g of t.abteilungen) {
        const o = g.artikel.filter((a) => !haken.has(a.id)), f = g.artikel.filter((a) => haken.has(a.id));
        if (o.length) offen.push(`<h3>${escapeHtml(g.name)}</h3><ul class="einkauf">${o.map((a) => zeile(a)).join('')}</ul>`);
        fertig.push(...f.map((a) => zeile(a)));
      }
      html += `<div class="karte">${offen.join('') || '<p class="muted">Alles im Wagen 🎉</p>'}
        ${t.vorratPruefen.length ? `<h3>Vorrat prüfen</h3><p class="klein muted">Kleine Mengen – nur kaufen, wenn nichts mehr da ist.</p><ul class="einkauf">${t.vorratPruefen.filter((a) => !haken.has(a.id)).map((a) => zeile(a, true)).join('')}</ul>` : ''}
        ${fertig.length || t.vorratPruefen.some((a) => haken.has(a.id)) ? `<h3 class="muted">Erledigt</h3><ul class="einkauf">${fertig.join('')}${t.vorratPruefen.filter((a) => haken.has(a.id)).map((a) => zeile(a, true)).join('')}</ul>` : ''}</div>`;
    }
    html += `<div class="karte"><h2 style="margin-top:0">Eigene Artikel</h2><ul class="einkauf">${eigene.map((e, i) => `<li class="ek${e.erledigt ? ' erledigt' : ''}"><label><input type="checkbox" data-eigen="${i}"${e.erledigt ? ' checked' : ''}><span>${escapeHtml(e.text)}</span></label><button type="button" class="knopf mini" data-eigen-weg="${i}" aria-label="Entfernen">×</button></li>`).join('')}</ul>
      <form id="eigen-form" class="suche"><input type="text" id="eigen-text" placeholder="z. B. Spülmittel" aria-label="Eigener Artikel"><button class="knopf" type="submit">+</button></form></div>`;
    if (!leer) {
      const k = liste.kosten;
      html += `<div class="karte"><h2 style="margin-top:0">Kosten (geschätzt)</h2><p class="zahl"><b>${zahl(k.gesamt, 2)} €</b>${k.budget ? ` von ${zahl(k.budget)} € Budget` : ''}</p>
        ${k.ueberBudget ? `<p class="hinweis">⚠️ ${zahl(k.gesamt - k.budget, 2)} € über dem Budget – günstigere Proteinquellen (Pute, Hähnchen, Hack) oder Reste einplanen.</p>` : ''}
        <details><summary class="klein muted">nach Abteilung</summary><ul class="punkte">${Object.entries(k.proAbteilung).map(([a, v]) => `<li>${escapeHtml(a)}: ${zahl(v, 2)} €</li>`).join('')}</ul></details></div>`;
      if (liste.restNachWoche.length) {
        html += `<div class="karte"><h2 style="margin-top:0">Reste nach der Woche</h2><p class="klein muted">Was von angebrochenen Packungen übrig bleibt.</p>
          <ul class="punkte">${liste.restNachWoche.map((r) => `<li>${escapeHtml(r.zutat)}: ${gramm(r.g)} g <span class="muted klein">(offen haltbar bis ${P.kurzTag(r.haltbar_bis)} ${datumKurz(r.haltbar_bis)})</span></li>`).join('')}</ul>
          <button class="knopf" type="button" id="in-vorrat">In Vorrat übernehmen</button></div>`;
      }
      html += `<div class="knopf-reihe"><button class="knopf primaer" type="button" id="teilen">Teilen / Kopieren</button><button class="knopf" type="button" id="haken-weg">Alle Haken zurücksetzen</button></div>`;
    }
    html += `<p class="verborgen" id="kontrolle" data-ok="${liste.kontrolle.ok}">${JSON.stringify(liste.kontrolle)}</p>`;
    $('#inhalt').innerHTML = html + fuss();

    $('#inhalt').onclick = (ev) => {
      const wb = ev.target.closest('[data-woche]');
      if (wb) { ev.preventDefault(); S.schreiben('planer_woche', P.nachbarWoche(w.jahr, w.kw, Number(wb.dataset.woche))); ansichtEinkauf(); return; }
      const weg = ev.target.closest('[data-eigen-weg]');
      if (weg) { const alle = S.lesen('eigene_artikel', {}); alle[key] = (alle[key] || []).filter((_, i) => i !== Number(weg.dataset.eigenWeg)); S.schreiben('eigene_artikel', alle); zeichnen(); return; }
      if (ev.target.id === 'haken-weg') { const h = S.lesen('haken', {}); delete h[key]; S.schreiben('haken', h); const e = S.lesen('eigene_artikel', {}); (e[key] || []).forEach((x) => { x.erledigt = false; }); S.schreiben('eigene_artikel', e); zeichnen(); return; }
      if (ev.target.id === 'in-vorrat') {
        S.schreiben('vorrat', [...vorrat(), ...liste.restNachWoche.map((r) => ({ zutat: r.zutat, g: r.g, haltbar_bis: r.haltbar_bis }))]);
        meldung('Reste in den Vorrat übernommen'); return;
      }
      if (ev.target.id === 'teilen') {
        const text = P.einkaufText(liste, `Einkaufsliste KW ${w.kw}`, eigene.filter((e) => !e.erledigt));
        (async () => {
          try { if (navigator.share) { await navigator.share({ title: `Einkaufsliste KW ${w.kw}`, text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
          try { await navigator.clipboard.writeText(text); meldung('Liste kopiert'); } catch (_) { prompt('Zum Kopieren markieren:', text); }
        })();
      }
    };
    $('#inhalt').onchange = (ev) => {
      const h = ev.target.dataset.haken;
      if (h !== undefined) {
        const alle = S.lesen('haken', {}); const s = new Set(alle[key] || []);
        ev.target.checked ? s.add(h) : s.delete(h); alle[key] = [...s]; S.schreiben('haken', alle);
        setTimeout(zeichnen, 250); return;
      }
      const e = ev.target.dataset.eigen;
      if (e !== undefined) { const alle = S.lesen('eigene_artikel', {}); alle[key][Number(e)].erledigt = ev.target.checked; S.schreiben('eigene_artikel', alle); zeichnen(); }
    };
    $('#eigen-form').onsubmit = (ev) => {
      ev.preventDefault();
      const t = $('#eigen-text').value.trim(); if (!t) return;
      const alle = S.lesen('eigene_artikel', {}); alle[key] = [...(alle[key] || []), { text: t, erledigt: false }]; S.schreiben('eigene_artikel', alle); zeichnen();
    };
  };
  zeichnen();
}
