"""Build the self-hosted font files in src/app/fonts/ from the upstream sources.

Why the fonts live in the repo
------------------------------
`next/font/google` downloads fonts from Google at build time. Google
intermittently answers with a `fonts.gstatic.com/l/font?kit=…&skey=…` address
that Next 16's Turbopack cannot resolve, and the page then fails with a 500 —
locally and, worse, in a deploy build. Committed font files make every build
independent of Google, and keep the CSP at `font-src 'self'`.

What this does
--------------
Takes the upstream TTFs from the google/fonts repository (SIL Open Font
License 1.1, licence texts kept beside the output) and writes one woff2 per
face, cut to the character ranges the app uses — the same ranges Google serves
as its `latin`, `latin-ext` and `devanagari` subsets. Variable fonts keep
their weight axis (narrowed to the weights the UI uses) and are pinned to the
default width.

Usage (needs `pip install fonttools brotli`):

    python scripts/build-fonts.py <folder with the upstream files>

Upstream files, from https://github.com/google/fonts/tree/main/ofl :
    instrumentsans/InstrumentSans[wdth,wght].ttf  -> InstrumentSans.ttf
    dmmono/DMMono-Regular.ttf, dmmono/DMMono-Medium.ttf
    notosansdevanagari/NotoSansDevanagari[wdth,wght].ttf -> NotoSansDevanagari.ttf
    and each family's OFL.txt -> OFL-<Family>.txt
"""

from __future__ import annotations

import io
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = Path(__file__).resolve().parent.parent / "src" / "app" / "fonts"

# Google Fonts' own subset ranges.
LATIN = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,"
    "U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,"
    "U+FEFF,U+FFFD"
)
# Includes U+20B9, the rupee sign, which money in `.tabular` needs.
LATIN_EXT = (
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,"
    "U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,"
    "U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
)
DEVANAGARI = (
    "U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,"
    "U+A830-A839,U+A8E0-A8FF,U+11B00-11B09"
)

# (source file, output name, unicode ranges, variable-axis limits or None)
FACES = [
    ("InstrumentSans.ttf", "InstrumentSans.woff2", f"{LATIN},{LATIN_EXT}", {"wdth": 100, "wght": (400, 600)}),
    ("DMMono-Regular.ttf", "DMMono-Regular.woff2", f"{LATIN},{LATIN_EXT}", None),
    ("DMMono-Medium.ttf", "DMMono-Medium.woff2", f"{LATIN},{LATIN_EXT}", None),
    (
        "NotoSansDevanagari.ttf",
        "NotoSansDevanagari.woff2",
        f"{DEVANAGARI},U+0000-007F",
        {"wdth": 100, "wght": (400, 600)},
    ),
]

LICENCES = ["OFL-InstrumentSans.txt", "OFL-DMMono.txt", "OFL-NotoSansDevanagari.txt"]


def build(source: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for src_name, out_name, ranges, axes in FACES:
        font = TTFont(source / src_name)
        if axes:
            font = instancer.instantiateVariableFont(font, axes)
            # Round-trip before subsetting: the instancer leaves lazily loaded
            # glyph variations that the subsetter cannot index.
            buffer = io.BytesIO()
            font.save(buffer)
            buffer.seek(0)
            font = TTFont(buffer)

        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]  # keep kerning, ligatures and Devanagari shaping
        options.name_IDs = ["*"]
        options.notdef_outline = True
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=subset.parse_unicodes(ranges))
        subsetter.subset(font)

        target = OUT / out_name
        font.flavor = "woff2"
        font.save(target)
        print(f"{out_name}: {target.stat().st_size / 1024:.0f} KB")

    for licence in LICENCES:
        shutil.copyfile(source / licence, OUT / licence)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    build(Path(sys.argv[1]))
