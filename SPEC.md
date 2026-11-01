# SPEC: Rezeptbuch, Wochenplaner-Baukasten und Einkaufsliste

Diese Datei ist die vollständige Vorgabe für mein Rezeptbuch-Projekt. Lies sie komplett, bevor du planst, Rezepte schreibst oder Code erstellst. Wenn etwas unklar oder widersprüchlich ist, frag nach, statt zu raten.

---

## 1. Ziel des Projekts

Ein persönliches, sehr ausführliches **Rezeptbuch mit 100 Rezepten** und eine **Web-App als persönlicher Baukasten** für das iPhone (Safari, zum Home-Bildschirm hinzufügbar).

Die Aufgabenteilung ist klar:

| Wer | Was |
|---|---|
| **Du (Claude)** | Rezepte entwickeln, Nährwerte exakt berechnen, prüfen, die Web-App bauen und pflegen |
| **Die App** | stellt die Rezepte bereit und gibt mir die Werkzeuge: Rezeptbuch, Wochenplaner, Live-Makrorechnung, Einkaufsliste, Kochmodus |
| **Ich** | plane meine Wochen selbst in der App, so wie ich will |

**Du erstellst keine Wochenpläne für mich.** Der Planer in der App rechnet live mit, zeigt Hinweise und berechnet die Einkaufsliste, entscheidet aber nichts. Rezepte lassen sich per Link in **MacroFactor** importieren.

Leitsatz: **Jedes Rezept muss so genau sein, dass ich es ohne Nachdenken nachkochen kann, und jede Zahl muss gerechnet sein, nicht geschätzt.** Geschmack und Alltagstauglichkeit gehen vor Perfektion bei den Makros, aber Protein hat immer Priorität.

---

## 2. Mein Profil

- **Ziel:** Muskelaufbau bei gleichzeitigem Fettabbau (Body Recomposition)
- **Gewicht:** 82 kg
- **Tagesziele** (aus MacroFactor, Stand 20.10.2026):

| Kalorien | Protein | Fett | Kohlenhydrate |
|---|---|---|---|
| 2.275 kcal | 149 g | 101 g | 191 g |

- **Mahlzeiten pro Tag:** Frühstück, Mittagessen, Abendessen. Snacks nur, um Lücken zu füllen.
- **Haushalt:** 2 Personen. Jedes Rezept ergibt **2 gleich große Portionen**. Die Nährwerte gelten **pro Portion = meine Portion**. Person 2 isst einfach mit, ihre Makros werden nicht gezählt.
- **Tracking:** MacroFactor (iPhone)
- **Vorrat, Ausstattung, Supermarkt, Budget:** im Onboarding abfragen (Abschnitt 13, Phase 1) und in `daten/profil.yaml` speichern.

### 2.1 Vorlieben (harte Regeln für Rezepte)

| Regel | Bedeutung |
|---|---|
| **Frühstück ist süß** | Ich liebe süßes Frühstück: Frühstücks-Brownie, Protein-Joghurt-Bowls, Pancakes, Waffeln, Baked Oats, Overnight Oats, Kaiserschmarrn, Milchreis, Quarkspeisen. **Alle Frühstücke sind süß.** Herzhaftes Frühstück nur, wenn ich es ausdrücklich wünsche. |
| **Süß, aber proteinreich** | Süße kommt aus Obst, Honig, Whey, Kakao, Zimt, Vanille oder Süßstoff. Wenig zugesetzter Zucker (Richtwert: max. 20 g Zucker gesamt pro Frühstücksportion). |
| **Wenig Gemüse** | Gemüse sparsam einsetzen, nie als Hauptbestandteil. Proteinquelle, Sättigungsbeilage und Sauce stehen im Mittelpunkt. Kleine Mengen für Geschmack und Farbe sind okay (Zwiebel, Knoblauch, Tomate, etwas Paprika). |
| **Alltagstauglich** | Zutaten aus normalen deutschen Supermärkten. Exotisches (z. B. Gochujang) nur, wenn es lange haltbar ist und in mehreren Rezepten vorkommt. |
| **Geschmack zählt** | Gute Gewürze, Saucen, Röstaromen und Texturen. Kein „Fitness-Essen“, das nach Verzicht schmeckt. |

Alle Werte dieses Abschnitts sind in `daten/profil.yaml` hinterlegt und änderbar. Wenn ich neue Makroziele nenne, aktualisierst du die Datei und generierst die App neu (die Ziele im Planer ändern sich dann mit).

---

## 3. Zielwerte pro Mahlzeit

Damit ich im Planer mit drei Mahlzeiten (plus ggf. einem Snack) meine Tagesziele leicht treffe, gelten für Rezepte diese Korridore **pro Portion**:

| Mahlzeit | kcal | Protein | Hinweis |
|---|---|---|---|
| Frühstück (süß) | 500–650 | mind. 35 g | |
| Hauptgericht Mittag/Abend | 600–850 | mind. 45 g | |
| Kalorienarmes Hauptgericht | max. 550 | mind. 35 g | für Auswärtstage und Tage mit Spielraum |
| Snack / Dessert (süß) | 200–350 | mind. 20 g | zum Auffüllen |

Rechenbeispiel: 600 (Frühstück) + 750 + 750 (Hauptgerichte) + 200 (Snack) = 2.300 kcal.

---

## 4. Kategorien und Küchen

### 4.1 Kategorien (werden aus den berechneten Werten vergeben, nicht geschätzt)

| Kategorie | Kriterium |
|---|---|
| **High Protein** | mind. 40 g Protein pro Portion **oder** mind. 10 g Protein pro 100 kcal |
| **Schnelle Rezepte** | Gesamtzeit (Vorbereitung + Kochen) max. 25 Minuten |
| **Meal Prep** | mind. 3 Tage im Kühlschrank haltbar und gut aufwärmbar (bzw. kalt essbar) |
| **Kalorienarm** | Hauptgericht mit max. 550 kcal und mind. 35 g Protein |
| **Frühstück & Snacks** | Mahlzeit ist Frühstück, Snack oder Dessert |

- Ein Rezept hat **eine Hauptkategorie** (bestimmt den Ordner) und beliebig viele weitere.
- „High Protein“, „Schnelle Rezepte“ und „Kalorienarm“ vergibt das Skript automatisch anhand der Kriterien. Ist die Hauptkategorie nicht erfüllt, ist das ein Fehler (Rezept anpassen, nicht Kategorie).
- Neue Kategorien schlage ich vor; du ergänzt sie hier und in der Konfiguration.

### 4.2 Länderküchen

| Küche | Beispiele |
|---|---|
| Deutsch | Schnitzel, Gulasch, Frikadellen, Kartoffelgerichte, Kaiserschmarrn |
| Italienisch | Pasta, Lasagne, Gnocchi, Piccata, Tiramisu |
| Asiatisch | Chinesisch, Japanisch, Koreanisch, Thai, Vietnamesisch |
| Mexikanisch | Burritos, Bowls, Tacos, Quesadillas, Chili |
| Indisch | Curry, Tandoori, Butter Chicken |
| Griechisch & Mediterran | Gyros, Souvlaki, Tzatziki-Bowls |
| Türkisch & Orientalisch | Köfte, Döner-Bowl, Shakshuka |
| Amerikanisch | Burger, BBQ, Pancakes, Waffeln, Brownies |
| International / Fusion | alles, was nicht klar zuzuordnen ist |

