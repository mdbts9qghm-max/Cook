"""Erzeugt den neutralen Test-Screenshot für den Import (SPEC 13, Phase 7) – ohne echte Marke oder echten Account.

Aufruf: python3 tests/daten/test_screenshot_erzeugen.py <ziel.png>
"""
import sys

from PIL import Image, ImageDraw, ImageFont

TEXT = """Lemon Blueberry Protein Mug Cake
ready in 5 minutes - tastes like dessert!

1 scoop vanilla protein powder
1/4 cup oat flour
1 egg
1/2 tsp baking powder
3 tbsp greek yogurt
2 tbsp milk
juice of 1/2 lemon + a little zest
a handful of blueberries

Mix everything in a big mug,
microwave for 90 seconds.
Let it cool 1 min, top with 2 tbsp
greek yogurt and a drizzle of honey.

per mug: 390 kcal - 38 g protein
#proteinbaking #mugcake #highprotein"""


def main(ziel: str) -> None:
    w, h = 1170, 2100
    img = Image.new("RGB", (w, h), (250, 250, 250))
    d = ImageDraw.Draw(img)
    fett = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52)
    normal = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 44)
    klein = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
    # „Video“-Fläche mit Tasse
    d.rectangle([0, 0, w, 760], fill=(232, 222, 205))
    d.ellipse([420, 260, 750, 330], fill=(255, 255, 255), outline=(180, 170, 150), width=6)
    d.rectangle([430, 295, 740, 600], fill=(255, 255, 255), outline=(180, 170, 150), width=6)
    d.arc([700, 360, 820, 500], -90, 90, fill=(180, 170, 150), width=14)
    for x, y in [(480, 300), (560, 290), (650, 305), (600, 315)]:
        d.ellipse([x, y, x + 28, y + 28], fill=(70, 80, 160))
    d.text((40, 690), "1:24 / 1:30", font=klein, fill=(90, 80, 70))
    # Kontozeile (neutral)
    d.ellipse([40, 800, 130, 890], fill=(200, 120, 90))
    d.text((150, 818), "home.kitchen.test", font=klein, fill=(30, 30, 30))
    y = 930
    for i, zeile in enumerate(TEXT.splitlines()):
        f = fett if i == 0 else normal
        d.text((40, y), zeile, font=f, fill=(25, 25, 25) if not zeile.startswith("#") else (40, 90, 170))
        y += 62 if i == 0 else 56
    img.save(ziel)


if __name__ == "__main__":
    main(sys.argv[1])
