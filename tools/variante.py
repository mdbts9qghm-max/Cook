"""Makro-Änderung einer Variante pro Portion berechnen (für „Varianten & Austausch“).

Aufruf:  python3 tools/variante.py "Skyr natur:+100" "Erdnussmus:-20"
         → Änderung pro Portion (Rezept = 2 Portionen) in kcal und g Protein/Fett/KH/Zucker
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402
import naehrwerte as N  # noqa: E402


def delta(aenderungen: list[tuple[str, float]], zutaten: dict) -> dict:
    d = N.leer()
    for zutat, g in aenderungen:
        d = N.addiere(d, N.werte_menge(zutaten, zutat, g))
    return N.skaliere(d, 1 / C.PORTIONEN)


def main(argv):
    zutaten = N.lade_zutaten()
    aend = []
    for a in argv:
        name, g = a.rsplit(":", 1)
        aend.append((name, float(g)))
    d = delta(aend, zutaten)
    print(f"pro Portion: {d['kcal']:+.0f} kcal, {d['protein']:+.1f} g Protein, {d['fett']:+.1f} g Fett, "
          f"{d['kh']:+.1f} g KH, {d['zucker']:+.1f} g Zucker")


if __name__ == "__main__":
    main(sys.argv[1:])
