# CLAUDE.md – Arbeitsregeln für das Rezeptbuch-Projekt

Vollständige Vorgabe: **`SPEC.md`** (bei Unklarheit dort nachlesen, bei Widerspruch nachfragen statt raten).

## Kurzfassung der Regeln

**Aufgabenteilung:** Claude entwickelt Rezepte, rechnet Nährwerte, prüft, baut die App. Die App ist ein Baukasten (Rezeptbuch, Planer, Live-Makros, Einkaufsliste, Kochmodus). **Der Nutzer plant selbst – Claude erstellt keine Wochenpläne** und ändert exportierte Pläne nicht ungefragt.

**Profil:** `daten/profil.yaml` (Ziele 2.275 kcal · 149 g P · 101 g F · 191 g KH; 2 Portionen pro Rezept, Nährwerte pro Portion). Ausstattung: Herd, Ofen, Airfryer, Mixer/Pürierstab, Waffeleisen (kein Reiskocher). Rewe/Edeka, Budget 100 €/Woche, Einkauf Sa (1×), Essenszeiten 8:00/13:00/19:00. App darf öffentlich (GitHub Pages).

**Rezept-Regeln (hart):**
- Frühstück immer **süß**, proteinreich, max. 20 g Zucker/Portion. Wenig Gemüse. Supermarkt-Zutaten. Geschmack zählt.
- Korridore pro Portion: Frühstück 500–650 kcal/≥35 g P · Hauptgericht 600–850/≥45 g · Kalorienarm ≤550/≥35 g · Snack 200–350/≥20 g.
- Verfehlt ein Rezept die Zielwerte: **Mengen anpassen, nicht die Zielwerte.**
- Rezepte sind **YAML** (`daten/rezepte/<id>.yaml`, Schema SPEC 6.4) = Single Source of Truth. Markdown und App werden generiert, **nie von Hand bearbeiten**.
- Mengen in Texten nur über Platzhalter `{id}` / `{id:n}`. Jede Zutat kommt im Text vor.
- Exakte Mengen für alles; Öl/Butter/Saucen voll mitzählen; Kochwasser-Salz nennen, „nicht mitgerechnet“.
- Kerntemperaturen: Geflügel 74 °C, Hack 72 °C, Schweinefilet 63 °C, Lachs 50–55 °C glasig / 60 °C durch; Schmorgerichte Gabelprobe.
- Herdstufe (x von 9), Ofen Temperatur + Modus (O/U und Umluft), Pfannengröße, Zeit, Garzeichen in jedem Schritt.
- Meal Prep: Fisch/Garnelen max. 2 Tage, sonst 3–4 Tage. Reis binnen 1 h kühlen.
- 12 Abschnitte in fester Reihenfolge (SPEC 7). Inspiration (TikTok/Instagram) nur in eigenen Worten, Feld `inspiration`.
- Kategorien High Protein / Schnell / Kalorienarm berechnet das Skript; nur Meal Prep manuell.
- Zutaten möglichst wiederverwenden (Ziel ≤ ca. 130 in `zutaten.csv`).

**Ergänzungen zum Schema (SPEC 6.4), in Phase 2 festgelegt:**
- Zutat-Felder: `zutat` = exakter Name aus `zutaten.csv` (Tabelle, Einkaufsliste) · `name` = optionaler Name im Fließtext · `anzeige` = vollständige Stück-/Löffelangabe inkl. Name („2 Eier Gr. M“, „1 Prise Salz“) → im Text „2 Eier Gr. M (120 g)“ · `mitrechnen: false` = z. B. Kochwasser-Salz (angezeigt, nicht gezählt).
- Reservierte Platzhalter: `{portion_g}` / `{gesamt_g}` = Fertiggewicht pro Portion / gesamt (für „Anrichten“).
- `aufbewahrung.separat` (optional): was getrennt gelagert wird. Snacks: `ohne_kochen: true`, wenn weder gekocht noch gebacken wird (SPEC 5.1).
- `packungen.csv`: zusätzliche optionale Spalte `tk_alternative` (Planer-Vorschlag „TK kaufen“); `packung_g = 0` → wird nicht eingekauft (Wasser).
- Hauptgerichte zwischen 551 und 599 kcal erfüllen keinen Korridor → Mengen anpassen.
- Plausibilität: ±5 % oder max. 3 kcal/100 g absolut (für energiearme Zutaten), siehe `tools/config.py`.