Klassiker gern als High-Protein-Version neu interpretieren (z. B. Lasagne mit Magerquark statt Béchamel, Butter Chicken mit Skyr statt Sahne).

### 4.3 Inspiration aus TikTok und Instagram
- **Keine eigene Kategorie**, sondern Inspirationsquelle. Vor allem bei **High Protein** und **Frühstück** Rezepte, wie sie oft auf TikTok und Instagram gepostet werden: Frühstücks-Brownie, Baked Oats, Protein-Pancakes, Cottage-Cheese-Rezepte, Skyr-Desserts, Wrap-Hacks aus der Pfanne, Burrito Bowls, Smash Burger, Marry Me Chicken, High-Protein-Pasta.
- Jedes so inspirierte Rezept hat das Feld **Inspiration**: worauf es basiert und was du für bessere Makros geändert hast (z. B. „Sahne durch Frischkäse light und Milch ersetzt, spart ca. 250 kcal pro Portion“).
- Keine Texte oder Fotos aus Posts übernehmen. Rezepte immer in eigenen Worten nach meiner Vorlage schreiben.

---

## 5. Der Startbestand: 100 Rezepte

### 5.1 Verteilung (exakt so)

| Bereich | Anzahl | Vorgaben |
|---|---|---|
| **Frühstück, süß** | 30 | mind. 8 Meal-Prep-tauglich, mind. 10 schnell (max. 25 min) |
| **Snacks & Desserts, süß** | 10 | auch als Nachtisch geeignet, mind. 3 ohne Kochen/Backen |
| **Hauptgerichte** | 60 | Verteilung auf Küchen siehe 5.2 |
| **Gesamt** | **100** | |

Ideen für Frühstück (fachlich sauber ausbauen, Dopplungen vermeiden): Frühstücks-Brownie (Baked Oats Schoko), weitere Baked-Oats-Sorten (z. B. Blaubeer-Cheesecake, Apfel-Zimt, Karottenkuchen), Protein-Joghurt-Bowl mit Granola und Beeren, Protein-Pancakes, Protein-Waffeln, Overnight Oats in 3–4 Sorten (z. B. Cheesecake, Apfelstrudel, Erdnuss-Banane, Tiramisu), Quark-Auflauf mit Kirschen, Protein-French-Toast, Protein-Kaiserschmarrn, Protein-Milchreis, Protein-Grießbrei, Bananenbrot (Meal Prep), Protein-Muffins (Meal Prep), Protein-Crêpes, Skyr-Tiramisu-Bowl, Cottage-Cheese-Pancakes, Protein-Porridge, Chia-Pudding mit Skyr, Protein-Scones, Apfel-Zimt-Quarkauflauf, Schoko-Erdnuss-Bowl, Protein-Zimtschnecken-Oats, Frühstücks-Cheesecake, Protein-Bircher-Müsli.

Ideen für Snacks: Protein-Mousse au Chocolat, Skyr-Cheesecake im Glas, Protein-Eis aus TK-Beeren („Nice Cream“), Protein-Balls, Quarkcreme mit Obst, Protein-Pudding mit Topping, Cookie-Dough aus Quark, Protein-Riegel (Meal Prep), Frozen-Joghurt-Bark, Protein-Brownie-Bites.

### 5.2 Hauptgerichte nach Küche

| Küche | Anzahl |
|---|---|
| Deutsch | 8 |
| Italienisch | 10 |
| Asiatisch | 10 |
| Mexikanisch | 6 |
| Indisch | 6 |
| Griechisch & Mediterran | 6 |
| Türkisch & Orientalisch | 6 |
| Amerikanisch | 6 |
| International / Fusion | 2 |
| **Summe** | **60** |

### 5.3 Mindestanforderungen über alle 100

| Anforderung | Mindestwert |
|---|---|
| Meal Prep | 24 Rezepte |
| Schnelle Rezepte | 30 Rezepte |
| Kalorienarme Hauptgerichte | 12 |
| High Protein | möglichst alle, mind. 90 |
| Mit TikTok/Instagram-Inspiration | 30 |
| Gleiche Proteinquelle als Hauptprotein | max. 20 Hauptgerichte (Hähnchen, Pute, Rind, Schwein mager, Fisch und Garnelen, Eier, Skyr/Quark/Hüttenkäse, Tofu/Hülsenfrüchte abwechseln) |
| Gute Restetauglichkeit (lässt sich am Folgetag mittags essen) | mind. 30 Hauptgerichte |

- Keine zwei Rezepte, die sich nur minimal unterscheiden. Varianten gehören in den Abschnitt „Varianten & Austausch“.
- Die Gesamtzutatenliste soll überschaubar bleiben: lieber eine Zutat in mehreren Rezepten nutzen als für jedes Rezept etwas Neues kaufen. Ziel: max. ca. 130 verschiedene Zutaten in `zutaten.csv`. Das macht auch die Einkaufslisten im Planer kürzer, weil sich Packungen über mehrere Rezepte aufbrauchen.
- Falls beim Start bereits Rezepte im Ordner liegen, zählen sie zu den 100, sofern sie den Regeln entsprechen (herzhafte Frühstücke zählen nicht als Frühstück, sondern werden gefragt: behalten, umbauen oder löschen).

---

## 6. Datenmodell (wichtige Designentscheidung)

**Rezepte sind strukturierte Daten (YAML), nicht Freitext.** Markdown-Dateien und die Web-App werden daraus generiert. Nur so können Nährwerte, Kategorien, Einkaufslisten und der MacroFactor-Export zuverlässig berechnet und geprüft werden.

**Wochenpläne und Vorrat gehören mir und leben in der App** (im Browser gespeichert, siehe 8.6). Sie liegen nicht als Pflichtdateien im Projekt. Nur wenn ich einen Plan exportiere und dir gebe, landet er unter `daten/wochenplaene/`.

### 6.1 Ordnerstruktur

