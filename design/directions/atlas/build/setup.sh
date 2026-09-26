#!/usr/bin/env bash
# Rebuild inputs for design/directions/atlas (run from this folder). Needs network once.
set -euo pipefail
npm i --no-audit --no-fund
mkdir -p cache
cp ../../../../web/src/assets/fonts/{CormorantGaramond-500,CormorantGaramond-500i,CormorantGaramond-600,EBGaramond-400,EBGaramond-400i,EBGaramond-600}.ttf cache/
for spec in 'Fira+Sans:wght@400;500;600'; do
  curl -s "https://fonts.googleapis.com/css2?family=$spec" | grep -oE "font-weight: [0-9]+|url\([^)]+\)" | paste - - |
  while read -r _ w u; do u=${u#url(}; curl -s -o "cache/FiraSans-$w.ttf" "${u%)}"; done
done
curl -sS -o cache/land-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json
curl -sS -o cache/countries-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json
node wikidata.mjs
# self-hosted WOFF2, subset to Latin, Latin Extended, Greek, Cyrillic and Vietnamese
for f in CormorantGaramond-500 CormorantGaramond-500i CormorantGaramond-600 EBGaramond-400 EBGaramond-400i EBGaramond-600 FiraSans-400 FiraSans-500 FiraSans-600; do
  pyftsubset "cache/$f.ttf" --unicodes="U+0000-024F,U+0259,U+02B0-02FF,U+0300-036F,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2000-206F,U+20AC,U+2100-215F,U+2190-2193,U+2212,U+2215,U+25CB,U+25CF" \
    --layout-features='*' --flavor=woff2 --output-file="../fonts/$f.woff2"
done
node build.mjs
