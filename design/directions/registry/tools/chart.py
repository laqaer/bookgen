"""Draw the Registry mockup's chart specimens as SVG from the real Victoria GEDCOM.

    python3 tools/chart.py        # writes charts/*.svg and inlines them into index.html

Every chart on the page is computed from web/src/samples/victoria.ged (Wikidata, CC0).
Text widths are measured from the actual font files so names are fitted, not guessed.
"""
import math, re, html
from collections import Counter
from pathlib import Path
from fontTools.ttLib import TTFont
from ged import load, ahnentafel, year

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
FONTS = ROOT / 'fonts'
OUT = ROOT / 'charts'


class Meter:
    def __init__(self, file):
        f = TTFont(FONTS / file)
        self.cmap, self.hmtx, self.upm = f.getBestCmap(), f['hmtx'], f['head'].unitsPerEm
        self.dflt = self.hmtx[self.cmap[ord('n')]][0]

    def w(self, s, size, track=0.0):
        t = sum(self.hmtx[self.cmap[ord(c)]][0] if ord(c) in self.cmap else self.dflt for c in s)
        return t / self.upm * size + track * size * max(len(s) - 1, 0)


FACES = {
    'corm': ("'Cormorant Garamond'", 600, Meter('CormorantGaramond-600.woff2')),
    'ebg': ("'EB Garamond'", 400, Meter('EBGaramond-400.woff2')),
    'ebg6': ("'EB Garamond'", 600, Meter('EBGaramond-600.woff2')),
    'inter': ("'Inter'", 400, Meter('Inter-400.woff2')),
    'mono': ("'Courier Prime'", 400, Meter('CourierPrime-400.woff2')),
}

PREFIX = re.compile(r'^(Prince|Princess|Duke|Duchess|Count|Countess|Margrave|Landgrave)\s+')


def ladder(name):
    """Longest-to-shortest display forms (brief §4.3 abbreviation ladder, adapted to royal styles)."""
    c = [name]
    s = PREFIX.sub('', name)
    c.append(s)
    if ',' in s:
        head, tail = s.split(',', 1)
        c.append(head + ',' + tail.split(' and ')[0])
        c.append(head)
        s = head
    m = re.match(r'^(.*?)\s+(?:Gräfin\s+|Graf\s+)?(?:of|von|zu|de)\s+', s)
    if m:
        c.append(m.group(1))
    parts = s.split()
    if len(parts) > 2:
        c.append(parts[0] + ' ' + ' '.join(p[0] + '.' for p in parts[1:-1]) + ' ' + parts[-1])
    c.append(parts[0])
    seen, out = set(), []
    for x in c:
        x = x.strip(' ,')
        if x and x not in seen:
            seen.add(x); out.append(x)
    return out


def dates(p):
    b, d = year(p.get('birt_date')), year(p.get('deat_date'))
    if b and d: return f'{b}–{d}'
    if b: return f'b. {b}'
    if d: return f'd. {d}'
    return ''


def fit(name, face, size, avail, min_size):
    """Pick the longest ladder form that fits at `size`; else shrink toward min_size."""
    m = FACES[face][2]
    forms = ladder(name)
    for f in forms:
        s = min(size, avail / m.w(f, 1))
        if s >= max(size * 0.8, min_size):
            return f, s
    for f in forms:
        s = avail / m.w(f, 1)
        if s >= min_size:
            return f, s
    f = forms[-1]
    return f, max(min(size, avail / m.w(f, 1)), min_size * 0.8)


def pt(cx, cy, r, th):
    a = math.radians(th)
    return cx + r * math.sin(a), cy - r * math.cos(a)


