// Broadside homepage mockup: lineage tracing on the specimen, and a drop zone
// that reads a GEDCOM file locally (FileReader) and never sends it anywhere.
(function () {
  'use strict';

  // ---- trace a line back to the centre (Ahnentafel: parent of n is n >> 1)
  var spec = document.querySelector('.specimen');
  if (spec) {
    var slots = {};
    spec.querySelectorAll('[data-n]').forEach(function (el) {
      var k = el.getAttribute('data-n');
      (slots[k] = slots[k] || []).push(el);
    });
    var lit = [];
    function clear() {
      lit.forEach(function (el) { el.classList.remove('lit'); });
      lit = [];
      spec.classList.remove('tracing');
    }
    spec.addEventListener('pointerover', function (e) {
      var g = e.target.closest('[data-n]');
      if (!g) return;
      clear();
      for (var n = +g.getAttribute('data-n'); n >= 1; n = n >> 1) {
        (slots[n] || []).forEach(function (el) { el.classList.add('lit'); lit.push(el); });
      }
      spec.classList.add('tracing');
    });
    spec.addEventListener('pointerleave', clear);
  }

  // ---- drop zone
  var hero = document.getElementById('drop');
  var input = document.getElementById('file');
  var status = document.getElementById('dz-status');
  if (!hero || !input || !status) return;

  function say(html) { status.innerHTML = html; }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function read(file) {
    if (!file) return;
    var name = esc(file.name);
    if (!/\.ged$/i.test(file.name)) {
      say('<b>' + name + '</b> is ready. The studio unzips .zip and .gdz files on this computer too.');
      return;
    }
    var r = new FileReader();
    r.onload = function () {
      var text = String(r.result);
      var people = (text.match(/^0 @[^@]+@ INDI/gm) || []).length;
      var fams = (text.match(/^0 @[^@]+@ FAM/gm) || []).length;
      function n(k, one, many) { return k.toLocaleString('en-US') + ' ' + (k === 1 ? one : many); }
      say('Read <b>' + n(people, 'person', 'people') + '</b> and ' + n(fams, 'family', 'families') +
          ' from ' + name + ' on this computer. Nothing was uploaded.');
    };
    r.onerror = function () { say('We couldn’t open ' + name + '. Try exporting it again.'); };
    r.readAsText(file);
  }

  input.addEventListener('change', function () { read(input.files && input.files[0]); });

  var depth = 0;
  hero.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; hero.classList.add('is-over'); });
  hero.addEventListener('dragover', function (e) { e.preventDefault(); });
  hero.addEventListener('dragleave', function () { if (--depth <= 0) { depth = 0; hero.classList.remove('is-over'); } });
  hero.addEventListener('drop', function (e) {
    e.preventDefault(); depth = 0; hero.classList.remove('is-over');
    read(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  // close the small-screen menu after choosing a section
  document.querySelectorAll('.menu a').forEach(function (a) {
    a.addEventListener('click', function () { a.closest('details').removeAttribute('open'); });
  });
})();
