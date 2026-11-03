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

# --- Ausschlüsse (Vorlieben aus profil.yaml) ------------------------------------------
# Begriffe, die in keinem Rezept vorkommen dürfen – auch nicht in Varianten oder Tipps.
VERBOTENE_BEGRIFFE = ["Tofu", "Sojaschnetzel", "Seitan", "Tempeh", "Fleischersatz",
                      "Eiklar"]   # Eiklar: im Laden nicht erhältlich (Nutzer, 03.11.2026) – ganze Eier, Quark oder Skyr nehmen

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

# --- Import (SPEC 9): ungenaue Mengen → Gramm ------------------------------------------
# Einheit → {Stichwort in der Zutat: g pro Einheit, "_": Standard}. Stichwörter deutsch und englisch,
# Vergleich ohne Groß-/Kleinschreibung; das erste passende Stichwort gewinnt. None = nicht eindeutig → nachfragen.
IMPORT_EINHEITEN = {
    "scoop": {"_": 30},                          # Messlöffel Proteinpulver
    "cup": {"hafer": 90, "oat": 90, "mehl": 125, "flour": 125, "reis": 185, "rice": 185, "zucker": 200,
            "sugar": 200, "milch": 245, "milk": 245, "joghurt": 245, "yogurt": 245, "yoghurt": 245,
            "skyr": 245, "quark": 250, "beer": 140, "berr": 140, "käse": 100, "cheese": 100, "_": None},
    "el": {"öl": 10, "oil": 10, "honig": 21, "honey": 21, "erdnussmus": 16, "peanut": 16, "mehl": 8,
           "flour": 8, "kakao": 6, "cocoa": 6, "joghurt": 15, "yogurt": 15, "skyr": 15, "milch": 15,
           "milk": 15, "chia": 12, "_": 15},
    "tl": {"öl": 4, "oil": 4, "salz": 6, "salt": 6, "backpulver": 4, "baking": 4, "zimt": 3,
           "cinnamon": 3, "vanille": 4, "vanilla": 4, "honig": 7, "honey": 7, "_": 5},
    "dose": {"kichererbsen": 240, "chickpea": 240, "kidney": 250, "bohnen": 250, "bean": 250, "mais": 140,
             "corn": 140, "thunfisch": 120, "tuna": 120, "tomaten": 400, "tomato": 400, "kokos": 400,
             "coconut": 400, "_": None},
    "prise": {"_": 0.5},
    "zehe": {"_": 4},                            # Knoblauchzehe
    "stück": {"ei": 60, "egg": 60, "banane": 120, "banana": 120, "zwiebel": 80, "onion": 80, "apfel": 150,
              "apple": 150, "paprika": 160, "pepper": 160, "möhre": 80, "carrot": 80, "zitrone": 100,
              "lemon": 100, "wrap": 62, "tortilla": 62, "_": None},
    "handvoll": {"spinat": 30, "spinach": 30, "beer": 50, "berr": 50, "nüss": 30, "nut": 30, "_": None},
    "oz": {"_": 28.35}, "lb": {"_": 453.6}, "ml": {"_": 1.0}, "g": {"_": 1.0}, "kg": {"_": 1000.0},
}
# Schreibweisen → Einheit
IMPORT_EINHEIT_ALIAS = {
    "scoops": "scoop", "messlöffel": "scoop", "ml.": "ml", "cups": "cup", "tasse": "cup", "tassen": "cup",
    "tbsp": "el", "tbs": "el", "tablespoon": "el", "tablespoons": "el", "esslöffel": "el",
    "tsp": "tl", "teaspoon": "tl", "teaspoons": "tl", "teelöffel": "tl", "dosen": "dose", "can": "dose", "cans": "dose",
    "prisen": "prise", "pinch": "prise", "zehen": "zehe", "clove": "zehe", "cloves": "zehe",
    "stk": "stück", "stk.": "stück", "x": "stück", "handful": "handvoll", "gramm": "g", "grams": "g",
}
# Ab dieser Ähnlichkeit (0–1) wird beim Import gefragt: Variante oder eigenes Rezept? (SPEC 9.2.6)
IMPORT_AEHNLICH_AB = 0.45

# --- MacroFactor (SPEC 10.3): Zutatennamen nur für JSON-LD / „Für MacroFactor“ ----------------
# MacroFactor ordnet Zutaten seiner eigenen Datenbank zu. Test vom 03.11.2026: „Basmatireis ungekocht“ wurde
# als „Basmati Rice, Cooked“ erkannt (steckt „gekocht“ drin), Milch 1,5 % als Vollmilch, Frischkäse light als
# fettreichere Sorte. Deshalb eindeutigere Namen; „ungekocht“ wird generell zu „trocken, roh“.
MACROFACTOR_NAMEN = {
    "Milch 1,5 % Fett": "fettarme Milch 1,5 % Fett",
    "Frischkäse light": "Frischkäse Leichtstufe (7 % Fett)",
    "Joghurt 1,5 % Fett": "fettarmer Joghurt 1,5 % Fett",
}
MACROFACTOR_ERSETZEN = [(" ungekocht", " trocken, roh")]