```
SPEC.md                         ← diese Datei
CLAUDE.md                       ← Arbeitsregeln und Fortschrittsliste (legst du in Phase 1 an)
README.md                       ← Anleitung für mich
daten/
  profil.yaml                   ← Makroziele, Vorlieben, Ausstattung, Supermarkt, Budget, Abteilungsreihenfolge
  zutaten.csv                   ← Nährwert-Datenbank pro 100 g
  packungen.csv                 ← Packungsgrößen, Abteilung, Preis (optional), Haltbarkeit
  extras.yaml                   ← einfache Extras für den Planer (z. B. Skyr mit Honig, Shake, Nüsse)
  rezepte/<id>.yaml             ← ein Rezept pro Datei (Single Source of Truth)
  wochenplaene/                 ← nur exportierte Pläne, die ich dir zur Prüfung gebe (optional)
tools/
  naehrwerte.py                 ← Nährwerte berechnen
  pruefen.py                    ← alle Prüfungen aus Abschnitt 12.1
  generieren.py                 ← Markdown + Web-App + Daten-JSON für die App erzeugen
  plan_pruefen.py               ← exportierten Wochenplan gegen die Hinweisregeln prüfen (optional, 8.5)
  config.py                     ← alle Schwellenwerte und Toleranzen, kommentiert
tests/                          ← pytest + Playwright
rezepte/<hauptkategorie>/<id>.md   ← generiert, nicht von Hand bearbeiten
rezeptbuch.md                   ← generiertes Inhaltsverzeichnis
import/                         ← Screenshots, Texte, links.txt (Abschnitt 9)
  erledigt/
web/                            ← generierte Web-App (Abschnitt 10)
  daten/rezepte.json            ← alle Rezepte inkl. Zutaten in Gramm und Nährwerten pro Portion
  daten/zutaten.json            ← Nährwerte pro 100 g (für Extras und eigene Mengen)
  daten/packungen.json          ← Packungen, Abteilungen, Preise, Haltbarkeit
  daten/profil.json             ← Tagesziele und Hinweisregeln
  js/planer.js                  ← Planer- und Einkaufslogik (reine Funktionen, testbar)
```

### 6.2 Zutaten-Datenbank `daten/zutaten.csv`

Spalten: `zutat, kcal, protein, fett, gesaettigt, kh, zucker, ballaststoffe, salz, garfaktor`

- Werte **pro 100 g Rohgewicht** bzw. so, wie die Zutat verwendet wird (z. B. „Basmatireis ungekocht“, „Kidneybohnen abgetropft“, „Ei Gr. M ohne Schale“).
- Quellen: Bundeslebensmittelschlüssel (BLS), USDA oder typische Herstellerangaben deutscher Supermarktprodukte. Bei Markenprodukten mit großer Streuung (z. B. Whey, Protein-Pudding) einen typischen Wert nehmen und in einer Kommentarzeile vermerken.
- `garfaktor`: Gewicht nach dem Garen / Rohgewicht (z. B. Reis 2,8, Hähnchen 0,75, Zwiebel 0,7). Dient der Schätzung des Gargewichts zum Portionieren.
- Namen sind eindeutig und konkret. Keine Zutat ohne Fettstufe, wo es darauf ankommt („Rinderhackfleisch 5 % Fett roh“, nicht „Hackfleisch“).

### 6.3 Packungen `daten/packungen.csv`

Spalten: `zutat, abteilung, packung_g, packung_text, preis_eur (optional), haltbar_tage_offen, frische (frisch | tk | lange_haltbar), max_tage_nach_einkauf (optional)`

Beispiel: `Magerquark, Kühlregal & Milchprodukte, 250, 250-g-Becher, 0.79, 4, frisch, `
Beispiel: `Lachsfilet frisch, Fleisch & Fisch, 250, 2 × 125 g, 4.49, 1, frisch, 2`

`max_tage_nach_einkauf` nutzt der Planer für Frische-Hinweise (Fisch, Garnelen, Hackfleisch: 2).

### 6.4 Rezept-Schema `daten/rezepte/<id>.yaml`

```yaml
id: fruehstuecks-brownie              # kebab-case, eindeutig
name: Frühstücks-Brownie
hauptkategorie: fruehstueck-snacks    # high-protein | schnell | meal-prep | kalorienarm | fruehstueck-snacks
kategorien_manuell: [Meal Prep]       # nur „Meal Prep“, die anderen berechnet das Skript
mahlzeit: Frühstück                   # Frühstück | Mittag/Abend | Snack
geschmack: süß                        # süß | herzhaft
kueche: Amerikanisch
hauptprotein: Eier & Whey             # für Filter und Abwechslungs-Hinweise im Planer
inspiration:                          # optional
  quelle: "TikTok-Trend „Breakfast Brownie“"
  link: null
  aenderungen: "Mehl durch Haferflocken, Zucker durch Banane und Whey ersetzt"
schwierigkeit: leicht                 # leicht | mittel | aufwendig
zeit: {vorbereitung: 10, kochen: 25, wartezeit: 0}   # Minuten
ausstattung: [Ofen, Mixer, "Auflaufform 20 × 20 cm"]
restetauglich: true                   # lässt sich gut am Folgetag essen (für die Reste-Funktion im Planer)
vortag:                               # was am Vortag passieren muss, erscheint im Planer als Erinnerung
  - "Overnight Oats am Abend ansetzen"
zutaten:
  - gruppe: Teig
  - {id: hafer, zutat: Haferflocken, g: 120, anzeige: null, hinweis: "zarte"}
  - {id: eier, zutat: "Ei Gr. M ohne Schale", g: 120, anzeige: "2 Stück Gr. M", hinweis: ""}
mise_en_place:
  - "Ofen auf 180 °C Ober-/Unterhitze (160 °C Umluft) vorheizen."
schritte:
  - {titel: Mixen, text: "{hafer}, {eier} … 30 Sekunden mixen.", timer_min: null}
  - {titel: Backen, text: "… 22–25 Minuten backen …", timer_min: 25}
zeitablauf: ["Während der Ofen vorheizt: mixen und einfüllen."]
fehler: ["Zu lange gebacken: wird trocken. Lieber 2 Minuten früher raus."]
anrichten: "…"
aufbewahrung: {kuehlschrank_tage: 3, einfrierbar: true, einfrieren_monate: 1, aufwaermen: "Mikrowelle 600 W, 60–90 s"}
varianten: ["**Mehr Protein:** 100 g Skyr extra (+32 kcal, +5,5 g Protein pro Portion)."]
tipps: ["…"]
gargewicht_g: null                    # optional gemessen, sonst aus garfaktor geschätzt
bewertung: {sterne: null, kommentar: null, datum: null}
```

**Platzhalter in Texten:** `{zutat_id}` wird beim Generieren durch Menge + Name ersetzt (z. B. „120 g Haferflocken“, „2 Eier (120 g)“), `{zutat_id:n}` nur durch den Namen. So sind Mengen in Zutatenliste und Schritten **immer identisch**. Jede Zutat muss mindestens einmal in Mise en place, Schritten oder Anrichten vorkommen. In der App werden die Platzhalter beim Skalieren live neu berechnet.

### 6.5 Extras `daten/extras.yaml`

Kleine Bausteine, die ich im Planer zu jedem Tag hinzufügen kann, ohne ein Rezept zu brauchen. Nährwerte werden aus `zutaten.csv` berechnet.

```yaml
- id: skyr-honig
  name: Skyr mit Honig
  zutaten: [{zutat: "Skyr natur", g: 250}, {zutat: Honig, g: 15}]
- id: whey-shake-milch
  name: Proteinshake mit Milch
  zutaten: [{zutat: "Whey Protein Vanille", g: 30}, {zutat: "Milch 1,5 % Fett", g: 300}]
- id: nuesse
  name: Nüsse (für Fett)
  zutaten: [{zutat: "Mandeln", g: 30}]
```

Mindestens 8 Extras zum Start (Protein, Fett, Kohlenhydrate jeweils gezielt auffüllbar).

### 6.6 Exportformat eines Wochenplans (JSON)

Der Planer speichert Pläne im Browser und kann sie als Datei exportieren und wieder importieren. Format:

