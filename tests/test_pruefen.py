"""Prüfungen aus SPEC 12.1 – echte Daten bestehen, manipulierte Rezepte fallen durch."""
import pytest

import pruefen as P


def _pruefe(r, zutaten, packungen):
    erg = P.Ergebnis()
    P.pruefe_rezept(r, zutaten, packungen, erg)
    return erg


def test_echte_daten_bestehen_alle_pruefungen():
    erg = P.pruefe_alles()
    assert erg.fehler == []


def test_basisrezept_ist_gueltig(basis_rezept, zutaten, packungen):
    erg = _pruefe(basis_rezept, zutaten, packungen)
    assert erg.fehler == []


def test_unbekannte_zutat(basis_rezept, zutaten, packungen):
    basis_rezept["zutaten"][0]["zutat"] = "Hackfleisch"
    assert any("nicht in zutaten.csv" in f for f in _pruefe(basis_rezept, zutaten, packungen).fehler)


def test_unbenutzte_zutat(basis_rezept, zutaten, packungen):
    basis_rezept["mise_en_place"] = ["Alles abwiegen."]
    assert any("reis kommt" in f for f in _pruefe(basis_rezept, zutaten, packungen).fehler)


def test_falscher_platzhalter(basis_rezept, zutaten, packungen):
    basis_rezept["anrichten"] = "Mit {petersilie} bestreuen."
    assert any("{petersilie}" in f for f in _pruefe(basis_rezept, zutaten, packungen).fehler)


def test_fehlende_kerntemperatur(basis_rezept, zutaten, packungen):
    basis_rezept["schritte"][0]["text"] = "{oel} auf Stufe 7 von 9 erhitzen, {huhn} 6 Minuten braten."
    assert any("Kerntemperatur" in f for f in _pruefe(basis_rezept, zutaten, packungen).fehler)


def test_ofen_ohne_modus(basis_rezept, zutaten, packungen):
    basis_rezept["schritte"].append({"titel": "Backen", "text": "Im Ofen bei 200 °C 10 Minuten backen."})
    assert any("ohne Modus" in f for f in _pruefe(basis_rezept, zutaten, packungen).fehler)


def test_herd_ohne_stufe_ist_warnung(basis_rezept, zutaten, packungen):
    basis_rezept["schritte"].append({"titel": "Sauce", "text": "In der Pfanne köcheln lassen."})
    erg = _pruefe(basis_rezept, zutaten, packungen)
    assert erg.fehler == [] and any("Herdstufe" in w for w in erg.warnungen)


def test_zielwerte_verfehlt(basis_rezept, zutaten, packungen):
    basis_rezept["zutaten"][0]["g"] = 150          # zu wenig Protein, zu wenig kcal
    fehler = _pruefe(basis_rezept, zutaten, packungen).fehler
    assert any("Korridors" in f or "Protein unter" in f for f in fehler)


def test_hauptkategorie_nicht_erfuellt(basis_rezept, zutaten, packungen):
    basis_rezept["hauptkategorie"] = "schnell"
    basis_rezept["zeit"]["kochen"] = 40
    assert any("Hauptkategorie schnell" in f for f in _pruefe(basis_rezept, zutaten, packungen).fehler)


def test_meal_prep_und_fisch_haltbarkeit(basis_rezept, zutaten, packungen):
    basis_rezept["kategorien_manuell"] = ["Meal Prep"]
    basis_rezept["aufbewahrung"]["kuehlschrank_tage"] = 2
    assert any("Meal Prep braucht" in f for f in _pruefe(basis_rezept, zutaten, packungen).fehler)
    basis_rezept["kategorien_manuell"] = []
    basis_rezept["zutaten"][0]["zutat"] = "Lachsfilet ohne Haut roh"
    basis_rezept["aufbewahrung"]["kuehlschrank_tage"] = 3
    assert any("Fisch/Garnelen" in f for f in _pruefe(basis_rezept, zutaten, packungen).fehler)


def test_fruehstueck_herzhaft_und_zucker_nur_warnung(zutaten, packungen, rezepte):
    r = dict(next(x for x in rezepte if x["mahlzeit"] == "Frühstück"))
    r["geschmack"] = "herzhaft"
    erg = _pruefe(r, zutaten, packungen)
    assert erg.fehler == [] and any("herzhaft" in w for w in erg.warnungen)


@pytest.mark.parametrize("feld", ["hauptprotein", "restetauglich", "aufbewahrung", "schritte"])
def test_pflichtfelder(basis_rezept, zutaten, packungen, feld):
    del basis_rezept[feld]
    assert any(f"Pflichtfeld fehlt: {feld}" in f for f in _pruefe(basis_rezept, zutaten, packungen).fehler)


def test_dateiname_muss_id_sein(basis_rezept, zutaten, packungen, tmp_path):
    basis_rezept["_datei"] = tmp_path / "anders.yaml"
    assert any("Dateiname" in f for f in _pruefe(basis_rezept, zutaten, packungen).fehler)


def test_doppelte_id(basis_rezept, zutaten, packungen):
    erg = P.pruefe_alles(rezepte=[basis_rezept, dict(basis_rezept)])
    assert any("id doppelt" in f for f in erg.fehler)


def test_manipulierte_zutat_in_datenbank(zutaten, packungen):
    db = dict(zutaten)
    db["Magerquark"] = dict(db["Magerquark"], kcal=120)
    erg = P.Ergebnis()
    P.pruefe_zutaten_db(db, packungen, erg)
    assert any("Magerquark: Plausibilität" in f for f in erg.fehler)


def test_jede_zutat_hat_packung(zutaten, packungen):
    assert set(zutaten) == set(packungen)


def test_verbotene_begriffe(basis_rezept, zutaten, packungen):
    basis_rezept["varianten"] = ["**Vegetarisch:** mit Tofu statt Hähnchen", "b"]
    assert any("Tofu" in f for f in _pruefe(basis_rezept, zutaten, packungen).fehler)
