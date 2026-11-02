"""Rezeptplan (Phase 3): daten/rezeptplan.yaml → rezeptplan.md mit Abgleich gegen SPEC 5.1–5.3.

Aufruf:  python3 tools/rezeptplan.py   → Exit-Code 1, wenn eine Vorgabe verfehlt wird
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402

PLAN_YAML = C.DATEN / "rezeptplan.yaml"
PLAN_MD = C.ROOT / "rezeptplan.md"
BEREICHE = {"fruehstueck": "Frühstück (süß)", "snack": "Snacks & Desserts (süß)", "hauptgericht": "Hauptgerichte"}
# Pro Runde (SPEC 13, Phase 4): 3 Frühstücke, 1 Snack, 6 Hauptgerichte
PRO_RUNDE = {"fruehstueck": 3, "snack": 1, "hauptgericht": 6}


def lade_plan(pfad: Path = PLAN_YAML) -> dict:
    with open(pfad, encoding="utf-8") as f:
        return yaml.safe_load(f)


def eintraege(plan: dict) -> list[dict]:
    alle = []
    for bereich in BEREICHE:
        for i, e in enumerate(plan[bereich]):
            e = dict(e, bereich=bereich, runde=i // PRO_RUNDE[bereich] + 1)
            alle.append(e)
    return alle


def abgleich(plan: dict) -> list[tuple[str, str, str, bool]]:
    """(Anforderung, Soll, Ist, ok)."""
    B = C.BESTAND
    alle = eintraege(plan)
    fr, sn, hg = (plan[k] for k in BEREICHE)
    z = []

    def add(name, soll, ist, ok):
        z.append((name, soll, str(ist), ok))

    add("Gesamt", f"genau {B['gesamt']}", len(alle), len(alle) == B["gesamt"])
    add("Frühstück, süß", f"genau {B['fruehstueck']}", len(fr), len(fr) == B["fruehstueck"])
    n = sum(bool(e.get("mp")) for e in fr)
    add("… davon Meal Prep", f"mind. {B['fruehstueck_meal_prep_min']}", n, n >= B["fruehstueck_meal_prep_min"])
    n = sum(bool(e.get("schnell")) for e in fr)
    add("… davon schnell (≤ 25 min)", f"mind. {B['fruehstueck_schnell_min']}", n, n >= B["fruehstueck_schnell_min"])
    add("Snacks & Desserts, süß", f"genau {B['snack']}", len(sn), len(sn) == B["snack"])
    n = sum(bool(e.get("ohne_kochen")) for e in sn)
    add("… davon ohne Kochen/Backen", f"mind. {B['snack_ohne_kochen_min']}", n, n >= B["snack_ohne_kochen_min"])
    add("Hauptgerichte", f"genau {B['hauptgericht']}", len(hg), len(hg) == B["hauptgericht"])
    kuechen = Counter(e["kueche"] for e in hg)
    for k, soll in B["kuechen_hauptgerichte"].items():
        add(f"… {k}", f"genau {soll}", kuechen.get(k, 0), kuechen.get(k, 0) == soll)
    n = sum(bool(e.get("mp")) for e in alle)
    add("Meal Prep (alle)", f"mind. {B['meal_prep_min']}", n, n >= B["meal_prep_min"])
    n = sum(bool(e.get("schnell")) for e in alle)
    add("Schnelle Rezepte (alle)", f"mind. {B['schnell_min']}", n, n >= B["schnell_min"])
    n = sum(bool(e.get("ka")) for e in hg)
    add("Kalorienarme Hauptgerichte", f"mind. {B['kalorienarm_min']}", n, n >= B["kalorienarm_min"])
    add("High Protein (geplant: alle)", f"mind. {B['high_protein_min']}", len(alle), len(alle) >= B["high_protein_min"])
    n = sum(bool(e.get("insp")) for e in alle)
    add("Mit TikTok/Instagram-Inspiration", f"mind. {B['inspiration_min']}", n, n >= B["inspiration_min"])
    prot = Counter(e["protein"] for e in hg)
    top, anz = prot.most_common(1)[0]
    add(f"Häufigstes Hauptprotein ({top})", f"max. {B['hauptprotein_max']}", anz, anz <= B["hauptprotein_max"])
    n = sum(bool(e.get("rest")) for e in hg)
    add("Restetaugliche Hauptgerichte", f"mind. {B['restetauglich_haupt_min']}", n, n >= B["restetauglich_haupt_min"])
    ids = [e["id"] for e in alle]
    doppelt = [i for i, c in Counter(ids).items() if c > 1]
    add("Eindeutige IDs", "keine doppelt", ", ".join(doppelt) or "ok", not doppelt)
    fisch_mp = [e["id"] for e in hg if e["protein"] == "Fisch & Garnelen" and e.get("mp")]
    add("Fisch/Garnelen nicht als Meal Prep", "keins", ", ".join(fisch_mp) or "ok", not fisch_mp)
    for e in alle:
        korr = {"fruehstueck": "fruehstueck", "snack": "snack"}.get(e["bereich"]) or ("kalorienarm" if e.get("ka") else "hauptgericht")
        k = C.ZIELWERTE[korr]
        if not (k["kcal_min"] <= e["kcal"] <= k["kcal_max"]):
            add(f"Ziel-kcal {e['id']}", f"{k['kcal_min']}–{k['kcal_max']}", e["kcal"], False)
    return z


def ja(x) -> str:
    return "✓" if x else ""


def md(plan: dict) -> str:
    vorhanden = {p.stem for p in C.REZEPTE_DIR.glob("*.yaml")}
    alle = eintraege(plan)
    o = ["<!-- Generiert von tools/rezeptplan.py aus daten/rezeptplan.yaml – nicht von Hand bearbeiten. -->", "",
         "# Rezeptplan – Startbestand mit 100 Rezepten", "",
         f"Stand: {sum(e['id'] in vorhanden for e in alle)} von {len(alle)} Rezepten geschrieben. "
         "Ziel-kcal sind Planwerte pro Portion; die echten Werte rechnet `tools/naehrwerte.py`.", "",
         "Legende: **S** = schnell (≤ 25 min aktiv) · **MP** = Meal Prep · **R** = restetauglich · "
         "**KA** = kalorienarm · **OK** = ohne Kochen/Backen · **I** = TikTok/Instagram-Inspiration · "
         "**Rd.** = Schreib-Runde in Phase 4 · ✅ = schon geschrieben", ""]
    nr = 0
    for bereich, titel in BEREICHE.items():
        liste = [e for e in alle if e["bereich"] == bereich]
        o += [f"## {titel} ({len(liste)})", ""]
        extra = " | R | KA" if bereich == "hauptgericht" else (" | OK" if bereich == "snack" else "")
        extra_t = "|---|---" if bereich == "hauptgericht" else ("|---" if bereich == "snack" else "")
        o += [f"| # | Gericht | Küche | Hauptprotein | Ziel-kcal | S | MP{extra} | I | Rd. | Idee |",
              f"|---:|---|---|---|---:|---|---{extra_t}|---|---:|---|"]
        aktuelle_kueche = None
        for e in liste:
            nr += 1
            if bereich == "hauptgericht" and e["kueche"] != aktuelle_kueche:
                aktuelle_kueche = e["kueche"]
            name = e["name"] + (" ✅" if e["id"] in vorhanden else "")
            spalten = ""
            if bereich == "hauptgericht":
                spalten = f" | {ja(e.get('rest'))} | {ja(e.get('ka'))}"
            elif bereich == "snack":
                spalten = f" | {ja(e.get('ohne_kochen'))}"
            o.append(f"| {nr} | {name} | {e['kueche']} | {e['protein']} | {e['kcal']} | {ja(e.get('schnell'))} | "
                     f"{ja(e.get('mp'))}{spalten} | {ja(e.get('insp'))} | {e['runde']} | {e['idee']} |")
        o.append("")
    hg = plan["hauptgericht"]
    o += ["## Hauptproteine der Hauptgerichte", "", "| Hauptprotein | Anzahl |", "|---|---:|"]
    for p, n in Counter(e["protein"] for e in hg).most_common():
        o.append(f"| {p} | {n} |")
    o += ["", "## Abgleich mit SPEC 5.1–5.3", "", "| Anforderung | Soll | Ist | |", "|---|---|---:|---|"]
    for name, soll, ist, ok in abgleich(plan):
        o.append(f"| {name} | {soll} | {ist} | {'✅' if ok else '❌'} |")
    if plan.get("hinweise"):
        o += ["", "## Hinweise", ""] + [f"- {h}" for h in plan["hinweise"]]
    o.append("")
    return "\n".join(o)


def main() -> int:
    plan = lade_plan()
    PLAN_MD.write_text(md(plan), encoding="utf-8")
    fehler = [z for z in abgleich(plan) if not z[3]]
    for name, soll, ist, _ in fehler:
        print(f"❌ {name}: Soll {soll}, Ist {ist}")
    if not fehler:
        print("✅ Rezeptplan erfüllt alle Vorgaben aus SPEC 5.1–5.3 → rezeptplan.md")
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main())