```json
{
  "version": 1,
  "kw": 45, "jahr": 2026,
  "einkauf": [{"datum": "2026-11-07", "art": "gross"}, {"datum": "2026-11-11", "art": "frisch"}],
  "tage": [
    {
      "datum": "2026-11-09",
      "slots": {
        "fruehstueck": {"typ": "rezept", "rezept": "fruehstuecks-brownie", "faktor": 1.0, "art": "rest", "von": "2026-11-08/fruehstueck"},
        "mittag":      {"typ": "rezept", "rezept": "burrito-bowl", "faktor": 1.0, "art": "rest", "von": "2026-11-08/abend"},
        "abend":       {"typ": "rezept", "rezept": "marry-me-chicken", "faktor": 1.0, "art": "kochen", "menge": 1},
        "snack":       null
      },
      "extras": [{"extra": "skyr-honig", "faktor": 1.0}],
      "auswaerts": null,
      "notiz": ""
    }
  ],
  "vorrat": [{"zutat": "Feta", "g": 50, "haltbar_bis": "2026-11-11"}]
}
```

- `art: kochen` + `menge: 2` heißt: Rezept wird doppelt gekocht, die zweite Ladung ist für Reste verfügbar.
- `art: rest` + `von` verweist auf den Slot, in dem gekocht wurde. Reste erzeugen **keine** zusätzlichen Zutaten auf der Einkaufsliste.
- `auswaerts`: `{"mahlzeit": "abend", "kcal": 950, "protein": 40, "fett": 45, "kh": 90}` (Werte anpassbar).

---

## 7. Rezept-Qualitätsstandard (harte Regeln)

Jedes generierte Rezept (`rezepte/<kategorie>/<id>.md` und Rezeptseite in der App) hat genau diese Abschnitte in dieser Reihenfolge:

1. **Kopf:** Name, Bewertung, Kategorien, Küche, Inspiration (falls vorhanden), Mahlzeit, Portionen (2), Schwierigkeit, Zeit (Vorbereitung · Kochen · Wartezeit · Gesamt), Ausstattung
2. **Nährwerte pro Portion:** kcal, Protein, Fett, davon gesättigt, Kohlenhydrate, davon Zucker, Ballaststoffe, Salz; dazu Anteil am Tagesziel in %, Protein pro 100 kcal, Makroverteilung in %, **Gewicht fertig gesamt und pro Portion** (zum Abwiegen)
3. **Zutaten (für 2 Portionen):** Tabelle Zutat | Menge | Hinweis, mit Gruppen (z. B. Teig, Topping). Mengen in Gramm (Rohgewicht/ungekocht), Stückangaben zusätzlich („2 Stück Gr. M (120 g)“)
4. **Mise en place:** alles, was vorab passiert: vorheizen, schneiden (mit Schnittgröße, z. B. „2 cm Würfel“), abwiegen, auftauen, marinieren
5. **Zubereitung:** nummerierte Schritte mit Titel. In jedem Schritt: **Herdstufe** (z. B. „Stufe 6 von 9“), **Ofentemperatur und Modus** (Ober-/Unterhitze und Umluft), Topf- oder Pfannengröße, **Zeit** und **woran man erkennt, dass es fertig ist** (Farbe, Konsistenz, Kerntemperatur)
6. **Zeitablauf:** was parallel läuft („Während der Reis kocht: Sauce anrühren“), wenn sinnvoll
7. **Häufige Fehler:** 2–4 typische Fehler mit Ursache und Lösung
8. **Anrichten:** wie die Portion auf den Teller oder in die Meal-Prep-Box kommt, mit Gramm pro Portion
9. **Meal Prep & Aufbewahrung:** Kühlschrank-Tage, einfrierbar ja/nein und wie lange, Aufwärmen (Gerät, Leistung, Dauer), was separat gelagert wird
10. **Varianten & Austausch:** 2–4 Varianten mit Makro-Änderung pro Portion (andere Proteinquelle, mehr/weniger kcal, andere Beilage)
11. **Tipps:** 1–3 Profi-Tipps für Geschmack und Gelingen
12. **Nährwert-Berechnung:** Tabelle pro Zutat (Menge, kcal, Protein, Fett, KH), Summe, pro Portion, Ergebnis des Plausibilitätschecks, Hinweis „Schätzwerte“

### 7.1 Inhaltliche Regeln
- **Exakte Mengen für alles**, auch Gewürze, Öl, Flüssigkeiten. Kein „etwas“, kein „nach Geschmack“ ohne Richtwert. Salz fürs Kochwasser wird genannt, aber als „nicht mitgerechnet“ markiert.
- **Öl, Butter und Saucen werden vollständig mitgezählt.**
- **Kerntemperaturen:** Geflügel 74 °C, Hackfleisch 72 °C, Schweinefilet 63 °C, Lachs 50–55 °C (glasig) bzw. 60 °C (durch). Bei Schmorgerichten: Garprobe mit der Gabel.
- **Lebensmittelsicherheit bei Meal Prep:** Gerichte mit Fisch und Garnelen max. 2 Tage, alles andere max. 3–4 Tage gekühlt. Reis nach dem Kochen schnell abkühlen und innerhalb von 1 Stunde in den Kühlschrank.
- **Süße Frühstücke:** Textur und Geschmack beschreiben (z. B. „Mitte darf noch saftig sein, dann wird er brownie-artig“). Tipps, wie es noch mehr nach Dessert schmeckt, ohne viel Kalorien (Vanille, Zimt, Prise Salz, Kakao).
- **Realistische Zeiten:** Vorheizen, Quellen, Marinieren und Ruhen werden in der Gesamtzeit berücksichtigt (Marinieren über Nacht als `wartezeit` und in `vortag`, nicht in „schnell“ mitzählen, aber deutlich markieren).
- **Selbstcheck vor dem Speichern:** alle Prüfungen aus Abschnitt 12.1 bestanden.

---

## 8. Wochenplaner in der App (mein Baukasten)

Ich plane selbst. Der Planer ist ein Werkzeug: Er rechnet live, warnt freundlich und erstellt die Einkaufsliste. **Er blockiert nichts und plant nichts automatisch**, außer ich drücke ausdrücklich einen Komfort-Button (z. B. „Rest morgen mittags eintragen“).

