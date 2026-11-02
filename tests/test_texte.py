"""Platzhalter-Ersetzung (SPEC 6.4, 12.2)."""
import pytest

import texte as T

E = {
    "hafer": {"id": "hafer", "zutat": "Haferflocken zart", "g": 120, "name": "zarte Haferflocken"},
    "eier": {"id": "eier", "zutat": "Ei Gr. M ohne Schale", "g": 120, "anzeige": "2 Eier Gr. M", "name": "Eier"},
    "salz": {"id": "salz", "zutat": "Salz", "g": 0.5, "anzeige": "1 Prise Salz"},
    "milch": {"id": "milch", "zutat": "Milch 1,5 % Fett", "g": 1150},
}


def test_menge_und_name():
    assert T.ersetze("{hafer} mit {eier} mixen.", E) == "120 g zarte Haferflocken mit 2 Eier Gr. M (120 g) mixen."
    assert T.ersetze("Die {hafer:n} quellen lassen.", E) == "Die zarte Haferflocken quellen lassen."
    assert T.ersetze("{eier:n}", E) == "Eier"


def test_ohne_name_wird_zutat_verwendet():
    assert T.ersetze("{milch}", E) == "1.150 g Milch 1,5 % Fett"


def test_prise():
    assert T.ersetze("{salz} dazu.", E) == "1 Prise Salz (0,5 g) dazu."
    assert T.menge(E["salz"]) == "1 Prise Salz (0,5 g)"


def test_stueckangaben_in_tabelle():
    assert T.menge(E["eier"]) == "2 Eier Gr. M (120 g)"
    assert T.menge(E["hafer"]) == "120 g"


def test_skalieren():
    assert T.ersetze("{eier}", E, faktor=1.5) == "3 Eier Gr. M (180 g)"
    assert T.ersetze("{hafer}", E, faktor=1.25) == "150 g zarte Haferflocken"
    assert T.skaliere_anzeige("1 Prise Salz", 2) == "2 Prise Salz"
    assert T.skaliere_anzeige("2 Eier", 0.75) == "1,5 Eier"
    assert T.skaliere_anzeige("¼ TL Salz", 2) == "¼ TL Salz"   # ohne Ziffer: unverändert


def test_reservierte_platzhalter():
    assert T.ersetze("ca. {portion_g} g", E, extra={"portion_g": "357"}) == "ca. 357 g"


def test_unbekannter_platzhalter():
    with pytest.raises(KeyError):
        T.ersetze("{gibtsnicht}", E)
    assert T.platzhalter_ids("{a} und {b:n} und {c-d}") == ["a", "b", "c-d"]
