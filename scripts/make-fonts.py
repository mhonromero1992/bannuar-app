"""
Cuts the app's fonts from Archivo, the variable font the website and portal use (SIL Open Font
License 1.1, The Archivo Project Authors, https://github.com/Omnibus-Type/Archivo).

    curl -L -o /tmp/Archivo-VF.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf"
    pip install fonttools
    python3 scripts/make-fonts.py /tmp/Archivo-VF.ttf src/assets/fonts

Five static files, each named after its PostScript name so `fontFamily` is the same on Android
(assets/fonts/<name>.ttf) and iOS. Subset to Latin, Latin Extended-A, punctuation and the peso sign.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

SRC, OUT = sys.argv[1], sys.argv[2]
# name, family, style, weight class, axes (the website: body 420, display 760 at 118% width, labels 640 at 72%)
CUTS = [
    ('Archivo-Regular', 'Archivo', 'Regular', 400, {'wght': 420, 'wdth': 100}),
    ('Archivo-SemiBold', 'Archivo SemiBold', 'Regular', 600, {'wght': 620, 'wdth': 100}),
    ('Archivo-Bold', 'Archivo Bold', 'Regular', 700, {'wght': 720, 'wdth': 100}),
    ('ArchivoExpanded-Bold', 'Archivo Expanded Bold', 'Regular', 760, {'wght': 760, 'wdth': 118}),
    ('ArchivoCondensed-SemiBold', 'Archivo Condensed SemiBold', 'Regular', 640, {'wght': 640, 'wdth': 72}),
]
UNICODES = (list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + list(range(0x2010, 0x203B))
            + [0x20B1, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2713, 0xFFFD])

for ps, family, style, weight, axes in CUTS:
    font = TTFont(SRC)
    font = instancer.instantiateVariableFont(font, axes, updateFontNames=False)
    opts = subset.Options()
    opts.layout_features = ['kern', 'liga', 'calt', 'tnum', 'lnum', 'case', 'ccmp', 'locl', 'mark', 'mkmk']
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    name = font['name']
    for rec in list(name.names):
        if rec.nameID in (16, 17, 25):
            name.removeNames(nameID=rec.nameID)
    name.setName(family, 1, 3, 1, 0x409)
    name.setName(style, 2, 3, 1, 0x409)
    name.setName(f'{family} {style}'.replace(' Regular', '') if style == 'Regular' and family != 'Archivo' else f'{family} {style}', 4, 3, 1, 0x409)
    name.setName(ps, 6, 3, 1, 0x409)
    name.setName(f'{ps};Bannuar app cut', 3, 3, 1, 0x409)
    font['OS/2'].usWeightClass = min(weight, 900)
    font['OS/2'].fsSelection = (font['OS/2'].fsSelection & ~0b1100001) | 0b1000000  # REGULAR bit only
    font['head'].macStyle = 0
    if 'STAT' in font:
        del font['STAT']
    if 'DSIG' in font:
        del font['DSIG']
    font.save(f'{OUT}/{ps}.ttf')
    print(ps, round(len(open(f'{OUT}/{ps}.ttf', 'rb').read()) / 1024), 'KB')
