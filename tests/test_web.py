"""Web-App (SPEC 10, 12.2): Daten-JSON, JSON-LD für MacroFactor, Service Worker und UI-Tests (Playwright)."""
import json
import re
import shutil
import subprocess

import pytest

import config as C
import generieren as G
import naehrwerte as N
import texte as T

JSONLD = re.compile(r'<script type="application/ld\+json">(.+?)</script>', re.S)


@pytest.fixture(scope="module")
def web(tmp_path_factory):
    d = tmp_path_factory.mktemp("web")
    assert G.generiere(md_dir=d / "md", rezeptbuch=d / "rezeptbuch.md", web_dir=d / "web") == 0
    return d / "web"


def test_struktur(web, rezepte):
    for f in ["index.html", "manifest.webmanifest", "sw.js", "css/app.css", "js/app.js", "js/planer.js",
              "js/rezept.js", "js/format.js", "js/kochmodus.js", "daten/rezepte.json", "daten/zutaten.json",
              "daten/packungen.json", "daten/profil.json", "daten/extras.json",
              "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png"]:
        assert (web / f).exists(), f
    assert len(list((web / "rezepte").glob("*.html"))) == len(rezepte)


def test_icons_groessen(web):
    from PIL import Image
    assert Image.open(web / "icons/apple-touch-icon.png").size == (180, 180)
    assert Image.open(web / "icons/icon-192.png").size == (192, 192)
    assert Image.open(web / "icons/icon-512.png").size == (512, 512)


def test_manifest(web):
    m = json.loads((web / "manifest.webmanifest").read_text())
    assert m["display"] == "standalone" and m["lang"] == "de"
    assert {i["sizes"] for i in m["icons"]} >= {"192x192", "512x512"}


def test_rezepte_json_gleiche_naehrwerte_wie_markdown(web, rezepte, zutaten):
    daten = json.loads((web / "daten/rezepte.json").read_text())
    assert daten["version"] and len(daten["rezepte"]) == len(rezepte)
    nach_id = {r["id"]: r for r in daten["rezepte"]}
    md_dir = web.parent / "md"
    for r in rezepte:
        b = N.berechne_rezept(r, zutaten)
        assert nach_id[r["id"]]["naehrwerte"] == b["portion_gerundet"]
        md = (md_dir / r["hauptkategorie"] / f"{r['id']}.md").read_text()
        assert f"| Kalorien | {N.zahl(nach_id[r['id']]['naehrwerte']['kcal'])} kcal |" in md


def test_json_ld_jeder_rezeptseite(web, rezepte, zutaten):
    pflicht_n = ["calories", "proteinContent", "fatContent", "saturatedFatContent", "carbohydrateContent",
                 "sugarContent", "fiberContent", "sodiumContent"]
    for r in rezepte:
        htm = (web / "rezepte" / f"{r['id']}.html").read_text()
        m = JSONLD.search(htm)
        assert m, r["id"]
        ld = json.loads(m.group(1))          # gültiges JSON
        assert ld["@type"] == "Recipe" and ld["name"] == r["name"]
        assert ld["recipeYield"] == "2 Portionen"
        assert ld["recipeIngredient"] and all(re.match(r"^\d+(,\d)? g \S", z) for z in ld["recipeIngredient"]), r["id"]
        assert all(s["@type"] == "HowToStep" and s["text"] and "{" not in s["text"] for s in ld["recipeInstructions"])
        for k in ("prepTime", "cookTime", "totalTime"):
            assert re.match(r"^PT\d+M$", ld[k])
        assert ld["recipeCategory"] and ld["recipeCuisine"]
        for k in pflicht_n:
            assert k in ld["nutrition"], (r["id"], k)
        p = N.berechne_rezept(r, zutaten)["portion_gerundet"]
        assert ld["nutrition"]["calories"] == f"{p['kcal']} kcal"
        assert ld["nutrition"]["proteinContent"] == f"{p['protein']} g"
        assert "{" not in htm.split("</script>", 1)[1], f"nicht ersetzter Platzhalter in {r['id']}.html"


def test_service_worker_cacht_alle_dateien(web):
    sw = (web / "sw.js").read_text()
    assert "__VERSION__" not in sw and "__DATEIEN__" not in sw
    liste = json.loads(re.search(r"const DATEIEN = (\[.*?\]);", sw, re.S).group(1))
    for f in web.rglob("*"):
        if f.is_file() and f.name not in ("sw.js", ".nojekyll"):
            assert str(f.relative_to(web)) in liste, f


def test_version_stabil_bei_gleichen_daten(web, tmp_path):
    G.generiere(md_dir=tmp_path / "md", rezeptbuch=tmp_path / "rb.md", web_dir=tmp_path / "web")
    v1 = json.loads((web / "daten/rezepte.json").read_text())["version"]
    v2 = json.loads((tmp_path / "web/daten/rezepte.json").read_text())["version"]
    assert v1 == v2


def _erwartete_texte(rezepte, zutaten):
    texte = {}
    for r in rezepte:
        b = N.berechne_rezept(r, zutaten)
        eintr = {e["id"]: e for e in N.zutat_eintraege(r)}
        extra = {"portion_g": N.zahl(b["gargewicht_portion"]), "gesamt_g": N.zahl(b["gargewicht_gesamt"])}
        roh = list(r["mise_en_place"]) + [s["text"] for s in r["schritte"]] + [r["anrichten"]] + \
            list(r["fehler"]) + list(r["varianten"]) + list(r["tipps"]) + list(r.get("zeitablauf") or []) + list(r.get("vortag") or [])
        texte[r["id"]] = [[t, T.ersetze(t, eintr, extra=extra)] for t in roh]
    return texte


@pytest.mark.skipif(shutil.which("node") is None, reason="node nicht installiert")
def test_ui_playwright(web, rezepte, zutaten, tmp_path):
    erw = {"texte": _erwartete_texte(rezepte, zutaten)}
    nw = {r["id"]: N.berechne_rezept(r, zutaten)["portion_gerundet"] for r in rezepte}
    erw["heute_kcal"] = N.zahl(nw["fruehstuecks-brownie"]["kcal"] * 1.25 + nw["marry-me-chicken"]["kcal"])
    pfad = tmp_path / "erwartet.json"
    pfad.write_text(json.dumps(erw, ensure_ascii=False))
    shots = C.ROOT / "tests" / "screenshots"
    p = subprocess.run(["node", str(C.ROOT / "tests/ui/ui_test.cjs"), str(web), str(pfad), str(shots)],
                       capture_output=True, text=True, timeout=240, cwd=C.ROOT)
    zeilen = [z for z in p.stdout.strip().splitlines() if z.startswith("{")]
    assert zeilen, p.stdout + p.stderr
    out = json.loads(zeilen[-1])
    if out.get("skip"):
        pytest.skip(out["skip"])
    fehler = [e for e in out.get("ergebnisse", []) if not e["ok"]]
    assert not fehler and not out.get("absturz"), json.dumps(out, ensure_ascii=False, indent=1)
    assert len(out["ergebnisse"]) >= 8
