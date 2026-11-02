"""Nährwertberechnung, Rundung, Plausibilität und Kategorien (SPEC 12.2)."""
import pytest

import config as C
import naehrwerte as N


def test_runden_kaufmaennisch():
    assert N.runden(0.5) == 1
    assert N.runden(2.5) == 3          # Python round() ergäbe 2
    assert N.runden(62.5) == 63
    assert N.runden(2.45, 1) == 2.5
    assert N.runden(12.625, 1) == 12.6
    assert N.runden(1.005, 2) == 1.01


def test_rezept_mit_bekannten_werten(mini_zutaten):
    rezept = {"zutaten": [
        {"gruppe": "Teig"},
        {"id": "q", "zutat": "Testquark", "g": 250},      # 125 kcal, 25 g P, 6,25 g KH
        {"id": "h", "zutat": "Testhafer", "g": 50},       # 185 kcal, 6,5 g P, 3,5 g F, 29,5 g KH, 5 g Bst
        {"id": "s", "zutat": "Testsalz", "g": 1},
        {"id": "w", "zutat": "Wasser", "g": 500, "mitrechnen": False},
    ]}
    b = N.berechne_rezept(rezept, mini_zutaten)
    g = b["gesamt"]
    assert g["kcal"] == pytest.approx(310)
    assert g["protein"] == pytest.approx(31.5)
    assert g["fett"] == pytest.approx(3.5)
    assert g["kh"] == pytest.approx(35.75)
    assert g["salz"] == pytest.approx(1.25)
    p = b["portion_gerundet"]
    assert p == {"kcal": 155, "protein": 15.8, "fett": 1.8, "gesaettigt": 0.0, "kh": 17.9,
                 "zucker": 3.1, "ballaststoffe": 2.5, "salz": 0.63}
    # Gargewicht: Quark 250 + Hafer 50 + Salz 1 (Wasser nicht mitgerechnet)
    assert b["gargewicht_gesamt"] == 301
    assert b["gargewicht_portion"] == 151
    assert b["plausibel"]
    assert [z["mitrechnen"] for z in b["zeilen"]] == [True, True, True, False]


def test_halbe_kcal_werden_aufgerundet(mini_zutaten):
    rezept = {"zutaten": [{"id": "q", "zutat": "Testquark", "g": 250}]}   # 125 kcal → 62,5 pro Portion
    assert N.berechne_rezept(rezept, mini_zutaten)["portion_gerundet"]["kcal"] == 63


def test_gargewicht_mit_garfaktor_und_messung(mini_zutaten):
    rezept = {"zutaten": [{"id": "h", "zutat": "Testhuhn", "g": 400}]}
    assert N.berechne_rezept(rezept, mini_zutaten)["gargewicht_gesamt"] == 300
    rezept["gargewicht_g"] = 280
    b = N.berechne_rezept(rezept, mini_zutaten)
    assert b["gargewicht_gesamt"] == 280 and b["gargewicht_gemessen"]


def test_plausibilitaet_schlaegt_bei_manipulierter_zutat_an(mini_zutaten):
    ok, _ = N.plausibel(mini_zutaten["Testquark"])
    assert ok
    kaputt = dict(mini_zutaten["Testquark"], kcal=60)      # +20 % gegenüber Atwater
    ok, abw = N.plausibel(kaputt)
    assert not ok and abw == pytest.approx(-16.7, abs=0.1)
    # auch im Rezept
    db = dict(mini_zutaten, Testquark=kaputt)
    b = N.berechne_rezept({"zutaten": [{"id": "q", "zutat": "Testquark", "g": 250}]}, db)
    assert not b["plausibel"]


def test_alle_zutaten_der_datenbank_sind_plausibel(zutaten):
    unplausibel = [n for n, w in zutaten.items() if not N.plausibel(w)[0]]
    assert unplausibel == []


def test_unbekannte_zutat(mini_zutaten):
    with pytest.raises(KeyError):
        N.berechne_rezept({"zutaten": [{"id": "x", "zutat": "Gibt es nicht", "g": 10}]}, mini_zutaten)