def f1(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def wedge(cx, cy, r0, r1, a0, a1):
    large = 1 if a1 - a0 > 180 else 0
    x0, y0 = pt(cx, cy, r1, a0); x1, y1 = pt(cx, cy, r1, a1)
    x2, y2 = pt(cx, cy, r0, a1); x3, y3 = pt(cx, cy, r0, a0)
    return (f'M{f1(x0)} {f1(y0)}A{f1(r1)} {f1(r1)} 0 {large} 1 {f1(x1)} {f1(y1)}'
            f'L{f1(x2)} {f1(y2)}A{f1(r0)} {f1(r0)} 0 {large} 0 {f1(x3)} {f1(y3)}Z')


def arc(cx, cy, r, a0, a1, rev):
    large = 1 if a1 - a0 > 180 else 0
    if rev:
        (xs, ys), (xe, ye), sw = pt(cx, cy, r, a1), pt(cx, cy, r, a0), 0
    else:
        (xs, ys), (xe, ye), sw = pt(cx, cy, r, a0), pt(cx, cy, r, a1), 1
    return f'M{f1(xs)} {f1(ys)}A{f1(r)} {f1(r)} 0 {large} {sw} {f1(xe)} {f1(ye)}'


def esc(s):
    return html.escape(s, quote=True)


def norm(a):
    return ((a + 180) % 360) - 180


# ---------------------------------------------------------------- fan engine
def fan(uid, people, cx, cy, R, span, start, rings, st, curved=3, order=None, colour=None, anim=False):
    """people: {ahnentafel n: person}; R[0] medallion radius, R[k] outer radius of ring k.
    rings[k] = (name_face, name_size, date_size, name_min). start = angle of slot 0 edge.
    order(k, j) -> angle index, default left-to-right."""
    defs, body = [], []
    for k in range(1, len(R)):
        n_slots = 2 ** k
        step = span / n_slots
        r0, r1 = R[k - 1], R[k]
        rm, depth = (r0 + r1) / 2, r1 - r0
        face, fs_n, fs_d, fs_min = rings[k]
        g = [f'<g class="ring r{k}">'] if anim else [f'<g class="r{k}">']
        texts = []
        for j in range(n_slots):
            n = 2 ** k + j
            a0 = start + j * step; a1 = a0 + step
            p = people.get(n)
            fill = st['empty'] if not p else (colour(p, n) if colour else (st['fa'] if j % 2 == 0 else st['fb']))
            meta = ''
            if anim and p:
                meta = f' data-n="{n}" data-name="{esc(p["name"])}" data-d="{dates(p)}"'
            g.append(f'<path d="{wedge(cx, cy, r0, r1, a0, a1)}" fill="{fill}"{meta}/>')
            if not p:
                continue
            m = (a0 + a1) / 2
            dt = dates(p)
            if k <= curved:
                rev = abs(norm(m)) > 90
                gap = fs_n * 0.35
                H = fs_n + gap + fs_d
                off_n = H / 2 - fs_n / 2
                off_d = H / 2 - fs_d / 2
                rn = rm - off_n if rev else rm + off_n
                rd = rm + off_d if rev else rm - off_d
                avail = rn * math.radians(step) * 0.86
                nm, fs = fit(p['name'], face, fs_n, avail, fs_min)
                pid_n, pid_d = f'{uid}a{n}', f'{uid}b{n}'
                defs.append(f'<path id="{pid_n}" d="{arc(cx, cy, rn, a0, a1, rev)}"/>')
                texts.append(f'<text class="nm" font-size="{f1(fs)}" font-family="{FACES[face][0]}" font-weight="{FACES[face][1]}"><textPath href="#{pid_n}" startOffset="50%">{esc(nm)}</textPath></text>')
                if dt:
                    defs.append(f'<path id="{pid_d}" d="{arc(cx, cy, rd, a0, a1, rev)}"/>')
                    texts.append(f'<text class="dt" font-size="{f1(fs_d)}"><textPath href="#{pid_d}" startOffset="50%">{dt}</textPath></text>')
            else:
                thick = rm * math.radians(step) * 0.92
                fn = min(fs_n, thick * 0.52)
                fd = min(fs_d, thick * 0.4)
                two = dt and (fn + fd + fn * 0.25) <= thick
                if not two:
                    fn = min(fs_n, thick * 0.8)
                avail = depth * 0.86
                nm, fs = fit(p['name'], face, fn, avail, fs_min)
                x, y = pt(cx, cy, rm, m)
                mm = norm(m)
                rot = mm - 90 if mm >= 0 else mm + 90
                if two:
                    gap = fs * 0.25
                    Hh = fs + gap + fd
                    yn, yd = -Hh / 2 + fs / 2, Hh / 2 - fd / 2
                    texts.append(f'<g transform="translate({f1(x)} {f1(y)}) rotate({f1(rot)})"><text class="nm" font-size="{f1(fs)}" y="{f1(yn)}" font-family="{FACES[face][0]}" font-weight="{FACES[face][1]}">{esc(nm)}</text><text class="dt" font-size="{f1(fd)}" y="{f1(yd)}">{dt}</text></g>')
                else:
                    texts.append(f'<g transform="translate({f1(x)} {f1(y)}) rotate({f1(rot)})"><text class="nm" font-size="{f1(fs)}" font-family="{FACES[face][0]}" font-weight="{FACES[face][1]}">{esc(nm)}</text></g>')
        g.append('<g class="tx">' + ''.join(texts) + '</g></g>')
        body.append(''.join(g))
    return defs, body


def style_block(uid, st, date_face="'EB Garamond'"):
    return (f'<style>#{uid} .nm{{fill:{st["name"]};text-anchor:middle;dominant-baseline:central}}'
            f'#{uid} .dt{{fill:{st["date"]};font-family:{date_face};text-anchor:middle;dominant-baseline:central}}'
            f'#{uid} path{{stroke:{st["line"]};stroke-width:{st.get("lw", 0.6)};stroke-linejoin:round}}'
            f'#{uid} defs path{{stroke:none}}</style>')


def medallion(cx, cy, r, st, name, sub, face='corm', size=30, sub_size=15, ring=True):
    fam, wt, m = FACES[face]
    s = size
    while m.w(name, s) > r * 1.7 and s > 8:
        s -= 0.5
    out = []
    if ring:
        out.append(f'<circle cx="{f1(cx)}" cy="{f1(cy)}" r="{f1(r)}" fill="{st["med"]}" stroke="{st["medline"]}" stroke-width="{st.get("medw", 1.4)}"/>')
    out.append(f'<text class="nm" x="{f1(cx)}" y="{f1(cy - s * 0.28)}" font-size="{f1(s)}" font-family="{fam}" font-weight="{wt}">{esc(name)}</text>')
    if sub:
        out.append(f'<text class="dt" x="{f1(cx)}" y="{f1(cy + s * 0.55)}" font-size="{f1(sub_size)}">{sub}</text>')
    return ''.join(out)


def caps(x, y, text, size, fill, track=0.22, face='corm', weight=None, anchor='middle'):
    fam, wt, m = FACES[face]
    return (f'<text x="{f1(x)}" y="{f1(y)}" font-family="{fam}" font-weight="{weight or wt}" font-size="{f1(size)}" '
            f'letter-spacing="{f1(size * track)}" fill="{fill}" text-anchor="{anchor}">{esc(text)}</text>')


def svg(uid, vb, inner, label, cls=''):
    return (f'<svg id="{uid}" class="chart {cls}" viewBox="{vb}" role="img" aria-label="{esc(label)}" '
            f'xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>')


# ---------------------------------------------------------------- data
INDI, FAM = load()
V7 = ahnentafel(INDI, FAM, '@I1@', 7)
V6 = {n: p for n, p in V7.items() if n < 64}
V5 = {n: p for n, p in V7.items() if n < 32}
V4 = {n: p for n, p in V7.items() if n < 16}
E5 = ahnentafel(INDI, FAM, '@I2@', 5)   # Edward, Duke of Kent
W5 = ahnentafel(INDI, FAM, '@I3@', 5)   # Victoria of Saxe-Coburg-Saalfeld

TOWN = {'Rudolstadt': 'Germany', 'Erbach': 'Germany', 'Zerbst': 'Germany', 'London': 'United Kingdom',
        'Weimar': 'Germany', 'Schwerin': 'Germany', 'Coburg': 'Germany', 'Gotha': 'Germany'}


def country(p):
    pl = p.get('birt_plac') or ''
    if ',' in pl:
        return pl.rsplit(',', 1)[1].strip()
    return TOWN.get(pl.strip(), 'Unplaced' if not pl else 'Other')


ATLAS = {'Germany': '#D9B56B', 'United Kingdom': '#7E9FB4', 'Netherlands': '#D58A55', 'Switzerland': '#B7666A',
         'Hungary': '#8DAE7F', 'Denmark': '#A08DBE', 'Sweden': '#6FAFA8', 'France': '#C98FA8', 'Other': '#CFC8B8',
         'Unplaced': '#E6E1D6'}


def stats():
    ids = [p['id'] for p in V7.values()]
    c = Counter(ids)
    rep = {INDI[i]['name']: k for i, k in c.items() if k > 1}
    ys = [year(p.get('birt_date')) for p in V7.values() if year(p.get('birt_date'))]
    cc = Counter(country(INDI[i]) for i in set(ids))
    return dict(slots=len(V7), people=len(set(ids)), repeats=rep, earliest=min(ys), countries=cc)


# ---------------------------------------------------------------- charts
GILT = dict(ground='#0B1024', fa='#111A36', fb='#0D142B', empty='#0B1024', line='rgba(200,164,92,.55)',
            name='#DDBE78', date='#93A0C6', med='#0B1024', medline='#C9A45C', lw=0.7, medw=1.6)


def hero():
    uid = 'fan-hero'
    cx, cy = 560, 566
    R = [70, 148, 220, 286, 376, 466, 554]
    rings = {1: ('corm', 26, 15, 16), 2: ('corm', 20, 13, 13), 3: ('corm', 15.5, 11, 11),
             4: ('ebg', 13, 9.5, 9), 5: ('ebg', 10.5, 7.6, 7.2), 6: ('ebg', 8.6, 6.4, 5.8)}
    defs, body = fan(uid, V7, cx, cy, R, 270, -135, rings, GILT, curved=3, anim=True)
    # generation scale along the open edge of the fan (website annotation, not part of the print)
    scale = []
    ex = lambda r: pt(cx, cy, r, -135)
    for k in range(0, len(R)):
        r_in = 0 if k == 0 else R[k - 1]
        rm = (r_in + R[k]) / 2 if k else R[0] * 0.5
        x, y = ex(rm)
        num = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][k]
        # offset perpendicular to the edge, into the open gap (down-right)
        ox, oy = math.cos(math.radians(45)) * 16, math.sin(math.radians(45)) * 16
        if k:
            tx, ty = ex(R[k - 1])
            t2x, t2y = tx + ox * 0.55, ty + oy * 0.55
            scale.append(f'<line x1="{f1(tx)}" y1="{f1(ty)}" x2="{f1(t2x)}" y2="{f1(t2y)}"/>')
        if k:
            scale.append(f'<text x="{f1(x + ox)}" y="{f1(y + oy)}" transform="rotate(-45 {f1(x + ox)} {f1(y + oy)})">{num}</text>')
    tx, ty = ex(R[-1]); scale.append(f'<line x1="{f1(tx)}" y1="{f1(ty)}" x2="{f1(tx + ox * .55)}" y2="{f1(ty + oy * .55)}"/>')
    gx, gy = ex(R[-1] + 30)
    scale.append(f'<text class="cap" x="{f1(gx + ox)}" y="{f1(gy + oy)}" transform="rotate(-45 {f1(gx + ox)} {f1(gy + oy)})">GEN.</text>')
    inner = (style_block(uid, GILT) +
             f'<style>#{uid} .scale text{{font-family:"Courier Prime";font-size:15px;fill:#8F9CC2;text-anchor:middle;dominant-baseline:central}}'
             f'#{uid} .scale .cap{{font-size:12px;letter-spacing:2px}}#{uid} .scale line{{stroke:#8F9CC2;stroke-width:1}}</style>'
             '<defs>' + ''.join(defs) + '</defs>' + ''.join(body) +
             '<g class="ring r0" data-n="1" data-name="Victoria" data-d="1819–1901">' + medallion(cx, cy, R[0], GILT, 'Victoria', '1819–1901', size=34, sub_size=16) + '</g>'
             '<g class="scale" aria-hidden="true">' + ''.join(scale) + '</g>'
             '<g class="ring r7">' +
             caps(cx, cy + 448, 'THE ANCESTORS OF QUEEN VICTORIA', 27, '#DDBE78', 0.2) +
             caps(cx, cy + 482, 'SEVEN GENERATIONS  ·  24 MAY 1819', 14, '#93A0C6', 0.26, face='ebg') + '</g>')
    return svg(uid, '0 0 1120 1072', inner,
               'Fan chart of the ancestors of Queen Victoria, seven generations, gold names on midnight blue', 'hero-chart')


