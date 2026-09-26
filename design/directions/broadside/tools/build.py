#!/usr/bin/env python3
"""Broadside direction: builds index.html from src/index.html.

Reads the CC0 Wikidata sample (web/src/samples/victoria.ged), lays out real
fan charts (hero specimen + six style proofs) as inline SVG, and injects them
into the page template at <!--@name--> markers.

Text widths are measured from the real EB Garamond / Source Sans advance
widths, so names are shortened with the product's abbreviation ladder
instead of overflowing.

Usage: python3 design/directions/broadside/tools/build.py
"""
import math
import os
import re
from html import escape

from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(ROOT, '..', '..', '..'))
GED = os.path.join(REPO, 'web', 'src', 'samples', 'victoria.ged')
FONTS = os.path.join(ROOT, 'fonts')

# ---------------------------------------------------------------- metrics
_metrics = {}


def _load(name):
    if name not in _metrics:
        f = TTFont(os.path.join(FONTS, name + '.woff2'))
        cmap = f.getBestCmap()
        hmtx = f['hmtx']
        upm = f['head'].unitsPerEm
        _metrics[name] = (cmap, hmtx, upm)
    return _metrics[name]


FACE = {  # svg font-family -> metric file
    'garamond': 'EBGaramond-400',
    'garamond-semibold': 'EBGaramond-600',
    'sans': 'SourceSans3-400',
    'sans-semibold': 'SourceSans3-600',
}


def measure(text, size, face='garamond', tracking=0.0):
    cmap, hmtx, upm = _load(FACE[face])
    w = 0
    for ch in text:
        g = cmap.get(ord(ch))
        w += hmtx[g][0] if g else upm * 0.5
    return w / upm * size + tracking * size * max(0, len(text) - 1)


# ---------------------------------------------------------------- gedcom
def parse_gedcom(path):
    ind, fam = {}, {}
    cur, kind, ctx = None, None, None
    with open(path, encoding='utf-8') as fh:
        for line in fh:
            parts = line.rstrip('\n').split(' ', 2)
            if len(parts) < 2:
                continue
            lvl = int(parts[0])
            if lvl == 0:
                cur = None
                if len(parts) > 2 and parts[2] == 'INDI':
                    cur, kind = ind.setdefault(parts[1], {'id': parts[1]}), 'I'
                elif len(parts) > 2 and parts[2] == 'FAM':
                    cur, kind = fam.setdefault(parts[1], {}), 'F'
                continue
            if cur is None:
                continue
            tag, val = parts[1], (parts[2] if len(parts) > 2 else '')
            if lvl == 1:
                ctx = tag
            if kind == 'I':
                if lvl == 1 and tag == 'NAME':
                    cur['name'] = val.replace('/', '').strip()
                elif lvl == 1 and tag == 'FAMC':
                    cur['famc'] = val
                elif lvl == 2 and tag == 'DATE' and ctx in ('BIRT', 'DEAT'):
                    cur[ctx] = val
                elif lvl == 2 and tag == 'PLAC' and ctx == 'BIRT':
                    cur['bplace'] = val
            elif lvl == 1 and tag in ('HUSB', 'WIFE'):
                cur[tag] = val
    return ind, fam


def ahnentafel(ind, fam, root='@I1@', gens=8):
    ah = {1: root}
    for n in range(1, 2 ** (gens - 1)):
        if n not in ah:
            continue
        f = ind[ah[n]].get('famc')
        if f and f in fam:
            if 'HUSB' in fam[f]:
                ah[2 * n] = fam[f]['HUSB']
            if 'WIFE' in fam[f]:
                ah[2 * n + 1] = fam[f]['WIFE']
    return ah


def year(d):
    if not d:
        return ''
    m = re.search(r'(\d{3,4})(?!.*\d{3,4})', d)
    if not m:
        return ''
    y = m.group(1)
    return ('c. ' + y) if re.match(r'(ABT|EST|CAL)', d) else y


def lifespan(p):
    b, d = year(p.get('BIRT')), year(p.get('DEAT'))
    if b and d:
        return f'{b}–{d}'
    if b:
        return f'b. {b}'
    if d:
        return f'd. {d}'
    return ''


TITLES = ('Prince ', 'Princess ', 'Duke ', 'Duchess ', 'Count ', 'Countess ',
          'Margrave ', 'Margravine ', 'Landgrave ', 'Landgravine ', 'Queen ',
          'King ', 'Lady ', 'Lord ', 'Archduke ', 'Archduchess ', 'Baron ',
          'Baroness ', 'Elector ', 'Electress ')


