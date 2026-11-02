"""Alle Schwellenwerte, Toleranzen und Pfade an einer Stelle (SPEC 3, 4.1, 5, 7, 12).

Persönliche Ziele und Planer-Hinweise stehen in daten/profil.yaml; hier steht nur,
was die Skripte zum Rechnen und Prüfen brauchen.
"""
from pathlib import Path

# --- Pfade -------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
DATEN = ROOT / "daten"
ZUTATEN_CSV = DATEN / "zutaten.csv"
PACKUNGEN_CSV = DATEN / "packungen.csv"
EXTRAS_YAML = DATEN / "extras.yaml"
PROFIL_YAML = DATEN / "profil.yaml"
REZEPTE_DIR = DATEN / "rezepte"
MD_DIR = ROOT / "rezepte"            # generierte Markdown-Rezepte
REZEPTBUCH_MD = ROOT / "rezeptbuch.md"
WEB_DIR = ROOT / "web"

PORTIONEN = 2                         # jedes Rezept ergibt 2 gleich große Portionen

# --- Plausibilität (SPEC 12.1) -------------------------------------------------
# 4·Protein + 4·KH + 9·Fett + 2·Ballaststoffe darf max. ±5 % von den kcal abweichen.
PLAUSI_TOLERANZ = 0.05
# Bei sehr energiearmen Zutaten (Gemüse, Zitronensaft) sind Prozentwerte wenig aussagekräftig:
# Abweichungen bis zu dieser absoluten Grenze (kcal pro 100 g) gelten zusätzlich als plausibel.
PLAUSI_ABSOLUT_KCAL = 3.0

# --- Zielwerte pro Portion (SPEC 3) – müssen mit profil.yaml übereinstimmen ------
ZIELWERTE = {
    "fruehstueck": {"kcal_min": 500, "kcal_max": 650, "protein_min": 35},
    "hauptgericht": {"kcal_min": 600, "kcal_max": 850, "protein_min": 45},
    "kalorienarm": {"kcal_min": 0, "kcal_max": 550, "protein_min": 35},
    "snack": {"kcal_min": 200, "kcal_max": 350, "protein_min": 20},
}
ZUCKER_MAX_FRUEHSTUECK = 20.0         # g pro Portion (Warnung)

# --- Kategorien (SPEC 4.1) -------------------------------------------------------
HIGH_PROTEIN_MIN_G = 40.0             # g Protein pro Portion …
HIGH_PROTEIN_MIN_PRO_100KCAL = 10.0   # … oder g Protein pro 100 kcal
SCHNELL_MAX_MIN = 25                  # Vorbereitung + Kochen (Wartezeit zählt nicht)
KALORIENARM_MAX_KCAL = 550
KALORIENARM_MIN_PROTEIN = 35.0
MEAL_PREP_MIN_TAGE = 3

KATEGORIEN = {                        # Schlüssel (Ordnername) → Anzeigename
    "high-protein": "High Protein",
    "schnell": "Schnelle Rezepte",
    "meal-prep": "Meal Prep",
    "kalorienarm": "Kalorienarm",
    "fruehstueck-snacks": "Frühstück & Snacks",
}
MAHLZEITEN = ["Frühstück", "Mittag/Abend", "Snack"]
KUECHEN = ["Deutsch", "Italienisch", "Asiatisch", "Mexikanisch", "Indisch",
           "Griechisch & Mediterran", "Türkisch & Orientalisch", "Amerikanisch",
           "International / Fusion"]
SCHWIERIGKEITEN = ["leicht", "mittel", "aufwendig"]

# --- Startbestand (SPEC 5) ---------------------------------------------------------
BESTAND = {
    "gesamt": 100,
    "fruehstueck": 30, "fruehstueck_meal_prep_min": 8, "fruehstueck_schnell_min": 10,
    "snack": 10, "snack_ohne_kochen_min": 3,
    "hauptgericht": 60,
    "kuechen_hauptgerichte": {"Deutsch": 8, "Italienisch": 10, "Asiatisch": 10, "Mexikanisch": 6,
                              "Indisch": 6, "Griechisch & Mediterran": 6,
                              "Türkisch & Orientalisch": 6, "Amerikanisch": 6,
                              "International / Fusion": 2},
    "meal_prep_min": 24, "schnell_min": 30, "kalorienarm_min": 12, "high_protein_min": 90,
    "inspiration_min": 30, "hauptprotein_max": 20, "restetauglich_haupt_min": 30,
    "zutaten_max": 130,
}

# --- Lebensmittelsicherheit (SPEC 7.1) ------------------------------------------------
# Zutaten, die eine Kerntemperatur oder Garprobe im Schritt brauchen (Präfix-Vergleich).
GARPROBE_PFLICHT = ["Hähnchen", "Puten", "Rinder", "Schweine", "Lachs", "Seelachs", "Garnelen"]
FISCH_MAX_KUEHLSCHRANK_TAGE = 2
FISCH = ["Lachs", "Seelachs", "Garnelen", "Thunfisch"]
SONST_MAX_KUEHLSCHRANK_TAGE = 4

# Muster für die Textprüfungen
MUSTER_GARPROBE = r"Kerntemperatur|°C\s*Kern|Garprobe|gabelzart|mit der Gabel|glasig"
MUSTER_OFEN = r"\b(Back)?[Oo]fen\b|backen"
MUSTER_OFEN_MODUS = r"Ober-/Unterhitze|Umluft"
MUSTER_TEMPERATUR = r"\d+\s*°C"
MUSTER_HERD = r"Pfanne|Topf|Wok|köcheln|anbraten|braten|kochen lassen|aufkochen"
MUSTER_HERDSTUFE = r"Stufe \d( |–|-)?(\d )?von 9"

# Abschnitte der generierten Rezepte (SPEC 7) – Reihenfolge ist Pflicht
ABSCHNITTE = [
    "Nährwerte pro Portion",
    "Zutaten (für 2 Portionen)",
    "Mise en place",
    "Zubereitung",
    "Zeitablauf",
    "Häufige Fehler",
    "Anrichten",
    "Meal Prep & Aufbewahrung",
    "Varianten & Austausch",
    "Tipps",
    "Nährwert-Berechnung",
]

PFLICHTFELDER = ["id", "name", "hauptkategorie", "mahlzeit", "geschmack", "kueche",
                 "hauptprotein", "schwierigkeit", "zeit", "ausstattung", "restetauglich",
                 "zutaten", "mise_en_place", "schritte", "fehler", "anrichten",
                 "aufbewahrung", "varianten", "tipps"]

HINWEIS_SCHAETZWERTE = ("Nährwerte sind berechnete Schätzwerte auf Basis von Durchschnittswerten "
                        "und können je nach Produkt abweichen. Die Hinweise im Planer sind "
                        "Orientierung und ersetzen keine Ernährungs- oder ärztliche Beratung.")
