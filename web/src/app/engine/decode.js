// Byte decoding for GEDCOM files: BOM sniffing, UTF-16, UTF-8, and the 8-bit code pages
// declared by `1 CHAR` (ANSEL, ANSI/CP1252, IBMPC/CP850, MACINTOSH/MacRoman).
// Everything returned is NFC-normalised. Pure JS, no DOM.

import { decodeAnsel } from './ansel.js';

const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F' +
  '\u0090‘’“”•–—˜™š›œ\u009DžŸ';

const CP850 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐' +
  '└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´\u00AD±‗¾¶§÷¸°¨·¹³²■\u00A0';

const MACROMAN = 'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\u00A0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ\uF8FFÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';

/** Build a 256-entry lookup table for a single-byte code page (0x00-0x7F = ASCII). */
function table(high) {
  const t = new Array(256);
  for (let i = 0; i < 128; i++) t[i] = String.fromCharCode(i);
  if (high === null) { for (let i = 128; i < 256; i++) t[i] = String.fromCharCode(i); return t; }
  const chars = Array.from(high);
  for (let i = 0; i < 128; i++) t[128 + i] = chars[i];
  return t;
}

const TABLES = {};
function tableFor(name) {
  if (!TABLES[name]) {
    TABLES[name] = table(name === 'CP1252' ? CP1252 + table(null).slice(160).join('') :
      name === 'CP850' ? CP850 : name === 'MACROMAN' ? MACROMAN : null);
  }
  return TABLES[name];
}

/**
 * Decode a single-byte code page.
 * @param {Uint8Array} u8
 * @param {'CP1252'|'CP850'|'MACROMAN'|'LATIN1'} name
 */
export function decodeSingleByte(u8, name) {
  const t = tableFor(name);
  const parts = [];
  const CHUNK = 16384;
  for (let i = 0; i < u8.length; i += CHUNK) {
    const end = Math.min(u8.length, i + CHUNK);
    let s = '';
    for (let j = i; j < end; j++) s += t[u8[j]];
    parts.push(s);
  }
  return parts.join('');
}

/** Map a `1 CHAR` value to a canonical charset name. */
export function canonicalCharset(value) {
  const v = String(value || '').trim().toUpperCase().replace(/[\s_]+/g, '-');
  if (!v) return null;
  if (/^UTF-?8$/.test(v) || v === 'UNICODE-UTF-8') return 'UTF-8';
  if (v === 'UNICODE' || v === 'UTF-16' || v === 'UCS-2') return 'UNICODE';
  if (v === 'UTF-16LE') return 'UTF-16LE';
  if (v === 'UTF-16BE') return 'UTF-16BE';
  if (v === 'ANSEL' || v === 'MARC-8' || v === 'MARC8') return 'ANSEL';
  if (v === 'ASCII' || v === 'US-ASCII') return 'ASCII';
  if (/^(ANSI|WINDOWS|WIN|CP-?1252|WINDOWS-?1252|MS-?1252|IBM-?WINDOWS|ISO-?8859-?1|ISO8859-?1|LATIN-?1|LATIN1)$/.test(v)) return 'CP1252';
  if (/^(IBMPC|IBM-?PC|IBM-?DOS|MS-?DOS|DOS|CP-?850|IBM-?850|OEM|CP-?437|IBM-?437)$/.test(v)) return 'CP850';
  if (/^(MACINTOSH|MAC|MACROMAN|MAC-?ROMAN|X-MAC-ROMAN|APPLE-?ROMAN)$/.test(v)) return 'MACROMAN';
  return null;
}

/** Find `1 CHAR xxx` in the header (read as ASCII). */
function sniffCharDeclaration(u8) {
  const limit = Math.min(u8.length, 65536);
  let head = '';
  for (let i = 0; i < limit; i++) head += String.fromCharCode(u8[i] < 128 ? u8[i] : 0x20);
  // Only look inside the HEAD record: stop at the first level-0 record after HEAD.
  const lines = head.split(/\r\n|\r|\n/);
  let inHead = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^0\s+HEAD\b/i.test(line)) { inHead = true; continue; }
    if (inHead && /^0\s/.test(line)) break;
    const m = line.match(/^1\s+CHAR(?:ACTER)?\s+(.+?)\s*$/i);
    if (m) return m[1];
  }
  return null;
}

/**
 * Scan bytes for UTF-8 validity.
 * @returns {{ valid: boolean, multibyte: number, invalid: number, high: number }}
 */
export function utf8Stats(u8) {
  let multibyte = 0, invalid = 0, high = 0;
  const n = u8.length;
  for (let i = 0; i < n; i++) {
    const b = u8[i];
    if (b < 0x80) continue;
    high++;
    let need = 0, min = 0;
    if (b >= 0xC2 && b <= 0xDF) { need = 1; min = 0x80; }
    else if (b >= 0xE0 && b <= 0xEF) { need = 2; min = 0x800; }
    else if (b >= 0xF0 && b <= 0xF4) { need = 3; min = 0x10000; }
    else { invalid++; continue; }
    if (i + need > n - 1) { invalid++; break; } // truncated sequence at the end
    let cp = b & (need === 1 ? 0x1F : need === 2 ? 0x0F : 0x07);
    let ok = true;
    for (let k = 1; k <= need; k++) {
      const c = u8[i + k];
      if (c === undefined || (c & 0xC0) !== 0x80) { ok = false; break; }
      cp = (cp << 6) | (c & 0x3F);
    }
    if (!ok || cp < min || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) { invalid++; continue; }
    multibyte++;
    i += need;
  }
  return { valid: invalid === 0, multibyte, invalid, high };
}

