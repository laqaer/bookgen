// GEDCOM date parsing (5.5, 5.5.1, 7.0) plus the free-text dates people actually type.
// parseDate(raw) -> GDate; formatYearRange(birth, death) -> "1819–1901". Pure JS, no DOM.

/**
 * @typedef {{ raw: string, year?: number, month?: number, day?: number,
 *   qualifier: ''|'ABT'|'CAL'|'EST'|'BEF'|'AFT'|'BET'|'FROM'|'TO'|'INT',
 *   year2?: number, dual?: string, sortKey: number|null, display: string,
 *   calendar?: 'julian'|'hebrew'|'french'|'roman'|'unknown', phrase?: string }} GDate
 */

const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Month names in the languages that show up in genealogy files. Keys are lower-case, no accents.
const MONTHS = new Map();
function addMonths(n, ...names) { for (const name of names) MONTHS.set(name, n); }
addMonths(1, 'jan', 'january', 'januar', 'janner', 'janvier', 'janv', 'januari', 'enero', 'ene', 'janeiro', 'gennaio', 'gen', 'leden', 'styczen', 'sty', 'tammikuu', 'januaris');
addMonths(2, 'feb', 'february', 'febr', 'februar', 'fevrier', 'fevr', 'fev', 'februari', 'febrero', 'fevereiro', 'febbraio', 'unor', 'luty', 'lut', 'helmikuu');
addMonths(3, 'mar', 'march', 'marz', 'maerz', 'mars', 'maart', 'marzo', 'marco', 'brezen', 'marzec', 'maalis', 'maaliskuu');
addMonths(4, 'apr', 'april', 'avril', 'avr', 'abril', 'abr', 'aprile', 'duben', 'kwiecien', 'kwi', 'huhtikuu');
addMonths(5, 'may', 'mai', 'mei', 'mayo', 'maio', 'maggio', 'mag', 'maj', 'kveten', 'toukokuu');
addMonths(6, 'jun', 'june', 'juni', 'juin', 'junio', 'junho', 'giugno', 'giu', 'cerven', 'czerwiec', 'cze', 'kesakuu');
addMonths(7, 'jul', 'july', 'juli', 'juillet', 'juil', 'julio', 'julho', 'luglio', 'lug', 'cervenec', 'lipiec', 'lip', 'heinakuu');
addMonths(8, 'aug', 'august', 'aout', 'augustus', 'agosto', 'ago', 'srpen', 'sierpien', 'sie', 'elokuu');
addMonths(9, 'sep', 'sept', 'september', 'septembre', 'septiembre', 'setiembre', 'setembro', 'settembre', 'set', 'zari', 'wrzesien', 'wrz', 'syyskuu');
addMonths(10, 'oct', 'october', 'okt', 'oktober', 'octobre', 'octubre', 'outubro', 'out', 'ottobre', 'ott', 'rijen', 'pazdziernik', 'paz', 'lokakuu');
addMonths(11, 'nov', 'november', 'novembre', 'noviembre', 'novembro', 'listopad', 'lis', 'marraskuu');
addMonths(12, 'dec', 'december', 'dez', 'dezember', 'decembre', 'diciembre', 'dic', 'dezembro', 'dicembre', 'prosinec', 'grudzien', 'gru', 'desember', 'des', 'joulukuu');

// French republican and Hebrew months (GEDCOM codes).
const FRENCH = ['VEND', 'BRUM', 'FRIM', 'NIVO', 'PLUV', 'VENT', 'GERM', 'FLOR', 'PRAI', 'MESS', 'THER', 'FRUC', 'COMP'];
const FRENCH_NAMES = ['Vendémiaire', 'Brumaire', 'Frimaire', 'Nivôse', 'Pluviôse', 'Ventôse', 'Germinal', 'Floréal', 'Prairial', 'Messidor', 'Thermidor', 'Fructidor', 'jour complémentaire'];
const HEBREW = ['TSH', 'CSH', 'KSL', 'TVT', 'SHV', 'ADR', 'ADS', 'NSN', 'IYR', 'SVN', 'TMZ', 'AAV', 'ELL'];
const HEBREW_NAMES = ['Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar II', 'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul'];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

function fold(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
}