def ladder(name):
    """The product's abbreviation ladder, adapted to titled names."""
    out = [name]
    base = name.split(',')[0].strip()
    out.append(base)
    t = base
    for pre in TITLES:
        if t.startswith(pre):
            t = t[len(pre):]
    out.append(t)
    short = re.split(r' (?:of|von|zu|de) ', t)[0]
    out.append(short)
    words = short.split()
    if len(words) > 2:
        out.append(' '.join([words[0]] + [w for w in words[1:] if re.fullmatch(r'[IVXL]+', w)]))
    if len(words) > 1:
        out.append(' '.join(w[0] + '.' if i < len(words) - 1 and not re.fullmatch(r'[IVXL]+', w) else w
                            for i, w in enumerate(words)))
    out.append(words[0] if words else name)
    seen, res = set(), []
    for o in out:
        if o and o not in seen:
            seen.add(o)
            res.append(o)
    return res


def fit(name, width, size, face):
    for cand in ladder(name):
        if measure(cand, size, face) <= width:
            return cand
    s = ladder(name)[-1]
    while len(s) > 1 and measure(s + '.', size, face) > width:
        s = s[:-1]
    return s + '.' if s != ladder(name)[-1] else s


def split2(name, width, size, face):
    """Try to set a name on two lines of `width`; returns list of lines."""
    for cand in ladder(name):
        if measure(cand, size, face) <= width:
            return [cand]
        words = cand.split()
        for k in range(len(words) - 1, 0, -1):
            a, b = ' '.join(words[:k]), ' '.join(words[k:])
            if measure(a, size, face) <= width and measure(b, size, face) <= width:
                return [a, b]
    return [fit(name, width, size, face)]


# ---------------------------------------------------------------- geometry
def pol(cx, cy, r, phi):
    a = math.radians(phi)
    return cx + r * math.sin(a), cy - r * math.cos(a)


def f(v):
    return f'{v:.2f}'.rstrip('0').rstrip('.')


def wedge_path(cx, cy, ri, ro, a0, a1):
    large = 1 if (a1 - a0) > 180 else 0
    x0, y0 = pol(cx, cy, ro, a0)
    x1, y1 = pol(cx, cy, ro, a1)
    x2, y2 = pol(cx, cy, ri, a1)
    x3, y3 = pol(cx, cy, ri, a0)
    return (f'M{f(x0)} {f(y0)}A{f(ro)} {f(ro)} 0 {large} 1 {f(x1)} {f(y1)}'
            f'L{f(x2)} {f(y2)}A{f(ri)} {f(ri)} 0 {large} 0 {f(x3)} {f(y3)}Z')


def arc_path(cx, cy, r, a0, a1, flip):
    if flip:
        x0, y0 = pol(cx, cy, r, a1)
        x1, y1 = pol(cx, cy, r, a0)
        return f'M{f(x0)} {f(y0)}A{f(r)} {f(r)} 0 0 0 {f(x1)} {f(y1)}'
    x0, y0 = pol(cx, cy, r, a0)
    x1, y1 = pol(cx, cy, r, a1)
    return f'M{f(x0)} {f(y0)}A{f(r)} {f(r)} 0 0 1 {f(x1)} {f(y1)}'


