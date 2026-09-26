// Atlas mockup behaviour. Nothing here touches the network.
(() => {
  const drop = document.getElementById('drop');
  const input = document.getElementById('file');
  const status = document.getElementById('drop-status');
  const title = document.getElementById('drop-title');
  if (drop && input) {
    const read = file => {
      if (!file) return;
      // Count people locally, the way the studio would: GEDCOM "0 @I1@ INDI" records.
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        const people = (text.match(/^0 @[^@]+@ INDI/gm) || []).length;
        title.textContent = people ? `Read ${people.toLocaleString('en-US')} people from ${file.name}` : `${file.name} doesn't look like a GEDCOM file`;
        status.textContent = people ? 'Read on this computer. Nothing was uploaded.' : 'Nothing was uploaded. Try a .ged file, or build it in 3 minutes instead.';
      };
      reader.readAsText(file.slice(0, 50 * 1024 * 1024));
    };
    input.addEventListener('change', () => read(input.files[0]));
    let depth = 0;
    const set = s => { drop.dataset.state = s; };
    drop.addEventListener('dragenter', e => { e.preventDefault(); depth++; set('over'); title.textContent = 'Let go to read it on this computer'; });
    drop.addEventListener('dragover', e => e.preventDefault());
    drop.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; set('idle'); title.textContent = 'Drop your family tree file here'; } });
    drop.addEventListener('drop', e => { e.preventDefault(); depth = 0; set('idle'); read(e.dataTransfer.files[0]); });
  }
  // Draw the migration arcs once, when the map scrolls into view.
  const map = document.querySelector('.atlas-map');
  if (map && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { map.classList.add('in'); io.disconnect(); } }), { threshold: 0.35 });
    io.observe(map);
  }
})();
// On narrow screens the map scrolls sideways; start it on Germany, where most of the dots are.
(() => {
  const sc = document.querySelector('.map-scroll');
  if (sc && sc.scrollWidth > sc.clientWidth + 4) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) * 0.66;
})();
// Hovering an ancestor lights their line back to the centre, as the studio does.
(() => {
  const svg = document.querySelector('.hero-fan');
  const tip = document.getElementById('fan-tip');
  if (!svg || !tip || !matchMedia('(hover: hover)').matches) return;
  const box = svg.parentElement;
  let lit = [];
  const clear = () => { lit.forEach(el => el.classList.remove('lit')); lit = []; svg.classList.remove('tracing'); tip.hidden = true; };
  svg.addEventListener('pointerover', e => {
    const w = e.target.closest('path[data-n]');
    if (!w) return clear();
    clear();
    for (let n = +w.dataset.n; n >= 2; n = Math.floor(n / 2)) { const el = svg.querySelector(`path[data-n="${n}"]`); if (el) { el.classList.add('lit'); lit.push(el); } }
    svg.classList.add('tracing');
    const [name, ...rest] = (w.dataset.t || '').split(' · ');
    tip.textContent = '';
    const b = document.createElement('b'); b.textContent = `No. ${w.dataset.n} `; tip.append(b, name, document.createElement('br'), rest.join(' · '));
    tip.hidden = false;
  });
  svg.addEventListener('pointermove', e => { const r = box.getBoundingClientRect(); tip.style.left = `${e.clientX - r.left}px`; tip.style.top = `${e.clientY - r.top}px`; });
  svg.addEventListener('pointerleave', clear);
})();
