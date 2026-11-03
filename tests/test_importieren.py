"""importieren.py (SPEC 9): Mengen umrechnen, Ähnlichkeit, Dateien/Links als erledigt markieren."""
import pytest

import importieren as I


@pytest.mark.parametrize("angabe,g", [
    ("1 scoop vanilla protein powder", 30), ("1/4 cup oat flour", 22.5), ("1 egg", 60), ("2 eggs", 120),
    ("1/2 tsp baking powder", 2), ("3 tbsp greek yogurt", 45), ("2 EL Honig", 42), ("1 Dose Kichererbsen", 240),
    ("½ cup blueberries", 70), ("1 1/2 cups milk", 367.5), ("1 Prise Salz", 0.5), ("2 Zehen Knoblauch", 8),
    ("100 g Skyr", 100), ("8 oz chicken", 226.8),
])
def test_umrechnen(angabe, g):
    assert I.umrechnen(angabe)["g"] == pytest.approx(g)


@pytest.mark.parametrize("angabe", ["1 cup Spinat", "1 Dose Suppe", "etwas Zimt"])
def test_umrechnen_unklar_wird_nachgefragt(angabe):
    r = I.umrechnen(angabe)
    assert r["g"] is None and "nachfragen" in r["regel"]


def test_gruppe_und_neue_dateien(tmp_path):
    for n in ("brownie-1.png", "brownie-2.png", "shake.txt", "links.txt", "notiz.pdf"):
        (tmp_path / n).write_text("x")
    d = I.neue_dateien(tmp_path)
    assert sorted(d) == ["brownie", "shake"] and len(d["brownie"]) == 2


def test_erledigt_verschiebt_und_markiert_links(tmp_path):
    (tmp_path / "brownie-1.png").write_text("x")
    (tmp_path / "links.txt").write_text("# Kommentar\nhttps://example.org/a\nhttps://example.org/b\n")
    I.erledigt("brownie", "fruehstuecks-brownie", tmp_path, heute="2026-11-03")
    assert (tmp_path / "erledigt" / "brownie-1.png").exists() and not (tmp_path / "brownie-1.png").exists()
    I.erledigt("https://example.org/b", "x-rezept", tmp_path, heute="2026-11-03")
    assert I.offene_links(tmp_path) == ["https://example.org/a"]
    assert "✓ https://example.org/b  → x-rezept (2026-11-03)" in (tmp_path / "links.txt").read_text()


def test_aehnliche_findet_bestehendes_rezept():
    top = I.aehnliche("Blueberry Protein Muffins", ["Whey Protein Vanille", "Heidelbeeren TK"], "Frühstück")
    assert top[0]["id"] == "blaubeer-protein-muffins" and top[0]["score"] >= 0.45
