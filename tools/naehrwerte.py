"""Nährwerte berechnen: Zutaten-Datenbank laden, Rezepte und Extras rechnen, runden, Kategorien vergeben.

Aufruf als Skript:  python3 tools/naehrwerte.py [rezept-id …]   → Übersicht pro Portion
"""
from __future__ import annotations

import csv
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402

NAEHRWERTE = ["kcal", "protein", "fett", "gesaettigt", "kh", "zucker", "ballaststoffe", "salz"]
NAMEN = {"kcal": "Kalorien", "protein": "Protein", "fett": "Fett", "gesaettigt": "davon gesättigt",
         "kh": "Kohlenhydrate", "zucker": "davon Zucker", "ballaststoffe": "Ballaststoffe", "salz": "Salz"}
# Nachkommastellen beim Runden
STELLEN = {"kcal": 0, "protein": 1, "fett": 1, "gesaettigt": 1, "kh": 1, "zucker": 1,
           "ballaststoffe": 1, "salz": 2}


# --- Laden ---------------------------------------------------------------------------
def _csv_zeilen(pfad: Path):
    with open(pfad, encoding="utf-8") as f:
        zeilen = [z for z in f if z.strip() and not z.lstrip().startswith("#")]
    return list(csv.DictReader(zeilen))


def lade_zutaten(pfad: Path = C.ZUTATEN_CSV) -> dict[str, dict]:
    """zutat → {kcal, protein, …, garfaktor} (Werte pro 100 g)."""
    daten = {}
    for z in _csv_zeilen(pfad):
        name = z["zutat"].strip()
        if name in daten:
            raise ValueError(f"Zutat doppelt in {pfad.name}: {name}")
        daten[name] = {k: float(z[k]) for k in NAEHRWERTE + ["garfaktor"]}
    return daten


def lade_packungen(pfad: Path = C.PACKUNGEN_CSV) -> dict[str, dict]:
    daten = {}
    for z in _csv_zeilen(pfad):
        name = z["zutat"].strip()
        if name in daten:
            raise ValueError(f"Packung doppelt in {pfad.name}: {name}")
        daten[name] = {
            "abteilung": z["abteilung"].strip(),
            "packung_g": float(z["packung_g"]),
            "packung_text": z["packung_text"].strip(),
            "preis_eur": float(z["preis_eur"]) if z.get("preis_eur") else None,
            "haltbar_tage_offen": int(z["haltbar_tage_offen"]),
            "frische": z["frische"].strip(),
            "max_tage_nach_einkauf": int(z["max_tage_nach_einkauf"]) if z.get("max_tage_nach_einkauf") else None,
            "tk_alternative": (z.get("tk_alternative") or "").strip() or None,
        }
    return daten


def lade_yaml(pfad: Path):
    with open(pfad, encoding="utf-8") as f:
        return yaml.safe_load(f)


def lade_profil(pfad: Path = C.PROFIL_YAML) -> dict:
    return lade_yaml(pfad)


def lade_extras(pfad: Path = C.EXTRAS_YAML) -> list[dict]:
    return lade_yaml(pfad) or []


def lade_rezepte(ordner: Path = C.REZEPTE_DIR) -> list[dict]:
    """Alle Rezepte, sortiert nach id. Jedes erhält `_datei` (Pfad) für Prüfungen."""
    rezepte = []
    for pfad in sorted(ordner.glob("*.yaml")):
        r = lade_yaml(pfad) or {}
        r["_datei"] = pfad
        rezepte.append(r)
    return rezepte


# --- Rechnen ----------------------------------------------------------------------------
def runden(wert: float, stellen: int = 0) -> float:
    """Kaufmännisch runden (0,5 → aufrunden), nicht Pythons Banker's Rounding."""
    q = Decimal(1).scaleb(-stellen)
    r = Decimal(str(wert)).quantize(q, rounding=ROUND_HALF_UP)
    return int(r) if stellen == 0 else float(r)


