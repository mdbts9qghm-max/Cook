"""Platzhalter in Rezepttexten ersetzen (SPEC 6.4).

{id}    → Menge + Name, z. B. „120 g Haferflocken“ oder „2 Eier Gr. M (120 g)“
{id:n}  → nur der Name, z. B. „Haferflocken“

Feldbedeutung je Zutat:
  zutat   – exakter Name aus zutaten.csv (erscheint in Zutatentabelle und Einkaufsliste)
  name    – optional, Name im Fließtext (Standard: zutat)
  anzeige – optional, vollständige Stück-/Löffelangabe inkl. Name, z. B. „2 Eier Gr. M“, „1 Prise Salz“;
            im Text wird dann „<anzeige> (<g> g)“ geschrieben
"""
from __future__ import annotations

import re

from naehrwerte import gramm, zahl

# Reservierte Platzhalter (keine Zutaten): Fertiggewicht pro Portion bzw. gesamt
RESERVIERT = {"portion_g", "gesamt_g"}

PLATZHALTER = re.compile(r"\{([a-z0-9][a-z0-9_-]*)(:n)?\}")
_ZAHL_AM_ANFANG = re.compile(r"^(\d+(?:[.,]\d+)?)(\s*)")


def text_name(e: dict) -> str:
    return e.get("name") or e["zutat"]


def skaliere_anzeige(anzeige: str, faktor: float) -> str:
    """„2 Eier“ × 1,5 → „3 Eier“; ohne führende Zahl bleibt der Text unverändert."""
    if faktor == 1:
        return anzeige
    m = _ZAHL_AM_ANFANG.match(anzeige)
    if not m:
        return anzeige
    n = float(m.group(1).replace(",", ".")) * faktor
    n_txt = zahl(n, 0) if abs(n - round(n)) < 1e-9 else zahl(n, 1)
    return n_txt + m.group(2) + anzeige[m.end():]


def menge(e: dict, faktor: float = 1.0) -> str:
    """Spalte „Menge“ der Zutatentabelle."""
    g = float(e["g"]) * faktor
    if e.get("anzeige"):
        return f"{skaliere_anzeige(e['anzeige'], faktor)} ({gramm(g)} g)"
    return f"{gramm(g)} g"


def menge_mit_name(e: dict, faktor: float = 1.0) -> str:
    g = float(e["g"]) * faktor
    if e.get("anzeige"):
        return f"{skaliere_anzeige(e['anzeige'], faktor)} ({gramm(g)} g)"
    return f"{gramm(g)} g {text_name(e)}"


def ersetze(text: str, eintraege: dict[str, dict], faktor: float = 1.0,
            extra: dict[str, str] | None = None) -> str:
    """Ersetzt alle Platzhalter. Unbekannte IDs lösen KeyError aus (pruefen.py fängt das ab).
    `extra` liefert die Werte der reservierten Platzhalter (z. B. portion_g)."""
    def ersatz(m: re.Match) -> str:
        if extra and m.group(1) in extra:
            return extra[m.group(1)]
        e = eintraege[m.group(1)]
        return text_name(e) if m.group(2) else menge_mit_name(e, faktor)
    return PLATZHALTER.sub(ersatz, text)


def platzhalter_ids(text: str) -> list[str]:
    return [m.group(1) for m in PLATZHALTER.finditer(text or "")]


def alle_texte(rezept: dict) -> list[str]:
    """Texte, in denen Zutaten vorkommen dürfen bzw. müssen (Mise en place, Schritte, Anrichten)."""
    t = list(rezept.get("mise_en_place") or [])
    t += [s.get("text", "") for s in rezept.get("schritte") or []]
    t.append(rezept.get("anrichten") or "")
    return t
