// ANSEL (ANSI/NISO Z39.47, MARC-8 Latin) decoder, with the GEDCOM 5.5 extensions.
// In ANSEL a combining diacritic byte comes BEFORE the letter it sits on; Unicode puts the
// combining mark AFTER the base letter. We reorder, then return NFC-composed text.
// Pure JS, no DOM.

/** Spacing graphic characters 0xA1-0xC8 plus GEDCOM extensions (0xBE, 0xBF, 0xCD-0xCF). */
const GRAPHIC = {
  0xA1: 'Ł', // Ł
  0xA2: 'Ø', // Ø
  0xA3: 'Đ', // Đ
  0xA4: 'Þ', // Þ
  0xA5: 'Æ', // Æ
  0xA6: 'Œ', // Œ
  0xA7: 'ʹ', // ʹ soft sign
  0xA8: '·', // · middle dot
  0xA9: '♭', // ♭ flat
  0xAA: '®', // ®
  0xAB: '±', // ±
  0xAC: 'Ơ', // Ơ
  0xAD: 'Ư', // Ư
  0xAE: 'ʼ', // ʼ alif
  0xB0: 'ʻ', // ʻ ayn
  0xB1: 'ł', // ł
  0xB2: 'ø', // ø
  0xB3: 'đ', // đ
  0xB4: 'þ', // þ
  0xB5: 'æ', // æ
  0xB6: 'œ', // œ
  0xB7: 'ʺ', // ʺ hard sign
  0xB8: 'ı', // ı dotless i
  0xB9: '£', // £
  0xBA: 'ð', // ð
  0xBC: 'ơ', // ơ
  0xBD: 'ư', // ư
  0xBE: '□', // □ empty box (GEDCOM)
  0xBF: '■', // ■ black box (GEDCOM)
  0xC0: '°', // ° degree
  0xC1: 'ℓ', // ℓ script small l
  0xC2: '℗', // ℗
  0xC3: '©', // ©
  0xC4: '♯', // ♯ sharp
  0xC5: '¿', // ¿
  0xC6: '¡', // ¡
  0xC7: 'ß', // ß (MARC-21)
  0xC8: '€', // € (MARC-21)
  0xCD: 'e', // midline e (GEDCOM)
  0xCE: 'o', // midline o (GEDCOM)
  0xCF: 'ß', // ß es-zet (GEDCOM)
  0x8D: '\u200D', // zero width joiner
  0x8E: '\u200C', // zero width non-joiner
};

/** Combining diacritics 0xE0-0xFE -> Unicode combining marks. */
const COMBINING = {
  0xE0: '\u0309', // hook above
  0xE1: '\u0300', // grave
  0xE2: '\u0301', // acute
  0xE3: '\u0302', // circumflex
  0xE4: '\u0303', // tilde
  0xE5: '\u0304', // macron
  0xE6: '\u0306', // breve
  0xE7: '\u0307', // dot above
  0xE8: '\u0308', // diaeresis (umlaut)
  0xE9: '\u030C', // caron (hacek)
  0xEA: '\u030A', // ring above
  0xEB: '\uFE20', // ligature, left half
  0xEC: '\uFE21', // ligature, right half
  0xED: '\u0315', // comma above right
  0xEE: '\u030B', // double acute
  0xEF: '\u0310', // candrabindu
  0xF0: '\u0327', // cedilla
  0xF1: '\u0328', // ogonek (right hook)
  0xF2: '\u0323', // dot below
  0xF3: '\u0324', // double dot below
  0xF4: '\u0325', // ring below
  0xF5: '\u0333', // double underline
  0xF6: '\u0332', // underline
  0xF7: '\u0326', // comma below (left hook)
  0xF8: '\u031C', // right cedilla (left half ring below)
  0xF9: '\u032E', // breve below (upadhmaniya)
  0xFA: '\uFE22', // double tilde, left half
  0xFB: '\uFE23', // double tilde, right half
  0xFE: '\u0313', // comma above (high comma, centred)
};

/** Spacing forms used when a diacritic has no letter to sit on (before a space, newline or end). */
const SPACING = {
  '\u0300': '`', '\u0301': '´', '\u0302': '^', '\u0303': '~', '\u0304': '¯',
  '\u0306': '˘', '\u0307': '˙', '\u0308': '¨', '\u030A': '˚', '\u030B': '˝',
  '\u030C': 'ˇ', '\u0327': '¸', '\u0328': '˛',
};