// Qualifier words (upper-case, accents folded) in GEDCOM and common free-text forms.
const APPROX = new Map([
  ['ABT', 'ABT'], ['ABOUT', 'ABT'], ['CA', 'ABT'], ['CIRCA', 'ABT'], ['C', 'ABT'], ['CIR', 'ABT'], ['APPROX', 'ABT'],
  ['APPROXIMATELY', 'ABT'], ['AROUND', 'ABT'], ['UM', 'ABT'], ['VERS', 'ABT'], ['OMKRING', 'ABT'], ['OMKR', 'ABT'],
  ['ONGEVEER', 'ABT'], ['OMSTREEKS', 'ABT'], ['ASI', 'ABT'], ['CERCA', 'ABT'], ['ENV', 'ABT'], ['ENVIRON', 'ABT'],
  ['CAL', 'CAL'], ['CALC', 'CAL'], ['CALCULATED', 'CAL'],
  ['EST', 'EST'], ['ESTIMATED', 'EST'], ['ESTIMATE', 'EST'],
  ['BEF', 'BEF'], ['BEFORE', 'BEF'], ['BFR', 'BEF'], ['VOR', 'BEF'], ['AVANT', 'BEF'], ['VOOR', 'BEF'], ['ANTES', 'BEF'],
  ['AFT', 'AFT'], ['AFTER', 'AFT'], ['NACH', 'AFT'], ['APRES', 'AFT'], ['ETTER', 'AFT'], ['EFTER', 'AFT'], ['NA', 'AFT'], ['DEPOIS', 'AFT'],
  ['INT', 'INT'], ['INTERPRETED', 'INT'],
]);

