"""Erzeugt aus den YAML-Daten die Markdown-Rezepte und rezeptbuch.md (Web-App folgt in Phase 5).

Aufruf:  python3 tools/generieren.py      → bricht ab, wenn pruefen.py Fehler meldet
Generierte Dateien nie von Hand bearbeiten – Änderungen gehören in daten/.
"""
from __future__ import annotations

import shutil
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402
import naehrwerte as N  # noqa: E402
import pruefen  # noqa: E402
import texte as T  # noqa: E402
from naehrwerte import gramm, runden, zahl  # noqa: E402

KOPF_GENERIERT = "<!-- Generiert von tools/generieren.py aus daten/rezepte/{id}.yaml – nicht von Hand bearbeiten. -->"


def datum_de(d) -> str:
    if not d:
        return ""
    if isinstance(d, str):
        d = date.fromisoformat(d)
    return d.strftime("%d.%m.%Y")


def sterne_text(bewertung: dict | None) -> str:
    b = bewertung or {}
    s = b.get("sterne")
    if not s:
        return "noch nicht bewertet"
    t = "★" * s + "☆" * (5 - s) + f" ({s}/5"
    if b.get("datum"):
        t += f", {datum_de(b['datum'])}"
    t += ")"
    if b.get("kommentar"):
        t += f" – „{b['kommentar']}“"
    if s <= 2:
        t += " · **aussortiert**"
    return t


def vorzeichen(wert: float, stellen: int = 0) -> str:
    """+1,5 / −0,3 (echtes Minuszeichen)."""
    t = zahl(abs(wert), stellen)
    return ("−" if runden(wert, stellen) < 0 else "+") + t


def zelle(t) -> str:
    return str(t).replace("|", "\\|").replace("\n", " ")


def kategorien_text(r: dict, b: dict) -> str:
    return " · ".join(C.KATEGORIEN[k] for k in N.kategorien(r, b["portion_gerundet"]))


def zeit_text(r: dict) -> str:
    z = r["zeit"]
    t = (f"Vorbereitung {z['vorbereitung']} min · Kochen {z['kochen']} min · "
         f"Wartezeit {z['wartezeit']} min · **Gesamt {N.gesamtzeit(r)} min**")
    if z["wartezeit"]:
        t += f" (aktiv {N.aktive_zeit(r)} min)"
    return t


def makroverteilung(p: dict) -> tuple[float, float, float]:
    e_p, e_f, e_k = 4 * p["protein"], 9 * p["fett"], 4 * p["kh"]
    s = e_p + e_f + e_k or 1
    return e_p / s * 100, e_f / s * 100, e_k / s * 100


