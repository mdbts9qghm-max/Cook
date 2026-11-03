"""Alle Prüfungen aus SPEC 12.1. Läuft vor jedem Generieren.

Aufruf:  python3 tools/pruefen.py          → Exit-Code 1 bei Fehlern, Warnungen nur als Hinweis
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402
import naehrwerte as N  # noqa: E402
import texte as T  # noqa: E402

KEBAB = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class Ergebnis:
    def __init__(self):
        self.fehler: list[str] = []
        self.warnungen: list[str] = []

    def f(self, wo: str, text: str):
        self.fehler.append(f"{wo}: {text}")

    def w(self, wo: str, text: str):
        self.warnungen.append(f"{wo}: {text}")

    @property
    def ok(self) -> bool:
        return not self.fehler


def pruefe_zutaten_db(zutaten: dict, packungen: dict, erg: Ergebnis):
    for name, w in zutaten.items():
        ok, abw = N.plausibel(w)
        if not ok:
            erg.f("zutaten.csv", f"{name}: Plausibilität verletzt ({abw:+.1f} %, "
                                 f"{w['kcal']:.0f} kcal angegeben, {N.atwater(w):.0f} berechnet)")
        if w["gesaettigt"] > w["fett"] + 1e-9:
            erg.f("zutaten.csv", f"{name}: gesättigte Fettsäuren > Fett")
        if w["zucker"] > w["kh"] + 1e-9:
            erg.f("zutaten.csv", f"{name}: Zucker > Kohlenhydrate")
        if name not in packungen:
            erg.f("packungen.csv", f"{name}: fehlt")
    for name, p in packungen.items():
        if name not in zutaten:
            erg.f("packungen.csv", f"{name}: nicht in zutaten.csv")
        if p["frische"] not in ("frisch", "tk", "lange_haltbar"):
            erg.f("packungen.csv", f"{name}: frische muss frisch | tk | lange_haltbar sein")


def _ist_fleisch_fisch(zutat: str) -> bool:
    return any(zutat.startswith(p) for p in C.GARPROBE_PFLICHT)


def _ist_fisch(zutat: str) -> bool:
    return any(zutat.startswith(p) for p in C.FISCH)


def pruefe_rezept(r: dict, zutaten: dict, packungen: dict, erg: Ergebnis) -> dict | None:
    wo = r.get("id") or str(r.get("_datei", "?"))

    # Pflichtfelder, id, Dateiname
    for feld in C.PFLICHTFELDER:
        if r.get(feld) is None or r.get(feld) == "":
            erg.f(wo, f"Pflichtfeld fehlt: {feld}")
    if erg.fehler and any(x.startswith(f"{wo}: Pflichtfeld") for x in erg.fehler):
        return None
    if not KEBAB.match(r["id"]):
        erg.f(wo, "id ist nicht kebab-case")
    datei = r.get("_datei")
    if datei and Path(datei).stem != r["id"]:
        erg.f(wo, f"Dateiname {Path(datei).name} ≠ id")
    if r["hauptkategorie"] not in C.KATEGORIEN:
        erg.f(wo, f"unbekannte Hauptkategorie {r['hauptkategorie']}")
    if r["mahlzeit"] not in C.MAHLZEITEN:
        erg.f(wo, f"unbekannte Mahlzeit {r['mahlzeit']}")
    if r["kueche"] not in C.KUECHEN:
        erg.f(wo, f"unbekannte Küche {r['kueche']}")
    if r["schwierigkeit"] not in C.SCHWIERIGKEITEN:
        erg.f(wo, f"unbekannte Schwierigkeit {r['schwierigkeit']}")
    if r["geschmack"] not in ("süß", "herzhaft"):
        erg.f(wo, "geschmack muss süß oder herzhaft sein")
    if not isinstance(r["restetauglich"], bool):
        erg.f(wo, "restetauglich muss true/false sein")
    manuell = r.get("kategorien_manuell") or []
    if any(k != "Meal Prep" for k in manuell):
        erg.f(wo, "kategorien_manuell darf nur „Meal Prep“ enthalten (Rest wird berechnet)")
    for k in ("vorbereitung", "kochen", "wartezeit"):
        if not isinstance((r["zeit"] or {}).get(k), int):
            erg.f(wo, f"zeit.{k} fehlt oder ist keine ganze Zahl")

    # Zutaten
    eintraege = N.zutat_eintraege(r)
    ids = {}
    for e in eintraege:
        for feld in ("id", "zutat", "g"):
            if feld not in e:
                erg.f(wo, f"Zutat ohne {feld}: {e}")
                return None
        if e["id"] in ids:
            erg.f(wo, f"Zutat-id doppelt: {e['id']}")
        ids[e["id"]] = e
        if e["zutat"] not in zutaten:
            erg.f(wo, f"Zutat nicht in zutaten.csv: {e['zutat']}")
        if e["zutat"] not in packungen:
            erg.f(wo, f"Zutat nicht in packungen.csv: {e['zutat']}")
        if not isinstance(e["g"], (int, float)) or e["g"] <= 0:
            erg.f(wo, f"{e['id']}: Menge muss > 0 g sein")
    if any(x.startswith(f"{wo}: Zutat nicht in") for x in erg.fehler):
        return None

    # Platzhalter
    texte = T.alle_texte(r)
    weitere = list(r.get("zeitablauf") or []) + list(r.get("vortag") or [])
    benutzt = set()
    for t in texte + weitere:
        for pid in T.platzhalter_ids(t):
            if pid not in ids and pid not in T.RESERVIERT:
                erg.f(wo, f"Platzhalter {{{pid}}} verweist auf keine Zutat")
            benutzt.add(pid)
    in_texten = {pid for t in texte for pid in T.platzhalter_ids(t)}
    for pid in ids:
        if pid in T.RESERVIERT:
            erg.f(wo, f"Zutat-id {pid} ist reserviert")
        if pid not in in_texten:
            erg.f(wo, f"Zutat {pid} kommt in Mise en place, Schritten und Anrichten nicht vor")

    # Nährwerte
    b = N.berechne_rezept(r, zutaten)
    p = b["portion_gerundet"]
    if not b["plausibel"]:
        erg.f(wo, f"Plausibilität des Rezepts verletzt ({b['plausi_abweichung']:+.1f} %)")
    for z in b["zeilen"]:
        ok, abw = N.plausibel(z["werte"])
        if not ok and z["werte"]["kcal"] >= 1:
            erg.f(wo, f"Plausibilität der Zutat {z['id']} verletzt ({abw:+.1f} %)")

    # Zielwerte
    name, korr = N.zielkorridor(r, p)
    if not (korr["kcal_min"] <= p["kcal"] <= korr["kcal_max"]):
        erg.f(wo, f"{p['kcal']} kcal außerhalb des Korridors {name} "
                  f"({korr['kcal_min']}–{korr['kcal_max']})")
    if p["protein"] < korr["protein_min"]:
        erg.f(wo, f"{p['protein']} g Protein unter Minimum {name} ({korr['protein_min']} g)")

    # Kategorien
    kat = N.kategorien(r, p)
    if r["hauptkategorie"] not in kat:
        erg.f(wo, f"Hauptkategorie {r['hauptkategorie']} ist nicht erfüllt (berechnet: {kat})")
    aufb = r.get("aufbewahrung") or {}
    tage = aufb.get("kuehlschrank_tage") or 0
    fisch = any(_ist_fisch(e["zutat"]) for e in eintraege)
    tiefkuehl_snack = tage == 0 and aufb.get("einfrierbar")   # wird gefroren gelagert (z. B. Frozen-Joghurt-Bark)
    if "Meal Prep" in manuell and tage < C.MEAL_PREP_MIN_TAGE and not tiefkuehl_snack:
        erg.f(wo, f"Meal Prep braucht mind. {C.MEAL_PREP_MIN_TAGE} Tage Kühlschrank (hat {tage})")
    if fisch and tage > C.FISCH_MAX_KUEHLSCHRANK_TAGE:
        erg.f(wo, f"Fisch/Garnelen: max. {C.FISCH_MAX_KUEHLSCHRANK_TAGE} Tage Kühlschrank (hat {tage})")
    if tage > C.SONST_MAX_KUEHLSCHRANK_TAGE:
        erg.f(wo, f"max. {C.SONST_MAX_KUEHLSCHRANK_TAGE} Tage Kühlschrank (hat {tage})")
    for feld in ("kuehlschrank_tage", "einfrierbar", "aufwaermen"):
        if feld not in aufb:
            erg.f(wo, f"aufbewahrung.{feld} fehlt")

    # Vorlieben
    if r["mahlzeit"] == "Frühstück":
        if r["geschmack"] != "süß":
            erg.w(wo, "Frühstück ist herzhaft (nur auf ausdrücklichen Wunsch)")
        if p["zucker"] > C.ZUCKER_MAX_FRUEHSTUECK:
            erg.w(wo, f"{p['zucker']} g Zucker pro Portion (Richtwert max. {C.ZUCKER_MAX_FRUEHSTUECK:.0f} g)")

    # Garprobe bei Fleisch/Fisch
    schritte = r.get("schritte") or []
    for e in eintraege:
        if not _ist_fleisch_fisch(e["zutat"]):
            continue
        mit = [s.get("text", "") for s in schritte if e["id"] in T.platzhalter_ids(s.get("text", ""))]
        if not any(re.search(C.MUSTER_GARPROBE, t) for t in mit):
            erg.f(wo, f"{e['id']}: kein Schritt, der {{{e['id']}}} nennt, enthält Kerntemperatur oder Garprobe")

    # Ofen- und Herdschritte
    for i, s in enumerate(schritte, 1):
        text = s.get("text", "")
        if not s.get("titel"):
            erg.f(wo, f"Schritt {i} ohne Titel")
        if re.search(C.MUSTER_TEMPERATUR, text) and re.search(C.MUSTER_OFEN, text) \
                and not re.search(C.MUSTER_OFEN_MODUS, text):
            erg.f(wo, f"Schritt {i}: Ofentemperatur ohne Modus (Ober-/Unterhitze/Umluft)")
        if re.search(C.MUSTER_HERD, text) and not re.search(C.MUSTER_HERDSTUFE, text) \
                and "Airfryer" not in text and not re.search(C.MUSTER_OFEN, text):
            erg.w(wo, f"Schritt {i}: Herd erwähnt, aber keine Herdstufe (x von 9)")
    if any("Ofen" in a for a in r["ausstattung"]):
        alle = texte + [s.get("text", "") for s in schritte]
        if not any(re.search(C.MUSTER_TEMPERATUR, t) and re.search(C.MUSTER_OFEN_MODUS, t) for t in alle):
            erg.f(wo, "Ofen in der Ausstattung, aber keine Temperatur mit Modus")

    # Ausschlüsse (z. B. kein Tofu)
    import yaml as _yaml
    volltext = _yaml.safe_dump({k: v for k, v in r.items() if k not in ("_datei", "bewertung")}, allow_unicode=True).lower()
    for begriff in C.VERBOTENE_BEGRIFFE:
        if begriff.lower() in volltext:
            erg.f(wo, f"enthält ausgeschlossenen Begriff „{begriff}“ (Vorlieben)")

    # Bewertung (SPEC 11.2): Sterne 1–5 oder leer
    bew = r.get("bewertung") or {}
    st = bew.get("sterne")
    if st is not None and not (isinstance(st, int) and 1 <= st <= 5):
        erg.f(wo, f"bewertung.sterne muss 1–5 oder null sein ({st!r})")
    if st and not bew.get("datum"):
        erg.w(wo, "Bewertung ohne Datum")

    # Umfang der Abschnitte (SPEC 7)
    if not 2 <= len(r["fehler"]) <= 4:
        erg.f(wo, f"Häufige Fehler: 2–4 erwartet ({len(r['fehler'])})")
    if not 2 <= len(r["varianten"]) <= 4:
        erg.f(wo, f"Varianten: 2–4 erwartet ({len(r['varianten'])})")
    if not 1 <= len(r["tipps"]) <= 3:
        erg.f(wo, f"Tipps: 1–3 erwartet ({len(r['tipps'])})")
    insp = r.get("inspiration")
    if insp and not (insp.get("quelle") and insp.get("aenderungen")):
        erg.f(wo, "inspiration braucht quelle und aenderungen")
    if r["zeit"].get("wartezeit", 0) >= 120 and not r.get("vortag"):
        erg.w(wo, "lange Wartezeit, aber keine Vortag-Erinnerung")
    return b


def pruefe_extras(extras: list[dict], zutaten: dict, packungen: dict, erg: Ergebnis):
    ids = set()
    for x in extras:
        wo = f"extras.yaml/{x.get('id', '?')}"
        if not x.get("id") or not x.get("name") or not x.get("zutaten"):
            erg.f(wo, "id, name und zutaten sind Pflicht")
            continue
        if x["id"] in ids:
            erg.f(wo, "id doppelt")
        ids.add(x["id"])
        for z in x["zutaten"]:
            if z["zutat"] not in zutaten or z["zutat"] not in packungen:
                erg.f(wo, f"Zutat unbekannt: {z['zutat']}")
        try:
            N.berechne_extra(x, zutaten)
        except Exception as ex:  # noqa: BLE001
            erg.f(wo, f"nicht berechenbar: {ex}")
    if len(extras) < 8:
        erg.f("extras.yaml", f"mind. 8 Extras erwartet ({len(extras)})")


def pruefe_alles(rezepte=None, zutaten=None, packungen=None, extras=None) -> Ergebnis:
    erg = Ergebnis()
    zutaten = zutaten if zutaten is not None else N.lade_zutaten()
    packungen = packungen if packungen is not None else N.lade_packungen()
    extras = extras if extras is not None else N.lade_extras()
    rezepte = rezepte if rezepte is not None else N.lade_rezepte()
    pruefe_zutaten_db(zutaten, packungen, erg)
    pruefe_extras(extras, zutaten, packungen, erg)
    gesehen = set()
    for r in rezepte:
        if r.get("id") in gesehen:
            erg.f(r["id"], "id doppelt")
        gesehen.add(r.get("id"))
        pruefe_rezept(r, zutaten, packungen, erg)
    if len(zutaten) > C.BESTAND["zutaten_max"]:
        erg.w("zutaten.csv", f"{len(zutaten)} Zutaten (Ziel max. ca. {C.BESTAND['zutaten_max']})")
    return erg


def main() -> int:
    erg = pruefe_alles()
    n = len(N.lade_rezepte())
    for w in erg.warnungen:
        print(f"⚠️  {w}")
    for f in erg.fehler:
        print(f"❌ {f}")
    if erg.ok:
        print(f"✅ Alle Prüfungen bestanden ({n} Rezepte, {len(N.lade_zutaten())} Zutaten, "
              f"{len(erg.warnungen)} Warnungen).")
        return 0
    print(f"\n{len(erg.fehler)} Fehler – bitte Rezepte anpassen (nicht die Zielwerte).")
    return 1


if __name__ == "__main__":
    sys.exit(main())
