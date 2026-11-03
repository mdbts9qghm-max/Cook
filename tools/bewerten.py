"""Bewertungen ins Rezept-YAML schreiben (SPEC 11.2).

Aufruf:
  python3 tools/bewerten.py "marry me" 4 "etwas zu trocken"   → ein Rezept (ID oder Teil des Namens)
  python3 tools/bewerten.py --aus sicherung.json               → alle in der App vergebenen Sterne übernehmen
  python3 tools/bewerten.py --aus sicherung.json --nur-zeigen  → nur anzeigen, was sich ändern würde

Es wird nur die Zeile `bewertung: {...}` ersetzt, der Rest der Datei bleibt Zeichen für Zeichen gleich.
1–2 Sterne: Rezept bleibt erhalten, gilt als „aussortiert“ (Inhaltsverzeichnis, Planer-Auswahl blendet es aus).
Danach: pruefen.py → generieren.py → Tests.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402

ZEILE = re.compile(r"^bewertung:.*$", re.M)
SICHERUNG_FORMAT = "rezeptbuch-sicherung"


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower().replace("ß", "ss"))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def rezepte_index(rezepte_dir: Path = C.REZEPTE_DIR) -> dict[str, str]:
    """id → Name"""
    out = {}
    for f in sorted(rezepte_dir.glob("*.yaml")):
        out[f.stem] = (yaml.safe_load(f.read_text(encoding="utf-8")) or {}).get("name", f.stem)
    return out


def finde_rezept(suche: str, index: dict[str, str]) -> str:
    """Rezept-ID zu einer ID oder einem Namensteil; bei mehreren Treffern verständlicher Fehler."""
    if suche in index:
        return suche
    q = _norm(suche)
    treffer = [i for i, n in index.items() if _norm(n) == q or _norm(i) == q]
    if not treffer:
        teile = q.split()
        treffer = [i for i, n in index.items() if all(t in _norm(n) + " " + _norm(i) for t in teile)]
    if len(treffer) == 1:
        return treffer[0]
    if not treffer:
        raise ValueError(f"Kein Rezept passt zu „{suche}“.")
    raise ValueError(f"„{suche}“ ist mehrdeutig: " + ", ".join(f"{index[i]} ({i})" for i in treffer[:8]))


def zeile(sterne: int | None, kommentar: str | None, datum: str | None) -> str:
    k = json.dumps(kommentar, ensure_ascii=False) if kommentar else "null"
    return f"bewertung: {{sterne: {sterne if sterne else 'null'}, kommentar: {k}, datum: {datum or 'null'}}}"


def setzen(rid: str, sterne: int, kommentar: str | None = None, datum: str | None = None,
           rezepte_dir: Path = C.REZEPTE_DIR) -> tuple[dict, dict]:
    """Schreibt die Bewertung; gibt (alt, neu) zurück."""
    if not (isinstance(sterne, int) and 1 <= sterne <= 5):
        raise ValueError("Sterne müssen 1 bis 5 sein.")
    datum = datum or date.today().isoformat()
    date.fromisoformat(datum)                       # wirft bei ungültigem Datum
    f = rezepte_dir / f"{rid}.yaml"
    text = f.read_text(encoding="utf-8")
    alt = (yaml.safe_load(text) or {}).get("bewertung") or {}
    neu_zeile = zeile(sterne, (kommentar or "").strip() or None, datum)
    if ZEILE.search(text):
        text = ZEILE.sub(lambda _: neu_zeile, text, count=1)
    else:
        text = text.rstrip("\n") + "\n" + neu_zeile + "\n"
    neu = yaml.safe_load(text)["bewertung"]
    f.write_text(text, encoding="utf-8")
    return alt, neu


def aus_export(pfad: Path) -> dict:
    """Bewertungen aus einer App-Sicherung oder einem Wochenplan-Export: {id: {sterne, kommentar, datum}}."""
    obj = json.loads(pfad.read_text(encoding="utf-8"))
    if isinstance(obj, dict) and obj.get("format") == SICHERUNG_FORMAT:
        return (obj.get("daten") or {}).get("bewertungen") or {}
    return (obj or {}).get("bewertungen") or {}


def text_sterne(s) -> str:
    return "★" * s + "☆" * (5 - s) if s else "–"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Bewertung ins Rezept-YAML übernehmen")
    ap.add_argument("rezept", nargs="?")
    ap.add_argument("sterne", nargs="?", type=int)
    ap.add_argument("kommentar", nargs="*")
    ap.add_argument("--aus", help="Sicherung/Export aus der App")
    ap.add_argument("--nur-zeigen", action="store_true")
    a = ap.parse_args(argv)
    index = rezepte_index()
    auftraege = []
    if a.aus:
        for rid, b in aus_export(Path(a.aus)).items():
            if rid not in index:
                print(f"⚠️ {rid}: Rezept gibt es nicht (mehr) – übersprungen")
                continue
            if not b or not b.get("sterne"):
                continue
            auftraege.append((rid, int(b["sterne"]), b.get("kommentar"), (b.get("datum") or "")[:10] or None))
    elif a.rezept and a.sterne:
        try:
            rid = finde_rezept(a.rezept, index)
        except ValueError as e:
            print(f"❌ {e}")
            return 1
        auftraege.append((rid, a.sterne, " ".join(a.kommentar) or None, None))
    else:
        ap.print_help()
        return 1
    geaendert = 0
    for rid, s, k, d in auftraege:
        if a.nur_zeigen:
            print(f"• {index[rid]}: {text_sterne(s)}{f' – {k}' if k else ''}")
            continue
        try:
            alt, neu = setzen(rid, s, k, d)
        except ValueError as e:
            print(f"❌ {index[rid]}: {e}")
            return 1
        if (alt.get("sterne"), alt.get("kommentar")) != (neu["sterne"], neu["kommentar"]):
            geaendert += 1
        hinweis = " · aussortiert (Planer blendet es aus)" if s <= 2 else ""
        print(f"✅ {index[rid]}: {text_sterne(alt.get('sterne'))} → {text_sterne(s)}{f' – „{k}“' if k else ''}{hinweis}")
    if not a.nur_zeigen:
        print(f"{geaendert} Bewertung(en) geändert. Weiter: pruefen.py → generieren.py → Tests.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