// Bytes that ANSEL leaves undefined. Real-world "ANSEL" files sometimes carry stray Windows-1252
// bytes; we decode those as CP1252 rather than dropping them.
const CP1252_HIGH = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F' +
  '\u0090‘’“”•–—˜™š›œ\u009DžŸ';

function fallbackChar(b) {
  if (b >= 0x80 && b <= 0x9F) return CP1252_HIGH[b - 0x80];
  return String.fromCharCode(b); // Latin-1 for 0xA0-0xFF leftovers
}

/**
 * Decode ANSEL bytes to a composed (NFC) Unicode string.
 * Diacritics precede their base letter in ANSEL; several may stack on one letter.
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {string}
 */
export function decodeAnsel(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const out = [];
  let chunk = '';
  let pending = ''; // combining marks waiting for their base letter
  let unknown = 0;
  const flush = () => { if (chunk) { out.push(chunk); chunk = ''; } };

  const emitBase = (ch) => {
    if (pending) {
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
        // A diacritic followed by space/line end is a spacing diacritic.
        let spacing = '';
        for (const m of pending) spacing += SPACING[m] || '';
        chunk += spacing + (ch === ' ' ? '' : ch);
      } else {
        chunk += ch + pending;
      }
      pending = '';
    } else {
      chunk += ch;
    }
  };

  for (let i = 0; i < u8.length; i++) {
    const b = u8[i];
    if (b < 0x80) {
      // Fast path: run of plain ASCII with no pending marks.
      if (!pending) {
        let j = i;
        while (j < u8.length && u8[j] < 0x80) j++;
        if (j - i > 1) {
          let s = '';
          for (let k = i; k < j; k++) s += String.fromCharCode(u8[k]);
          chunk += s;
          if (chunk.length > 8192) flush();
          i = j - 1;
          continue;
        }
      }
      emitBase(String.fromCharCode(b));
    } else if (COMBINING[b] !== undefined) {
      pending += COMBINING[b];
    } else if (GRAPHIC[b] !== undefined) {
      emitBase(GRAPHIC[b]);
    } else if (b === 0x88 || b === 0x89) {
      // non-sorting character begin/end markers: drop
    } else {
      unknown++;
      emitBase(fallbackChar(b));
    }
    if (chunk.length > 8192) flush();
  }
  if (pending) {
    let spacing = '';
    for (const m of pending) spacing += SPACING[m] || '';
    chunk += spacing;
  }
  flush();
  const text = out.join('').normalize('NFC');
  decodeAnsel.lastUnknownBytes = unknown;
  return text;
}

/** Count of bytes in the last decodeAnsel() call that are undefined in ANSEL (decoded as CP1252). */
decodeAnsel.lastUnknownBytes = 0;

/**
 * Encode a Unicode string as ANSEL bytes (used for test fixtures and round-trip checks).
 * Characters with no ANSEL form become '?'.
 * @param {string} str
 * @returns {Uint8Array}
 */
export function encodeAnsel(str) {
  const graphicRev = new Map();
  for (const [k, v] of Object.entries(GRAPHIC)) {
    const code = Number(k);
    if (code >= 0xCD && code <= 0xCF) continue;
    if (!graphicRev.has(v)) graphicRev.set(v, code);
  }
  graphicRev.set('ß', 0xCF);
  const combRev = new Map(Object.entries(COMBINING).map(([k, v]) => [v, Number(k)]));
  const bytes = [];
  const nfd = str.normalize('NFD');
  const chars = Array.from(nfd);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const code = ch.codePointAt(0);
    // Gather combining marks that follow this base letter.
    const marks = [];
    while (i + 1 < chars.length && combRev.has(chars[i + 1])) marks.push(combRev.get(chars[++i]));
    for (const m of marks) bytes.push(m);
    if (code < 0x80) bytes.push(code);
    else if (graphicRev.has(ch)) bytes.push(graphicRev.get(ch));
    else if (!combRev.has(ch)) bytes.push(0x3F);
  }
  return Uint8Array.from(bytes);
}