/** Heuristic: detect BOM-less UTF-16 by the pattern of zero bytes in the first 512 bytes. */
function sniffUtf16(u8) {
  const n = Math.min(u8.length, 512) & ~1;
  if (n < 4) return null;
  let evenZero = 0, oddZero = 0;
  for (let i = 0; i < n; i += 2) {
    if (u8[i] === 0) evenZero++;
    if (u8[i + 1] === 0) oddZero++;
  }
  const pairs = n / 2;
  if (oddZero > pairs * 0.6 && evenZero < pairs * 0.1) return 'UTF-16LE';
  if (evenZero > pairs * 0.6 && oddZero < pairs * 0.1) return 'UTF-16BE';
  return null;
}

function utf16(u8, offset, le) {
  const label = le ? 'utf-16le' : 'utf-16be';
  try {
    return new TextDecoder(label).decode(u8.subarray(offset));
  } catch {
    // Manual fallback (very old runtimes without utf-16be in TextDecoder).
    const parts = [];
    let s = '';
    for (let i = offset; i + 1 < u8.length; i += 2) {
      s += String.fromCharCode(le ? u8[i] | (u8[i + 1] << 8) : (u8[i] << 8) | u8[i + 1]);
      if (s.length > 16384) { parts.push(s); s = ''; }
    }
    parts.push(s);
    return parts.join('');
  }
}

function nfc(text) {
  // Skip the (cheap but not free) normalisation pass for pure-ASCII text.
  // eslint-disable-next-line no-control-regex
  return /[^\u0000-\u007F]/.test(text) ? text.normalize('NFC') : text;
}

/**
 * Decode GEDCOM bytes to text.
 * Order: BOM, BOM-less UTF-16, `1 CHAR` declaration (checked against the bytes), UTF-8, CP1252.
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {{ text: string, charset: string, declared: string|null, warnings: string[] }}
 */
export function decodeBytes(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const warnings = [];

  // 1. Byte order marks.
  if (u8.length >= 3 && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) {
    const text = new TextDecoder('utf-8').decode(u8.subarray(3));
    return { text: nfc(text), charset: 'UTF-8', declared: null, warnings };
  }
  if (u8.length >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) {
    return { text: nfc(stripBom(utf16(u8, 2, true))), charset: 'UTF-16LE', declared: null, warnings };
  }
  if (u8.length >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) {
    return { text: nfc(stripBom(utf16(u8, 2, false))), charset: 'UTF-16BE', declared: null, warnings };
  }

  // 2. UTF-16 without a BOM.
  const u16 = sniffUtf16(u8);
  if (u16) return { text: nfc(stripBom(utf16(u8, 0, u16 === 'UTF-16LE'))), charset: u16, declared: null, warnings };

  // 3. Declared charset, checked against the bytes. Programs often declare ANSEL or ANSI and
  //    then write UTF-8; valid multi-byte UTF-8 almost never happens by accident.
  const declaredRaw = sniffCharDeclaration(u8);
  const declared = canonicalCharset(declaredRaw);
  // Fast path: a strict UTF-8 decode (native) tells us most of what we need.
  let utf8Text = null;
  try { utf8Text = new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch { utf8Text = null; }
  let high, looksUtf8, strictUtf8 = utf8Text !== null;
  if (strictUtf8) {
    // eslint-disable-next-line no-control-regex
    high = /[^\u0000-\u007F]/.test(utf8Text) ? 1 : 0;
    looksUtf8 = high > 0;
  } else {
    // Mostly UTF-8 with a few broken bytes still counts as UTF-8.
    const stats = utf8Stats(u8);
    high = stats.high;
    looksUtf8 = stats.multibyte > 0 && stats.invalid <= Math.floor(stats.multibyte / 50);
  }

  if (declaredRaw && !declared) warnings.push(`Unknown character set "${declaredRaw}"; read it as ${looksUtf8 || high === 0 ? 'UTF-8' : 'Windows-1252'}.`);

  let charset;
  if (declared === 'ANSEL' || declared === 'CP1252' || declared === 'CP850' || declared === 'MACROMAN') {
    if (looksUtf8) {
      charset = 'UTF-8';
      warnings.push(`The file says ${declaredRaw} but contains UTF-8 text; read it as UTF-8.`);
    } else charset = declared;
  } else if (declared === 'ASCII') {
    charset = high === 0 || looksUtf8 ? 'UTF-8' : 'CP1252';
    if (high > 0) warnings.push(`The file says ASCII but contains accented characters; read it as ${charset === 'UTF-8' ? 'UTF-8' : 'Windows-1252'}.`);
  } else {
    // UTF-8, UNICODE without BOM/zeros (treated as UTF-8), GEDCOM 7 (no CHAR), unknown.
    if (strictUtf8 || looksUtf8) charset = 'UTF-8';
    else {
      charset = 'CP1252';
      warnings.push('Some characters were not valid UTF-8; read the file as Windows-1252.');
    }
  }

  let text;
  if (charset === 'UTF-8') text = utf8Text !== null ? utf8Text : new TextDecoder('utf-8').decode(u8);
  else if (charset === 'ANSEL') {
    text = decodeAnsel(u8);
    if (decodeAnsel.lastUnknownBytes > 0) warnings.push(`${decodeAnsel.lastUnknownBytes} byte(s) are not defined in ANSEL; read them as Windows-1252.`);
    return { text, charset, declared: declaredRaw, warnings }; // already NFC
  } else text = decodeSingleByte(u8, charset);
  return { text: nfc(stripBom(text)), charset, declared: declaredRaw, warnings };
}

function stripBom(s) {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}
