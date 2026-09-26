// Name handling: the abbreviation ladder used when a name does not fit its slot, plus small
// helpers for splitting typed names. Names are never hyphenated. Pure JS, no DOM.

const PARTICLES = new Set(['van', 'von', 'de', 'der', 'den', 'del', 'della', 'delle', 'dei', 'di', 'da', 'du', 'des', 'la', 'le', 'ten', 'ter',
  'te', 'zu', 'zum', 'zur', 'dos', 'das', 'do', 'y', 'e', 'bin', 'ibn', 'ben', 'bat', 'al', 'el', 'af', 'av', 'op', "d'", 'st', 'st.', 'lo', "o'"]);

const TITLES = new Set(['prince', 'princess', 'duke', 'duchess', 'count', 'countess', 'king', 'queen', 'lord', 'lady', 'sir', 'dame', 'dr', 'rev',
  'reverend', 'baron', 'baroness', 'margrave', 'margravine', 'landgrave', 'landgravine', 'elector', 'electress', 'archduke', 'archduchess',
  'emperor', 'empress', 'grand', 'earl', 'marquess', 'marquis', 'marchioness', 'viscount', 'viscountess', 'fr', 'hon', 'capt', 'captain',
  'col', 'colonel', 'gen', 'general', 'mr', 'mrs', 'ms', 'miss', 'herr', 'frau', 'graf', 'grafin', 'gräfin', 'fürst', 'furst', 'fürstin', 'herzog',
  'herzogin', 'prinz', 'prinzessin', 'freiherr', 'freifrau', 'don', 'doña', 'dona', 'dom', 'saint', 'st', 'infante', 'infanta', 'tsar', 'czar',
  'tsarina', 'czarina', 'sultan', 'shah', 'pope', 'bishop', 'burgrave', 'dauphin', 'crown', 'hereditary', 'rhinegrave', 'wildgrave', 'waldgrave']);

const SUFFIX_RE = /^(jr|sr|jnr|snr|ii|iii|iv|v|vi|vii|viii|esq|md|phd)\.?$/i;
const ROMAN_RE = /^(?=[IVXLC])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/;
const CJK_RE = /[\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF]/;

