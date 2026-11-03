"""Rezeptplan (Phase 3) erfüllt SPEC 5.1–5.3; geschriebene Rezepte passen zum Plan."""
import rezeptplan as RP


def test_plan_erfuellt_alle_vorgaben():
    fehler = [z for z in RP.abgleich(RP.lade_plan()) if not z[3]]
    assert fehler == []


def test_geschriebene_rezepte_stehen_im_plan(rezepte):
    """Alle 100 geplanten Rezepte existieren und passen zum Plan; spätere Rezepte (Import, 11.3) stehen nicht im Plan."""
    plan = {e["id"]: e for e in RP.eintraege(RP.lade_plan())}
    ids = {r["id"] for r in rezepte}
    assert set(plan) <= ids, f"fehlen: {sorted(set(plan) - ids)}"
    bereich = {"Frühstück": "fruehstueck", "Snack": "snack", "Mittag/Abend": "hauptgericht"}
    for r in rezepte:
        if r["id"] not in plan:
            continue
        e = plan[r["id"]]
        assert bereich[r["mahlzeit"]] == e["bereich"]
        assert r["kueche"] == e["kueche"]


def test_planmarkierungen_stimmen_mit_berechnung(rezepte, zutaten):
    """Was der Plan als schnell / Meal Prep / kalorienarm / restetauglich zusagt, muss das Rezept auch erfüllen."""
    import naehrwerte as N
    plan = {e["id"]: e for e in RP.eintraege(RP.lade_plan())}
    for r in rezepte:
        if r["id"] not in plan:
            continue
        e = plan[r["id"]]
        kat = N.kategorien(r, N.berechne_rezept(r, zutaten)["portion_gerundet"])
        for flag, key in (("schnell", "schnell"), ("mp", "meal-prep"), ("ka", "kalorienarm")):
            if e.get(flag):
                assert key in kat, f"{r['id']}: laut Plan {key}, berechnet {kat}"
        if e.get("rest"):
            assert r["restetauglich"], r["id"]
        if e.get("insp"):
            assert r.get("inspiration"), r["id"]
        if e.get("ohne_kochen"):
            assert r.get("ohne_kochen"), r["id"]
