"""Rezeptplan (Phase 3) erfüllt SPEC 5.1–5.3; geschriebene Rezepte passen zum Plan."""
import rezeptplan as RP


def test_plan_erfuellt_alle_vorgaben():
    fehler = [z for z in RP.abgleich(RP.lade_plan()) if not z[3]]
    assert fehler == []


def test_geschriebene_rezepte_stehen_im_plan(rezepte):
    plan = {e["id"]: e for e in RP.eintraege(RP.lade_plan())}
    bereich = {"Frühstück": "fruehstueck", "Snack": "snack", "Mittag/Abend": "hauptgericht"}
    for r in rezepte:
        assert r["id"] in plan, f"{r['id']} fehlt im Rezeptplan"
        e = plan[r["id"]]
        assert bereich[r["mahlzeit"]] == e["bereich"]
        assert r["kueche"] == e["kueche"]