### 8.1 Planen
- **Wochenansicht** Montag bis Sonntag (ISO-Kalenderwoche), wechselbar zwischen Wochen. Pro Tag die Slots **Frühstück, Mittag, Abend, Snack** plus beliebig viele **Extras**.
- **Slot antippen → Rezeptauswahl:** Suche, Filter (Mahlzeit, Kategorie, Küche, Hauptprotein, max. Zeit, Bewertung, restetauglich), Sortierung (Name, kcal, Protein, Zeit) und **„passt zu meinen Restmakros“**: sortiert nach den Werten, die für diesen Tag noch fehlen. Standardmäßig sind passende Rezepte für die Mahlzeit vorgefiltert (Frühstück → süße Frühstücke), Filter lässt sich lösen.
- **Portionsfaktor pro Slot:** 0,5 bis 2,0 in 0,25er-Schritten, mit Live-Anzeige der Mengenänderung („Reis 90 g statt 75 g pro Portion“).
- **Doppelt kochen und Reste:** Bei einem Slot „doppelt kochen“ wählen; die zweite Ladung erscheint als verfügbarer Rest. Button „Rest morgen mittags eintragen“ füllt den Slot am Folgetag. Reste kann ich auch per Hand in jeden Slot ziehen.
- **Meal Prep:** ein Rezept als „Prep-Ladung“ (z. B. × 2 = 4 Portionen) markieren und die Portionen auf Tage verteilen.
- **Auswärts:** Slot als „Auswärts“ markieren, Platzhalter 950 kcal (40 g P, 45 g F, 90 g KH), Werte anpassbar. Erzeugt keine Zutaten.
- **Notiz** pro Tag.
- **Kopieren:** Tag kopieren, Woche kopieren, Woche als **Vorlage** speichern und später wieder einsetzen.
- **Drag & Drop** (Gedrückthalten auf iPhone) zum Verschieben und Tauschen von Mahlzeiten, zusätzlich immer über Menü „Verschieben nach …“ erreichbar.
- **Einkaufstage** pro Woche festlegen (Standard aus `profil.yaml`), z. B. Sa groß, Mi frisch.

### 8.2 Live-Rechnung
- **Pro Slot:** kcal und Protein.
- **Pro Tag:** Summe kcal, Protein, Fett, KH als Balken gegen das Ziel, Abweichung in g und %. Restmakros „noch offen“ werden immer angezeigt.
- **Pro Woche:** Durchschnitt der Makros, Anzahl Kochtage, geschätzte Kochzeit, Kosten (falls Preise vorhanden).
- Gerechnet wird mit den vorberechneten Nährwerten pro Portion × Faktor (aus `rezepte.json`), Extras aus `zutaten.json`. Dieselben Zahlen wie im Rezeptbuch.

### 8.3 Hinweise (nicht blockierend)
Der Planer zeigt pro Tag ein kleines Symbol (grün/gelb/rot) und auf Antippen eine Liste der Hinweise. Alle Schwellen stehen in `profil.yaml` und sind änderbar.

| Hinweis | Standardwert |
|---|---|
| Protein pro Tag | gelb unter 145 g, rot unter 130 g |
| Kalorien pro Tag | grün bei 2.275 ± 100 kcal |
| Fett pro Tag | 101 g ± 15 g, rot unter 70 g |
| Kohlenhydrate pro Tag | 191 g ± 20 g |
| Frühstück herzhaft | Hinweis (nur Info) |
| Abendessen gleiche Küche wie am Vortag | Hinweis |
| Abendessen gleiche Hauptproteinquelle wie am Vortag | Hinweis |
| Rezept mit 1–2 Sternen | ausgeblendet in der Auswahl (einblendbar), Hinweis wenn trotzdem geplant |
| 3-Sterne-Rezepte mehr als 1× pro Woche | Hinweis |
| Fisch, Garnelen, Hackfleisch später als 2 Tage nach Einkauf | Hinweis mit Vorschlag „TK kaufen“ (setzt in der Einkaufsliste TK-Variante und eine Auftau-Erinnerung) |
| Rest/Meal Prep älter als `kuehlschrank_tage` | rot |
| Rest geplant, aber nicht genug Portionen gekocht | rot |
| Tag mit wenig Zeit (von mir markiert) und Rezept über 25 min | Hinweis |

Wenn ein Tag nicht aufgeht, zeigt der Planer **Vorschläge zum Auffüllen** (nur als Vorschlag, ich tippe zum Übernehmen): Faktor einer Beilage/Portion erhöhen, einen Snack ergänzen, ein passendes Extra (z. B. Skyr mit Honig bei fehlendem Protein, Nüsse bei fehlendem Fett).

### 8.4 Tagesansicht, Erinnerungen und Zeitplan
- **Erinnerungen für morgen** werden automatisch aus dem Plan erzeugt: `vortag`-Felder der Rezepte (z. B. „Overnight Oats ansetzen“, „Marinade ansetzen“), Auftauen von TK-Fisch/-Fleisch, Meal-Prep-Box aus dem Gefrierfach.
- **Zeitplan für Kochtage:** Ich gebe eine Essenszeit ein (Standard 18:30), der Planer rechnet aus den Rezeptzeiten rückwärts („18:00 Ofen vorheizen, 18:10 Lachs rein, 18:30 essen“).
- **Reste-Übersicht** der Woche: welches Gericht wie viele Portionen ergibt, wann welche gegessen wird, wie gelagert, bis wann haltbar.
- **Meal-Prep-Ablauf:** Für einen Prep-Tag fasst der Planer die Schritte aller Prep-Rezepte zusammen, sortiert nach Ofen/Herd/kalt, mit geschätzter Gesamtdauer und welcher Box für welchen Tag.

### 8.5 Einkaufsliste (in der App berechnet)
Wird in `web/js/planer.js` aus dem aktuellen Plan **berechnet**, nicht geschrieben, und aktualisiert sich bei jeder Planänderung.

- Mengen aller **gekochten** Rezepte der Woche × Faktor × `menge` addieren, gleiche Zutaten zusammenfassen. Reste und Auswärts erzeugen keine Zutaten. Extras zählen mit.
- **Vorrat abziehen** (Vorrat wird in der App gepflegt, 8.6).
- Auf **Packungsgrößen** aus `packungen.json` aufrunden.
- Nach **Abteilungen** sortieren: Obst & Gemüse · Fleisch & Fisch · Kühlregal & Milchprodukte · Brot & Backwaren · Trockenwaren · Konserven & Saucen · Gewürze & Öle · Tiefkühl · Sonstiges. Reihenfolge aus `profil.yaml`, in der App änderbar.
- Pro Zeile: **Produkt mit genauer Angabe** (Sorte, Fettstufe, TK/frisch) · **Bedarf → Kaufmenge** · **wofür** (z. B. „Hähnchenbrustfilet: 1.150 g → 3 × 400 g · Mo Abend, Do Abend“) · Frische-Hinweis, wenn relevant.
- **Abhaken** mit Speicherung, abgehakte Artikel wandern nach unten, Button „Alle Haken zurücksetzen“.
- **Eigene Artikel** hinzufügen (Freitext, z. B. Spülmittel).
- Bei zwei Einkaufsterminen: **getrennte Listen**; frische Ware mit kurzer Haltbarkeit automatisch zum späteren Termin, wenn sie erst nach dem zweiten Einkauf gebraucht wird.
- Abschnitt **„Vorrat prüfen“** für Gewürze, Öl, Salz, Backpulver usw., die nur in kleinen Mengen gebraucht werden.
- **Reste nach der Woche:** was von angebrochenen Packungen übrig bleibt (z. B. „Feta: 50 g, offen haltbar bis Mi“). Button „In Vorrat übernehmen“. Bei der Rezeptauswahl der nächsten Woche werden Rezepte, die diese Reste verbrauchen, markiert.
- Wenn ein Budget angegeben ist: **Kostenschätzung** pro Abteilung und gesamt, Hinweis bei Überschreitung.
- **Teilen/Kopieren** als Text (für Notizen oder Nachrichten an Person 2).
- **Kontrollrechnung** (intern, getestet): Summe aller Rezeptmengen = Summe Liste + Vorrat.