def md_rezept(r: dict, b: dict, profil: dict) -> str:
    p = b["portion_gerundet"]
    ziel = profil["tagesziele"]
    eintraege = {e["id"]: e for e in N.zutat_eintraege(r)}
    extra = {"portion_g": zahl(b["gargewicht_portion"]), "gesamt_g": zahl(b["gargewicht_gesamt"])}
    ers = lambda t: T.ersetze(t, eintraege, extra=extra)  # noqa: E731
    o: list[str] = [KOPF_GENERIERT.format(id=r["id"]), "", f"# {r['name']}", ""]

    # 1. Kopf
    o += [f"**Bewertung:** {sterne_text(r.get('bewertung'))}", "", "| | |", "|---|---|",
          f"| **Kategorien** | {kategorien_text(r, b)} |",
          f"| **Küche** | {r['kueche']} |"]
    insp = r.get("inspiration")
    if insp:
        q = insp["quelle"] + (f" ([Link]({insp['link']}))" if insp.get("link") else "")
        o.append(f"| **Inspiration** | {zelle(q)} – {zelle(insp['aenderungen'])} |")
    o += [f"| **Mahlzeit** | {r['mahlzeit']} ({r['geschmack']}) |",
          f"| **Hauptprotein** | {r['hauptprotein']} |",
          f"| **Portionen** | {C.PORTIONEN} |",
          f"| **Schwierigkeit** | {r['schwierigkeit']} |",
          f"| **Zeit** | {zeit_text(r)} |",
          f"| **Ausstattung** | {zelle(', '.join(r['ausstattung']))} |",
          f"| **Restetauglich** | {'ja' if r['restetauglich'] else 'nein'} |"]
    if r.get("vortag"):
        o.append(f"| **Am Vortag** | {zelle('; '.join(ers(v) for v in r['vortag']))} |")
    o.append("")

    # 2. Nährwerte pro Portion
    o += ["## Nährwerte pro Portion", "", "| Nährwert | pro Portion | Anteil am Tagesziel |", "|---|---:|---:|"]
    zuordnung = {"kcal": "kcal", "protein": "protein", "fett": "fett", "kh": "kh"}
    for k in N.NAEHRWERTE:
        einheit = " kcal" if k == "kcal" else " g"
        wert = zahl(p[k], N.STELLEN[k]) + einheit
        anteil = f"{zahl(p[k] / ziel[zuordnung[k]] * 100, 0)} %" if k in zuordnung else "–"
        o.append(f"| {N.NAMEN[k]} | {wert} | {anteil} |")
    vp, vf, vk = makroverteilung(p)
    o += ["",
          f"- **Protein pro 100 kcal:** {zahl(N.protein_pro_100kcal(p), 1)} g",
          f"- **Makroverteilung (Energie):** Protein {zahl(vp, 0)} % · Fett {zahl(vf, 0)} % · Kohlenhydrate {zahl(vk, 0)} %",
          f"- **Gewicht fertig:** gesamt ca. {zahl(b['gargewicht_gesamt'])} g · pro Portion ca. "
          f"{zahl(b['gargewicht_portion'])} g ({'gemessen' if b['gargewicht_gemessen'] else 'geschätzt aus Garfaktoren'})",
          "- **MacroFactor:** Fertiges Gericht wiegen und als Gesamtgewicht in MacroFactor eintragen, "
          "dann kannst du nach Gramm loggen.", ""]

    # 3. Zutaten
    o += ["## Zutaten (für 2 Portionen)", ""]
    start = object()
    gruppe_alt = start
    for e in N.zutat_eintraege(r):
        if e["_gruppe"] != gruppe_alt:
            if gruppe_alt is not start and o[-1] != "":
                o.append("")
            if e["_gruppe"]:
                o += [f"**{e['_gruppe']}**", ""]
            o += ["| Zutat | Menge | Hinweis |", "|---|---:|---|"]
            gruppe_alt = e["_gruppe"]
        hinweis = e.get("hinweis") or ""
        if not e.get("mitrechnen", True):
            hinweis = (hinweis + "; " if hinweis else "") + "nicht mitgerechnet"
        o.append(f"| {zelle(e['zutat'])} | {zelle(T.menge(e))} | {zelle(hinweis)} |")
    o.append("")

    # 4. Mise en place
    o += ["## Mise en place", ""] + [f"- {ers(t)}" for t in r["mise_en_place"]] + [""]

    # 5. Zubereitung
    o += ["## Zubereitung", ""]
    for i, s in enumerate(r["schritte"], 1):
        o += [f"### {i}. {s['titel']}", "", ers(s["text"])]
        if s.get("timer_min"):
            o += ["", f"⏱️ Timer: {zahl(s['timer_min'])} min"]
        o.append("")

    # 6. Zeitablauf
    o += ["## Zeitablauf", ""]
    o += [f"- {ers(t)}" for t in r.get("zeitablauf") or []] or ["- Keine parallelen Arbeitsschritte nötig."]
    o.append("")

    # 7. Häufige Fehler
    o += ["## Häufige Fehler", ""] + [f"- {ers(t)}" for t in r["fehler"]] + [""]

    # 8. Anrichten
    o += ["## Anrichten", "", ers(r["anrichten"]), ""]

    # 9. Meal Prep & Aufbewahrung
    a = r["aufbewahrung"]
    einfr = "nein"
    if a.get("einfrierbar"):
        einfr = "ja" + (f", bis {a['einfrieren_monate']} Monat{'e' if a.get('einfrieren_monate', 1) != 1 else ''}"
                        if a.get("einfrieren_monate") else "")
    o += ["## Meal Prep & Aufbewahrung", "",
          f"- **Kühlschrank:** {a['kuehlschrank_tage']} Tag{'e' if a['kuehlschrank_tage'] != 1 else ''} "
          "(luftdicht verschlossen, bei max. 7 °C)",
          f"- **Einfrierbar:** {einfr}",
          f"- **Aufwärmen:** {a['aufwaermen']}"]
    if a.get("separat"):
        o.append(f"- **Separat lagern:** {a['separat']}")
    o.append("")

    # 10. Varianten
    o += ["## Varianten & Austausch", ""] + [f"- {ers(t)}" for t in r["varianten"]] + [""]

    # 11. Tipps
    o += ["## Tipps", ""] + [f"- {ers(t)}" for t in r["tipps"]] + [""]

    # 12. Nährwert-Berechnung
    o += ["## Nährwert-Berechnung", "", "| Zutat | Menge | kcal | Protein | Fett | KH |", "|---|---:|---:|---:|---:|---:|"]
    for z in b["zeilen"]:
        w = z["werte"]
        if z["mitrechnen"]:
            o.append(f"| {zelle(z['zutat'])} | {gramm(z['g'])} g | {zahl(w['kcal'], 0)} | {zahl(w['protein'], 1)} | "
                     f"{zahl(w['fett'], 1)} | {zahl(w['kh'], 1)} |")
        else:
            o.append(f"| {zelle(z['zutat'])} | {gramm(z['g'])} g | – | – | – | – (nicht mitgerechnet) |")
    g = b["gesamt_gerundet"]
    o += [f"| **Summe** | | **{zahl(g['kcal'])}** | **{zahl(g['protein'], 1)}** | **{zahl(g['fett'], 1)}** | **{zahl(g['kh'], 1)}** |",
          f"| **pro Portion** | | **{zahl(p['kcal'])}** | **{zahl(p['protein'], 1)}** | **{zahl(p['fett'], 1)}** | **{zahl(p['kh'], 1)}** |",
          ""]
    at = N.atwater(b["gesamt"])
    o += [f"**Plausibilitätscheck:** 4 × Protein + 4 × KH + 9 × Fett + 2 × Ballaststoffe = {zahl(at)} kcal "
          f"gegenüber {zahl(g['kcal'])} kcal laut Datenbank ({vorzeichen(b['plausi_abweichung'], 1)} %, "
          f"erlaubt ±{zahl(C.PLAUSI_TOLERANZ * 100)} %) "
          f"{'✅ bestanden' if b['plausibel'] else '❌ nicht bestanden'}.", "",
          f"*Schätzwerte: {C.HINWEIS_SCHAETZWERTE}*", ""]
    return "\n".join(o)


