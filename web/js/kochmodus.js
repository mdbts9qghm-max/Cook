// Kochmodus: ein Schritt pro Ansicht, große Schrift, Wischen/Tippen, mehrere Timer, Bildschirm bleibt an.
import { escapeHtml, inlineMd, eintragsMap, menge, platzhalterIds, rezeptText, textName } from './rezept.js';

let timer = [];          // { id, name, ende (ms), fertig }
let tick = null;
let wakeLock = null;
let audioCtx = null;

async function wachHalten() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (_) { /* nicht unterstützt oder abgelehnt – still */ }
}
function wachLoslassen() {
  try { if (wakeLock) wakeLock.release(); } catch (_) { /* still */ }
  wakeLock = null;
}
function beimSichtbarWerden() { if (document.visibilityState === 'visible' && document.querySelector('.koch')) wachHalten(); }

function piep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.4);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + i * 0.4 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.4 + 0.3);
      o.start(t0 + i * 0.4); o.stop(t0 + i * 0.4 + 0.32);
    }
  } catch (_) { /* still */ }
  try { if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]); } catch (_) { /* still */ }
}

function restZeit(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function timerStarten(name, minuten) {
  timer.push({ id: Date.now() + Math.random(), name, ende: Date.now() + minuten * 60000, fertig: false });
  timerZeichnen();
}

function timerZeichnen() {
  const box = document.querySelector('.koch-timer');
  if (!box) return;
  const jetzt = Date.now();
  box.innerHTML = timer.map((t) => {
    const rest = t.ende - jetzt;
    if (rest <= 0 && !t.fertig) { t.fertig = true; piep(); }
    return `<span class="t${t.fertig ? ' fertig' : ''}" data-timer="${t.id}">⏱️ ${escapeHtml(t.name)} ${t.fertig ? 'fertig!' : restZeit(rest)}
      <button type="button" aria-label="Timer entfernen" data-weg="${t.id}">×</button></span>`;
  }).join('');
}

/** Seiten des Kochmodus: Mise en place + alle Schritte */
export function kochSeiten(rezept) {
  const seiten = [];
  if (rezept.mise_en_place && rezept.mise_en_place.length) {
    seiten.push({ titel: 'Mise en place', punkte: rezept.mise_en_place, timer_min: null, ids: rezept.mise_en_place.flatMap(platzhalterIds) });
  }
  for (const s of rezept.schritte) seiten.push({ titel: s.titel, text: s.text, timer_min: s.timer_min, ids: platzhalterIds(s.text) });
  return seiten;
}

/** Öffnet den Kochmodus. faktor bezogen auf 2 Portionen. */
export function oeffnen(rezept, faktor = 1, beimSchliessen = () => {}) {
  const seiten = kochSeiten(rezept);
  const map = eintragsMap(rezept);
  let i = 0;
  const el = document.createElement('div');
  el.className = 'koch';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', `Kochmodus: ${rezept.name}`);
  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';
  wachHalten();
  document.addEventListener('visibilitychange', beimSichtbarWerden);

  function zeichnen() {
    const s = seiten[i];
    const zutaten = [...new Set(s.ids)].filter((id) => map[id]).map((id) => map[id]);
    const textHtml = s.punkte
      ? `<ul>${s.punkte.map((p) => `<li>${inlineMd(rezeptText(rezept, p, faktor))}</li>`).join('')}</ul>`
      : `<p>${inlineMd(rezeptText(rezept, s.text, faktor))}</p>`;
    el.innerHTML = `
      <div class="koch-kopf">
        <span class="fortschritt">Schritt ${i + 1} von ${seiten.length} · ${escapeHtml(rezept.name)}</span>
        <button type="button" data-aktion="schliessen" aria-label="Kochmodus beenden">✕</button>
      </div>
      <div class="koch-punkte" aria-hidden="true">${seiten.map((_, j) => `<span class="${j <= i ? 'an' : ''}"></span>`).join('')}</div>
      <div class="koch-timer" aria-live="polite"></div>
      <div class="koch-inhalt">
        <h2>${escapeHtml(s.titel)}</h2>
        <div class="koch-text">${textHtml}</div>
        ${zutaten.length ? `<div class="koch-zutaten"><b>Zutaten für diesen Schritt</b><ul>${zutaten.map((e) => `<li>${escapeHtml(menge(e, faktor))} ${e.anzeige ? '' : escapeHtml(textName(e))}</li>`).join('')}</ul></div>` : ''}
        ${s.timer_min ? `<button type="button" class="knopf primaer koch-timer-start" data-aktion="timer">⏱️ Timer ${s.timer_min} min starten</button>` : ''}
      </div>
      <div class="koch-nav">
        <button type="button" class="knopf" data-aktion="zurueck" ${i === 0 ? 'disabled' : ''}>Zurück</button>
        <button type="button" class="knopf primaer" data-aktion="weiter">${i === seiten.length - 1 ? 'Fertig – guten Appetit!' : 'Weiter'}</button>
      </div>`;
    timerZeichnen();
  }

  function schliessen(fertig = false) {
    el.remove();
    document.body.style.overflow = '';
    document.removeEventListener('visibilitychange', beimSichtbarWerden);
    wachLoslassen();
    beimSchliessen();
    if (fertig === true) window.dispatchEvent(new CustomEvent('kochen-fertig', { detail: { id: rezept.id } }));
  }
  function vor() { if (i < seiten.length - 1) { i++; zeichnen(); } else schliessen(true); }
  function zurueck() { if (i > 0) { i--; zeichnen(); } }

  el.addEventListener('click', (ev) => {
    const weg = ev.target.closest('[data-weg]');
    if (weg) { timer = timer.filter((t) => String(t.id) !== weg.dataset.weg); timerZeichnen(); return; }
    const b = ev.target.closest('[data-aktion]');
    if (!b) return;
    const a = b.dataset.aktion;
    if (a === 'schliessen') schliessen(false);
    else if (a === 'weiter') vor();
    else if (a === 'zurueck') zurueck();
    else if (a === 'timer') timerStarten(seiten[i].titel, seiten[i].timer_min);
  });

  // Wischen: links = weiter, rechts = zurück
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? vor : zurueck)();
    x0 = null;
  });
  el.tabIndex = -1;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') vor();
    if (e.key === 'ArrowLeft') zurueck();
    if (e.key === 'Escape') schliessen(false);
  });

  if (!tick) tick = setInterval(timerZeichnen, 1000);
  zeichnen();
  el.focus();
  return { schliessen, seiten: seiten.length };
}
