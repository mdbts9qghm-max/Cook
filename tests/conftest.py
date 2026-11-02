import copy
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import naehrwerte as N  # noqa: E402


@pytest.fixture(scope="session")
def zutaten():
    return N.lade_zutaten()


@pytest.fixture(scope="session")
def packungen():
    return N.lade_packungen()


@pytest.fixture(scope="session")
def rezepte():
    return N.lade_rezepte()


@pytest.fixture
def mini_zutaten():
    """Kleine Test-Datenbank mit runden, bekannten Werten (pro 100 g)."""
    def z(kcal, p, f, kh, bst=0.0, zucker=0.0, salz=0.0, gar=1.0, ges=0.0):
        return {"kcal": kcal, "protein": p, "fett": f, "gesaettigt": ges, "kh": kh, "zucker": zucker,
                "ballaststoffe": bst, "salz": salz, "garfaktor": gar}
    return {
        "Testquark": z(50, 10.0, 0.0, 2.5, zucker=2.5, salz=0.1),     # 4·10 + 4·2,5 = 50
        "Testhafer": z(370, 13.0, 7.0, 59.0, bst=10.0),                 # 52+63+236+20 = 371
        "Testöl": z(900, 0, 100.0, 0),
        "Testsalz": z(0, 0, 0, 0, salz=100.0),
        "Testhuhn": z(100, 25.0, 0, 0, gar=0.75),
        "Wasser": z(0, 0, 0, 0, gar=0.0),
    }


@pytest.fixture
def basis_rezept():
    """Minimal gültiges Rezept-Gerüst für Prüf-Tests (wird pro Test verändert)."""
    return copy.deepcopy({
        "id": "test-rezept", "name": "Testrezept", "hauptkategorie": "high-protein",
        "kategorien_manuell": [], "mahlzeit": "Mittag/Abend", "geschmack": "herzhaft",
        "kueche": "Deutsch", "hauptprotein": "Hähnchen", "schwierigkeit": "leicht",
        "zeit": {"vorbereitung": 5, "kochen": 15, "wartezeit": 0},
        "ausstattung": ["Pfanne (28 cm)"], "restetauglich": True, "vortag": [],
        "zutaten": [
            {"id": "huhn", "zutat": "Hähnchenbrustfilet roh", "g": 500},
            {"id": "reis", "zutat": "Basmatireis ungekocht", "g": 180},
            {"id": "oel", "zutat": "Olivenöl", "g": 10},
        ],
        "mise_en_place": ["{reis} abwiegen."],
        "schritte": [
            {"titel": "Braten", "text": "{oel} in der Pfanne (28 cm) auf Stufe 7 von 9 erhitzen, {huhn} 6 Minuten "
                                         "braten bis zur Kerntemperatur 74 °C.", "timer_min": 6},
        ],
        "zeitablauf": [], "fehler": ["a", "b"], "anrichten": "Anrichten.",
        "aufbewahrung": {"kuehlschrank_tage": 3, "einfrierbar": False, "aufwaermen": "Mikrowelle"},
        "varianten": ["a", "b"], "tipps": ["a"],
    })
