// Fetch birthplace coordinates (P19 -> P625) and modern country (P17) for every person in the sample, from Wikidata (CC0).
import fs from 'node:fs';
import { readGed } from './ged.mjs';
const g = readGed('/home/user/bookgen/web/src/samples/victoria.ged');
const qids = Object.values(g.indi).map(p => p.qid).filter(Boolean);
const q = `SELECT ?p ?place ?placeLabel ?coord ?countryLabel WHERE {
  VALUES ?p { ${qids.map(x => 'wd:' + x).join(' ')} }
  ?p wdt:P19 ?place . OPTIONAL { ?place wdt:P625 ?coord . } OPTIONAL { ?place wdt:P17 ?country . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/sparql-results+json', 'user-agent': 'GildrootDesignMockup/0.1 (design research)' }, body: 'query=' + encodeURIComponent(q) });
const j = await r.json();
const out = {};
for (const b of j.results.bindings) {
  const id = b.p.value.split('/').pop();
  const m = b.coord?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
  (out[id] ??= { place: b.placeLabel?.value, countries: [] });
  if (m) out[id].lonlat = [+m[1], +m[2]];
  if (b.countryLabel && !out[id].countries.includes(b.countryLabel.value)) out[id].countries.push(b.countryLabel.value);
}
fs.writeFileSync('cache/birthplaces.json', JSON.stringify(out, null, 1));
console.log(qids.length, 'people;', Object.keys(out).length, 'with birthplace;', Object.values(out).filter(o => o.lonlat).length, 'with coords');
