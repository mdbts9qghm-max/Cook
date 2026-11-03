"""Helfer für den Rezept-Import aus Instagram/TikTok (SPEC 9). Das Rezept selbst schreibt Claude
in eigenen Worten als YAML – dieses Skript übernimmt die mechanischen Schritte.

Aufruf:
  python3 tools/importieren.py                       → Überblick: neue Dateien in import/ und offene Links
  python3 tools/importieren.py umrechnen "1 Scoop Whey" "1/2 cup oats" "2 EL Honig"
  python3 tools/importieren.py aehnlich "Lemon Blueberry Mug Cake" --zutaten "Whey,Heidelbeeren TK,Ei"
  python3 tools/importieren.py erledigt lemon-mugcake --rezept zitronen-blaubeer-tassenkuchen
        → Dateien der Gruppe nach import/erledigt/ verschieben bzw. Link in links.txt als erledigt markieren
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
import unicodedata
from datetime import date
from fractions import Fraction
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402

IMPORT_DIR = C.ROOT / "import"
LINKS = "links.txt"
BILDER = {".png", ".jpg", ".jpeg", ".heic", ".webp"}
TEXTE = {".txt", ".md"}
ERLEDIGT_MARKE = "✓"


# ---------- Überblick ------------------------------------------------------------------------
def gruppe(datei: Path) -> str:
    """brownie-1.png, brownie-2.png → brownie (SPEC 9.1)"""
    return re.sub(r"[-_ ]\d+$", "", datei.stem)


def neue_dateien(import_dir: Path = IMPORT_DIR) -> dict[str, list[Path]]:
    out: dict[str, list[Path]] = {}
    if not import_dir.exists():
        return out
    for f in sorted(import_dir.iterdir()):
        if f.is_file() and f.name != LINKS and not f.name.startswith(".") and f.suffix.lower() in BILDER | TEXTE:
            out.setdefault(gruppe(f), []).append(f)
    return out


def offene_links(import_dir: Path = IMPORT_DIR) -> list[str]:
    p = import_dir / LINKS
    if not p.exists():
        return []
    return [z.strip() for z in p.read_text(encoding="utf-8").splitlines()
            if z.strip() and not z.lstrip().startswith(("#", ERLEDIGT_MARKE))]


# ---------- Mengen umrechnen -----------------------------------------------------------------
_ZAHL = r"(\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])"
_BRUCH = {"½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3"}


def _zahl(text: str) -> float:
    t = _BRUCH.get(text, text).replace(",", ".").strip()
    if " " in t:                                   # „1 1/2“
        a, b = t.split()
        return float(a) + float(Fraction(b))
    return float(Fraction(t)) if "/" in t else float(t)


def _einheit(wort: str) -> str | None:
    w = wort.lower().strip(".")
    w = C.IMPORT_EINHEIT_ALIAS.get(w, C.IMPORT_EINHEIT_ALIAS.get(w + ".", w))
    return w if w in C.IMPORT_EINHEITEN else None


def umrechnen(angabe: str) -> dict:
    """„1/2 cup oats“ → {menge, einheit, zutat, g (oder None = nachfragen), regel}"""
    s = angabe.strip()
    m = re.match(rf"^{_ZAHL}\s*([A-Za-zÄÖÜäöüß.]+)?\s*(.*)$", s)
    if not m:
        return {"angabe": angabe, "g": None, "regel": "keine Menge erkannt – nachfragen"}
    menge = _zahl(m.group(1))
    wort, rest = (m.group(2) or ""), m.group(3).strip()
    einheit = _einheit(wort) if wort else None
    if wort and not einheit:                       # „2 eggs“ → Stückzahl, Wort gehört zur Zutat
        rest = f"{wort} {rest}".strip()
        einheit = "stück"
    if not wort:
        einheit = "stück"
    zutat = re.sub(r"^(of|von)\s+", "", rest, flags=re.I)
    tabelle = C.IMPORT_EINHEITEN[einheit]
    z = zutat.lower()
    pro = next((g for k, g in tabelle.items() if k != "_" and k in z), tabelle["_"])
    regel = next((f"{einheit}: „{k}“" for k in tabelle if k != "_" and k in z), f"{einheit}: Standard")
    g = round(menge * pro, 1) if pro is not None else None
    return {"angabe": angabe, "menge": menge, "einheit": einheit, "zutat": zutat, "g": g,
            "regel": regel if g is not None else f"{einheit} bei „{zutat}“ nicht eindeutig – nachfragen"}


# ---------- Ähnliche Rezepte -----------------------------------------------------------------
_FUELL = {"mit", "und", "aus", "dem", "der", "die", "das", "in", "im", "the", "with", "and", "a", "protein", "high"}
_SYNONYME = {"blueberry": "blaubeer", "blueberries": "blaubeer", "heidelbeer": "blaubeer", "lemon": "zitrone",
             "zitronen": "zitrone", "mug": "tasse", "cake": "kuchen", "oats": "oats", "chicken": "haehnchen",
             "cheesecake": "cheesecake", "pancakes": "pancakes", "brownie": "brownie", "beef": "rind",
             "salmon": "lachs", "shrimp": "garnelen", "peanut": "erdnuss", "chocolate": "schoko",
             "choco": "schoko", "strawberry": "erdbeer", "banana": "banane", "cinnamon": "zimt", "apple": "apfel"}


def _woerter(text: str) -> set[str]:
    t = unicodedata.normalize("NFKD", text.lower().replace("ß", "ss"))
    t = "".join(c for c in t if not unicodedata.combining(c))
    out = set()
    for w in re.split(r"[^a-z0-9]+", t):
        if len(w) < 3 or w in _FUELL:
            continue
        w = _SYNONYME.get(w, w)
        for end in ("en", "n", "e", "s"):           # grobe Grundform
            if w.endswith(end) and len(w) - len(end) >= 4:
                w = w[: -len(end)]
                break
        out.add(w)
    return out


def _jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


def aehnliche(name: str, zutaten: list[str] | None = None, mahlzeit: str | None = None,
              rezepte_dir: Path = C.REZEPTE_DIR, n: int = 5) -> list[dict]:
    """Ähnlichkeit 0–1 aus Namenswörtern (60 %) und gemeinsamen Zutaten (40 %), gleiche Mahlzeit +0,1."""
    nw = _woerter(name)
    zs = {z.strip() for z in (zutaten or []) if z.strip()}
    out = []
    for f in sorted(rezepte_dir.glob("*.yaml")):
        r = yaml.safe_load(f.read_text(encoding="utf-8"))
        rz = {z["zutat"] for z in r["zutaten"] if "zutat" in z}
        s_name = _jaccard(nw, _woerter(r["name"]) | _woerter(r["id"]))
        s_zut = _jaccard(zs, rz) if zs else None
        score = s_name if s_zut is None else 0.6 * s_name + 0.4 * s_zut
        if mahlzeit and r.get("mahlzeit") == mahlzeit:
            score += 0.1
        out.append({"id": r["id"], "name": r["name"], "mahlzeit": r.get("mahlzeit"), "score": round(min(score, 1.0), 2),
                    "gemeinsam": sorted(zs & rz)})
    return sorted(out, key=lambda x: -x["score"])[:n]


# ---------- Erledigt -------------------------------------------------------------------------
def erledigt(was: str, rezept_id: str, import_dir: Path = IMPORT_DIR, heute: str | None = None) -> list[str]:
    """Verschiebt alle Dateien der Gruppe nach import/erledigt/ und/oder markiert passende Links."""
    heute = heute or date.today().isoformat()
    meldungen = []
    ziel = import_dir / "erledigt"
    ziel.mkdir(parents=True, exist_ok=True)
    for f in neue_dateien(import_dir).get(was, []):
        neu = ziel / f.name
        if neu.exists():
            neu = ziel / f"{f.stem}-{heute}{f.suffix}"
        shutil.move(str(f), neu)
        meldungen.append(f"📁 {f.name} → import/erledigt/")
    p = import_dir / LINKS
    if p.exists():
        zeilen = p.read_text(encoding="utf-8").splitlines()
        vorher = list(zeilen)
        for i, z in enumerate(zeilen):
            if z.strip() and not z.lstrip().startswith(("#", ERLEDIGT_MARKE)) and (z.strip() == was or was in z):
                zeilen[i] = f"{ERLEDIGT_MARKE} {z.strip()}  → {rezept_id} ({heute})"
                meldungen.append(f"🔗 Link erledigt: {z.strip()}")
        if zeilen != vorher:
            p.write_text("\n".join(zeilen) + "\n", encoding="utf-8")
    if not meldungen:
        meldungen.append(f"⚠️ Nichts gefunden für „{was}“ (Dateigruppe oder Link).")
    return meldungen


# ---------- CLI --------------------------------------------------------------------------------
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Import-Helfer (SPEC 9)")
    sub = ap.add_subparsers(dest="befehl")
    u = sub.add_parser("umrechnen")
    u.add_argument("angaben", nargs="+")
    a = sub.add_parser("aehnlich")
    a.add_argument("name")
    a.add_argument("--zutaten", default="")
    a.add_argument("--mahlzeit")
    e = sub.add_parser("erledigt")
    e.add_argument("was", help="Dateigruppe (z. B. brownie) oder Link")
    e.add_argument("--rezept", required=True)
    args = ap.parse_args(argv)

    if args.befehl == "umrechnen":
        for x in args.angaben:
            r = umrechnen(x)
            print(f"{x:30} → {str(r['g']) + ' g' if r['g'] is not None else '❓'}   ({r['regel']})")
        return 0
    if args.befehl == "aehnlich":
        for r in aehnliche(args.name, args.zutaten.split(",") if args.zutaten else None, args.mahlzeit):
            flag = "⚠️ " if r["score"] >= C.IMPORT_AEHNLICH_AB else "   "
            print(f"{flag}{r['score']:.2f}  {r['name']} ({r['id']}){'  gemeinsam: ' + ', '.join(r['gemeinsam']) if r['gemeinsam'] else ''}")
        return 0
    if args.befehl == "erledigt":
        for m in erledigt(args.was, args.rezept):
            print(m)
        return 0

    dateien, links = neue_dateien(), offene_links()
    if not dateien and not links:
        print("Nichts Neues in import/ (Screenshots, .txt) und keine offenen Links in import/links.txt.")
        return 0
    for g, fs in dateien.items():
        print(f"🖼️  {g}: {', '.join(f.name for f in fs)}")
    for link in links:
        print(f"🔗 {link}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