### 8.6 Speicherung meiner Pläne
- Pläne, Vorlagen, Vorrat, Haken und Einstellungen werden im Browser gespeichert (localStorage bzw. IndexedDB, immer mit try/catch und stillem Fallback).
- **Wichtig:** Browser-Speicher gehört zu einem Gerät und kann verloren gehen (z. B. Website-Daten gelöscht). Deshalb:
  - **Export** des aktuellen Plans oder aller Daten als JSON-Datei (Teilen-Menü, z. B. in iCloud Drive sichern),
  - **Import** einer solchen Datei,
  - dezenter Hinweis „Letzte Sicherung vor X Tagen“, wenn länger als 14 Tage nicht exportiert wurde.
- Neue App-Versionen (neue Rezepte) dürfen gespeicherte Pläne **nie** löschen. Wird ein geplantes Rezept umbenannt oder entfernt, zeigt der Planer den Slot als „Rezept nicht mehr vorhanden“ statt abzustürzen. Datenformat hat eine `version` und wird bei Änderungen migriert.
- Optional in einer späteren Phase: Synchronisierung zwischen Geräten (z. B. für Person 2). Vorher mit mir besprechen.

### 8.7 Optional: Plan von Claude prüfen lassen
Wenn ich einen exportierten Plan schicke („Plan prüfen“), legst du ihn unter `daten/wochenplaene/KW-XX-JJJJ.json` ab, prüfst ihn mit `tools/plan_pruefen.py` gegen die Hinweise aus 8.3 und gibst mir kurze Verbesserungsvorschläge. **Du änderst den Plan nicht selbst**, außer ich bitte darum.

---

## 9. Rezepte importieren (Instagram und TikTok)

Ich will Rezepte, die ich auf Instagram oder TikTok finde, ins Rezeptbuch übernehmen.

### 9.1 Eingangswege
1. **Screenshots** (zuverlässigster Weg): Post und Bildunterschrift als Bilder in `import/`. Mehrere Bilder zu einem Rezept mit gleichem Namen und Nummer (`brownie-1.png`, `brownie-2.png`).
2. **Links:** eine Zeile pro Post in `import/links.txt` oder direkt im Chat.
3. **Text:** kopierte Bildunterschrift als `.txt` in `import/` oder direkt im Chat.

### 9.2 Ablauf bei „Import“
1. Alle neuen Dateien und Links durchgehen.
2. Screenshots ansehen und Zutaten, Mengen und Schritte herauslesen.
3. Links abrufen. **Instagram blockiert das oft** (Anmeldung nötig). Wenn es nicht klappt: kurz sagen und um Screenshot oder Text bitten, nicht raten.
4. Ungenaue Angaben umrechnen („1 Scoop“ → 30 g Whey, „1 Cup“ → Gramm je nach Zutat, „1 Dose“ → Abtropfgewicht). Was sich nicht klären lässt, sammeln und am Ende in **einer** Liste nachfragen.
5. Vollständiges Rezept nach Schema 6.4 und Standard 7 bauen, **in eigenen Worten**, an meine Makros angepasst (z. B. Sahne → Skyr oder Frischkäse light, mehr Protein, weniger Öl). Frühstück süß lassen bzw. machen.
6. Prüfen, ob es schon ein sehr ähnliches Rezept gibt. Wenn ja, fragen: Variante im bestehenden Rezept oder eigenes Rezept?
7. Prüfungen laufen lassen, generieren, Dateien nach `import/erledigt/` verschieben, Link in `links.txt` als erledigt markieren.
8. Kurze Zusammenfassung: importierte Rezepte mit kcal und Protein pro Portion, offene Fragen. Neue Rezepte sind nach dem Aktualisieren sofort im Planer auswählbar.

---

## 10. Web-App für Safari (iPhone)

### 10.1 Grundsätze
- **Statische Web-App**, komplett von `tools/generieren.py` aus den YAML-Daten erzeugt. HTML, CSS und Vanilla JavaScript, keine Build-Tools, keine Frameworks, keine externen Abhängigkeiten zur Laufzeit.
- Die App ist ein **Baukasten**: Rezeptdaten kommen fest aus der Generierung, alles Persönliche (Pläne, Vorrat, Haken, Vorlagen) erstelle ich in der App.
- Planer- und Einkaufslogik in **reinen Funktionen** (`web/js/planer.js`), getrennt von der Oberfläche, damit sie testbar ist.
- **Mobile-first**, optimiert für iPhone in Safari. Heller und dunkler Modus (folgt dem System).
- **PWA:** Web-App-Manifest, Icons (180 × 180 Apple Touch Icon, 192 und 512), Service Worker für Offline-Nutzung. Über „Teilen → Zum Home-Bildschirm“ startet sie wie eine App (`display: standalone`). Bei neuer Version: Hinweis „Neue Rezepte verfügbar – neu laden“.
- Große, gut lesbare Schrift, Tap-Flächen mind. 44 × 44 pt.
- Sprache Deutsch, Datumsformat TT.MM.JJJJ, Zeitzone Europe/Berlin, Zahlen mit Komma.
- Untere Tab-Leiste: **Heute · Rezepte · Planer · Einkauf · Mehr** (Vorrat, Vorlagen, Einstellungen, Sicherung).

### 10.2 Ansichten
1. **Heute (Startseite):** Datum, die Mahlzeiten aus meinem aktuellen Plan mit kcal/Protein, Tagesbalken gegen Ziel (kcal, Protein, Fett, KH), Restmakros, Zeitplan, Erinnerungen für morgen, Button „Jetzt kochen“. Ist für heute nichts geplant: Hinweis mit Button „Woche planen“.
2. **Rezeptbuch:** Kacheln oder Liste, **Suche**, **Filter** nach Kategorie, Küche, Mahlzeit, Hauptprotein, Bewertung, max. Zeit; Sortierung nach Name, kcal, Protein, Zeit. Favoriten (Herz, lokal gespeichert).
3. **Rezeptseite:** alle Abschnitte aus Standard 7, Portionsrechner (1–6 Portionen, Mengen skalieren live), Buttons „Kochmodus“, „In Planer eintragen“ (Tag und Slot wählen) und „Für MacroFactor kopieren“.
4. **Kochmodus:** Vollbild, ein Schritt pro Ansicht, sehr große Schrift, Wischen/Tippen für vor und zurück, Zutaten des Schritts mit Mengen eingeblendet (mit dem im Planer gewählten Faktor), **Timer** bei Schritten mit `timer_min` (mit Ton und Vibration, falls möglich; mehrere Timer parallel), **Bildschirm bleibt an** (Screen Wake Lock API, mit stillem Fallback, wenn nicht unterstützt).
5. **Planer:** siehe Abschnitt 8.1–8.4.
6. **Einkaufsliste:** siehe Abschnitt 8.5.
7. **Vorrat:** Zutaten mit Menge und optionalem Haltbarkeitsdatum eintragen (Auswahl aus der Zutatenliste), Reste aus der Einkaufsliste übernehmen.