def poster_frame(w, h, ground, rule=None, inset=14, gap=4):
    s = f'<rect width="{w}" height="{h}" fill="{ground}"/>'
    if rule:
        s += (f'<rect x="{inset}" y="{inset}" width="{w - 2 * inset}" height="{h - 2 * inset}" fill="none" stroke="{rule}" stroke-width="1"/>'
              f'<rect x="{inset + gap}" y="{inset + gap}" width="{w - 2 * (inset + gap)}" height="{h - 2 * (inset + gap)}" fill="none" stroke="{rule}" stroke-width=".5"/>')
    return s


def ivory():
    uid = 'st-ivory'
    st = dict(fa='#F4EEE2', fb='#EFE7D8', empty='#F2ECDF', line='#7B6448', name='#4A3826', date='#8A7358',
              med='#F2ECDF', medline='#7B6448', lw=0.45)
    W, H = 500, 380
    cx, cy = 250, 292
    R = [34, 78, 118, 156, 200]
    rings = {1: ('ebg', 11.5, 7.5, 7), 2: ('ebg', 9, 6.5, 6), 3: ('ebg', 7, 5.2, 5),
             4: ('ebg', 6, 4.6, 4)}
    defs, body = fan(uid, V5, cx, cy, R, 180, -90, rings, st, curved=3)
    inner = (style_block(uid, st) + poster_frame(W, H, '#F2ECDF', '#7B6448') + '<defs>' + ''.join(defs) + '</defs>' +
             ''.join(body) + medallion(cx, cy, R[0], st, 'Victoria', '1819–1901', 'ebg', 12, 7, ring=False) +
             caps(cx, 336, 'THE ANCESTORS OF VICTORIA', 11, '#4A3826', 0.24, face='ebg') +
             caps(cx, 352, 'FIVE GENERATIONS · 1819', 7, '#8A7358', 0.3, face='ebg'))
    return svg(uid, f'0 0 {W} {H}', inner, 'Ivory style: a half-circle fan chart in sepia ink on bone paper')


