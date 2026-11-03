"""plan_pruefen.py (SPEC 8.7): nutzt dieselbe Logik wie die App, ändert den Plan nie."""
import json
import shutil
from datetime import date, timedelta

import pytest

import generieren as G
import plan_pruefen as PP

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node nicht installiert")


@pytest.fixture(scope="module")
def web(tmp_path_factory):
    d = tmp_path_factory.mktemp("pp")
    assert G.generiere(md_dir=d / "md", rezeptbuch=d / "rb.md", web_dir=d / "web") == 0
    return d / "web"


def _plan(slots_pro_tag, kw=47, jahr=2026):
    montag = date.fromisocalendar(jahr, kw, 1)
    tage = []
    for i in range(7):
        d = (montag + timedelta(days=i)).isoformat()
        slots = {"fruehstueck": None, "mittag": None, "abend": None, "snack": None}
        slots.update(slots_pro_tag.get(i, {}))
        tage.append({"datum": d, "slots": slots, "extras": [], "notiz": ""})
    return {"version": 1, "jahr": jahr, "kw": kw, "tage": tage,
            "einkauf": [{"datum": (montag - timedelta(days=2)).isoformat(), "art": "gross"}], "vorrat": []}


def R(rid, **kw):
    return {"typ": "rezept", "rezept": rid, **kw}


def test_erkennt_wenig_protein_und_unbekanntes_rezept(web, tmp_path):
    plan = _plan({0: {"abend": R("marry-me-chicken"), "mittag": R("gibt-es-nicht")}})
    datei = tmp_path / "plan.json"
    datei.write_text(json.dumps(plan))
    vorher = datei.read_text()
    [w] = PP.pruefen(PP.einlesen(datei), web_dir=web)
    mo = w["tage"][0]
    texte = [h["text"] for h in mo["hinweise"]["liste"]]
    assert mo["hinweise"]["stufe"] == "rot"
    assert any("nicht mehr vorhanden" in t for t in texte)
    assert any(t.startswith("Protein") for t in texte)
    assert "unbekannt: gibt-es-nicht" in mo["slots"]["mittag"]
    assert w["kontrolle"]["ok"]
    b = PP.bericht(w)
    assert "KW 47/2026" in b and "nicht verändert" in b
    assert datei.read_text() == vorher            # Plan bleibt unangetastet


def test_rest_ohne_kochen_und_wiederholung(web, tmp_path):
    plan = _plan({1: {"abend": R("marry-me-chicken")}, 2: {"abend": R("marry-me-chicken"),
                  "mittag": R("marry-me-chicken", art="rest", von="2026-11-16/abend")}})
    datei = tmp_path / "p.json"
    datei.write_text(json.dumps(plan))
    [w] = PP.pruefen(PP.einlesen(datei), web_dir=web)
    mi = [h["text"] for h in w["tage"][2]["hinweise"]["liste"]]
    assert any("kein Kochen eingeplant" in t for t in mi)
    assert any("wie gestern" in t for t in mi)


def test_sicherung_mit_vorwoche_und_bewertungen(web, tmp_path):
    vorwoche = _plan({6: {"abend": R("marry-me-chicken")}}, kw=46)
    woche = _plan({0: {"abend": R("marry-me-chicken")}})
    sich = {"format": "rezeptbuch-sicherung", "version": 1,
            "daten": {"plaene": {"2026-W46": vorwoche, "2026-W47": woche},
                      "bewertungen": {"marry-me-chicken": {"sterne": 2}}}}
    datei = tmp_path / "s.json"
    datei.write_text(json.dumps(sich))
    erg = PP.pruefen(PP.einlesen(datei), nur=["2026-W47"], web_dir=web)
    assert [w["kw"] for w in erg] == [47]
    mo = [h["text"] for h in erg[0]["tage"][0]["hinweise"]["liste"]]
    assert any("wie gestern" in t for t in mo)      # Sonntag der Vorwoche zählt mit
    assert any("2 ★" in t for t in mo)


def test_ablegen(tmp_path):
    datei = tmp_path / "x.json"
    plan = _plan({0: {"abend": R("marry-me-chicken")}})
    datei.write_text(json.dumps(plan))
    [z] = PP.ablegen(datei, PP.einlesen(datei), ziel_dir=tmp_path / "ab")
    assert z.name == "KW-47-2026.json" and json.loads(z.read_text())["tage"] == plan["tage"]


def test_falsches_format(tmp_path):
    datei = tmp_path / "f.json"
    datei.write_text('{"foo": 1}')
    with pytest.raises(SystemExit):
        PP.einlesen(datei)
