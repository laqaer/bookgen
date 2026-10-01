// /print/ size planner. Progressive enhancement: the page already shows every size in a
// table; this script only updates the "At this size" panel from the data-* attributes on
// each radio button (generated from web/src/app/charts/sizes.js SIZE_LIMITS and the studio's
// tiling code, and checked against them by web/test/site/pages.test.mjs). No network use.

const $ = id => document.getElementById(id);
const planner = $('planner');
if (planner) {
  const inputs = [...planner.querySelectorAll('input[name="size"]')];
  const FREE = new Set(['letter', 'a4']);
  const PX_PER_IN = 6; // the scale drawing: 6px per inch, 216px tall for 36 in
  function update(input) {
    const d = input.dataset;
    const label = d.label;
    $('p-size-line').innerHTML = `At ${label}`;
    $('p-fan').innerHTML = `${d.fan}<small>generations</small>`;
    $('p-bowtie').innerHTML = `${d.bowtie}<small>each side</small>`;
    $('p-pedigree').innerHTML = `${d.pedigree}<small>generations</small>`;
    $('p-frame').innerHTML = d.frame;
    const letter = Number(d.letter), a4 = Number(d.a4);
    $('p-home').textContent = FREE.has(input.value)
      ? 'Prints on one sheet on a home printer. No tiling needed.'
      : `${letter} Letter sheets (or ${a4} A4), plus one page with the assembly map.`;
    $('p-free').textContent = FREE.has(input.value)
      ? 'Yes, a fan or pedigree PDF of up to 5 generations in the Ivory style. More generations, other styles and the bowtie are part of the $29 license.'
      : `No. Sizes above Letter and A4 are part of the $29 license, paid once.`;
    const w = Number(d.w), h = Number(d.h);
    const sheet = $('p-sheet');
    sheet.style.width = `${Math.round(w * PX_PER_IN)}px`;
    sheet.style.height = `${Math.round(h * PX_PER_IN)}px`;
    sheet.innerHTML = label;
    $('p-letter-sheet').style.display = FREE.has(input.value) ? 'none' : '';
    $('p-scale-cap').textContent = FREE.has(input.value) ? 'To scale.' : 'To scale, beside a Letter sheet.';
  }
  inputs.forEach(i => i.addEventListener('change', () => update(i)));
  const start = inputs.find(i => i.checked) || inputs[0];
  if (start) update(start);
  // keep the static markup's scale honest before the first change
  $('p-letter-sheet').style.width = `${Math.round(8.5 * PX_PER_IN)}px`;
  $('p-letter-sheet').style.height = `${Math.round(11 * PX_PER_IN)}px`;
}