### 10.3 Export für MacroFactor
MacroFactor kann Rezepte per Link importieren und liest dabei das Standard-Rezeptformat von Websites.
- Jede Rezeptseite enthält **schema.org/Recipe als JSON-LD**: `name`, `recipeYield` („2 Portionen“), `recipeIngredient` (eine Zeile pro Zutat mit Grammangabe, z. B. „250 g Hähnchenbrustfilet roh“), `recipeInstructions` (HowToStep mit Text), `prepTime`/`cookTime`/`totalTime` (ISO 8601), `recipeCategory`, `recipeCuisine`, `nutrition` (NutritionInformation pro Portion: calories, proteinContent, fatContent, saturatedFatContent, carbohydrateContent, sugarContent, fiberContent, sodiumContent).
- Jede Rezeptseite hat eine **eigene, statische URL** (z. B. `rezepte/<id>.html`), damit der Link-Import ohne JavaScript funktioniert.
- Button **„Für MacroFactor kopieren“**: kopiert die Zutatenliste als einfachen Text (eine Zutat pro Zeile, Gramm + konkreter Name) in die Zwischenablage, als Ausweichlösung.
- Hinweis auf jeder Rezeptseite: „Fertiges Gericht wiegen und als Gesamtgewicht in MacroFactor eintragen, dann kannst du nach Gramm loggen.“ Mit dem geschätzten Gargewicht als Orientierung.
- Der Link-Import funktioniert nur, wenn die Web-App **öffentlich erreichbar** ist (Abschnitt 10.4).

### 10.4 Veröffentlichung
- Vorschlag: **GitHub Pages** (kostenlos), Veröffentlichung des Ordners `web/`.
- **Vorher fragen, ob die Seite öffentlich sein darf.** Veröffentlicht werden nur Rezepte und die leere App. Meine Pläne, mein Vorrat und meine Einkaufslisten liegen nur in meinem Browser und werden **nicht** veröffentlicht.
- Jeden Schritt, den ich selbst auf GitHub machen muss, genau erklären (Repository anlegen, Pages aktivieren, URL).

---

## 11. Zusatzfunktionen

### 11.1 Kühlschrank-Modus
- **In der App:** Zutaten auswählen (z. B. Hähnchen, Reis, Skyr) → passende Rezepte aus dem Rezeptbuch, sortiert danach, wie viele der Zutaten sie nutzen und wie wenig fehlt. Mit Faktor-Vorschlag passend zu meinen Restmakros des Tages.
- **Im Chat** („Kühlschrank: Hähnchen, Reis, Skyr …“): 2–3 Gerichte vorschlagen, erst aus dem Rezeptbuch, sonst neue. Fragen, was ich heute schon gegessen habe, und die Portion an meine restlichen Makros anpassen. Fehlende Zutaten max. 1–2 Basics, klar markiert. Gefällt mir ein neues Gericht, kommt es ins Rezeptbuch.

### 11.2 Bewertungen („bewerten [Rezept] [1–5 Sterne] [Kommentar]“)
- Sterne, Kommentar und Datum ins Rezept-YAML schreiben, neu generieren.
- Einfluss auf den Planer: siehe 8.3.
- Kommentare umsetzen: z. B. „zu trocken“ → Rezept anpassen (mehr Sauce, kürzere Garzeit) und mir die Änderung zeigen. „zu wenig süß“ → Süße erhöhen, Makros neu rechnen.
- 1–2 Sterne: Rezept bleibt erhalten, wird im Inhaltsverzeichnis als „aussortiert“ markiert und in der Planer-Auswahl standardmäßig ausgeblendet.
- Optional: In der App kann ich nach dem Kochen schnell Sterne vergeben (lokal gespeichert); beim Export sind sie dabei, damit du sie ins YAML übernehmen kannst.

### 11.3 Neue Rezepte und Anpassungen
- **„neue Rezepte“:** Kategorien per Ja/Nein und Küchen abfragen, dann 3–5 Rezepte.
- **„Küche: Italienisch“:** 3–5 neue Rezepte dieser Küche.
- **„anpassen [Rezept]“:** z. B. mehr Protein, weniger Fett, ohne Ofen; Nährwerte neu rechnen, Unterschied zeigen.
- **„trending“:** per Websuche aktuelle High-Protein-Trends von TikTok/Instagram suchen und 5 Ideen vorschlagen, die zu meinen Vorlieben passen.
- Neue Rezepte über die 100 hinaus sind erlaubt; die Verteilungsregeln aus 5.1–5.3 gelten nur für den Startbestand.

---

## 12. Prüfungen und Tests (pytest + Playwright)

### 12.1 Prüfungen pro Rezept (`tools/pruefen.py`, laufen vor jedem Generieren)
- Alle Zutaten existieren in `zutaten.csv` und `packungen.csv`.
- **Plausibilität:** 4 × Protein + 4 × KH + 9 × Fett + 2 × Ballaststoffe weicht max. ±5 % von den kcal ab (pro Zutat und pro Rezept).
- Jede Zutat wird mindestens einmal im Text verwendet; jeder Platzhalter verweist auf eine existierende Zutat.
- Zielwerte der Mahlzeit aus Abschnitt 3 eingehalten.
- Hauptkategorie erfüllt ihr Kriterium; berechnete Kategorien stimmen.
- Frühstück hat `geschmack: süß` (Warnung statt Fehler, wenn bewusst herzhaft).
- Zucker pro Frühstücksportion max. 20 g (Warnung).
- Schritte mit Fleisch oder Fisch enthalten eine Kerntemperatur oder Garprobe.
- Ofenschritte enthalten Temperatur und Modus.
- Pflichtfelder vorhanden (inkl. `hauptprotein`, `restetauglich`), `id` eindeutig, Dateiname = `id`.
- Extras aus `extras.yaml` sind berechenbar.

### 12.2 Tests
Mindestens diese Szenarien:

**Rezepte und Bestand (pytest)**
- Nährwertberechnung für ein Testrezept mit bekannten Werten (inkl. Rundung)
- Plausibilitätscheck schlägt bei einer manipulierten Zutat an
- Platzhalter-Ersetzung: `{id}` und `{id:n}`, Stückangaben, „1 Prise“
- Kategorien: Grenzfälle (genau 25 min, genau 550 kcal, genau 40 g Protein, 10 g pro 100 kcal)
- Bestand: genau 100 Rezepte, Verteilung aus 5.1 und 5.2, Mindestwerte aus 5.3, max. ca. 130 Zutaten
- JSON-LD jeder Rezeptseite ist gültiges JSON und enthält alle Felder aus 10.3
- Generierte Markdown-Dateien enthalten alle Abschnitte aus Standard 7 in der richtigen Reihenfolge
- `rezepte.json` enthält für jedes Rezept dieselben Nährwerte wie die Markdown-Datei