def runde_werte(werte: dict) -> dict:
    return {k: runden(werte[k], STELLEN[k]) for k in NAEHRWERTE}


def leer() -> dict:
    return {k: 0.0 for k in NAEHRWERTE}


def addiere(a: dict, b: dict) -> dict:
    return {k: a[k] + b[k] for k in NAEHRWERTE}


def skaliere(werte: dict, faktor: float) -> dict:
    return {k: werte[k] * faktor for k in NAEHRWERTE}


def werte_menge(zutaten: dict, zutat: str, g: float) -> dict:
    if zutat not in zutaten:
        raise KeyError(f"Zutat nicht in zutaten.csv: {zutat}")
    pro100 = zutaten[zutat]
    return {k: pro100[k] * g / 100.0 for k in NAEHRWERTE}


def atwater(werte: dict) -> float:
    """Energie aus den Makros: 4·P + 4·KH + 9·F + 2·Ballaststoffe."""
    return 4 * werte["protein"] + 4 * werte["kh"] + 9 * werte["fett"] + 2 * werte["ballaststoffe"]


def plausibel(werte: dict, toleranz: float = C.PLAUSI_TOLERANZ,
              absolut: float = C.PLAUSI_ABSOLUT_KCAL) -> tuple[bool, float]:
    """(ok, Abweichung in Prozent) – Abweichung von atwater() zu den angegebenen kcal."""
    kcal = werte["kcal"]
    berechnet = atwater(werte)
    diff = berechnet - kcal
    if kcal == 0:
        return abs(diff) <= absolut, 0.0 if diff == 0 else 100.0
    prozent = diff / kcal * 100
    return (abs(diff) / kcal <= toleranz) or abs(diff) <= absolut, prozent


def zutat_eintraege(rezept: dict) -> list[dict]:
    """Zutaten ohne Gruppen-Marker; jeder Eintrag bekommt `_gruppe`."""
    gruppe = None
    eintraege = []
    for e in rezept.get("zutaten") or []:
        if "gruppe" in e and "zutat" not in e:
            gruppe = e["gruppe"]
            continue
        e = dict(e)
        e["_gruppe"] = gruppe
        eintraege.append(e)
    return eintraege


def berechne_rezept(rezept: dict, zutaten: dict) -> dict:
    """Nährwerte pro Zutat, gesamt und pro Portion (roh und gerundet) plus Gargewicht."""
    zeilen = []
    gesamt = leer()
    gargewicht = 0.0
    for e in zutat_eintraege(rezept):
        mit = e.get("mitrechnen", True)
        w = werte_menge(zutaten, e["zutat"], float(e["g"]))
        if mit:
            gesamt = addiere(gesamt, w)
            gargewicht += float(e["g"]) * zutaten[e["zutat"]]["garfaktor"]
        zeilen.append({"id": e["id"], "zutat": e["zutat"], "g": float(e["g"]),
                       "mitrechnen": mit, "werte": w})
    if rezept.get("gargewicht_g"):
        gargewicht = float(rezept["gargewicht_g"])
    portion = skaliere(gesamt, 1 / C.PORTIONEN)
    ok, abw = plausibel(gesamt)
    return {
        "zeilen": zeilen,
        "gesamt": gesamt,
        "gesamt_gerundet": runde_werte(gesamt),
        "portion": portion,
        "portion_gerundet": runde_werte(portion),
        "gargewicht_gesamt": runden(gargewicht, 0),
        "gargewicht_portion": runden(gargewicht / C.PORTIONEN, 0),
        "gargewicht_gemessen": bool(rezept.get("gargewicht_g")),
        "plausibel": ok,
        "plausi_abweichung": abw,
    }


def berechne_extra(extra: dict, zutaten: dict) -> dict:
    gesamt = leer()
    for z in extra["zutaten"]:
        gesamt = addiere(gesamt, werte_menge(zutaten, z["zutat"], float(z["g"])))
    return runde_werte(gesamt)


