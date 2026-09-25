"""Fetch ancestors via Wikidata entity API (wbgetentities), write GEDCOM. CC0 data."""
import json, sys, time, urllib.request, urllib.parse
sys.path.insert(0, '.')
from wd_ancestors import to_gedcom
UA = 'StemmaShowcase/0.1 (https://github.com/laqaer/bookgen)'
def get(ids, props='claims|labels'):
    out = {}
    for i in range(0, len(ids), 50):
        url = 'https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({'action': 'wbgetentities', 'ids': '|'.join(ids[i:i+50]), 'props': props, 'languages': 'en', 'format': 'json'})
        for t in range(5):
            try:
                out.update(json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60))['entities']); break
            except Exception as e:
                print('retry', e, file=sys.stderr); time.sleep(3 * (t + 1))
        time.sleep(0.3)
    return out
def claim(e, p):
    for c in e.get('claims', {}).get(p, []):
        v = c['mainsnak'].get('datavalue', {}).get('value')
        if v is not None: return v
def time_str(v):
    if not v: return None
    t, prec = v['time'], v['precision']
    y = t[:5] if t.startswith('-') else t[1:5]
    if prec >= 11: return t.lstrip('+')[:10] + 'T'
    if prec == 10: return t.lstrip('+')[:7] + '-01T'
    if prec == 9: return t.lstrip('+')[:4] + '-01-01T'
    return None
def ancestors(root, gens):
    ents, frontier = {}, [root]
    for g in range(gens):
        frontier = [q for q in dict.fromkeys(frontier) if q not in ents]
        if not frontier: break
        ents.update(get(frontier))
        nxt = []
        for q in frontier:
            for p in ('P22', 'P25'):
                v = claim(ents.get(q, {}), p)
                if v: nxt.append(v['id'])
        frontier = nxt
        print(f'gen {g+1}: {len(ents)}', file=sys.stderr)
    places = sorted({v['id'] for e in ents.values() for p in ('P19', 'P20') for v in [claim(e, p)] if v})
    pents = get(places)
    countries = sorted({v['id'] for e in pents.values() for v in [claim(e, 'P17')] if v})
    cents = get(countries, 'labels')
    lab = lambda e: e.get('labels', {}).get('en', {}).get('value')
    people = {}
    for q, e in ents.items():
        if 'missing' in e: continue
        sex = claim(e, 'P21'); sex = {'Q6581097': 'male', 'Q6581072': 'female'}.get(sex['id']) if sex else None
        r = {'id': q, 'pLabel': lab(e) or q, 'sexLabel': sex}
        for p, k in (('P22', 'father'), ('P25', 'mother')):
            v = claim(e, p)
            if v: r[k] = v['id']
        for p, k in (('P569', 'birth'), ('P570', 'death')):
            s = time_str(claim(e, p))
            if s: r[k] = s
        bp = claim(e, 'P19')
        if bp and bp['id'] in pents:
            r['bplaceLabel'] = lab(pents[bp['id']])
            c = claim(pents[bp['id']], 'P17')
            if c and c['id'] in cents: r['bcountryLabel'] = lab(cents[c['id']])
        dp = claim(e, 'P20')
        if dp and dp['id'] in pents: r['dplaceLabel'] = lab(pents[dp['id']])
        people[q] = r
    return people
if __name__ == '__main__':
    root, gens, out, title = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
    ppl = ancestors(root, gens)
    open(out, 'w').write(to_gedcom(ppl, root, title))
    print(out, len(ppl), 'people', file=sys.stderr)
