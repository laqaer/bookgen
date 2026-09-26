// Markdown rendering of the QA gate report (web/test/out/report.md).

import { relative } from 'node:path';

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const badge = s => ({ pass: 'PASS', fail: '**FAIL**', skip: 'skip', warn: 'warn' }[s] || s);
const round = (v, d = 1) => (v == null ? '—' : Math.round(v * 10 ** d) / 10 ** d);

/** Group failure messages that differ only in numbers or quoted values. */
function groupFailures(rows) {
  const groups = new Map();
  for (const r of rows) {
    for (const f of r.failures || []) {
      if (/^Scene IR: \d+ problem/.test(f)) continue;
      const key = f.replace(/"[^"]*"/g, '"…"').replace(/items(\[\d+\]|\.items)*/g, 'items[…]').replace(/-?\d+(\.\d+)?/g, 'N').slice(0, 160);
      if (!groups.has(key)) groups.set(key, { key, example: f, count: 0, ids: [] });
      const g = groups.get(key);
      g.count++;
      if (g.ids.length < 4 && !g.ids.includes(r.id)) g.ids.push(r.id);
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

function matrixSection(m, title, opts) {
  const out = [`## ${title}`, ''];
  if (!m) { out.push('Not run.', ''); return out; }
  out.push(`**${badge(m.status)}** — ${esc(m.message)}`, '');
  if (!m.rows?.length) return out;
  if (m.charts?.length) out.push(`- Charts rendered: ${m.charts.join(', ')}${m.missingCharts?.length ? ` (not present yet, skipped: ${m.missingCharts.join(', ')})` : ''}`);
  if (m.summary) out.push(`- ${m.summary.renders} renders in ${m.summary.seconds} s on ${m.summary.workers} browser page(s): ${m.summary.pass} pass, ${m.summary.fail} fail${m.summary.skip ? `, ${m.summary.skip} skipped` : ''}`);
  const rendered = m.rows.filter(r => r.pdf);
  if (rendered.length) {
    const minText = Math.min(...rendered.map(r => r.pdf.minFontSize).filter(v => v != null));
    const minStroke = Math.min(...rendered.map(r => r.stats?.minStroke).filter(v => v != null));
    const diffs = rendered.map(r => r.pdf.diff).filter(Boolean);
    out.push(`- Smallest text in any PDF: ${round(minText, 2)} pt (floor 5.5 pt); thinnest stroke in any Scene: ${round(minStroke, 2)} pt (minimum 0.35 pt)`);
    if (diffs.length) out.push(`- Canvas vs PDF raster diff over ${diffs.length} renders: worst mean ${round(Math.max(...diffs.map(d => d.meanAbs)), 2)}/255 (limit 6), worst changed ${round(Math.max(...diffs.map(d => d.changedPct)), 2)}% of pixels (limit 2%)`);
    const names = rendered.reduce((s, r) => s + (r.pdf.namesChecked || 0), 0);
    out.push(`- Text runs checked for extraction (NFC): ${names.toLocaleString('en-US')}`);
  }
  const bench = m.rows.find(r => r.bench);
  if (bench) out.push(`- Performance, ${bench.id} (${bench.bench.items} items): re-render ${bench.bench.rerenderMs} ms (layout ${bench.bench.layoutMs} + canvas ${bench.bench.canvasMs}; budget < 150 ms), PDF ${bench.bench.pdfMs} ms (budget < 2 s), ${Math.round(bench.bench.pdfBytes / 1024)} KB`);
  out.push('');

  if (m.corpus?.length) {
    out.push('| Corpus file | Tier | People | Root | Parse |', '|---|---|---|---|---|');
    for (const c of m.corpus) out.push(`| ${esc(c.label)} | ${c.tier} | ${c.count ?? '—'} | ${esc(c.suggestedRoot ?? '—')} | ${c.ok ? `${c.parseMs ?? '—'} ms` : `**${esc(c.error)}**`} |`);
    out.push('');
  }

  // file × chart
  const charts = [...new Set(m.rows.map(r => r.chart))];
  const trees = [...new Set(m.rows.map(r => r.tree))];
  out.push(`| File | ${charts.join(' | ')} |`, `|---|${charts.map(() => '---').join('|')}|`);
  for (const t of trees) {
    const cells = charts.map(c => {
      const rs = m.rows.filter(r => r.tree === t && r.chart === c);
      if (!rs.length) return '—';
      const f = rs.filter(r => r.status === 'fail').length, p = rs.filter(r => r.status === 'pass').length, s = rs.filter(r => r.status === 'skip').length;
      return `${p}/${rs.length - s} pass${f ? ` · **${f} fail**` : ''}${s ? ` · ${s} skip` : ''}`;
    });
    out.push(`| ${t} | ${cells.join(' | ')} |`);
  }
  out.push('');

  // style × colour mode
  const styles = [...new Set(m.rows.map(r => r.style))];
  const modes = [...new Set(m.rows.map(r => r.colorMode))];
  if (styles.length > 1 || modes.length > 1) {
    out.push(`| Style | ${modes.join(' | ')} |`, `|---|${modes.map(() => '---').join('|')}|`);
    for (const st of styles) {
      out.push(`| ${st} | ${modes.map(md => {
        const rs = m.rows.filter(r => r.style === st && r.colorMode === md && r.status !== 'skip');
        const f = rs.filter(r => r.status === 'fail').length;
        return rs.length ? `${rs.length - f}/${rs.length}${f ? ' **✗**' : ''}` : '—';
      }).join(' | ')} |`);
    }
    out.push('');
  }

  const defects = m.rows.filter(r => r.expectFail);
  if (defects.length) {
    out.push('| Injected defect | Caught | Gate said |', '|---|---|---|');
    for (const d of defects) out.push(`| ${esc(d.variant.replace(/^defect-/, ''))} | ${d.status === 'pass' ? 'yes' : '**NO**'} | ${esc((d.caught || []).slice(0, 2).join(' · ')).slice(0, 220)} |`);
    out.push('');
  }

  const failing = m.rows.filter(r => r.status === 'fail');
  if (failing.length) {
    out.push(`### Failures (${failing.length} renders)`, '', '| Count | Problem | Examples |', '|---|---|---|');
    for (const g of groupFailures(failing).slice(0, 30)) out.push(`| ${g.count} | ${esc(g.example).slice(0, 240)} | ${g.ids.map(esc).join('<br>')} |`);
    out.push('');
    out.push('<details><summary>Every failing render</summary>', '');
    for (const r of failing.slice(0, 200)) {
      out.push(`- **${esc(r.id)}**${r.note ? ` (${esc(r.note)})` : ''}${r.files?.pdf ? ` — \`${relative(opts.repo, r.files.pdf)}\`` : ''}`);
      for (const f of r.failures.slice(0, 8)) out.push(`  - ${esc(f).slice(0, 300)}`);
    }
    if (failing.length > 200) out.push(`- … ${failing.length - 200} more in report.json`);
    out.push('', '</details>', '');
  }

  const warned = m.rows.filter(r => r.warnings?.length);
  if (warned.length) {
    const kinds = new Map();
    for (const r of warned) for (const w of r.warnings) {
      const k = w.replace(/\s*\(.*$/, '').split(':')[0].replace(/\d+/g, 'N');
      if (!kinds.has(k)) kinds.set(k, { k, count: 0, example: `${r.id}: ${w}` });
      kinds.get(k).count++;
    }
    out.push(`### Warnings (do not fail the gate)`, '', '| Count | Kind | Example |', '|---|---|---|');
    for (const w of [...kinds.values()].sort((a, b) => b.count - a.count)) out.push(`| ${w.count} | ${esc(w.k)} | ${esc(w.example).slice(0, 260)} |`);
    out.push('');
  }
  const pre = m.rows.filter(r => r.preflight?.triggered?.length);
  if (pre.length) {
    out.push(`Glyph preflight triggered on ${pre.length} render(s) (names the fonts cannot draw were replaced by their romanized form before export, as the studio asks the user to): ${[...new Set(pre.flatMap(r => r.preflight.triggered.map(p => `${p.name} → ${r.preflight.overrides?.[p.id]?.name || 'hidden'}`)))].map(esc).join('; ')}.`, '');
  }
  if (m.pageErrors?.length) out.push(`Browser errors during the matrix: ${m.pageErrors.slice(0, 5).map(e => '`' + esc(e).slice(0, 160) + '`').join(', ')}`, '');
  return out;
}

function privacySection(p) {
  const out = ['## Privacy', ''];
  if (!p) { out.push('Not run.', ''); return out; }
  out.push(`**${badge(p.status)}** — ${esc(p.message)}`, '');
  out.push(`Allowed third-party hosts: ${p.allowedHosts.join(', ')} (answered locally with an empty 200; nothing is sent). Request URLs and bodies are scanned for ${p.tokens} name words from the sample files and GEDCOM record markers. Service workers are blocked so every request is visible.`, '');
  out.push('| Page | Kind | Requests | Third-party | Result | Notes |', '|---|---|---|---|---|---|');
  for (const pg of p.pages) {
    const third = pg.external.length ? [...new Set(pg.external.map(e => `${e.host}${e.allowed ? '' : ' ✗'}`))].join(', ') : '—';
    const notes = [...pg.violations, ...(pg.kind === 'canary' && pg.caught ? [`caught ${pg.caught.length} planted leaks`] : []), ...pg.notes].join(' · ');
    out.push(`| \`${esc(pg.path)}\` | ${pg.kind}${pg.blocking ? '' : ' (report only)'} | ${pg.requests} | ${esc(third)} | ${badge(pg.status)} | ${esc(notes).slice(0, 300)} |`);
  }
  out.push('');
  return out;
}

/**
 * @param {object} report see run-all.mjs
 * @param {{ outDir: string, repo: string }} opts
 */
export function renderMarkdown(report, opts) {
  const e = report.env;
  const out = [
    '# Gildroot QA gate report',
    '',
    `**Result: ${report.status === 'pass' ? 'PASS' : 'FAIL'}** · ${report.generatedAt.replace('T', ' ').slice(0, 16)} UTC · ${report.seconds} s · commit \`${report.commit || '?'}\`${report.dirty ? ' + uncommitted changes' : ''} on \`${report.branch || '?'}\``,
    '',
    `Node ${e.node} · Chromium ${e.chromium || '—'} · PyMuPDF ${e.pymupdf || '—'} · ${e.platform}${e.ci ? ' · CI' : ''} · \`${report.command}\``,
    '',
    '| Step | Result | Detail | Time |',
    '|---|---|---|---|',
    ...report.steps.map(s => `| ${s.label} | ${badge(s.status)} | ${esc(s.message).slice(0, 400)} | ${s.seconds != null ? `${s.seconds} s` : '—'} |`),
    '',
  ];
  for (const s of report.steps.filter(x => x.status === 'fail' && (x.failing?.length || x.output))) {
    out.push(`### ${s.label}: what failed`, '');
    if (s.failing?.length) out.push(...s.failing.map(f => `- ${esc(f)}`), '');
    if (s.output) out.push('```', s.output.slice(-4000), '```', '');
    if (s.log) out.push(`Full log: \`${s.log}\``, '');
  }
  out.push(...matrixSection(report.matrix, 'Chart render matrix', opts));
  out.push(...matrixSection(report.selfTest, 'Matrix self-test (stub layout, injected defects)', opts));
  out.push(...privacySection(report.privacy));
  out.push('## Reproduce', '', '```bash',
    'node web/test/run-all.mjs                      # everything',
    'node web/test/run-all.mjs --only matrix --quick --files victoria --charts fan',
    'node web/test/run-all.mjs --only matrix --keep  # keep every PDF under web/test/out/matrix/',
    'python3 tools/qa/pdfcheck.py <file.pdf> --size WxH --expect-names <file.names.txt>',
    '```', '',
    'Failing renders keep their PDF, canvas PNG, diff PNG and the list of expected text runs next to each other under `web/test/out/matrix/`.', '');
  return out.join('\n');
}