**Planer-Logik (`planer.js`, per Playwright mit Testplänen ausgeführt)**
- Tagessumme mit Faktor (z. B. 1,25) skaliert Mengen und Makros korrekt
- Auswärts-Platzhalter wird korrekt gerechnet und erzeugt keine Zutaten
- Reste (`art: rest`) erzeugen keine Zutaten; doppelt gekochtes Rezept zählt doppelt
- Hinweise aus 8.3 erscheinen bei passenden Testplänen: Protein unter 145 g, Fett unter 70 g, gleiche Küche/Proteinquelle abends hintereinander, 1–2-Sterne-Rezept, Fisch/Hack später als 2 Tage nach Einkauf, Rest älter als erlaubt, Rest ohne ausreichend gekochte Portionen
- Erinnerungen für morgen enthalten `vortag`-Texte und Auftau-Hinweise
- Einkaufsliste: Kontrollrechnung (Summe Rezeptmengen = Liste + Vorrat), Aufrundung auf Packungen, Vorratsabzug, Sortierung nach Abteilungen, Aufteilung auf zwei Einkaufstermine, Reste nach der Woche korrekt
- Export → Import ergibt identischen Plan; Plan mit unbekannter Rezept-ID führt nicht zum Absturz; Plan im alten Format wird migriert
- Eine neue App-Version (zusätzliches Rezept) lässt bestehende gespeicherte Pläne unverändert

**Oberfläche (Playwright, Viewport 390 × 844)**
- Jede Seite lädt ohne JavaScript-Fehler
- Rezept über Rezeptauswahl in einen Slot eintragen, Tagesbalken aktualisiert sich
- Einkaufsliste merkt sich Haken nach Neuladen
- Kochmodus zeigt Schritt 1 bis n, Timer startet
- App funktioniert offline nach dem ersten Laden (Service Worker)

---

## 13. Vorgehen

Arbeite in diesen Phasen. Beginne jede Phase im **Plan-Modus**, warte auf mein OK, prüfe am Ende Prüfungen und Tests, aktualisiere die Fortschrittsliste in der `CLAUDE.md` und schlage einen Git-Commit vor.

1. **Planung und Onboarding:**
   - Frag mich: Küchenausstattung (Ofen, Airfryer, Mixer, Waffeleisen, Reiskocher …), Supermarkt(e), Wochenbudget (optional), bevorzugte Einkaufstage, übliche Essenszeiten, ob die Web-App öffentlich sein darf.
   - Beschreibe Datenmodell, Ordnerstruktur, Skripte und den Aufbau der App (Baukasten-Prinzip, Speicherung). Noch keine Rezepte.
   - `CLAUDE.md` mit Arbeitsregeln (Kurzfassung dieser SPEC), Befehlen (Abschnitt 14) und Fortschrittsliste anlegen. `daten/profil.yaml` anlegen. Git einrichten.
2. **Grundlagen:** `zutaten.csv` (Startbestand), `packungen.csv`, `extras.yaml`, `config.py`, `naehrwerte.py`, `pruefen.py`, `generieren.py` (nur Markdown) mit Tests. Zwei Beispielrezepte (1 süßes Frühstück, 1 Hauptgericht) zur Abnahme durch mich: Passt Stil und Ausführlichkeit?
3. **Rezeptliste:** `rezeptplan.md` mit allen 100 Gerichten (Name, Bereich, Küche, Hauptprotein, Ziel-kcal, schnell/Meal Prep/restetauglich, Inspiration ja/nein) und Abgleich gegen 5.1 bis 5.3. **Warte auf mein OK**, ich tausche ggf. einzelne Gerichte.
4. **Rezepte schreiben:** **10 Runden à 10 Rezepten.** Nach jeder Runde: Prüfungen, Generieren, `rezeptbuch.md` aktualisieren, Einzeiler zum Fortschritt („Runde 4/10: 40 Rezepte, alle Prüfungen bestanden“). Verfehlt ein Rezept die Zielwerte: Mengen anpassen, nicht die Zielwerte. Nach Runde 5 kurzer Zwischenstand (Verteilung bisher, Zutatenzahl), damit ich gegensteuern kann. Am Ende: Übersicht (Anzahl pro Kategorie und Küche gegen Vorgabe, Durchschnittsmakros pro Mahlzeit, ein Beispieltag, der meine Ziele trifft, als Anregung für meine eigene Planung).
5. **Web-App Teil 1 – Rezeptbuch:** Heute (vorerst ohne Plan), Rezeptbuch, Rezeptseite, Kochmodus, JSON-LD, MacroFactor-Button, PWA. Teste selbst im iPhone-Format mit Playwright und zeig mir Screenshots von Rezeptbuch, Rezeptseite und Kochmodus.
6. **Web-App Teil 2 – Baukasten:** Planer (8.1–8.4), Einkaufsliste (8.5), Vorrat, Speicherung mit Export/Import (8.6), `planer.js` mit Tests. Danach plane ich **selbst** eine Testwoche in der App; du schaust dir mit mir an, ob Bedienung, Hinweise und Einkaufsliste passen, und passt die App an. Screenshots von Heute, Planer, Tagesansicht und Einkaufsliste.
7. **Import und Komfort:** Import (Abschnitt 9) mit einem Test-Screenshot, Kühlschrank-Modus (App und Chat), Bewertungen, optional `plan_pruefen.py`.
8. **Livegang:** GitHub Pages einrichten (Schritt für Schritt erklären), MacroFactor-Import mit einem Rezept gemeinsam testen, App zum Home-Bildschirm hinzufügen, README mit Anleitung für den Alltag (inkl. Sicherung meiner Pläne).

---

## 14. Befehle im Alltag (nach dem Aufbau)

Die Wochenplanung mache ich in der App. Im Chat mit dir gelten diese Befehle:

| Befehl | Was passiert |
|---|---|
| **Import** | alles Neue aus `import/` übernehmen (Abschnitt 9) |
| **Import: [Link oder Text]** | einzelnes Rezept direkt aus dem Chat übernehmen |
| **Kühlschrank: [Zutaten]** | Kühlschrank-Modus im Chat (11.1) |
| **bewerten [Rezept] [Sterne] [Kommentar]** | Bewertung speichern (11.2) |
| **neue Rezepte** / **Küche: [Name]** / **trending** | neue Rezepte (11.3) |
| **anpassen [Rezept]** | Rezept ändern, Nährwerte neu rechnen |
| **Extra: [Name, Zutaten]** | neues Extra für den Planer anlegen |
| **Ziele: [kcal, P, F, KH]** | neue Makroziele aus MacroFactor übernehmen, App neu generieren |
| **Plan prüfen** + Exportdatei | Plan gegen die Hinweise prüfen und Vorschläge machen, ohne ihn zu ändern (8.7) |
| **App-Wunsch: [Beschreibung]** | neue Funktion oder Änderung am Baukasten umsetzen (Plan-Modus, Tests) |
| **Web-App aktualisieren** | prüfen, generieren, veröffentlichen |

Nach jeder Änderung an Daten: `pruefen.py`, `generieren.py`, Tests, bei Bedarf veröffentlichen.

---

## 15. Hinweis

In der README und im Footer der Web-App: Nährwerte sind berechnete Schätzwerte auf Basis von Durchschnittswerten und können je nach Produkt abweichen. Die Hinweise im Planer sind Orientierung und ersetzen keine Ernährungs- oder ärztliche Beratung.