function clean(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/** First letter of a word as an initial: "Johann" -> "J.", "Jean-Pierre" -> "J.-P.", "Ødegård" -> "Ø.". */
export function initialOf(word) {
  const w = clean(word).replace(/^["'“‘(]+|["'”’)]+$/g, '');
  if (!w) return '';
  return w.split('-').filter(Boolean).map(part => {
    const letters = Array.from(part.normalize('NFC'));
    const first = letters.find(ch => /\p{L}/u.test(ch)) || letters[0];
    return first.toLocaleUpperCase() + '.';
  }).join('-');
}

/** Initial of a surname: first capitalised word ("van der Berg" -> "B."), keeps hyphen pairs. */
function surnameInitial(surname) {
  const words = clean(surname).split(' ');
  const main = words.find(w => /^\p{Lu}/u.test(w) && !PARTICLES.has(w.toLowerCase())) || words[words.length - 1] || '';
  return initialOf(main);
}

function givenWords(given) {
  // Drop quoted nicknames and parenthesised parts from the abbreviation steps.
  return clean(given.replace(/"[^"]*"|“[^”]*”|\([^)]*\)/g, ' ')).split(' ').filter(Boolean);
}

function stripTitles(s) {
  const words = clean(s).split(' ');
  let i = 0;
  while (i < words.length - 1 && TITLES.has(words[i].toLowerCase().replace(/\.$/, ''))) i++;
  return words.slice(i).join(' ');
}

/** Ladder for names without a surname ("George III of Great Britain", "Prince Edward, Duke of Kent"). */
function styledLadder(full) {
  const cands = [full];
  cands.push(stripTitles(full));
  const comma = full.indexOf(',');
  const of = full.search(/\s(of|von|zu|de|av|af)\s/i);
  let cut = -1;
  if (comma > 0 && (of < 0 || comma < of)) cut = comma;
  else if (of > 0) cut = of;
  const head = cut > 0 ? full.slice(0, cut).trim() : full;
  cands.push(head);
  const bare = stripTitles(head);
  cands.push(bare);
  const words = bare.split(' ').filter(Boolean);
  const isNum = w => ROMAN_RE.test(w) || /^\d+(st|nd|rd|th)?$/i.test(w);
  const names = words.filter(w => !isNum(w));
  const nums = words.filter(isNum);
  if (names.length >= 2) {
    for (let k = names.length - 1; k >= 1; k--) cands.push([...names.slice(0, k), initialOf(names[k]), ...nums].join(' '));
  }
  if (names.length) cands.push([...names.slice(0, 2).map(initialOf), ...nums].join(' '));
  // Keep only candidates that get strictly shorter.
  const out = [];
  for (const c of cands.map(clean)) {
    if (!c) continue;
    if (!out.length || c.length < out[out.length - 1].length) out.push(c);
  }
  return out;
}

/**
 * Abbreviation ladder, from the full name down to initials. Layout tries each rung in order.
 * "Johann Georg Friedrich Weber" → "Johann Georg F. Weber" → "Johann G. Weber" → "J. G. Weber"
 * → "Weber" → "J. G. W.". Names without a surname (royal styles) shorten at "of"/commas instead.
 * @param {{ given?: string, surname?: string, name?: string, suffix?: string }} person
 * @returns {string[]}
 */
export function nameLadder(person) {
  if (!person) return [];
  const given = clean(person.given);
  const surname = clean(person.surname);
  const suffix = clean(person.suffix);
  const full = clean(person.name) || clean([given, surname, suffix].filter(Boolean).join(' '));
  if (!full) return [];
  const out = [];
  const push = s => { s = clean(s); if (s && !out.includes(s)) out.push(s); };

  if (!surname) return styledLadder(full);

  // CJK names: no initials; full name, then the family name alone.
  if (CJK_RE.test(full)) {
    push(full);
    push(surname);
    return out;
  }

  const words = givenWords(given);
  const surnameFirst = !!given && full.startsWith(surname) && !full.startsWith(given);
  if (surnameFirst) {
    // "Nguyễn Thị Hoa": family name first; the last given name is the one people use.
    push(full);
    if (words.length > 1) push(`${surname} ${words[words.length - 1]}`);
    push(surname);
    push([surnameInitial(surname), ...words.slice(-2).map(initialOf)].join(' '));
    return out;
  }

  push(full);
  if (suffix || given !== words.join(' ')) push([given && words.join(' '), surname].filter(Boolean).join(' '));
  const n = words.length;
  if (n >= 2) {
    for (let k = n - 1; k >= 1; k--) push(`${words.slice(0, k).join(' ')} ${initialOf(words[k])} ${surname}`);
    push(`${words.slice(0, 2).map(initialOf).join(' ')} ${surname}`);
  } else if (n === 1) {
    push(`${initialOf(words[0])} ${surname}`);
  }
  push(surname);
  push([...words.slice(0, 2).map(initialOf), surnameInitial(surname)].join(' '));
  return out;
}

/**
 * Split a typed name into given name, surname and suffix.
 * Accepts GEDCOM style ("Anna /Kowalski/") or plain ("Anna Maria van der Berg Jr.").
 * A single word is taken as a given name.
 * @param {string} full
 * @returns {{ given: string, surname: string, suffix: string }}
 */
export function splitName(full) {
  const s = clean(full);
  if (!s) return { given: '', surname: '', suffix: '' };
  const m = s.match(/^(.*?)\/([^/]*)\/?(.*)$/);
  if (m) {
    const before = clean(m[1]), sur = clean(m[2]), after = clean(m[3]);
    if (before || !after) return { given: before, surname: sur, suffix: after };
    return SUFFIX_RE.test(after) ? { given: '', surname: sur, suffix: after } : { given: after, surname: sur, suffix: '' };
  }
  const words = s.split(' ');
  let suffix = '';
  if (words.length > 2 && SUFFIX_RE.test(words[words.length - 1])) suffix = words.pop();
  if (words.length === 1) return { given: words[0], surname: '', suffix };
  let i = words.length - 1;
  while (i > 1 && PARTICLES.has(words[i - 1].toLowerCase())) i--;
  return { given: words.slice(0, i).join(' '), surname: words.slice(i).join(' '), suffix };
}

/**
 * Title-case a name part written in capitals ("SMITH" -> "Smith", "VAN DER BERG" -> "van der Berg",
 * "O'BRIEN" -> "O'Brien"). Mixed-case input is returned unchanged.
 * @param {string} s
 * @returns {string}
 */
export function fixCaps(s) {
  const str = clean(s);
  const letters = str.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2 || letters !== letters.toLocaleUpperCase() || letters === letters.toLocaleLowerCase()) return str;
  return str.split(' ').map((w, i, arr) => {
    const lw = w.toLocaleLowerCase();
    if (i < arr.length - 1 && PARTICLES.has(lw)) return lw;
    if (ROMAN_RE.test(w)) return w;
    return lw.replace(/(^|[-'’])(\p{L})/gu, (_, p, ch) => p + ch.toLocaleUpperCase())
      .replace(/^Mc(\p{L})/u, (_, ch) => 'Mc' + ch.toLocaleUpperCase());
  }).join(' ');
}
