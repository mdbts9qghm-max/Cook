// Rezeptbuch-App – Start, Router, Service Worker. Ansichten liegen in ansicht-*.js, Logik in planer.js/rezept.js/format.js.
import * as P from './planer.js';
import * as S from './speicher.js';
import { oeffnen as kochmodusOeffnen } from './kochmodus.js';
import { $, D, bewertungDialog, laden, svg, tabsMarkieren } from './ui.js';
import { ansichtRezept, ansichtRezepte } from './ansicht-rezepte.js';
import { ansichtAuswahl, ansichtHeute, ansichtPlaner, ansichtTag } from './ansicht-planer.js';
import { ansichtEinkauf } from './ansicht-einkauf.js';
import { ansichtKuehlschrank } from './ansicht-kuehlschrank.js';
import { ansichtBefehle, ansichtEinstellungen, ansichtMehr, ansichtSicherung, ansichtVorlagen, ansichtVorrat } from './ansicht-mehr.js';

const TABS = { heute: 'heute', rezepte: 'rezepte', rezept: 'rezepte', kochen: 'rezepte', planer: 'planer', tag: 'planer', auswahl: 'planer',
  einkauf: 'einkauf', mehr: 'mehr', vorrat: 'mehr', vorlagen: 'mehr', einstellungen: 'mehr', sicherung: 'mehr', kuehlschrank: 'mehr', befehle: 'mehr' };

function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'heute';
  const [teil, a, b] = h.split('/').map(decodeURIComponent);
  window.scrollTo(0, 0);
  const inhalt = $('#inhalt');
  inhalt.onclick = null; inhalt.onchange = null;
  if (inhalt._aufraeumen) inhalt._aufraeumen();
  document.querySelector('.banner.verschieben')?.remove();
  tabsMarkieren(TABS[teil] || 'heute');
  switch (teil) {
    case 'rezepte': return ansichtRezepte();
    case 'rezept': return ansichtRezept(a || '');
    case 'kochen': { ansichtRezept(a || ''); const r = D.map[a]; if (r) kochmodusOeffnen(r, 1); return; }
    case 'planer': return ansichtPlaner(a);
    case 'tag': return ansichtTag(a);
    case 'auswahl': return ansichtAuswahl(a, b);
    case 'einkauf': return ansichtEinkauf();
    case 'mehr': return ansichtMehr();
    case 'vorrat': return ansichtVorrat();
    case 'vorlagen': return ansichtVorlagen();
    case 'einstellungen': return ansichtEinstellungen();
    case 'sicherung': return ansichtSicherung();
    case 'kuehlschrank': return ansichtKuehlschrank();
    case 'befehle': return ansichtBefehle();
    default: return ansichtHeute();
  }
}

// ---------- Service Worker / Update-Hinweis ----------
function updateBanner(worker) {
  if (document.querySelector('.banner.update')) return;
  const b = document.createElement('div');
  b.className = 'banner update';
  b.innerHTML = '<span>Neue Rezepte verfügbar</span><button type="button">Neu laden</button>';
  b.querySelector('button').onclick = () => worker.postMessage('SKIP_WAITING');
  document.body.appendChild(b);
}
function serviceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Nur neu laden, wenn ein bestehender Service Worker durch eine neue Version ersetzt wurde –
  // nicht beim allerersten Laden (clients.claim() löst dort ebenfalls controllerchange aus).
  const hatteController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) updateBanner(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) updateBanner(w); });
    });
  }).catch(() => { /* still */ });
  let neu = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hatteController && !neu) { neu = true; location.reload(); } });
}

async function start() {
  document.querySelector('.tabs').innerHTML = [['heute', 'Heute'], ['rezepte', 'Rezepte'], ['planer', 'Planer'], ['einkauf', 'Einkauf'], ['mehr', 'Mehr']]
    .map(([t, n]) => `<a href="#/${t}" data-tab="${t}">${svg(t)}<span>${n}</span></a>`).join('');
  try { await laden(); } catch (e) {
    $('#inhalt').innerHTML = '<p>Die Rezeptdaten konnten nicht geladen werden. Bitte mit Internet einmal neu laden.</p>';
    return;
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('kochen-fertig', (e) => { const r = D.map[e.detail.id]; if (r) bewertungDialog(r, route, 'Wie war’s?'); });
  route();
  serviceWorker();
}

window.__app = { D, P, S };   // für Tests
start();