# --- Kategorien und Zeit --------------------------------------------------------------------
def gesamtzeit(rezept: dict) -> int:
    z = rezept.get("zeit") or {}
    return int(z.get("vorbereitung", 0)) + int(z.get("kochen", 0)) + int(z.get("wartezeit", 0))


def aktive_zeit(rezept: dict) -> int:
    """Vorbereitung + Kochen (maßgeblich für „Schnelle Rezepte“, Wartezeit zählt nicht)."""
    z = rezept.get("zeit") or {}
    return int(z.get("vorbereitung", 0)) + int(z.get("kochen", 0))


def protein_pro_100kcal(portion: dict) -> float:
    return portion["protein"] / portion["kcal"] * 100 if portion["kcal"] else 0.0


def ist_high_protein(portion: dict) -> bool:
    return (portion["protein"] >= C.HIGH_PROTEIN_MIN_G
            or protein_pro_100kcal(portion) >= C.HIGH_PROTEIN_MIN_PRO_100KCAL)


def ist_schnell(rezept: dict) -> bool:
    return aktive_zeit(rezept) <= C.SCHNELL_MAX_MIN


def ist_kalorienarm(rezept: dict, portion: dict) -> bool:
    return (rezept.get("mahlzeit") == "Mittag/Abend"
            and portion["kcal"] <= C.KALORIENARM_MAX_KCAL
            and portion["protein"] >= C.KALORIENARM_MIN_PROTEIN)


def kategorien(rezept: dict, portion: dict) -> list[str]:
    """Kategorie-Schlüssel in fester Reihenfolge. `portion` = gerundete Werte pro Portion."""
    k = []
    if ist_high_protein(portion):
        k.append("high-protein")
    if ist_schnell(rezept):
        k.append("schnell")
    if "Meal Prep" in (rezept.get("kategorien_manuell") or []):
        k.append("meal-prep")
    if ist_kalorienarm(rezept, portion):
        k.append("kalorienarm")
    if rezept.get("mahlzeit") in ("Frühstück", "Snack"):
        k.append("fruehstueck-snacks")
    return k


def zielkorridor(rezept: dict, portion: dict) -> tuple[str, dict]:
    """Welcher Korridor aus SPEC 3 gilt? Hauptgerichte: normal oder kalorienarm."""
    m = rezept.get("mahlzeit")
    if m == "Frühstück":
        return "fruehstueck", C.ZIELWERTE["fruehstueck"]
    if m == "Snack":
        return "snack", C.ZIELWERTE["snack"]
    if rezept.get("hauptkategorie") == "kalorienarm" or portion["kcal"] <= C.KALORIENARM_MAX_KCAL:
        return "kalorienarm", C.ZIELWERTE["kalorienarm"]
    return "hauptgericht", C.ZIELWERTE["hauptgericht"]


# --- Zahlen auf Deutsch ------------------------------------------------------------------------
def zahl(wert: float, stellen: int = 0) -> str:
    """1150 → „1.150“, 48.6 → „48,6“."""
    r = runden(wert, stellen)
    s = f"{r:,.{stellen}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def gramm(g: float) -> str:
    """Grammangabe: ab 10 g ganzzahlig, darunter mit max. 1 Nachkommastelle."""
    if g >= 10 or float(g).is_integer():
        return zahl(g, 0)
    return zahl(g, 1).rstrip("0").rstrip(",")


def main(argv: list[str]) -> int:
    zutaten = lade_zutaten()
    for r in lade_rezepte():
        if argv and r.get("id") not in argv:
            continue
        b = berechne_rezept(r, zutaten)
        p = b["portion_gerundet"]
        kat = ", ".join(C.KATEGORIEN[k] for k in kategorien(r, p))
        print(f"{r['id']:<32} {p['kcal']:>4} kcal  P {p['protein']:>5}  F {p['fett']:>5}  "
              f"KH {p['kh']:>5}  Zucker {p['zucker']:>4}  Salz {p['salz']:>4}  "
              f"Plausi {b['plausi_abweichung']:+.1f} %  [{kat}]")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
