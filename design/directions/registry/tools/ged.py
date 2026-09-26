"""Tiny GEDCOM reader for the Registry mockup (Victoria sample only)."""
import re, unicodedata
from pathlib import Path

GED = Path(__file__).resolve().parents[4] / 'web/src/samples/victoria.ged'

def load(path=GED):
    indi, fam = {}, {}
    cur = None; ctx = None
    for raw in path.read_text(encoding='utf-8').splitlines():
        m = re.match(r'(\d+) (@[^@]+@ )?(\w+) ?(.*)', raw.strip())
        if not m: continue
        lvl, xref, tag, val = int(m.group(1)), (m.group(2) or '').strip(), m.group(3), m.group(4)
        if lvl == 0:
            ctx = None
            if tag == 'INDI': cur = indi.setdefault(xref, {'id': xref, 'fams': [], 'famc': None}); kind = 'I'
            elif tag == 'FAM': cur = fam.setdefault(xref, {'id': xref, 'chil': []}); kind = 'F'
            else: cur = None
            continue
        if cur is None: continue
        if lvl == 1:
            ctx = tag
            if tag == 'NAME': cur['name'] = unicodedata.normalize('NFC', val.replace('/', '').strip())
            elif tag == 'SEX': cur['sex'] = val
            elif tag == 'FAMC': cur['famc'] = val
            elif tag == 'FAMS': cur['fams'].append(val)
            elif tag == 'HUSB': cur['husb'] = val
            elif tag == 'WIFE': cur['wife'] = val
            elif tag == 'CHIL': cur['chil'].append(val)
        elif lvl == 2 and ctx in ('BIRT', 'DEAT'):
            if tag == 'DATE': cur[ctx.lower() + '_date'] = val
            if tag == 'PLAC': cur[ctx.lower() + '_plac'] = val
    return indi, fam

def year(d):
    if not d: return None
    m = re.search(r'(\d{3,4})(?!.*\d{3,4})', d)
    return int(m.group(1)) if m else None

def ahnentafel(indi, fam, root='@I1@', gens=7):
    """Return {ahnentafel number: person dict} for generations 1..gens."""
    out = {1: indi[root]}
    for n in range(1, 2 ** (gens - 1)):
        p = out.get(n)
        if not p or not p.get('famc'): continue
        f = fam.get(p['famc'])
        if not f: continue
        if f.get('husb') in indi: out[2 * n] = indi[f['husb']]
        if f.get('wife') in indi: out[2 * n + 1] = indi[f['wife']]
    return out

if __name__ == '__main__':
    indi, fam = load()
    for g in (5, 6, 7, 8):
        a = ahnentafel(indi, fam, gens=g)
        ids = [p['id'] for p in a.values()]
        print(g, 'gens: slots', 2 ** g - 1, 'filled', len(a), 'distinct', len(set(ids)))
    a = ahnentafel(indi, fam, gens=7)
    from collections import Counter
    c = Counter(p['id'] for p in a.values())
    print('repeats', [(indi[i]['name'], k) for i, k in c.items() if k > 1])
    ys = [year(p.get('birt_date')) for p in a.values() if year(p.get('birt_date'))]
    print('years', min(ys), max(ys))
    for n in sorted(a):
        if n < 64:
            p = a[n]; print(n, p['name'], '|', p.get('birt_date'), '|', p.get('birt_plac'), '|', p.get('deat_date'))