# ---------------------------------------------------------------- fan
def fan(ind, ah, *, uid, gens, R, r0, span=270, depths, curved=3, cx=None, cy=None,
        sizes, face='garamond', face_b='garamond-semibold', numbers=True,
        root_label=True, collapse=True, interactive=False, cls='fan'):
    """Returns (svg_fragment, cx, cy, bounds). Coordinates are absolute."""
    cx = R if cx is None else cx
    cy = R if cy is None else cy
    bounds = [r0]
    for d in depths[:gens - 1]:
        bounds.append(bounds[-1] + d)
    scale = R / bounds[-1]
    bounds = [b * scale for b in bounds]
    out = [f'<g class="{cls}">']
    red = []  # the second-ink plate: printed as its own layer, on top
    defs = []
    counts = {}
    for n, pid in ah.items():
        if n < 2 ** gens:
            counts[pid] = counts.get(pid, 0) + 1
    repeat_ids = {}
    for pid, c in counts.items():
        if c > 1:
            repeat_ids[pid] = len(repeat_ids) + 1

    for g in range(1, gens):
        ri, ro = bounds[g - 1], bounds[g]
        depth = ro - ri
        k = 2 ** g
        step = span / k
        fs_name, fs_date = sizes[g]
        out.append(f'<g class="ring r{g + 1}">')
        for i in range(k):
            n = k + i
            a0 = -span / 2 + i * step
            a1 = a0 + step
            ac = (a0 + a1) / 2
            pid = ah.get(n)
            attrs = f' data-n="{n}"' if interactive else ''
            out.append(f'<g class="slot{" empty" if not pid else ""}"{attrs}>')
            out.append(f'<path class="w" d="{wedge_path(cx, cy, ri, ro, a0, a1)}"/>')
            if pid:
                p = ind[pid]
                life = lifespan(p)
                if g <= curved:
                    flip = abs(ac) > 100
                    rm = (ri + ro) / 2
                    arc_len = math.radians(step) * (rm - depth * 0.22) - fs_name * 0.9
                    # one line if a rich rung of the ladder fits; otherwise two lines;
                    # step the size down (to 78%) before dropping to a poorer rung
                    lad = ladder(p['name'])
                    best = None
                    for fac in (1, .9, .8):
                        fsn = fs_name * fac
                        al = math.radians(step) * (rm - depth * 0.22) - fsn * 0.9
                        pitch = fsn * 1.02
                        cand = []
                        one = next(((i, [c]) for i, c in enumerate(lad) if measure(c, fsn, face_b) <= al), None)
                        if one:
                            cand.append(one)
                        room = depth - fs_date * 1.3 - fsn * 0.4
                        if room >= pitch + fsn * 0.72:
                            done = False
                            for i, c in enumerate(lad):
                                words = c.split()
                                for k2 in range(len(words) - 1, 0, -1):
                                    a_, b_ = ' '.join(words[:k2]), ' '.join(words[k2:])
                                    if measure(a_, fsn, face_b) <= al and measure(b_, fsn, face_b) <= al:
                                        cand.append((i + 0.5, [a_, b_]))
                                        done = True
                                        break
                                if done:
                                    break
                        if cand:
                            c = min(cand, key=lambda t: t[0])
                            if best is None or c[0] < best[0]:
                                best = (c[0], c[1], fsn)
                            if c[0] <= 1:
                                break
                    if best:
                        names, fs_n = best[1], best[2]
                    else:
                        fs_n = fs_name
                        names = [fit(p['name'], arc_len, fs_n, face_b)]
                    pitch = fs_n * 1.02
                    lines = [(t, fs_n, 'nm', pitch) for t in names]
                    if life:
                        lines.append((life, fs_date, 'dt', fs_date * 1.25))
                    block = fs_n * 0.72 + sum(l[3] for l in lines[1:]) + lines[-1][1] * 0.18
                    # upright text has its tops outward, flipped text has them toward the centre
                    r_b = (rm - block / 2 + fs_n * 0.72) if flip else (rm + block / 2 - fs_n * 0.72)
                    for j, (txt, fsz, kls, pit) in enumerate(lines):
                        if j:
                            r_b += (pit if flip else -pit)
                        pid_ = f'{uid}{n}l{j}'
                        defs.append(f'<path id="{pid_}" d="{arc_path(cx, cy, r_b, a0, a1, flip)}"/>')
                        out.append(f'<text class="{kls}" font-size="{f(fsz)}"><textPath href="#{pid_}" startOffset="50%" text-anchor="middle">{escape(txt)}</textPath></text>')
                    if numbers:
                        # Ahnentafel number: small, at the leading inner corner
                        rn = ri + fs_date * 0.9
                        an = (a0 + 1.2 * 180 / math.pi * fs_date / rn) if not flip else (a1 - 1.2 * 180 / math.pi * fs_date / rn)
                        x, y = pol(cx, cy, rn, an)
                        rot = ac if not flip else ac - 180
                        red.append(f'<text class="ah"{attrs} font-size="{f(fs_date * 0.82)}" transform="translate({f(x)} {f(y)}) rotate({f(an if not flip else an - 180)})" text-anchor="{"start" if not flip else "end"}" dy="{f(fs_date * 0.3)}">{n}</text>')
                else:
                    right = ac > 0
                    rot = ac - 90 if right else ac + 90
                    width_perp = math.radians(step) * ri
                    lh = fs_name * 1.08
                    nlines = max(1, int((width_perp - fs_name * 0.25) // lh))
                    num_w = measure(str(n), fs_date * 0.8, 'sans') + fs_date * 0.5 if numbers else 0
                    pad = fs_name * 0.35
                    avail = depth - 2 * pad - num_w
                    lines = []
                    if nlines >= 3:
                        lines = split2(p['name'], avail, fs_name, face)
                    else:
                        lines = [fit(p['name'], avail, fs_name, face)]
                    if nlines == 1:
                        dl = []
                    else:
                        dl = [life] if life else []
                    total = len(lines) + len(dl)
                    if total > nlines:
                        lines = [fit(p['name'], avail, fs_name, face)]
                        total = len(lines) + len(dl)
                    rmid = ri + num_w + pad + avail / 2
                    x, y = pol(cx, cy, rmid, ac)
                    tsp = []
                    first_dy = -(total - 1) / 2 * lh + fs_name * 0.33
                    for j, ln in enumerate(lines):
                        dy = first_dy if j == 0 else lh
                        tsp.append(f'<tspan x="0" dy="{f(dy)}">{escape(ln)}</tspan>')
                    for ln in dl:
                        tsp.append(f'<tspan class="dt" x="0" dy="{f(lh)}" font-size="{f(fs_date)}">{ln}</tspan>')
                    out.append(f'<text class="nm" font-size="{f(fs_name)}" text-anchor="middle" transform="translate({f(x)} {f(y)}) rotate({f(rot)})">{"".join(tsp)}</text>')
                    if numbers:
                        xn, yn = pol(cx, cy, ri + fs_date * 0.35, ac)
                        red.append(f'<text class="ah"{attrs} font-size="{f(fs_date * 0.8)}" text-anchor="{"start" if right else "end"}" transform="translate({f(xn)} {f(yn)}) rotate({f(rot)})" dy="{f(fs_date * 0.28)}">{n}</text>')
                if collapse and pid in repeat_ids:
                    rr = ro - fs_date * 0.75
                    ang = a1 - (fs_date * 0.75) / (math.pi * rr / 180)
                    x, y = pol(cx, cy, rr, ang)
                    red.append(f'<g class="pc"><circle cx="{f(x)}" cy="{f(y)}" r="{f(fs_date * 0.55)}"/>'
                               f'<text x="{f(x)}" y="{f(y)}" dy="{f(fs_date * 0.26)}" font-size="{f(fs_date * 0.72)}" text-anchor="middle">{counts[pid]}</text></g>')
            out.append('</g>')
        out.append('</g>')
    # rules between generations (drawn on top, crisp)
    rules = []
    for g in range(1, gens):
        r = bounds[g]
        x0, y0 = pol(cx, cy, r, -span / 2)
        x1, y1 = pol(cx, cy, r, span / 2)
        rules.append(f'M{f(x0)} {f(y0)}A{f(r)} {f(r)} 0 1 1 {f(x1)} {f(y1)}')
    out.append(f'<path class="rings" d="{" ".join(rules)}"/>')
    # root
    p = ind[ah[1]]
    root_attr = ' data-n="1"' if interactive else ''
    red.append(f'<g class="root"{root_attr}><circle class="rd" cx="{f(cx)}" cy="{f(cy)}" r="{f(r0 * scale)}"/>')
    if root_label:
        fsr, fsd = sizes[0]
        red.append(f'<text class="rn" x="{f(cx)}" y="{f(cy + fsr * 0.12)}" font-size="{f(fsr)}" text-anchor="middle">{escape(p["name"])}</text>')
        red.append(f'<text class="rdt" x="{f(cx)}" y="{f(cy + fsr * 0.12 + fsd * 1.5)}" font-size="{f(fsd)}" text-anchor="middle">{lifespan(p)}</text>')
        if numbers:
            red.append(f'<text class="rah" x="{f(cx)}" y="{f(cy - fsr * 0.95)}" font-size="{f(fsd * 0.8)}" text-anchor="middle">1</text>')
    red.append('</g>')
    out.append('</g>')
    legend = [(ind[pid]['name'], counts[pid], num) for pid, num in repeat_ids.items()]
    return ('<defs>' + ''.join(defs) + '</defs>' + ''.join(out) +
            '<g class="plate-r">' + ''.join(red) + '</g>'), bounds, legend


ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']


# ---------------------------------------------------------------- hero specimen
def earliest(ind, ah, gens):
    ys = [int(re.sub(r'\D', '', year(ind[pid].get('BIRT')))) for n, pid in ah.items()
          if n < 2 ** gens and year(ind[pid].get('BIRT'))]
    return min(ys)


def hero(ind, ah):
    gens = 7
    W, H = 1000, 922
    cx, cy, R = 500, 520, 440
    depths = [74, 66, 60, 74, 80, 88, 94]
    sizes = {0: (27, 13), 1: (17.5, 11.5), 2: (13.2, 9.6), 3: (10.4, 8), 4: (9, 7), 5: (7.6, 6), 6: (6.1, 5)}
    body, bounds, legend = fan(ind, ah, uid='h', gens=gens, R=R, r0=58, depths=depths, cx=cx, cy=cy,
                               sizes=sizes, interactive=True, cls='fan hero-fan')
    s = [f'<svg class="specimen" viewBox="0 0 {W} {H}" role="img" aria-labelledby="spec-t spec-d" xmlns="http://www.w3.org/2000/svg">',
         '<title id="spec-t">Fan chart specimen: the ancestors of Queen Victoria, seven generations</title>',
         '<desc id="spec-d">A 270-degree fan chart printed in black and vermilion. Victoria is at the centre; her parents, grandparents and earlier generations fan outward in six rings, each person numbered with an Ahnentafel number. Red dots mark people who appear more than once.</desc>']
    # printers' marks: crop marks around the trim box
    tx0, ty0, tx1, ty1 = 34, 30, W - 34, H - 34
    cm = []
    L, gap = 22, 8
    for (x, y, sx, sy) in ((tx0, ty0, -1, -1), (tx1, ty0, 1, -1), (tx0, ty1, -1, 1), (tx1, ty1, 1, 1)):
        cm.append(f'M{x + sx * gap} {y}h{sx * L}M{x} {y + sy * gap}v{sy * L}')
    s.append(f'<path class="crop" d="{"".join(cm)}"/>')
    # registration targets
    for (x, y) in ((W / 2, 12), (W / 2, H - 12)):
        s.append(f'<g class="reg"><circle cx="{x}" cy="{y}" r="6"/><path d="M{x - 10} {y}h20M{x} {y - 10}v20"/></g>')
    s.append(body)
    # generation scale along both open edges of the fan
    lab = []
    for g in range(1, gens):
        rm = (bounds[g - 1] + bounds[g]) / 2
        for side, text in ((-1, ROMAN[g]), (1, str(2 ** g))):
            ang = side * 135
            x, y = pol(cx, cy, rm, ang)
            # push outward, perpendicular to the edge, into the open sector
            nx, ny = pol(0, 0, 13, ang + side * 90)
            rot = ang + 90 if side < 0 else ang - 90
            lab.append(f'<text class="scale" x="{f(x + nx)}" y="{f(y + ny)}" text-anchor="middle" dy="3.5" transform="rotate({f(rot)} {f(x + nx)} {f(y + ny)})">{text}</text>')
    x, y = pol(cx, cy, bounds[-1] + 10, -135)
    lab.append(f'<text class="scale-h" x="{f(x - 8)}" y="{f(y + 16)}" text-anchor="start">GENERATION</text>')
    x, y = pol(cx, cy, bounds[-1] + 10, 135)
    lab.append(f'<text class="scale-h" x="{f(x + 8)}" y="{f(y + 16)}" text-anchor="end">ANCESTORS</text>')
    # title block in the open sector
    ty = cy + 206
    s.append(f'<text class="t-kicker" x="{cx}" y="{ty}" text-anchor="middle">THE ANCESTORS OF</text>')
    s.append(f'<text class="t-title" x="{cx}" y="{ty + 56}" text-anchor="middle">Queen Victoria</text>')
    # second plate: the generation scale, the title rule and the subtitle
    s.append('<g class="plate-r">' + ''.join(lab) +
             f'<path class="t-rule" d="M{cx - 120} {ty + 80}h240M{cx - 120} {ty + 85}h240"/>'
             f'<text class="t-sub" x="{cx}" y="{ty + 110}" text-anchor="middle">SEVEN GENERATIONS \u00b7 {earliest(ind, ah, 7)}\u20131819</text></g>')
    # slug line + colour bar
    s.append(f'<g class="slug"><rect x="{tx0}" y="{ty1 + 10}" width="12" height="12" class="k"/><rect x="{tx0 + 14}" y="{ty1 + 10}" width="12" height="12" class="v"/>'
             f'<text x="{tx0 + 36}" y="{ty1 + 20}">FAN 270° · 7 GENERATIONS · LETTERPRESS STYLE · 18 × 24 IN</text>'
             f'<text x="{tx1}" y="{ty1 + 20}" text-anchor="end">DATA: WIKIDATA, CC0</text></g>')
    s.append('</svg>')
    return ''.join(s), legend


# ---------------------------------------------------------------- style proofs
STYLES = {
    'ivory': dict(face='garamond', face_b='garamond-semibold'),
    'midnight': dict(face='garamond', face_b='garamond-semibold'),
    'botanical': dict(face='garamond', face_b='garamond-semibold'),
    'letterpress': dict(face='garamond', face_b='garamond-semibold'),
    'nordic': dict(face='sans', face_b='sans-semibold'),
    'cartographer': dict(face='garamond', face_b='garamond-semibold'),
}


def laurel(cx, y, w, cls):
    """An engraved laurel spray pair, drawn from leaf ellipses along two arcs."""
    out = [f'<g class="{cls}">']
    for side in (-1, 1):
        pts = []
        for i in range(9):
            t = i / 8
            x = cx + side * (18 + t * w)
            yy = y - math.sin(t * math.pi * 0.9) * 26 + t * 6
            ang = side * (-20 - 50 * t)
            for leaf in (-1, 1):
                a = ang + leaf * 38 * side
                out.append(f'<ellipse cx="{f(x)}" cy="{f(yy)}" rx="9" ry="3.4" transform="rotate({f(a + (0 if side > 0 else 180))} {f(x)} {f(yy)}) translate({f(side * 7)} 0)"/>')
            pts.append((x, yy))
        d = 'M' + ' L'.join(f'{f(x)} {f(yy)}' for x, yy in pts)
        out.append(f'<path class="stem" d="{d}"/>')
    out.append('</g>')
    return ''.join(out)


def compass(x, y, r, cls):
    pts = []
    for k in range(8):
        a = k * 45
        rr = r if k % 2 == 0 else r * 0.55
        x1, y1 = pol(x, y, rr, a)
        xl, yl = pol(x, y, r * 0.16, a - 45 / 2 * 2 / 2 - 0)
        xr, yr = pol(x, y, r * 0.16, a + 45 / 2)
        xl, yl = pol(x, y, r * 0.16, a - 45 / 2)
        pts.append(f'<path class="{"cp-a" if k % 2 == 0 else "cp-b"}" d="M{f(x)} {f(y)}L{f(xl)} {f(yl)}L{f(x1)} {f(y1)}Z"/>')
        pts.append(f'<path class="cp-c" d="M{f(x)} {f(y)}L{f(xr)} {f(yr)}L{f(x1)} {f(y1)}Z"/>')
    nx, ny = pol(x, y, r + 11, 0)
    return (f'<g class="{cls}"><circle cx="{f(x)}" cy="{f(y)}" r="{f(r * 0.72)}" class="cp-ring"/>' + ''.join(pts) +
            f'<text x="{f(nx)}" y="{f(ny + 4)}" text-anchor="middle" class="cp-n">N</text></g>')


def proof(ind, ah, style):
    W, H = 600, 800
    gens = 5
    cx, cy, R = 300, 330, 262
    depths = [58, 54, 52, 70, 72]
    sizes = {0: (21, 11), 1: (14, 9.5), 2: (11, 8), 3: (9.2, 7.2), 4: (7.6, 6.2)}
    st = STYLES[style]
    body, bounds, _ = fan(ind, ah, uid=style[:2], gens=gens, R=R, r0=48, depths=depths, cx=cx, cy=cy,
                          sizes=sizes, numbers=False, collapse=False, face=st['face'], face_b=st['face_b'],
                          cls='fan')
    s = [f'<svg class="proof s-{style}" viewBox="0 0 {W} {H}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">',
         f'<rect class="ground" width="{W}" height="{H}"/>']
    if style == 'ivory':
        s.append(f'<rect class="frame1" x="22" y="22" width="{W - 44}" height="{H - 44}"/><rect class="frame2" x="30" y="30" width="{W - 60}" height="{H - 60}"/>')
    if style == 'cartographer':
        g = []
        for k in range(-6, 7):
            g.append(f'M{300 + k * 60} 0 Q{300 + k * 48} 400 {300 + k * 60} 800')
        for k in range(1, 14):
            g.append(f'M0 {k * 60} Q300 {k * 60 - 28} 600 {k * 60}')
        s.append(f'<path class="grat" d="{" ".join(g)}"/>')
        s.append(compass(528, 78, 36, 'compass'))
    if style == 'nordic':
        pass
    s.append(body)
    ty = 660
    title = {'nordic': 'Queen Victoria'}.get(style, 'Queen Victoria')
    s.append(f'<text class="pk" x="300" y="{ty}" text-anchor="middle">THE ANCESTORS OF</text>')
    s.append(f'<text class="pt" x="300" y="{ty + 50}" text-anchor="middle">{title}</text>')
    s.append(f'<text class="ps" x="300" y="{ty + (92 if style == "letterpress" else 80)}" text-anchor="middle">FIVE GENERATIONS · {earliest(ind, ah, 5)}–1819</text>')
    if style == 'botanical':
        s.append(laurel(300, ty + 110, 120, 'laurel'))
    if style == 'letterpress':
        s.append(f'<path class="lp-rule" d="M230 {ty + 69}h140M230 {ty + 74}h140"/>')
    s.append('</svg>')
    return ''.join(s)


# ---------------------------------------------------------------- mark
def _segments(cx, cy, rings, span, center, gap):
    d = []
    for (ri, ro, k) in rings:
        step = span / k
        gd = gap / ((ri + ro) / 2) * 180 / math.pi / 2
        for i in range(k):
            a0 = center - span / 2 + i * step
            d.append(wedge_path(cx, cy, ri, ro, a0 + gd, a0 + step - gd))
    return ''.join(d)


def mark(cls='mark', title=True):
    """The sort: a square block of black with a quarter fan cut out of it.
    Vermilion quarter disc = the root person (1); then 2 parents, 4 grandparents."""
    cx, cy = 5, 27
    a = ' role="img" aria-label="Gildroot"' if title else ' aria-hidden="true" focusable="false"'
    return (f'<svg class="{cls}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"{a}>'
            f'<rect class="m-block" width="32" height="32"/>'
            f'<path class="m-root" d="M{cx} {cy}L{cx} {cy - 8.4}A8.4 8.4 0 0 1 {cx + 8.4} {cy}Z"/>'
            f'<path class="m-ring" d="{_segments(cx, cy, [(10.4, 15.9, 2), (17.7, 23.4, 4)], 90, 45, 2.2)}"/>'
            '</svg>')


def chart_types():
    """Three pictograms: fan, bowtie, pedigree, drawn from the real geometry."""
    def mini_fan(cx, cy, span, center, rings=(0, 9, 17, 25), root=True):
        d = []
        for g in range(1, len(rings) - 1):
            k = 2 ** (g - 1) * 2
            step = span / k
            for i in range(k):
                a0 = center - span / 2 + i * step
                d.append(wedge_path(cx, cy, rings[g], rings[g + 1], a0, a0 + step))
        out = f'<path class="ct-w" d="{"".join(d)}"/>'
        if root:
            out += f'<circle class="ct-r" cx="{cx}" cy="{cy}" r="{rings[1] - 2}"/>'
        return out
    fan_svg = mini_fan(40, 38, 270, 0, rings=(0, 9, 18, 27, 35))
    bow = mini_fan(30, 36, 180, -90, rings=(0, 7, 15, 23, 30), root=False) + mini_fan(50, 36, 180, 90, rings=(0, 7, 15, 23, 30), root=False)
    bow += '<circle class="ct-r" cx="40" cy="36" r="8"/>'
    ped = []
    boxes = [(4, 31, 16), (26, 17, 12), (26, 45, 12), (46, 10, 8), (46, 24, 8), (46, 38, 8), (46, 52, 8)]
    for (x, y, w) in boxes:
        ped.append(f'M{x} {y - 3}h{w + 10}v6h-{w + 10}Z')
    con = 'M20 34h3v-14h3M23 34v14h3M44 20h-1v-7h3M43 20v7h3M44 48h-1v-7h3M43 48v7h3'
    ped_svg = f'<path class="ct-w" d="{"".join(ped[1:])}"/><path class="ct-rb" d="{ped[0]}"/><path class="ct-c" d="{con}"/>'
    items = [('Fan', fan_svg), ('Bowtie', bow), ('Pedigree', ped_svg)]
    lis = ''.join(f'<li><svg viewBox="0 0 80 76" aria-hidden="true" focusable="false">{svg}</svg><span>{name}</span></li>' for name, svg in items)
    return f'<ul class="ctypes">{lis}</ul>'


def sizes_fig():
    """Poster sizes side by side, to scale, each with a fan of its maximum depth."""
    k = 4.6  # px per inch
    sizes = [('Letter', 8.5, 11, 6), ('11\u00d714', 11, 14, 6), ('16\u00d720', 16, 20, 7), ('18\u00d724', 18, 24, 7), ('24\u00d736', 24, 36, 8)]
    gap = 12
    Wt = sum(w for _, w, _, _ in sizes) * k + gap * (len(sizes) - 1)
    Hmax = 36 * k
    W, H = Wt + 4, Hmax + 50
    base = Hmax + 2
    x = 2
    out = [f'<svg class="sizes-svg" viewBox="0 0 {f(W)} {f(H)}" role="img" aria-labelledby="sizes-t"><title id="sizes-t">Poster sizes to scale. A fan on Letter or 11 by 14 holds 6 generations, on 16 by 20 or 18 by 24 it holds 7, and on 24 by 36 it holds 8.</title>']
    for name, w, h, gen in sizes:
        pw, ph = w * k, h * k
        big = name.startswith('24')
        out.append(f'<rect class="sz{" big" if big else ""}" x="{f(x)}" y="{f(base - ph)}" width="{f(pw)}" height="{f(ph)}"/>')
        # the fan: concentric arcs, one per generation
        R = pw * 0.4
        fcx, fcy = x + pw / 2, base - ph + pw * 0.12 + R
        r0 = R * 0.18
        step = (R - r0) / (gen - 1)
        arcs = []
        for g in range(gen):
            r = r0 + g * step
            x0, y0 = pol(fcx, fcy, r, -135)
            x1, y1 = pol(fcx, fcy, r, 135)
            arcs.append(f'M{f(x0)} {f(y0)}A{f(r)} {f(r)} 0 1 1 {f(x1)} {f(y1)}')
        x0, y0 = pol(fcx, fcy, R, -135)
        x1, y1 = pol(fcx, fcy, R, 135)
        xa, ya = pol(fcx, fcy, r0, -135)
        xb, yb = pol(fcx, fcy, r0, 135)
        arcs.append(f'M{f(xa)} {f(ya)}L{f(x0)} {f(y0)}M{f(xb)} {f(yb)}L{f(x1)} {f(y1)}')
        # wedge dividers: 2, 4, 8 ... per ring (capped so small sheets stay legible)
        for g in range(1, gen):
            k2 = min(2 ** g, 16 if pw > 60 else 8)
            ra, rb = r0 + (g - 1) * step, r0 + g * step
            for i in range(1, k2):
                a = -135 + 270 * i / k2
                xa_, ya_ = pol(fcx, fcy, ra, a)
                xb_, yb_ = pol(fcx, fcy, rb, a)
                arcs.append(f'M{f(xa_)} {f(ya_)}L{f(xb_)} {f(yb_)}')
        out.append(f'<path class="sz-fan" d="{" ".join(arcs)}"/><circle class="sz-root" cx="{f(fcx)}" cy="{f(fcy)}" r="{f(r0 * 0.8)}"/>')
        out.append(f'<text class="sz-l{" big" if big else ""}" x="{f(x)}" y="{f(base + 20)}">{name}</text>')
        out.append(f'<text class="sz-g" x="{f(x)}" y="{f(base + 40)}">{gen} gen.</text>')
        x += pw + gap
    out.append('</svg>')
    return ''.join(out)


def card_fan():
    """The small fan printed on the front of the gift card (4 generations)."""
    cx, cy = 50, 50
    d = _segments(cx, cy, [(15, 26, 2), (27.5, 37, 4), (38.5, 47, 8)], 270, 0, 1.1)
    return (f'<svg class="gc-fan" viewBox="0 0 100 88" aria-hidden="true" focusable="false">'
            f'<path class="gcf-w" d="{d}"/><circle class="gcf-r" cx="{cx}" cy="{cy}" r="12.5"/></svg>')


def main():
    ind, fam = parse_gedcom(GED)
    ah = ahnentafel(ind, fam, gens=8)
    hero_svg, legend = hero(ind, ah)
    blocks = {'hero-fan': hero_svg, 'mark': mark(), 'mark-sm': mark('mark', False), 'chart-types': chart_types(),
              'sizes': sizes_fig(), 'card-fan': card_fan()}
    for st in STYLES:
        blocks['proof-' + st] = proof(ind, ah, st)
    # pedigree collapse: the person who appears most often, for the reading notes
    top = sorted(legend, key=lambda t: (-t[1], t[2]))[0]
    blocks['collapse-name'] = escape(top[0])
    blocks['collapse-count'] = str(top[1])
    blocks['collapse-total'] = str(len(legend))
    items = legend
    src = open(os.path.join(ROOT, 'src', 'index.html'), encoding='utf-8').read()

    def rep(m):
        k = m.group(1)
        if k not in blocks:
            raise SystemExit(f'unknown block {k}')
        return blocks[k]
    html = re.sub(r'<!--@([\w-]+)-->', rep, src)
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(html)
    # favicon
    fav = mark('fav', False).replace('<svg ', '<svg width="32" height="32" ').replace(
        '</svg>', '').replace('class="m-block"', 'fill="#141210"').replace('class="m-root"', 'fill="#D8341C"').replace('class="m-ring"', 'fill="#FFFFFF"')
    open(os.path.join(ROOT, 'images', 'favicon.svg'), 'w').write(fav + '</svg>')
    print('built index.html', len(html) // 1024, 'KB;', 'collapse:', items)


if __name__ == '__main__':
    main()
