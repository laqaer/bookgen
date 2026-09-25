"""Fetch an ancestor tree from Wikidata (CC0) and write it as GEDCOM 5.5.1."""
import json, sys, time, urllib.request, urllib.parse
UA = 'StemmaShowcase/0.1 (https://github.com/laqaer/bookgen)'
def sparql(q):
    url = 'https://query.wikidata.org/sparql?' + urllib.parse.urlencode({'query': q, 'format': 'json'})
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/sparql-results+json'})
            return json.load(urllib.request.urlopen(req, timeout=60))['results']['bindings']
        except Exception as e:
            print('retry', e, file=sys.stderr); time.sleep(2 * (i + 1))
    raise SystemExit('sparql failed')
def qid(u): return u.rsplit('/', 1)[-1]
def fetch(qids):
    vals = ' '.join('wd:' + q for q in qids)
    q = f'''SELECT ?p ?pLabel ?father ?mother ?sexLabel ?birth ?death ?bplaceLabel ?bcountryLabel ?dplaceLabel WHERE {{
      VALUES ?p {{ {vals} }}
      OPTIONAL {{ ?p wdt:P22 ?father }} OPTIONAL {{ ?p wdt:P25 ?mother }} OPTIONAL {{ ?p wdt:P21 ?sex }}
      OPTIONAL {{ ?p wdt:P569 ?birth }} OPTIONAL {{ ?p wdt:P570 ?death }}
      OPTIONAL {{ ?p wdt:P19 ?bplace . OPTIONAL {{ ?bplace wdt:P17 ?bcountry }} }}
      OPTIONAL {{ ?p wdt:P20 ?dplace }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }} }}'''
    out = {}
    for b in sparql(q):
        p = qid(b['p']['value']); r = out.setdefault(p, {'id': p})
        for k in ('pLabel', 'sexLabel', 'birth', 'death', 'bplaceLabel', 'bcountryLabel', 'dplaceLabel'):
            if k in b and k not in r: r[k] = b[k]['value']
        for k in ('father', 'mother'):
            if k in b and k not in r: r[k] = qid(b[k]['value'])
    return out
def ancestors(root, gens):
    people, frontier = {}, [root]
    for g in range(gens):
        frontier = [q for q in dict.fromkeys(frontier) if q not in people]
        if not frontier: break
        for i in range(0, len(frontier), 150):
            people.update(fetch(frontier[i:i + 150])); time.sleep(1)
        frontier = [p[k] for q in frontier if q in people for p in [people[q]] for k in ('father', 'mother') if k in p]
        print(f'gen {g+1}: {len(people)} people', file=sys.stderr)
    return people
MON = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split()
def gdate(s):
    if not s or s.startswith('http'): return None
    neg = s.startswith('-'); s = s.lstrip('-+'); y, m, d = s[:10].split('-')
    y = int(y)
    if neg: return None
    return f'{int(d)} {MON[int(m)-1]} {y}' if d != '00' and m != '00' and not (m == '01' and d == '01') else str(y)
def to_gedcom(people, root, title):
    ids = {q: f'@I{i+1}@' for i, q in enumerate(people)}
    L = ['0 HEAD', '1 SOUR STEMMA', '2 NAME Stemma showcase (Wikidata CC0)', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', f'1 NOTE {title}. Source: Wikidata (CC0).']
    fams = {}
    for q, p in people.items():
        f, m = p.get('father'), p.get('mother')
        f = f if f in people else None; m = m if m in people else None
        if f or m: fams.setdefault((f, m), []).append(q)
    famid = {k: f'@F{i+1}@' for i, k in enumerate(fams)}
    for q, p in people.items():
        name = p.get('pLabel', q)
        if name == q: name = 'Unknown'
        parts = name.split(' ')
        L += [f'0 {ids[q]} INDI', f'1 NAME {name}', f'1 SEX {"M" if p.get("sexLabel")=="male" else "F" if p.get("sexLabel")=="female" else "U"}']
        b, d = gdate(p.get('birth')), gdate(p.get('death'))
        if b or p.get('bplaceLabel'):
            L.append('1 BIRT')
            if b: L.append(f'2 DATE {b}')
            if p.get('bplaceLabel'): L.append(f'2 PLAC {p["bplaceLabel"]}' + (f', {p["bcountryLabel"]}' if p.get('bcountryLabel') and p.get('bcountryLabel') != p.get('bplaceLabel') else ''))
        if d or p.get('dplaceLabel'):
            L.append('1 DEAT')
            if d: L.append(f'2 DATE {d}')
            if p.get('dplaceLabel'): L.append(f'2 PLAC {p["dplaceLabel"]}')
        L.append(f'1 NOTE Wikidata {q}')
        for k, kids in fams.items():
            if q in kids: L.append(f'1 FAMC {famid[k]}')
            if q in k: L.append(f'1 FAMS {famid[k]}')
    for (f, m), kids in fams.items():
        L.append(f'0 {famid[(f, m)]} FAM')
        if f: L.append(f'1 HUSB {ids[f]}')
        if m: L.append(f'1 WIFE {ids[m]}')
        for c in kids: L.append(f'1 CHIL {ids[c]}')
    L.append('0 TRLR')
    return '\n'.join(L) + '\n'
if __name__ == '__main__':
    root, gens, out, title = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
    ppl = ancestors(root, gens)
    open(out, 'w').write(to_gedcom(ppl, root, title))
    print(out, len(ppl), 'people', file=sys.stderr)