# --- Kategorien: Grenzfälle --------------------------------------------------------------------
def _p(kcal, protein):
    return {"kcal": kcal, "protein": protein}


@pytest.mark.parametrize("portion, erwartet", [
    (_p(700, 40.0), True),     # genau 40 g
    (_p(700, 39.9), False),
    (_p(300, 30.0), True),     # genau 10 g pro 100 kcal
    (_p(300, 29.9), False),
])
def test_high_protein_grenzen(portion, erwartet):
    assert N.ist_high_protein(portion) is erwartet


@pytest.mark.parametrize("vorb, kochen, warte, erwartet", [
    (10, 15, 0, True),         # genau 25 min
    (10, 16, 0, False),
    (5, 20, 480, True),        # Wartezeit (z. B. über Nacht) zählt nicht
])
def test_schnell_grenzen(vorb, kochen, warte, erwartet):
    r = {"zeit": {"vorbereitung": vorb, "kochen": kochen, "wartezeit": warte}}
    assert N.ist_schnell(r) is erwartet


@pytest.mark.parametrize("mahlzeit, portion, erwartet", [
    ("Mittag/Abend", _p(550, 35.0), True),   # genau 550 kcal / 35 g
    ("Mittag/Abend", _p(551, 50.0), False),
    ("Mittag/Abend", _p(500, 34.9), False),
    ("Frühstück", _p(500, 40.0), False),     # nur Hauptgerichte
])
def test_kalorienarm_grenzen(mahlzeit, portion, erwartet):
    assert N.ist_kalorienarm({"mahlzeit": mahlzeit}, portion) is erwartet


def test_kategorien_reihenfolge_und_manuell():
    r = {"mahlzeit": "Frühstück", "zeit": {"vorbereitung": 5, "kochen": 0, "wartezeit": 480},
         "kategorien_manuell": ["Meal Prep"]}
    assert N.kategorien(r, _p(550, 40)) == ["high-protein", "schnell", "meal-prep", "fruehstueck-snacks"]


def test_zielkorridor():
    assert N.zielkorridor({"mahlzeit": "Frühstück"}, _p(600, 40))[0] == "fruehstueck"
    assert N.zielkorridor({"mahlzeit": "Snack"}, _p(300, 25))[0] == "snack"
    assert N.zielkorridor({"mahlzeit": "Mittag/Abend"}, _p(700, 50))[0] == "hauptgericht"
    assert N.zielkorridor({"mahlzeit": "Mittag/Abend"}, _p(540, 40))[0] == "kalorienarm"
    assert N.zielkorridor({"mahlzeit": "Mittag/Abend", "hauptkategorie": "kalorienarm"}, _p(600, 40))[0] == "kalorienarm"


def test_deutsche_zahlen():
    assert N.zahl(1150) == "1.150"
    assert N.zahl(48.55, 1) == "48,6"
    assert N.gramm(0.5) == "0,5"
    assert N.gramm(2) == "2"
    assert N.gramm(12.4) == "12"


def test_extras_berechenbar(zutaten):
    extras = N.lade_extras()
    assert len(extras) >= 8
    werte = {x["id"]: N.berechne_extra(x, zutaten) for x in extras}
    # Skyr 250 g (157,5 kcal) + Honig 15 g (45,9 kcal) = 203 kcal
    assert werte["skyr-honig"]["kcal"] == 203
    assert werte["skyr-honig"]["protein"] == pytest.approx(27.6)
    # jede Lücke (Protein, Fett, KH) ist gezielt auffüllbar
    fuellt = {f for x in extras for f in x.get("fuellt", [])}
    assert {"protein", "fett", "kh"} <= fuellt


def test_profil_und_config_stimmen_ueberein():
    profil = N.lade_profil()
    for k, v in profil["zielwerte_mahlzeit"].items():
        c = C.ZIELWERTE[k]
        assert (v["kcal_min"] or 0) == c["kcal_min"] and v["kcal_max"] == c["kcal_max"]
        assert v["protein_min"] == c["protein_min"]