**Web-App:** statisch, Vanilla HTML/CSS/JS, keine Frameworks/Build-Tools, PWA, mobile-first (iPhone Safari), hell/dunkel, Deutsch (TT.MM.JJJJ, Komma). Logik in reinen Funktionen (`web/js/planer.js`). Persönliche Daten nur im Browser (try/catch), Export/Import JSON, Format versioniert + migriert, unbekannte Rezept-IDs dürfen nichts crashen. JSON-LD schema.org/Recipe pro statischer Rezeptseite (MacroFactor).

**Vorgehen:** Phasen aus SPEC 13. Jede Phase im Plan-Modus beginnen, auf OK warten, am Ende Prüfungen + Tests, Fortschrittsliste unten aktualisieren, Git-Commit vorschlagen.

## Befehle

Technisch (nach jeder Datenänderung in dieser Reihenfolge):
```bash
python3 tools/pruefen.py        # alle Prüfungen SPEC 12.1
python3 tools/generieren.py     # Markdown, rezeptbuch.md, web/
python3 -m pytest tests/        # pytest + Playwright
```

Im Chat (SPEC 14): **Import** · **Import: [Link/Text]** · **Kühlschrank: [Zutaten]** · **bewerten [Rezept] [Sterne] [Kommentar]** · **neue Rezepte** / **Küche: [Name]** / **trending** · **anpassen [Rezept]** · **Extra: [Name, Zutaten]** · **Ziele: [kcal, P, F, KH]** · **Plan prüfen** + Datei · **App-Wunsch: [Beschreibung]** · **Web-App aktualisieren**

## Fortschritt

- [x] **Phase 1 – Planung & Onboarding:** Onboarding-Fragen beantwortet, `SPEC.md`, `CLAUDE.md`, `daten/profil.yaml`, Ordnerstruktur angelegt (01.11.2026)
- [x] **Phase 2 – Grundlagen:** zutaten.csv (123 Zutaten), packungen.csv, extras.yaml (12), config.py, naehrwerte.py, texte.py, pruefen.py, generieren.py (Markdown), Tests, 2 Beispielrezepte – vom Nutzer abgenommen (02.11.2026)
- [x] **Phase 3 – Rezeptliste:** `daten/rezeptplan.yaml` → `rezeptplan.md` (100 Gerichte, `python3 tools/rezeptplan.py`), vom Nutzer freigegeben (02.11.2026)
- [ ] **Phase 4 – Rezepte schreiben:** 10 Runden à 10 – Runde 2 ✅ (20/100; Runde = 3 Frühstücke, 1 Snack, 6 Hauptgerichte laut Spalte „Rd.“ in rezeptplan.md). Varianten-Makros mit `python3 tools/variante.py "Zutat:+g"` rechnen.
- [ ] **Phase 5 – Web-App Teil 1:** Heute, Rezeptbuch, Rezeptseite, Kochmodus, JSON-LD, MacroFactor-Button, PWA
- [ ] **Phase 6 – Web-App Teil 2:** Planer, Einkaufsliste, Vorrat, Speicherung, planer.js-Tests, Testwoche
- [ ] **Phase 7 – Import & Komfort:** Import, Kühlschrank-Modus, Bewertungen, plan_pruefen.py
- [ ] **Phase 8 – Livegang:** GitHub Pages, MacroFactor-Test, Home-Bildschirm, README
