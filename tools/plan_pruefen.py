"""Exportierten Wochenplan gegen die Hinweisregeln prüfen (SPEC 8.7) – ändert den Plan nie.

Aufruf:
  python3 tools/plan_pruefen.py                      → neueste Datei in daten/wochenplaene/
  python3 tools/plan_pruefen.py pfad/KW-47-2026.json → bestimmte Datei (Wochenplan oder Sicherung)
  python3 tools/plan_pruefen.py datei.json --ablegen → zusätzlich als daten/wochenplaene/KW-XX-JJJJ.json ablegen
  python3 tools/plan_pruefen.py sicherung.json --woche 2026-W47   → aus einer Sicherung nur diese Woche

Damit Chat-Prüfung und App nie auseinanderlaufen, rechnet das Skript nicht selbst, sondern ruft
dieselben reinen Funktionen aus web/js/planer.js über Node auf (hinweiseWoche, tagesSumme,
auffuellVorschlaege, wochenStatistik, einkaufsliste) – mit den generierten Daten aus web/daten/.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402
from naehrwerte import zahl  # noqa: E402

PLAENE_DIR = C.DATEN / "wochenplaene"
SICHERUNG_FORMAT = "rezeptbuch-sicherung"
SLOT_NAMEN = {"fruehstueck": "Frühstück", "mittag": "Mittag", "abend": "Abend", "snack": "Snack"}
WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

# Läuft in Node als ES-Modul; bekommt die Eingabe als JSON auf stdin.
NODE_SKRIPT = r"""
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const web = process.argv[1];
const P = await import(pathToFileURL(web + '/js/planer.js').href);
const lese = (n) => JSON.parse(readFileSync(web + '/daten/' + n + '.json', 'utf8'));
const r = lese('rezepte'), profil = lese('profil'), extras = lese('extras'), packungen = lese('packungen');
const ein = JSON.parse(readFileSync(0, 'utf8'));
const rezepteMap = Object.fromEntries(r.rezepte.map((x) => [x.id, x]));
const extrasMap = Object.fromEntries(extras.map((x) => [x.id, x]));
const plaene = Object.fromEntries(Object.entries(ein.plaene).map(([k, p]) => [k, P.migrierePlan(p)]));
const ctx = { rezepteMap, extrasMap, packungen, profil, abteilungen: profil.einkauf.abteilungen, bewertungen: ein.bewertungen || {} };
const out = [];
for (const key of ein.pruefen) {
  const plan = plaene[key];
  const vw = P.nachbarWoche(plan.jahr, plan.kw, -1);
  const vor = plaene[P.wochenSchluessel(vw.jahr, vw.kw)];
  const c = { ...ctx, vorTage: vor ? vor.tage : [] };
  const hinweise = P.hinweiseWoche(plan, c);
  const tage = plan.tage.map((t) => ({
    datum: t.datum, belegt: P.tagBelegt(t), summe: P.tagesSumme(t, rezepteMap, extrasMap),
    slots: Object.fromEntries(P.SLOTS.map((s) => {
      const e = t.slots[s];
      if (!e) return [s, null];
      if (e.typ === 'auswaerts') return [s, 'auswärts'];
      const rz = rezepteMap[e.rezept];
      const zusatz = [e.art === 'rest' ? 'Rest' : '', (e.menge ?? 1) > 1 ? `×${e.menge} kochen` : '', (e.faktor ?? 1) !== 1 ? `Portion ×${e.faktor}` : ''].filter(Boolean);
      return [s, (rz ? rz.name : `unbekannt: ${e.rezept}`) + (zusatz.length ? ` (${zusatz.join(', ')})` : '')];
    })),
    extras: (t.extras || []).map((x) => (extrasMap[x.extra] ? extrasMap[x.extra].name : x.extra)),
    hinweise: hinweise[t.datum], vorschlaege: P.auffuellVorschlaege(t, c).map((v) => v.text),
  }));
  const liste = P.einkaufsliste(plan, c, plan.vorrat || []);
  out.push({ schluessel: key, jahr: plan.jahr, kw: plan.kw, tage, statistik: P.wochenStatistik(plan, c), kosten: liste.kosten,
    einkauf: plan.einkauf, kontrolle: liste.kontrolle, ziele: profil.tagesziele });
}
process.stdout.write(JSON.stringify(out));
"""


def einlesen(pfad: Path) -> dict:
    """→ {plaene: {schluessel: plan}, bewertungen: {}} – akzeptiert Wochenplan-Export oder Gesamtsicherung."""
    try:
        obj = json.loads(pfad.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise SystemExit(f"❌ {pfad.name} ist keine lesbare JSON-Datei ({e})")
    if isinstance(obj, dict) and obj.get("format") == SICHERUNG_FORMAT:
        d = obj.get("daten") or {}
        return {"plaene": d.get("plaene") or {}, "bewertungen": d.get("bewertungen") or {}}
    if isinstance(obj, dict) and isinstance(obj.get("tage"), list) and obj.get("kw") and obj.get("jahr"):
        return {"plaene": {schluessel(obj["jahr"], obj["kw"]): obj}, "bewertungen": obj.get("bewertungen") or {}}
    raise SystemExit("❌ Unbekanntes Format – erwartet wird ein exportierter Wochenplan oder eine Sicherung aus der App.")


def schluessel(jahr, kw) -> str:
    return f"{int(jahr)}-W{int(kw):02d}"


def pruefen(daten: dict, nur: list[str] | None = None, web_dir: Path = C.WEB_DIR) -> list[dict]:
    """Ruft planer.js in Node auf und gibt pro Woche Tage, Hinweise, Statistik und Kosten zurück."""
    if shutil.which("node") is None:
        raise SystemExit("❌ Node.js wird gebraucht (die Prüfung nutzt dieselbe Logik wie die App: web/js/planer.js).")
    if not (web_dir / "js/planer.js").exists():
        raise SystemExit("❌ web/ fehlt – zuerst python3 tools/generieren.py ausführen.")
    keys = sorted(k for k, p in daten["plaene"].items() if p and any(_belegt(t) for t in p.get("tage", [])))
    if nur:
        keys = [k for k in keys if k in nur]
    if not keys:
        raise SystemExit("❌ Kein (belegter) Wochenplan gefunden.")
    ein = json.dumps({"plaene": daten["plaene"], "bewertungen": daten["bewertungen"], "pruefen": keys})
    p = subprocess.run(["node", "--no-warnings", "--input-type=module", "-e", NODE_SKRIPT, str(web_dir)],
                       input=ein, capture_output=True, text=True, timeout=60)
    if p.returncode != 0:
        raise SystemExit(f"❌ Prüfung fehlgeschlagen:\n{p.stderr[-2000:]}")
    return json.loads(p.stdout)


def _belegt(t: dict) -> bool:
    return any((t.get("slots") or {}).get(s) for s in SLOT_NAMEN) or bool(t.get("extras"))


def _tag_kurz(datum: str) -> str:
    from datetime import date
    d = date.fromisoformat(datum)
    return f"{WOCHENTAGE[d.weekday()]} {d.strftime('%d.%m.')}"


SYMBOL = {"rot": "🔴", "gelb": "🟡", "info": "ℹ️", "ok": "🟢", "leer": "⚪"}


def bericht(woche: dict) -> str:
    """Kurzer Bericht als Markdown (für den Chat)."""
    z, st, k = woche["ziele"], woche["statistik"], woche["kosten"]
    a = st["durchschnitt"]
    o = [f"## Planprüfung KW {woche['kw']}/{woche['jahr']}", ""]
    o.append(f"**Ø pro geplantem Tag:** {zahl(a['kcal'])} kcal · {zahl(a['protein'])} g P · {zahl(a['fett'])} g F · "
             f"{zahl(a['kh'])} g KH (Ziel {zahl(z['kcal'])} · {zahl(z['protein'])} · {zahl(z['fett'])} · {zahl(z['kh'])})")
    budget = f" von {zahl(k['budget'])} €" if k.get("budget") is not None else ""
    o.append(f"{st['geplanteTage']} Tage geplant · {st['kochtage']} Kochtage · ca. {st['kochzeit_min']} min aktive Kochzeit · "
             f"Einkauf ca. {zahl(k['gesamt'], 2)} €{budget}{' ⚠️ über Budget' if k.get('ueberBudget') else ''}")
    if not woche["kontrolle"]["ok"]:
        o.append("⚠️ Einkaufsliste: Mengenkontrolle stimmt nicht (bitte melden).")
    zaehler = {"rot": 0, "gelb": 0}
    for t in woche["tage"]:
        h = t["hinweise"]
        for x in h["liste"]:
            if x["stufe"] in zaehler:
                zaehler[x["stufe"]] += 1
        if not t["belegt"] and not h["liste"]:
            continue
        s = t["summe"]
        o += ["", f"### {SYMBOL.get(h['stufe'], '')} {_tag_kurz(t['datum'])} – {zahl(s['kcal'])} kcal · {zahl(s['protein'])} g P · "
              f"{zahl(s['fett'])} g F · {zahl(s['kh'])} g KH"]
        belegte = [f"{SLOT_NAMEN[sl]}: {n}" for sl, n in t["slots"].items() if n]
        if t["extras"]:
            belegte.append("Extras: " + ", ".join(t["extras"]))
        o.append("  \n".join(belegte) if belegte else "_leer_")
        for x in h["liste"]:
            o.append(f"- {SYMBOL.get(x['stufe'], '')} {x['text']}")
        for v in t["vorschlaege"]:
            o.append(f"- 💡 Vorschlag: {v}")
    o += ["", f"**Ergebnis:** {zaehler['rot']} × rot, {zaehler['gelb']} × gelb."
          + (" Alles im grünen Bereich." if not any(zaehler.values()) else "")]
    o.append("_Nur Hinweise – der Plan wurde nicht verändert._")
    return "\n".join(o)


def ablegen(pfad: Path, daten: dict, nur: list[str] | None = None, ziel_dir: Path = PLAENE_DIR) -> list[Path]:
    """Legt die Wochen als <ziel_dir>/KW-XX-JJJJ.json ab (inhaltlich unverändert)."""
    ziel_dir.mkdir(parents=True, exist_ok=True)
    ziele = []
    for key, plan in daten["plaene"].items():
        if not plan or (nur and key not in nur) or not any(_belegt(t) for t in plan.get("tage", [])):
            continue
        ziel = ziel_dir / f"KW-{int(plan['kw']):02d}-{int(plan['jahr'])}.json"
        if pfad.resolve() != ziel.resolve():
            ziel.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")
        ziele.append(ziel)
    return ziele


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Wochenplan prüfen (ändert nichts am Plan)")
    ap.add_argument("datei", nargs="?", help="exportierter Plan oder Sicherung (Standard: neueste in daten/wochenplaene/)")
    ap.add_argument("--woche", action="append", help="nur diese Woche(n), z. B. 2026-W47")
    ap.add_argument("--ablegen", action="store_true", help="Plan unter daten/wochenplaene/ ablegen")
    a = ap.parse_args(argv)
    if a.datei:
        pfad = Path(a.datei)
    else:
        kandidaten = sorted(PLAENE_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime)
        if not kandidaten:
            print("❌ Keine Datei angegeben und daten/wochenplaene/ ist leer.")
            return 1
        pfad = kandidaten[-1]
    daten = einlesen(pfad)
    for w in pruefen(daten, a.woche):
        print(bericht(w))
        print()
    if a.ablegen:
        for z in ablegen(pfad, daten, a.woche):
            print(f"📁 abgelegt: {z.relative_to(C.ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