/** Parse one simple date (no qualifiers): returns fields or null. */
function parseSimple(input, calendarHint) {
  let s = input.trim();
  const out = {};
  let calendar = calendarHint || null;

  // Calendar escapes: 5.5 "@#DJULIAN@", 7.0 "JULIAN".
  const esc = s.match(/^@#D([A-Z _]+)@\s*/i);
  if (esc) {
    const c = esc[1].toUpperCase().replace(/[_ ]+/g, ' ').trim();
    calendar = c === 'GREGORIAN' ? null : c === 'JULIAN' ? 'julian' : c === 'HEBREW' ? 'hebrew' : c.startsWith('FRENCH') ? 'french' : c === 'ROMAN' ? 'roman' : 'unknown';
    s = s.slice(esc[0].length);
  } else {
    const kw = s.match(/^(GREGORIAN|JULIAN|FRENCH_R|HEBREW)\s+/i);
    if (kw) {
      const c = kw[1].toUpperCase();
      calendar = c === 'GREGORIAN' ? null : c === 'JULIAN' ? 'julian' : c === 'HEBREW' ? 'hebrew' : 'french';
      s = s.slice(kw[0].length);
    }
  }
  if (!s) return null;

  // B.C. / BCE suffix.
  let bc = false;
  const bcm = s.match(/\s*\(?\b(B\.?\s?C\.?(?:E\.?)?|BCE)\)?\s*$/i);
  if (bcm && /\d/.test(s.slice(0, bcm.index))) { bc = true; s = s.slice(0, bcm.index); }

  // Non-Gregorian calendars with their own month codes.
  if (calendar === 'french' || calendar === 'hebrew') {
    const codes = calendar === 'french' ? FRENCH : HEBREW;
    const names = calendar === 'french' ? FRENCH_NAMES : HEBREW_NAMES;
    const m = s.toUpperCase().match(/^(?:(\d{1,2})\s+)?(?:([A-Z]{3,4})\s+)?(\d{1,4})$/);
    if (!m) return null;
    const day = m[1] ? +m[1] : undefined;
    const mi = m[2] ? codes.indexOf(m[2]) : -1;
    if (m[2] && mi < 0) return null;
    const cy = +m[3];
    let year;
    if (calendar === 'french') {
      // Year 1 began 22 Sep 1792. Vendémiaire-Frimaire (and early Nivôse) fall in the first Gregorian year.
      year = cy + 1791 + (mi < 0 || mi < 3 || (mi === 3 && (day || 1) <= 10) ? 0 : 1);
    } else {
      year = cy - 3761 + (mi < 0 ? 1 : mi <= 2 ? 0 : 1);
    }
    const text = [day, mi >= 0 ? names[mi] : '', calendar === 'french' ? `an ${ROMAN[cy] || cy}` : String(cy)].filter(v => v !== undefined && v !== '').join(' ');
    return { year, calendar, text, approxYear: true };
  }

  // ISO 8601: 1819-05-24, 1819-05.
  let m = s.match(/^(\d{3,4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (m) {
    out.year = +m[1];
    if (+m[2] >= 1 && +m[2] <= 12) out.month = +m[2];
    if (m[3] && +m[3] >= 1 && +m[3] <= 31 && out.month) out.day = +m[3];
    return finish(out, bc, calendar);
  }
  // Numeric day.month.year / month/day/year.
  m = s.match(/^(\d{1,2})\s*([./-])\s*(\d{1,2})\s*\2\s*(\d{3,4})$/);
  if (m) {
    let a = +m[1], b = +m[3];
    let day, month;
    if (a > 12 && b <= 12) { day = a; month = b; }
    else if (b > 12 && a <= 12) { month = a; day = b; }
    else if (m[2] === '/') { month = a; day = b; } // US style
    else { day = a; month = b; }
    if (month >= 1 && month <= 12) { out.month = month; if (day >= 1 && day <= 31) out.day = day; }
    out.year = +m[4];
    return finish(out, bc, calendar);
  }
  // month.year numeric: 05.1819 or 5/1819
  m = s.match(/^(\d{1,2})\s*[./]\s*(\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) {
    out.month = +m[1]; out.year = +m[2];
    return finish(out, bc, calendar);
  }

  // Token based: "24 MAY 1819", "May 24, 1819", "24. Mai 1819", "11 FEB 1731/32", "MAY 1819", "1819".
  const tokens = s.replace(/(\d)(st|nd|rd|th)\b/gi, '$1').split(/[\s,.]+|-(?=[A-Za-z])|(?<=[A-Za-z])-/).filter(Boolean);
  if (!tokens.length || tokens.length > 4) return null;
  const nums = [];
  for (const t of tokens) {
    const dm = t.match(/^(\d{1,4})\/(\d{1,4})$/);
    if (dm) {
      if (out.year !== undefined) return null;
      const y1 = +dm[1];
      const y2s = dm[2];
      const base = 10 ** y2s.length;
      let y2 = y2s.length >= String(y1).length ? +y2s : y1 - (y1 % base) + +y2s;
      if (y2 < y1 && y2s.length < String(y1).length) y2 += base;
      if (y2 === y1 + 1) {
        out.year = y2;
        out.dual = `${y1}/${String(y2 % 100).padStart(2, '0')}`;
      } else if (y2 > y1) {
        out.year = y1; out.rangeTo = y2;
      } else return null;
      continue;
    }
    if (/^\d+$/.test(t)) { nums.push(t); continue; }
    const key = fold(t).replace(/\.$/, '');
    if (MONTHS.has(key)) {
      if (out.month !== undefined) return null;
      out.month = MONTHS.get(key);
      continue;
    }
    return null; // unknown word
  }
  // Assign numbers. With a month: 3-4 digits = year, 1-2 digits = day. Without: one number = year.
  if (out.month !== undefined) {
    for (const t of nums) {
      const v = +t;
      if (t.length >= 3 && out.year === undefined) out.year = v;
      else if (t.length <= 2 && out.day === undefined && v >= 1 && v <= 31 && (out.year === undefined || nums.length === 1 || nums.indexOf(t) === 0)) out.day = v;
      else if (out.year === undefined) out.year = v;
      else return null;
    }
    if (out.year === undefined && out.day !== undefined && nums.length === 1 && bc) { out.year = out.day; delete out.day; }
  } else {
    if (nums.length > 1) return null;
    if (nums.length === 1) {
      if (out.year !== undefined) return null;
      if (nums[0].length < 3 && !bc && !calendar) return null;
      out.year = +nums[0];
    }
  }
  if (out.year === undefined && out.month === undefined) return null;
  return finish(out, bc, calendar);
}

function finish(out, bc, calendar) {
  if (bc && out.year !== undefined) out.year = -out.year;
  if (calendar) out.calendar = calendar;
  return out;
}

function simpleText(d) {
  if (d.text) return d.text;
  let y = '';
  if (d.year !== undefined) y = d.dual ? d.dual : d.year < 0 ? `${-d.year} BC` : String(d.year);
  const parts = [];
  if (d.day !== undefined && d.month !== undefined) parts.push(String(d.day));
  if (d.month !== undefined) parts.push(MONTH_ABBR[d.month]);
  if (y) parts.push(y);
  return parts.join(' ');
}

function sortKeyOf(d) {
  if (!d || d.year === undefined) return null;
  return d.year * 10000 + (d.month || 0) * 100 + (d.day || 0);
}

const cache = new Map();

/**
 * Parse a GEDCOM DATE value (or a human-typed date) into a GDate.
 * Never throws: unparseable text keeps its raw form as the display string.
 * @param {string} raw
 * @returns {GDate}
 */
export function parseDate(raw) {
  const key = raw == null ? '' : String(raw);
  const hit = cache.get(key);
  if (hit) return { ...hit };
  const res = parseDateUncached(key);
  if (cache.size > 20000) cache.clear();
  cache.set(key, res);
  return { ...res };
}

function make(raw, qualifier, a, b, phrase) {
  /** @type {GDate} */
  const g = { raw, qualifier, sortKey: null, display: '' };
  if (a) {
    if (a.year !== undefined) g.year = a.year;
    if (a.month !== undefined) g.month = a.month;
    if (a.day !== undefined) g.day = a.day;
    if (a.dual) g.dual = a.dual;
    if (a.calendar) g.calendar = a.calendar;
  }
  if (b && b.year !== undefined) g.year2 = b.year;
  if (phrase) g.phrase = phrase;
  g.sortKey = sortKeyOf(a);
  const ta = a ? simpleText(a) : '';
  const tb = b ? simpleText(b) : '';
  const bothYears = a && b && a.month === undefined && b.month === undefined && !a.text && !b.text;
  const range = (x, y) => (bothYears ? `${x}–${y}` : `${x} – ${y}`);
  switch (qualifier) {
    case 'ABT': case 'CAL': case 'EST': g.display = ta ? `c. ${ta}` : ''; break;
    case 'BEF': g.display = ta ? `before ${ta}` : ''; break;
    case 'AFT': g.display = ta ? `after ${ta}` : ''; break;
    case 'BET': g.display = ta && tb ? range(ta, tb) : ta ? `after ${ta}` : tb ? `before ${tb}` : ''; break;
    case 'FROM': g.display = ta && tb ? range(ta, tb) : ta ? `from ${ta}` : ''; break;
    case 'TO': g.display = ta ? `to ${ta}` : ''; break;
    case 'INT': g.display = ta || phrase || ''; break;
    default: g.display = ta || phrase || '';
  }
  if (!g.display) g.display = phrase || raw.trim();
  return g;
}

function parseDateUncached(raw) {
  let s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return { raw, qualifier: '', sortKey: null, display: '' };

  // Date phrase in parentheses, alone or after INT: "(Stillborn)", "INT 1843 (the famine year)".
  let phrase;
  const pm = s.match(/\(([^()]*)\)\s*$/);
  if (pm && !/^\s*B\.?\s?C/i.test(pm[1])) {
    phrase = pm[1].trim();
    s = s.slice(0, pm.index).trim();
  }
  if (!s) {
    // Phrase only: look for a year inside it.
    const y = phrase && phrase.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    const g = make(raw, '', y ? { year: +y[1] } : null, null, phrase);
    g.display = phrase;
    return g;
  }

  const up = fold(s).toUpperCase();
  // Calendar escape before a qualifier ("@#DJULIAN@ ABT 1700") is non-standard but seen; hoist it.
  let calendarHint = null;
  let body = up;
  const esc = up.match(/^@#D([A-Z _]+)@\s*/);
  if (esc && /^(ABT|BEF|AFT|BET|FROM|TO|CAL|EST|INT)\b/.test(up.slice(esc[0].length))) {
    const c = esc[1].replace(/[_ ]+/g, ' ').trim();
    calendarHint = c === 'JULIAN' ? 'julian' : c === 'HEBREW' ? 'hebrew' : c.startsWith('FRENCH') ? 'french' : null;
    body = up.slice(esc[0].length);
  }

  // BET x AND y / BETWEEN x AND y / ZWISCHEN x UND y / ENTRE x ET y / TUSSEN x EN y
  let m = body.match(/^(?:BET|BETWEEN|BTW|BTWN|ZW|ZWISCHEN|ENTRE|TUSSEN|MELLOM|MELLAN)\.?\s+(.+?)\s+(?:AND|&|UND|ET|E|EN|OG|OCH|Y|-|–)\s+(.+)$/);
  if (m) {
    const a = parseSimple(m[1], calendarHint);
    const b = parseSimple(m[2], calendarHint);
    if (a || b) return make(raw, 'BET', a || null, b || null, phrase);
  }
  // FROM x TO y / FROM x / TO y
  m = body.match(/^FROM\s+(.+?)(?:\s+TO\s+(.+))?$/);
  if (m) {
    const a = parseSimple(m[1], calendarHint);
    const b = m[2] ? parseSimple(m[2], calendarHint) : null;
    if (a) return make(raw, 'FROM', a, b, phrase);
  }
  m = body.match(/^TO\s+(.+)$/);
  if (m) {
    const a = parseSimple(m[1], calendarHint);
    if (a) return make(raw, 'TO', a, null, phrase);
  }

  // Leading qualifier word(s): ABT, EST., c., ca., ~, <, >, "before", "abt." ...
  let qualifier = '';
  let rest = body;
  const sym = rest.match(/^([~<>≈])\s*/);
  if (sym) {
    qualifier = sym[1] === '<' ? 'BEF' : sym[1] === '>' ? 'AFT' : 'ABT';
    rest = rest.slice(sym[0].length);
  } else {
    const qm = rest.match(/^([A-Z]+)\.?(?:\s+|(?=\d))/);
    if (qm && APPROX.has(qm[1])) {
      qualifier = APPROX.get(qm[1]);
      rest = rest.slice(qm[0].length);
    }
  }

  const simple = parseSimple(rest, calendarHint);
  if (simple) {
    if (simple.rangeTo !== undefined && !qualifier) {
      // "1790/95" style range that is not dual dating.
      const a = { ...simple }; delete a.rangeTo;
      return make(raw, 'BET', a, { year: simple.rangeTo }, phrase);
    }
    delete simple.rangeTo;
    return make(raw, qualifier, simple, null, phrase);
  }

  // "1790-1795", "1790 – 1795", "1790 to 1795"
  m = rest.match(/^(.+?)\s*(?:-|–|—|\bTO\b|\bTIL\b|\bBIS\b)\s*(.+)$/);
  if (m) {
    const a = parseSimple(m[1]);
    const b = parseSimple(m[2]);
    if (a && b && a.year !== undefined && b.year !== undefined) return make(raw, 'BET', a, b, phrase);
  }

  // "1840s" decade.
  m = rest.match(/^(\d{3})0'?S$/);
  if (m) {
    const g = make(raw, 'ABT', { year: +m[1] * 10 + 5 }, null, phrase);
    g.display = `${m[1]}0s`;
    return g;
  }

  // Fallback: any plausible year inside the text keeps sorting and year ranges working.
  const ym = rest.match(/\b(\d{4})\b/) || rest.match(/\b(\d{3})\b/);
  const g = make(raw, qualifier || (ym ? 'ABT' : ''), ym ? { year: +ym[1] } : null, null, phrase);
  g.display = s;
  if (phrase) g.display = `${s} (${phrase})`;
  return g;
}

/**
 * Short year form used in year ranges: "1819", "c. 1843", "bef. 1790", "1731/32".
 * @param {GDate|null|undefined} d
 * @returns {string}
 */
export function yearText(d) {
  if (!d || d.year === undefined) return '';
  const y = d.dual ? d.dual : d.year < 0 ? `${-d.year} BC` : String(d.year);
  switch (d.qualifier) {
    case 'ABT': case 'CAL': case 'EST': return `c. ${y}`;
    case 'BEF': return `bef. ${y}`;
    case 'AFT': return `aft. ${y}`;
    case 'TO': return `bef. ${y}`;
    case 'BET': case 'FROM':
      if (d.year2 !== undefined && d.year2 !== d.year) return `c. ${Math.round((d.year + d.year2) / 2)}`;
      return d.qualifier === 'FROM' && d.year2 === undefined ? y : `c. ${y}`;
    default: return y;
  }
}

function asDate(x) {
  if (!x) return null;
  if (typeof x === 'string') return parseDate(x);
  if ('date' in x && !('qualifier' in x)) return x.date || null; // a GEvent
  return x;
}

/**
 * Year range for labels: "1819–1901", "c. 1843–1901", "b. 1819", "d. 1901", "" when unknown.
 * Accepts GDates, GEvents ({ date }) or raw date strings.
 * @param {GDate|{date: GDate|null}|string|null} birth
 * @param {GDate|{date: GDate|null}|string|null} death
 * @returns {string}
 */
export function formatYearRange(birth, death) {
  const a = yearText(asDate(birth));
  const b = yearText(asDate(death));
  if (a && b) return `${a}–${b}`;
  if (a) return `b. ${a}`;
  if (b) return `d. ${b}`;
  return '';
}

/**
 * Compare two GDates for sorting (unknown dates last).
 * @param {GDate|null} a
 * @param {GDate|null} b
 */
export function compareDates(a, b) {
  const ka = a && a.sortKey != null ? a.sortKey : Infinity;
  const kb = b && b.sortKey != null ? b.sortKey : Infinity;
  return ka === kb ? 0 : ka < kb ? -1 : 1;
}
