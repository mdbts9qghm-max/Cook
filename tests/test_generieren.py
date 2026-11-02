"""Generierte Markdown-Dateien (SPEC 7) und Startbestand (SPEC 5)."""
import re
from collections import Counter

import pytest

import config as C
import generieren as G
import naehrwerte as N


@pytest.fixture(scope="module")
def ausgabe(tmp_path_factory):
    d = tmp_path_factory.mktemp("md")
    assert G.generiere(md_dir=d / "rezepte", rezeptbuch=d / "rezeptbuch.md") == 0
    return d


def test_jedes_rezept_hat_eine_md_datei(ausgabe, rezepte):
    for r in rezepte:
        assert (ausgabe / "rezepte" / r["hauptkategorie"] / f"{r['id']}.md").exists()


def test_abschnitte_vollstaendig_und_in_reihenfolge(ausgabe, rezepte):
    for r in rezepte:
        text = (ausgabe / "rezepte" / r["hauptkategorie"] / f"{r['id']}.md").read_text()
        assert text.splitlines()[2] == f"# {r['name']}"
        h2 = re.findall(r"^## (.+)$", text, flags=re.M)
        assert h2 == C.ABSCHNITTE, r["id"]
        for kopf in ("**Kategorien**", "**Küche**", "**Mahlzeit**", "**Portionen**", "**Schwierigkeit**",
                     "**Zeit**", "**Ausstattung**", "**Bewertung:**"):
            assert kopf in text
        assert "{" not in text.replace("{{", ""), "nicht ersetzter Platzhalter"


def test_naehrwerte_in_md_stimmen_mit_berechnung(ausgabe, rezepte, zutaten):
    for r in rezepte:
        text = (ausgabe / "rezepte" / r["hauptkategorie"] / f"{r['id']}.md").read_text()
        p = N.berechne_rezept(r, zutaten)["portion_gerundet"]
        assert f"| Kalorien | {N.zahl(p['kcal'])} kcal |" in text
        assert f"| Protein | {N.zahl(p['protein'], 1)} g |" in text
        assert f"| **pro Portion** | | **{N.zahl(p['kcal'])}** |" in text


def test_mengen_in_text_identisch_mit_tabelle(ausgabe, rezepte):
    import texte as T
    for r in rezepte:
        text = (ausgabe / "rezepte" / r["hauptkategorie"] / f"{r['id']}.md").read_text()
        for e in N.zutat_eintraege(r):
            assert T.menge(e) in text


def test_rezeptbuch(ausgabe, rezepte):
    text = (ausgabe / "rezeptbuch.md").read_text()
    for r in rezepte:
        assert f"rezepte/{r['hauptkategorie']}/{r['id']}.md" in text


def test_aussortiert_markierung():
    assert "aussortiert" in G.sterne_text({"sterne": 2})
    assert "aussortiert" not in G.sterne_text({"sterne": 3})
    assert G.sterne_text(None) == "noch nicht bewertet"


# --- Startbestand (greift, sobald alle 100 Rezepte geschrieben sind) ------------------------------
def test_startbestand(rezepte, zutaten):
    B = C.BESTAND
    if len(rezepte) < B["gesamt"]:
        pytest.skip(f"Startbestand noch im Aufbau ({len(rezepte)}/{B['gesamt']})")
    assert len(rezepte) == B["gesamt"]
    info = []
    for r in rezepte:
        p = N.berechne_rezept(r, zutaten)["portion_gerundet"]
        info.append((r, set(N.kategorien(r, p))))
    fr = [(r, k) for r, k in info if r["mahlzeit"] == "Frühstück"]
    sn = [(r, k) for r, k in info if r["mahlzeit"] == "Snack"]
    hg = [(r, k) for r, k in info if r["mahlzeit"] == "Mittag/Abend"]
    assert len(fr) == B["fruehstueck"] and len(sn) == B["snack"] and len(hg) == B["hauptgericht"]
    assert all(r["geschmack"] == "süß" for r, _ in fr + sn)
    assert sum("meal-prep" in k for _, k in fr) >= B["fruehstueck_meal_prep_min"]
    assert sum("schnell" in k for _, k in fr) >= B["fruehstueck_schnell_min"]
    assert sum(r.get("ohne_kochen", False) for r, _ in sn) >= B["snack_ohne_kochen_min"]
    assert Counter(r["kueche"] for r, _ in hg) == Counter(B["kuechen_hauptgerichte"])
    assert sum("meal-prep" in k for _, k in info) >= B["meal_prep_min"]
    assert sum("schnell" in k for _, k in info) >= B["schnell_min"]
    assert sum("kalorienarm" in k for _, k in hg) >= B["kalorienarm_min"]
    assert sum("high-protein" in k for _, k in info) >= B["high_protein_min"]
    assert sum(bool(r.get("inspiration")) for r, _ in info) >= B["inspiration_min"]
    assert max(Counter(r["hauptprotein"] for r, _ in hg).values()) <= B["hauptprotein_max"]
    assert sum(r["restetauglich"] for r, _ in hg) >= B["restetauglich_haupt_min"]
    assert len(zutaten) <= B["zutaten_max"]
