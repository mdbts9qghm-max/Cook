"""bewerten.py (SPEC 11.2): nur die Bewertungszeile ändert sich, Suche nach Namen, Übernahme aus App-Export."""
import json
import shutil

import pytest
import yaml

import bewerten as B
import config as C


@pytest.fixture
def rdir(tmp_path):
    d = tmp_path / "rezepte"
    d.mkdir()
    for n in ("marry-me-chicken", "protein-pancakes", "cottage-cheese-pancakes"):
        shutil.copy(C.REZEPTE_DIR / f"{n}.yaml", d)
    return d


def test_finde_rezept(rdir):
    idx = B.rezepte_index(rdir)
    assert B.finde_rezept("marry me", idx) == "marry-me-chicken"
    assert B.finde_rezept("cottage", idx) == "cottage-cheese-pancakes"
    with pytest.raises(ValueError, match="mehrdeutig"):
        B.finde_rezept("pancakes", idx)
    with pytest.raises(ValueError, match="Kein Rezept"):
        B.finde_rezept("gulasch", idx)


def test_setzen_aendert_nur_eine_zeile(rdir):
    f = rdir / "marry-me-chicken.yaml"
    vorher = f.read_text().splitlines()
    alt, neu = B.setzen("marry-me-chicken", 4, 'zu "trocken": mehr Sauce', "2026-11-03", rezepte_dir=rdir)
    nachher = f.read_text().splitlines()
    assert alt["sterne"] is None and neu["sterne"] == 4
    assert neu["kommentar"] == 'zu "trocken": mehr Sauce'
    assert str(neu["datum"]) == "2026-11-03"
    diff = [(a, b) for a, b in zip(vorher, nachher) if a != b]
    assert len(vorher) == len(nachher) and len(diff) == 1 and diff[0][1].startswith("bewertung:")
    assert yaml.safe_load(f.read_text())["name"]


def test_ungueltige_sterne(rdir):
    with pytest.raises(ValueError):
        B.setzen("marry-me-chicken", 6, rezepte_dir=rdir)


def test_aus_export(tmp_path):
    s = tmp_path / "s.json"
    s.write_text(json.dumps({"format": "rezeptbuch-sicherung", "daten": {"bewertungen": {"x": {"sterne": 2}}}}))
    assert B.aus_export(s) == {"x": {"sterne": 2}}
    p = tmp_path / "p.json"
    p.write_text(json.dumps({"jahr": 2026, "kw": 47, "tage": [], "bewertungen": {"y": {"sterne": 5}}}))
    assert B.aus_export(p) == {"y": {"sterne": 5}}
