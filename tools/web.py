"""Erzeugt die Web-App in web/ (SPEC 10): App-Quellen aus app/ kopieren, Daten-JSON, statische
Rezeptseiten mit schema.org/Recipe (JSON-LD für MacroFactor), Icons und Service Worker.

Wird von tools/generieren.py aufgerufen – web/ nie von Hand bearbeiten.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
from pathlib import Path

import config as C
import naehrwerte as N
import texte as T
from naehrwerte import gramm, zahl

APP_DIR = C.ROOT / "app"


# ---------- Daten ----------------------------------------------------------------------------
def rezept_daten(r: dict, b: dict) -> dict:
    """Alles, was die App für ein Rezept braucht (Texte mit Platzhaltern, damit die App live skalieren kann)."""
    p = b["portion_gerundet"]
    zeilen = {z["id"]: z for z in b["zeilen"]}
    zutaten = []
    for e in N.zutat_eintraege(r):
        w = zeilen[e["id"]]["werte"]
        zutaten.append({
            "id": e["id"], "zutat": e["zutat"], "mf": mf_name(e["zutat"]), "g": float(e["g"]), "anzeige": e.get("anzeige"),
            "name": e.get("name"), "hinweis": e.get("hinweis") or "", "gruppe": e["_gruppe"],
            "mitrechnen": e.get("mitrechnen", True),
            "werte": {k: N.runden(w[k], N.STELLEN[k]) for k in ("kcal", "protein", "fett", "kh")},
        })
    z = r["zeit"]
    return {
        "id": r["id"], "name": r["name"], "url": f"rezepte/{r['id']}.html",
        "hauptkategorie": r["hauptkategorie"], "kategorien": N.kategorien(r, p),
        "mahlzeit": r["mahlzeit"], "geschmack": r["geschmack"], "kueche": r["kueche"],
        "hauptprotein": r["hauptprotein"], "inspiration": r.get("inspiration"),
        "schwierigkeit": r["schwierigkeit"],
        "zeit": {**z, "gesamt": N.gesamtzeit(r), "aktiv": N.aktive_zeit(r)},
        "ausstattung": r["ausstattung"], "restetauglich": r["restetauglich"],
        "ohne_kochen": bool(r.get("ohne_kochen")), "vortag": r.get("vortag") or [],
        "zutaten": zutaten, "mise_en_place": r["mise_en_place"],
        "schritte": [{"titel": s["titel"], "text": s["text"], "timer_min": s.get("timer_min")} for s in r["schritte"]],
        "zeitablauf": r.get("zeitablauf") or [], "fehler": r["fehler"], "anrichten": r["anrichten"],
        "aufbewahrung": r["aufbewahrung"], "varianten": r["varianten"], "tipps": r["tipps"],
        "naehrwerte": p, "gesamt": b["gesamt_gerundet"],
        "gargewicht_gesamt": b["gargewicht_gesamt"], "gargewicht_portion": b["gargewicht_portion"],
        "gargewicht_gemessen": b["gargewicht_gemessen"],
        "plausi": {"ok": b["plausibel"], "abweichung": N.runden(b["plausi_abweichung"], 1)},
        "bewertung": r.get("bewertung") or {"sterne": None, "kommentar": None, "datum": None},
    }


def extras_daten(extras: list[dict], zutaten: dict) -> list[dict]:
    return [{"id": x["id"], "name": x["name"], "fuellt": x.get("fuellt", []), "zutaten": x["zutaten"],
             "naehrwerte": N.berechne_extra(x, zutaten)} for x in extras]


def json_default(o):
    if hasattr(o, "isoformat"):
        return o.isoformat()
    raise TypeError(type(o))


def dump(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), default=json_default)


# ---------- JSON-LD (schema.org/Recipe) ---------------------------------------------------------
def iso_dauer(minuten: int) -> str:
    return f"PT{int(minuten)}M"


def text_ohne_md(t: str) -> str:
    return re.sub(r"\*\*(.+?)\*\*", r"\1", t)


def mf_name(zutat: str) -> str:
    """Zutatenname für MacroFactor (eindeutiger als der Einkaufsname, siehe config.MACROFACTOR_NAMEN)."""
    n = C.MACROFACTOR_NAMEN.get(zutat, zutat)
    for alt, neu in C.MACROFACTOR_ERSETZEN:
        n = n.replace(alt, neu)
    return n


def json_ld(r: dict, b: dict) -> dict:
    p = b["portion_gerundet"]
    eintraege = {e["id"]: e for e in N.zutat_eintraege(r)}
    extra = {"portion_g": zahl(b["gargewicht_portion"]), "gesamt_g": zahl(b["gargewicht_gesamt"])}
    zutaten = [f"{gramm(float(e['g']))} g {mf_name(e['zutat'])}" for e in N.zutat_eintraege(r)
               if e.get("mitrechnen", True) and e["zutat"] != "Wasser"]
    schritte = [{"@type": "HowToStep", "name": s["titel"], "text": text_ohne_md(T.ersetze(s["text"], eintraege, extra=extra))}
                for s in r["schritte"]]
    return {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": r["name"],
        "description": f"{r['mahlzeit']} · {r['kueche']} · {p['kcal']} kcal und {zahl(p['protein'], 1)} g Protein pro Portion",
        "recipeYield": f"{C.PORTIONEN} Portionen",
        "recipeIngredient": zutaten,
        "recipeInstructions": schritte,
        "prepTime": iso_dauer(r["zeit"]["vorbereitung"]),
        "cookTime": iso_dauer(r["zeit"]["kochen"]),
        "totalTime": iso_dauer(N.gesamtzeit(r)),
        "recipeCategory": r["mahlzeit"],
        "recipeCuisine": r["kueche"],
        "keywords": ", ".join(C.KATEGORIEN[k] for k in N.kategorien(r, p)),
        "nutrition": {
            "@type": "NutritionInformation",
            "servingSize": f"1 Portion (ca. {b['gargewicht_portion']} g)",
            "calories": f"{p['kcal']} kcal",
            "proteinContent": f"{p['protein']} g",
            "fatContent": f"{p['fett']} g",
            "saturatedFatContent": f"{p['gesaettigt']} g",
            "carbohydrateContent": f"{p['kh']} g",
            "sugarContent": f"{p['zucker']} g",
            "fiberContent": f"{p['ballaststoffe']} g",
            "sodiumContent": f"{N.runden(p['salz'] * 400)} mg",
        },
    }


# ---------- Statische Rezeptseite --------------------------------------------------------------
def md_inline(t: str) -> str:
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html.escape(t, quote=False))


def html_rezept(r: dict, b: dict, profil: dict) -> str:
    p = b["portion_gerundet"]
    z = profil["tagesziele"]
    eintraege = {e["id"]: e for e in N.zutat_eintraege(r)}
    extra = {"portion_g": zahl(b["gargewicht_portion"]), "gesamt_g": zahl(b["gargewicht_gesamt"])}
    t = lambda s: md_inline(T.ersetze(s, eintraege, extra=extra))  # noqa: E731
    e = html.escape
    kat = " · ".join(C.KATEGORIEN[k] for k in N.kategorien(r, p))
    o = ["<!doctype html>", '<html lang="de"><head><meta charset="utf-8">',
         '<meta name="viewport" content="width=device-width, initial-scale=1">',
         f"<title>{e(r['name'])} – Rezeptbuch</title>",
         f'<meta name="description" content="{e(r["mahlzeit"])}, {p["kcal"]} kcal, {zahl(p["protein"], 1)} g Protein pro Portion">',
         '<link rel="stylesheet" href="../css/app.css">',
         f'<script type="application/ld+json">{json.dumps(json_ld(r, b), ensure_ascii=False)}</script>',
         "</head><body style=\"padding-bottom:16px\"><main>",
         f'<p><a href="../index.html#/rezept/{r["id"]}">‹ In der App öffnen</a></p>',
         f"<h1>{e(r['name'])}</h1>", f"<p class=\"muted\">{e(kat)}</p>",
         '<dl class="kopf-info">',
         f"<dt>Küche</dt><dd>{e(r['kueche'])}</dd>"]
    if r.get("inspiration"):
        o.append(f"<dt>Inspiration</dt><dd>{e(r['inspiration']['quelle'])} – {e(r['inspiration']['aenderungen'])}</dd>")
    zz = r["zeit"]
    o += [f"<dt>Mahlzeit</dt><dd>{e(r['mahlzeit'])} ({e(r['geschmack'])})</dd>",
          f"<dt>Portionen</dt><dd>{C.PORTIONEN}</dd>",
          f"<dt>Schwierigkeit</dt><dd>{e(r['schwierigkeit'])}</dd>",
          f"<dt>Zeit</dt><dd>Vorbereitung {zz['vorbereitung']} min · Kochen {zz['kochen']} min · Wartezeit {zz['wartezeit']} min · Gesamt {N.gesamtzeit(r)} min</dd>",
          f"<dt>Ausstattung</dt><dd>{e(', '.join(r['ausstattung']))}</dd></dl>",
          "<h2>Nährwerte pro Portion</h2><table><tbody>"]
    for k in N.NAEHRWERTE:
        einheit = " kcal" if k == "kcal" else " g"
        anteil = f"{zahl(p[k] / z[k] * 100)} %" if k in ("kcal", "protein", "fett", "kh") else ""
        o.append(f'<tr><td>{N.NAMEN[k]}</td><td class="r">{zahl(p[k], N.STELLEN[k])}{einheit}</td><td class="r muted">{anteil}</td></tr>')
    o += ["</tbody></table>",
          f"<p class=\"hinweis\">Fertiges Gericht wiegen und als Gesamtgewicht in MacroFactor eintragen, dann kannst du nach Gramm loggen. "
          f"Orientierung: gesamt ca. {zahl(b['gargewicht_gesamt'])} g, pro Portion ca. {zahl(b['gargewicht_portion'])} g.</p>",
          "<h2>Zutaten (für 2 Portionen)</h2>"]
    start = object()
    gruppe = start
    for x in N.zutat_eintraege(r):
        if x["_gruppe"] != gruppe:
            if gruppe is not start:
                o.append("</tbody></table>")
            gruppe = x["_gruppe"]
            if gruppe:
                o.append(f'<p class="gruppe">{e(gruppe)}</p>')
            o.append("<table><tbody>")
        hinweis = "; ".join(h for h in [x.get("hinweis") or "", "" if x.get("mitrechnen", True) else "nicht mitgerechnet"] if h)
        o.append(f'<tr><td>{e(x["zutat"])}{f"<br><span class=\"muted klein\">{e(hinweis)}</span>" if hinweis else ""}</td>'
                 f'<td class="r">{e(T.menge(x))}</td></tr>')
    o.append("</tbody></table>")
    o += ["<h2>Mise en place</h2><ul class=\"punkte\">"] + [f"<li>{t(s)}</li>" for s in r["mise_en_place"]] + ["</ul>"]
    o += ["<h2>Zubereitung</h2><ol class=\"schritte\">"] + [f"<li><b>{e(s['titel'])}</b><br>{t(s['text'])}</li>" for s in r["schritte"]] + ["</ol>"]
    o += ["<h2>Zeitablauf</h2><ul class=\"punkte\">"] + [f"<li>{t(s)}</li>" for s in (r.get("zeitablauf") or ["Keine parallelen Arbeitsschritte nötig."])] + ["</ul>"]
    o += ["<h2>Häufige Fehler</h2><ul class=\"punkte\">"] + [f"<li>{t(s)}</li>" for s in r["fehler"]] + ["</ul>"]
    o += [f"<h2>Anrichten</h2><p>{t(r['anrichten'])}</p>"]
    a = r["aufbewahrung"]
    o += ["<h2>Meal Prep &amp; Aufbewahrung</h2><ul class=\"punkte\">",
          f"<li><b>Kühlschrank:</b> {a['kuehlschrank_tage']} Tage</li>",
          f"<li><b>Einfrierbar:</b> {'ja' if a.get('einfrierbar') else 'nein'}</li>",
          f"<li><b>Aufwärmen:</b> {e(a['aufwaermen'])}</li>"]
    if a.get("separat"):
        o.append(f"<li><b>Separat lagern:</b> {e(a['separat'])}</li>")
    o.append("</ul>")
    o += ["<h2>Varianten &amp; Austausch</h2><ul class=\"punkte\">"] + [f"<li>{t(s)}</li>" for s in r["varianten"]] + ["</ul>"]
    o += ["<h2>Tipps</h2><ul class=\"punkte\">"] + [f"<li>{t(s)}</li>" for s in r["tipps"]] + ["</ul>"]
    g = b["gesamt_gerundet"]
    o += ["<h2>Nährwert-Berechnung</h2><div class=\"tabelle-scroll\"><table><thead><tr><th>Zutat</th><th class=\"r\">Menge</th>"
          "<th class=\"r\">kcal</th><th class=\"r\">P</th><th class=\"r\">F</th><th class=\"r\">KH</th></tr></thead><tbody>"]
    for zl in b["zeilen"]:
        w = zl["werte"]
        if zl["mitrechnen"]:
            o.append(f"<tr><td>{e(zl['zutat'])}</td><td class=\"r\">{gramm(zl['g'])} g</td><td class=\"r\">{zahl(w['kcal'])}</td>"
                     f"<td class=\"r\">{zahl(w['protein'], 1)}</td><td class=\"r\">{zahl(w['fett'], 1)}</td><td class=\"r\">{zahl(w['kh'], 1)}</td></tr>")
        else:
            o.append(f"<tr><td>{e(zl['zutat'])}</td><td class=\"r\">{gramm(zl['g'])} g</td><td class=\"r muted\" colspan=\"4\">nicht mitgerechnet</td></tr>")
    o += [f"<tr><td><b>Summe</b></td><td></td><td class=\"r\"><b>{zahl(g['kcal'])}</b></td><td class=\"r\"><b>{zahl(g['protein'], 1)}</b></td>"
          f"<td class=\"r\"><b>{zahl(g['fett'], 1)}</b></td><td class=\"r\"><b>{zahl(g['kh'], 1)}</b></td></tr>",
          f"<tr><td><b>pro Portion</b></td><td></td><td class=\"r\"><b>{zahl(p['kcal'])}</b></td><td class=\"r\"><b>{zahl(p['protein'], 1)}</b></td>"
          f"<td class=\"r\"><b>{zahl(p['fett'], 1)}</b></td><td class=\"r\"><b>{zahl(p['kh'], 1)}</b></td></tr></tbody></table></div>",
          f"<p class=\"fuss\">{e(C.HINWEIS_SCHAETZWERTE)}</p>", "</main></body></html>"]
    return "\n".join(o)


# ---------- Icons ----------------------------------------------------------------------------------
def icons(ziel: Path):
    from PIL import Image, ImageDraw
    ziel.mkdir(parents=True, exist_ok=True)

    def zeichne(groesse: int, rand: float) -> Image.Image:
        s = 1024
        img = Image.new("RGBA", (s, s), (194, 65, 12, 255))
        d = ImageDraw.Draw(img)
        m = int(s * rand)
        # Schüssel
        d.chord([m + 120, m + 250, s - m - 120, s - m - 40], 0, 180, fill=(255, 255, 255, 255))
        d.rectangle([m + 100, m + 590, s - m - 100, m + 640], fill=(255, 255, 255, 255))
        # Dampf
        for i, x in enumerate((s // 2 - 150, s // 2, s // 2 + 150)):
            y0 = m + 180 + (40 if i == 1 else 80)
            d.arc([x - 50, y0, x + 50, y0 + 160], 270, 90, fill=(255, 236, 222, 255), width=34)
            d.arc([x - 50, y0 + 150, x + 50, y0 + 310], 90, 270, fill=(255, 236, 222, 255), width=34)
        return img.resize((groesse, groesse), Image.LANCZOS)

    zeichne(180, 0.0).convert("RGB").save(ziel / "apple-touch-icon.png")
    zeichne(192, 0.0).save(ziel / "icon-192.png")
    zeichne(512, 0.0).save(ziel / "icon-512.png")
    zeichne(512, 0.1).save(ziel / "icon-512-maskable.png")


# ---------- Gesamtablauf -----------------------------------------------------------------------------
def generiere_web(web_dir: Path, rezepte: list[dict], berechnet: dict[str, dict], zutaten: dict,
                  packungen: dict, profil: dict, extras: list[dict]) -> int:
    if web_dir.exists():
        shutil.rmtree(web_dir)
    shutil.copytree(APP_DIR, web_dir, ignore=shutil.ignore_patterns("sw.js", ".DS_Store"))
    (web_dir / "daten").mkdir(exist_ok=True)
    (web_dir / "rezepte").mkdir(exist_ok=True)

    daten = {
        "rezepte": [rezept_daten(r, berechnet[r["id"]]) for r in sorted(rezepte, key=lambda x: x["name"])],
        "zutaten": zutaten,
        "packungen": packungen,
        "profil": profil,
        "extras": extras_daten(extras, zutaten),
    }
    inhalt = {k: dump(v) for k, v in daten.items()}
    for r in rezepte:
        (web_dir / "rezepte" / f"{r['id']}.html").write_text(html_rezept(r, berechnet[r["id"]], profil), encoding="utf-8")
    icons(web_dir / "icons")

    # Version = Hash über Daten und App-Dateien → neue Version nur bei echten Änderungen
    h = hashlib.sha256()
    for k in sorted(inhalt):
        h.update(inhalt[k].encode())
    for f in sorted(APP_DIR.rglob("*")):
        if f.is_file():
            h.update(f.read_bytes())
    version = h.hexdigest()[:12]
    inhalt["rezepte"] = dump({"version": version, "rezepte": daten["rezepte"]})
    for k, v in inhalt.items():
        (web_dir / "daten" / f"{k}.json").write_text(v, encoding="utf-8")

    dateien = sorted(str(f.relative_to(web_dir)).replace("\\", "/") for f in web_dir.rglob("*") if f.is_file())
    sw = (APP_DIR / "sw.js").read_text(encoding="utf-8")
    sw = sw.replace("__VERSION__", version).replace("__DATEIEN__", json.dumps(["./"] + dateien, ensure_ascii=False, indent=1))
    (web_dir / "sw.js").write_text(sw, encoding="utf-8")
    (web_dir / ".nojekyll").write_text("", encoding="utf-8")
    return len(rezepte)