def gilt():
    uid = 'st-gilt'
    W, H = 400, 500
    cx, cy = 200, 238
    R = [26, 58, 88, 114, 146, 180]
    rings = {1: ('corm', 11, 6.5, 6), 2: ('corm', 8.5, 5.5, 5), 3: ('corm', 6.6, 4.6, 4.2),
             4: ('ebg', 5.6, 4, 3.6), 5: ('ebg', 4.4, 3.2, 3)}
    defs, body = fan(uid, V6, cx, cy, R, 270, -135, rings, GILT, curved=3)
    inner = (style_block(uid, GILT) + poster_frame(W, H, '#0B1024') + '<defs>' + ''.join(defs) + '</defs>' +
             ''.join(body) + medallion(cx, cy, R[0], GILT, 'Victoria', '1819–1901', 'corm', 12, 6) +
             caps(cx, 416, 'THE ANCESTORS OF QUEEN VICTORIA', 10, '#DDBE78', 0.2) +
             caps(cx, 432, 'SIX GENERATIONS · 1819', 6, '#93A0C6', 0.3, face='ebg'))
    return svg(uid, f'0 0 {W} {H}', inner, 'Midnight Gilt style: a three-quarter fan chart in gold on midnight blue')


def laurel(cx, cy, w, col):
    """Two engraved sprigs rising from a stem knot, leaves alternating along a quadratic branch."""
    out = []
    for side in (-1, 1):
        p0 = (cx + side * 4, cy)
        p1 = (cx + side * w * 0.55, cy + 6)
        p2 = (cx + side * w, cy - 22)
        q = lambda t: ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                       (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
        out.append(f'<path d="M{f1(p0[0])} {f1(p0[1])}Q{f1(p1[0])} {f1(p1[1])} {f1(p2[0])} {f1(p2[1])}" fill="none" stroke="{col}" stroke-width=".9"/>')
        for i in range(1, 10):
            t = i / 10
            x, y = q(t)
            dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
            dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
            ang = math.degrees(math.atan2(dy, dx))
            for flip in (-1, 1):
                if (i + (flip > 0)) % 2:
                    continue
                a = ang + flip * 38
                L = 7.5 - t * 2.5
                lx, ly = x + math.cos(math.radians(a)) * L * 0.55, y + math.sin(math.radians(a)) * L * 0.55
                out.append(f'<ellipse cx="{f1(lx)}" cy="{f1(ly)}" rx="{f1(L * 0.62)}" ry="{f1(L * 0.24)}" transform="rotate({f1(a)} {f1(lx)} {f1(ly)})" fill="{col}"/>')
        tx, ty = p2
        out.append(f'<ellipse cx="{f1(tx + side * 2)}" cy="{f1(ty - 2)}" rx="3.6" ry="1.5" transform="rotate({f1(-side * 55)} {f1(tx + side * 2)} {f1(ty - 2)})" fill="{col}"/>')
    out.append(f'<circle cx="{cx}" cy="{cy + 1}" r="2" fill="{col}"/>')
    return ''.join(out)


def botanical():
    uid = 'st-bot'
    st = dict(fa='#FFFFFF', fb='#FFFFFF', empty='#FBF8F1', line='#6E6A4B', name='#3E3B28', date='#7C7556',
              med='#FBF8F1', medline='#6E6A4B', lw=0.45)
    tints = {1: '#DCE0C4', 2: '#EFDDB7', 3: '#EFD3CC', 4: '#E3E6D2'}
    W, H = 500, 380
    cx, cy = 250, 176
    R = [40, 76, 108, 138, 170]
    rings = {1: ('ebg', 8.5, 5.8, 5.2), 2: ('ebg', 6.8, 4.8, 4.4), 3: ('ebg', 5.6, 4.1, 3.6), 4: ('ebg', 4.8, 3.5, 3.2)}

    def col(p, n):
        k = n.bit_length() - 1
        return tints.get(k, '#FFFFFF')
    d1, b1 = fan(uid + 'l', E5, cx, cy, R, 150, -165, rings, st, curved=2, colour=col)
    d2, b2 = fan(uid + 'r', W5, cx, cy, R, 150, 15, rings, st, curved=2, colour=col)
    inner = (style_block(uid, st) + poster_frame(W, H, '#FBF8F1', '#8C8660', 12, 3) + '<defs>' + ''.join(d1 + d2) + '</defs>' +
             ''.join(b1 + b2) +
             f'<circle cx="{cx}" cy="{cy}" r="{R[0]}" fill="#FBF8F1" stroke="#6E6A4B" stroke-width=".8"/>'
             f'<text class="nm" x="{cx}" y="{cy - 12}" font-size="9" font-family="\'EB Garamond\'">Edward</text>'
             f'<text class="nm" x="{cx}" y="{cy + 1}" font-size="8" font-family="\'EB Garamond\'" font-style="italic">&amp;</text>'
             f'<text class="nm" x="{cx}" y="{cy + 13}" font-size="9" font-family="\'EB Garamond\'">Victoria</text>'
             f'<text class="dt" x="{cx}" y="{cy + 25}" font-size="5.5">1767 · 1786</text>' +
             laurel(cx, 322, 64, '#7D8757') +
             caps(cx, 348, 'TWO FAMILIES · KENT &amp; SAXE-COBURG'.replace('&amp;', '&'), 9, '#3E3B28', 0.22, face='ebg'))
    return svg(uid, f'0 0 {W} {H}', inner, 'Botanical style: a two-families bowtie chart with olive, ochre and rose tints and a laurel')


def letterpress():
    uid = 'st-press'
    W, H = 500, 380
    ink, red = '#1B1A18', '#C8361D'
    cols = [22, 132, 242, 352]
    bw = [100, 100, 100, 124]
    top, bot = 92, 356
    out = [poster_frame(W, H, '#F4EEDF')]
    out.append(f'<text x="{W / 2}" y="44" text-anchor="middle" font-family="\'EB Garamond\'" font-weight="600" font-size="19" letter-spacing="3.2" fill="{red}" style="font-variant:small-caps">The Ancestors of Victoria</text>')
    out.append(f'<line x1="120" y1="56" x2="380" y2="56" stroke="{ink}" stroke-width="1.4"/><line x1="120" y1="59.5" x2="380" y2="59.5" stroke="{ink}" stroke-width=".5"/>')
    out.append(f'<text x="{W / 2}" y="74" text-anchor="middle" font-family="\'EB Garamond\'" font-size="8" letter-spacing="1.6" fill="{ink}">FOUR GENERATIONS · KENSINGTON PALACE, 24 MAY 1819</text>')
    pos = {}
    for g in range(4):
        n0 = 2 ** g
        cnt = n0
        slot = (bot - top) / cnt
        for j in range(cnt):
            n = n0 + j
            y = top + slot * (j + 0.5)
            pos[n] = (cols[g], y)
    for n, (x, y) in pos.items():
        g = n.bit_length() - 1
        if n > 1:
            px, py = pos[n // 2]
            out.append(f'<path d="M{px + bw[g - 1]} {f1(py)}H{f1(px + bw[g - 1] + 5)}V{f1(y)}H{x}" fill="none" stroke="{ink}" stroke-width=".6"/>')
    for n, (x, y) in pos.items():
        g = n.bit_length() - 1
        p = V4[n]
        h = [34, 30, 26, 22][g]
        fs = [9.5, 8, 7, 6.2][g]
        nm, fs2 = fit(p['name'], 'ebg6', fs, bw[g] - 8, fs * 0.72)
        out.append(f'<rect x="{x}" y="{f1(y - h / 2)}" width="{bw[g]}" height="{h}" fill="#F4EEDF" stroke="{red if n == 1 else ink}" stroke-width="{1.2 if n == 1 else .6}"/>')
        out.append(f'<text x="{x + 5}" y="{f1(y - 1.5)}" font-family="\'EB Garamond\'" font-weight="600" font-size="{f1(fs2)}" fill="{ink}">{esc(nm)}</text>')
        out.append(f'<text x="{x + 5}" y="{f1(y + fs * 0.95)}" font-family="\'EB Garamond\'" font-size="{f1(fs * 0.78)}" fill="{red}">{dates(p)}</text>')
    return svg(uid, f'0 0 {W} {H}', ''.join(out), 'Letterpress style: a four-generation pedigree chart in black and vermilion on cream')


def nordic():
    uid = 'st-nordic'
    st = dict(fa='#FFFFFF', fb='#E6EBEF', empty='#FFFFFF', line='#2E3338', name='#23272B', date='#6B7680',
              med='#FFFFFF', medline='#2E3338', lw=0.5, medw=0.8)
    W, H = 400, 500
    cx, cy = 200, 226
    R = [30, 70, 106, 138, 172]
    rings = {1: ('inter', 8.5, 6, 5.5), 2: ('inter', 6.8, 5, 4.4), 3: ('inter', 5.4, 4, 3.6), 4: ('inter', 4.6, 3.4, 3)}
    defs, body = fan(uid, V5, cx, cy, R, 360, -180, rings, st, curved=2)
    inner = (style_block(uid, st, "'Inter'") + poster_frame(W, H, '#FFFFFF') + '<defs>' + ''.join(defs) + '</defs>' +
             ''.join(body) + medallion(cx, cy, R[0], st, 'Victoria', '1819–1901', 'inter', 10, 5.5) +
             caps(cx, 440, 'ANCESTORS OF VICTORIA', 9.5, '#23272B', 0.3, face='inter') +
             caps(cx, 456, 'Five generations', 6.5, '#6B7680', 0.08, face='inter'))
    return svg(uid, f'0 0 {W} {H}', inner, 'Nordic style: a full-circle fan chart in charcoal and pale blue-grey on white')


def compass(cx, cy, r, col):
    pts = []
    for i, a in enumerate(range(0, 360, 45)):
        L = r if i % 2 == 0 else r * 0.55
        x1, y1 = pt(cx, cy, L, a); xl, yl = pt(cx, cy, r * 0.16, a - 45); xr, yr = pt(cx, cy, r * 0.16, a + 45)
        pts.append(f'<path d="M{f1(cx)} {f1(cy)}L{f1(xl)} {f1(yl)}L{f1(x1)} {f1(y1)}Z" fill="{col}"/>')
        pts.append(f'<path d="M{f1(cx)} {f1(cy)}L{f1(xr)} {f1(yr)}L{f1(x1)} {f1(y1)}Z" fill="none" stroke="{col}" stroke-width=".5"/>')
    pts.append(f'<circle cx="{cx}" cy="{cy}" r="{r * 0.7}" fill="none" stroke="{col}" stroke-width=".4"/>')
    pts.append(f'<text x="{cx}" y="{f1(cy - r - 3)}" text-anchor="middle" font-family="\'EB Garamond\'" font-size="6" fill="{col}">N</text>')
    return ''.join(pts)


def cartographer():
    uid = 'st-carto'
    st = dict(fa='#fff', fb='#fff', empty='#DCE7EC', line='#40586A', name='#1F3140', date='#3E5566',
              med='#E8F0F3', medline='#40586A', lw=0.45, medw=0.8)
    W, H = 400, 500
    cx, cy = 200, 230
    R = [28, 66, 100, 130, 164]
    rings = {1: ('ebg', 9.5, 6, 5.5), 2: ('ebg', 7.4, 5, 4.6), 3: ('ebg', 6, 4.2, 3.8), 4: ('ebg', 5, 3.6, 3.2)}
    defs, body = fan(uid, V5, cx, cy, R, 270, -135, rings, st, curved=3, colour=lambda p, n: ATLAS.get(country(p), ATLAS['Other']))
    grat = ''.join(f'<line x1="0" y1="{y}" x2="{W}" y2="{y}"/>' for y in range(20, H, 40)) + \
        ''.join(f'<path d="M{x} 0Q{x + (x - 200) * 0.12} {H / 2} {x} {H}" fill="none"/>' for x in range(20, W, 40))
    cc = Counter(country(p) for p in V5.values())
    tot = sum(cc.values())
    leg, lx, ly = [], 40, 416
    items = cc.most_common(4)
    for i, (c, k) in enumerate(items):
        x = lx + i * 84
        leg.append(f'<rect x="{x}" y="{ly}" width="9" height="9" fill="{ATLAS.get(c, ATLAS["Other"])}" stroke="#40586A" stroke-width=".4"/>'
                   f'<text x="{x + 13}" y="{ly + 7.5}" font-family="\'EB Garamond\'" font-size="7.5" fill="#1F3140">{esc(c)} {round(100 * k / tot)}%</text>')
    inner = (style_block(uid, st) + poster_frame(W, H, '#DCE7EC', '#40586A', 12, 3) +
             f'<g stroke="#B7CBD5" stroke-width=".5" fill="none">{grat}</g>' + '<defs>' + ''.join(defs) + '</defs>' +
             ''.join(body) + medallion(cx, cy, R[0], st, 'Victoria', '1819–1901', 'ebg', 10, 5.5) +
             compass(344, 58, 20, '#40586A') +
             caps(cx, 398, 'WHERE THEY WERE BORN', 8.5, '#1F3140', 0.26, face='ebg') + ''.join(leg))
    return svg(uid, f'0 0 {W} {H}', inner, 'Cartographer style: a fan chart coloured by birthplace on map-blue paper with a compass rose')



def giftfan():
    """A small nameless Ivory fan for the gift-card front."""
    cx, cy = 100, 98
    R = [18, 40, 60, 78, 94]
    out = []
    for k in range(1, len(R)):
        n = 2 ** k
        for j in range(n):
            a0 = -90 + j * 180 / n
            fill = '#F3ECDD' if (j + k) % 2 else '#E9DEC8'
            out.append(f'<path d="{wedge(cx, cy, R[k - 1], R[k], a0, a0 + 180 / n)}" fill="{fill}"/>')
    out.append(f'<path d="M{cx - R[0]} {cy}A{R[0]} {R[0]} 0 0 1 {cx + R[0]} {cy}Z" fill="#F7F1E4"/>')
    return ('<svg class="giftfan" viewBox="0 0 200 104" aria-hidden="true" focusable="false"><g stroke="#7B6448" stroke-width=".7">'
            + ''.join(out) + '</g></svg>')


def glyph(kind):
    """Small line drawings of the three chart engines, drawn in currentColor."""
    g = []
    if kind == 'fan':
        cx, cy = 40, 40
        for r in (10, 20, 30):
            g.append(f'<path d="{arc(cx, cy, r, -135, 135, False)}" fill="none"/>')
        for k, (r0, r1) in enumerate([(10, 20), (20, 30)], start=1):
            n = 2 ** k
            for j in range(n + 1):
                a = -135 + j * 270 / n
                x0, y0 = pt(cx, cy, r0, a); x1, y1 = pt(cx, cy, r1, a)
                g.append(f'<line x1="{f1(x0)}" y1="{f1(y0)}" x2="{f1(x1)}" y2="{f1(y1)}"/>')
        x0, y0 = pt(cx, cy, 10, -135); x1, y1 = pt(cx, cy, 10, 135)
        g.append(f'<line x1="{f1(cx)}" y1="{f1(cy)}" x2="{f1(x0)}" y2="{f1(y0)}"/><line x1="{f1(cx)}" y1="{f1(cy)}" x2="{f1(x1)}" y2="{f1(y1)}"/>')
    elif kind == 'bowtie':
        cx, cy = 40, 40
        for side in (-1, 1):
            a0 = -165 if side < 0 else 15
            for r in (14, 23, 32):
                g.append(f'<path d="{arc(cx, cy, r, a0, a0 + 150, False)}" fill="none"/>')
            for r0, r1, n in ((14, 23, 2), (23, 32, 4)):
                for j in range(n + 1):
                    a = a0 + j * 150 / n
                    x0, y0 = pt(cx, cy, r0, a); x1, y1 = pt(cx, cy, r1, a)
                    g.append(f'<line x1="{f1(x0)}" y1="{f1(y0)}" x2="{f1(x1)}" y2="{f1(y1)}"/>')
        g.append(f'<circle cx="{cx}" cy="{cy}" r="9"/>')
    else:
        g.append('<rect x="6" y="34" width="16" height="12"/>')
        for y in (18, 50):
            g.append(f'<rect x="30" y="{y}" width="16" height="12"/><path d="M22 40H26V{y + 6}H30" fill="none"/>')
        for y in (10, 26, 42, 58):
            py = 24 if y < 40 else 56
            g.append(f'<rect x="54" y="{y}" width="20" height="10"/><path d="M46 {py}H50V{y + 5}H54" fill="none"/>')
    return (f'<svg class="glyph" viewBox="0 0 80 80" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.5">'
            + ''.join(g) + '</g></svg>')


def sizes():
    """Paper sizes drawn to one scale, with the fan generations each one holds (brief §4.4)."""
    items = [('Letter', 8.5, 11, 6), ('11×14', 11, 14, 6), ('18×24', 18, 24, 7), ('24×36', 24, 36, 8)]
    k = 5.2
    x, base = 2, 196
    out = []
    for name, w, h, gen in items:
        W, H = w * k, h * k
        out.append(f'<rect x="{f1(x)}" y="{f1(base - H)}" width="{f1(W)}" height="{f1(H)}" class="sheet"/>')
        out.append(f'<text x="{f1(x + W / 2)}" y="{base + 20}" class="sz">{name}</text>')
        out.append(f'<text x="{f1(x + W / 2)}" y="{f1(base - H / 2 + 5)}" class="gn">{gen}</text>')
        x += W + 12
    return (f'<svg class="sizes" viewBox="0 0 {f1(x)} 222" role="img" aria-label="Paper sizes to scale: Letter holds 6 generations, 11 by 14 holds 6, 18 by 24 holds 7, 24 by 36 holds 8">'
            + ''.join(out) + '</svg>')


def mark(uid='mk', root='#A3281A', ink='currentColor'):
    """Logo mark: a real three-generation quarter fan. 1 root, 2 parents, 4 grandparents."""
    cx, cy = 3, 29
    rs = [9, 17.5, 26]
    paths = [f'<path d="M{cx} {cy}L{cx} {cy - rs[0]}A{rs[0]} {rs[0]} 0 0 1 {cx + rs[0]} {cy}Z" fill="{root}"/>']
    for k, r in enumerate(rs[1:], start=1):
        paths.append(f'<path d="M{cx} {cy - r}A{r} {r} 0 0 1 {cx + r} {cy}" fill="none"/>')
    for k in (1, 2):
        n = 2 ** k
        for j in range(1, n):
            a = j * 90 / n
            x0, y0 = pt(cx, cy, rs[k - 1], a); x1, y1 = pt(cx, cy, rs[k], a)
            paths.append(f'<line x1="{f1(x0)}" y1="{f1(y0)}" x2="{f1(x1)}" y2="{f1(y1)}"/>')
    return (f'<svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><g stroke="{ink}" stroke-width="1.6" stroke-linecap="square">'
            f'<line x1="{cx}" y1="{cy - rs[2]}" x2="{cx}" y2="{cy}"/><line x1="{cx}" y1="{cy}" x2="{cx + rs[2]}" y2="{cy}"/>'
            + ''.join(paths) + '</g></svg>')


def main():
    OUT.mkdir(exist_ok=True)
    charts = {'hero': hero(), 'ivory': ivory(), 'gilt': gilt(), 'botanical': botanical(), 'letterpress': letterpress(),
              'nordic': nordic(), 'cartographer': cartographer(), 'mark': mark(), 'mark-foot': mark('mf'), 'giftfan': giftfan(),
              'g-fan': glyph('fan'), 'g-bowtie': glyph('bowtie'), 'g-pedigree': glyph('pedigree'), 'sizes': sizes()}
    for k, v in charts.items():
        (OUT / f'{k}.svg').write_text(v, encoding='utf-8')
    idx = ROOT / 'index.html'
    if idx.exists():
        s = idx.read_text(encoding='utf-8')
        for k, v in charts.items():
            s = re.sub(rf'(<!--chart:{k}-->).*?(<!--/chart:{k}-->)', lambda m: m.group(1) + v + m.group(2), s, flags=re.S)
        idx.write_text(s, encoding='utf-8')
    st = stats()
    print({k: len(v) for k, v in charts.items()})
    print('slots', st['slots'], 'people', st['people'], 'earliest', st['earliest'])
    print('repeats', st['repeats'])
    print('countries', st['countries'].most_common())
    print('5gen countries', Counter(country(p) for p in V5.values()).most_common())


if __name__ == '__main__':
    main()