def md_rezeptbuch(rezepte: list[dict], berechnet: dict[str, dict]) -> str:
    o = ["<!-- Generiert von tools/generieren.py – nicht von Hand bearbeiten. -->", "",
         "# Rezeptbuch", "",
         f"{len(rezepte)} Rezepte · je 2 Portionen · Nährwerte pro Portion · Stand {date.today().strftime('%d.%m.%Y')}", ""]
    for key, titel in C.KATEGORIEN.items():
        liste = [r for r in rezepte if r["hauptkategorie"] == key]
        if not liste:
            continue
        o += [f"## {titel} ({len(liste)})", "",
              "| Rezept | Mahlzeit | Küche | kcal | Protein | Zeit | Bewertung |",
              "|---|---|---|---:|---:|---:|---|"]
        for r in sorted(liste, key=lambda x: x["name"]):
            p = berechnet[r["id"]]["portion_gerundet"]
            s = (r.get("bewertung") or {}).get("sterne")
            bew = ("★" * s + (" · aussortiert" if s <= 2 else "")) if s else "–"
            name = f"[{r['name']}](rezepte/{key}/{r['id']}.md)"
            if s and s <= 2:
                name = f"~~{name}~~"
            o.append(f"| {name} | {r['mahlzeit']} | {r['kueche']} | {p['kcal']} | {zahl(p['protein'], 1)} g | "
                     f"{N.gesamtzeit(r)} min | {bew} |")
        o.append("")
    o += [f"*{C.HINWEIS_SCHAETZWERTE}*", ""]
    return "\n".join(o)


def generiere(md_dir: Path = C.MD_DIR, rezeptbuch: Path = C.REZEPTBUCH_MD) -> int:
    erg = pruefen.pruefe_alles()
    if not erg.ok:
        for f in erg.fehler:
            print(f"❌ {f}")
        print("Abbruch: erst alle Prüfungen bestehen (python3 tools/pruefen.py).")
        return 1
    zutaten = N.lade_zutaten()
    profil = N.lade_profil()
    rezepte = N.lade_rezepte()
    berechnet = {r["id"]: N.berechne_rezept(r, zutaten) for r in rezepte}

    if md_dir.exists():
        shutil.rmtree(md_dir)
    for r in rezepte:
        ziel = md_dir / r["hauptkategorie"] / f"{r['id']}.md"
        ziel.parent.mkdir(parents=True, exist_ok=True)
        ziel.write_text(md_rezept(r, berechnet[r["id"]], profil), encoding="utf-8")
    rezeptbuch.write_text(md_rezeptbuch(rezepte, berechnet), encoding="utf-8")
    print(f"✅ {len(rezepte)} Rezepte als Markdown erzeugt, rezeptbuch.md aktualisiert.")
    return 0


if __name__ == "__main__":
    sys.exit(generiere())
