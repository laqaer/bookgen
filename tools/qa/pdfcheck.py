#!/usr/bin/env python3
"""PDF QA gate for Gildroot chart exports (company/BRIEF.md section 4.8).

Checks one PDF with PyMuPDF and prints a JSON report:

  * page size: TrimBox (or MediaBox when there is no separate TrimBox) equals --size
  * fonts: every font embedded, no Type 3 fonts
  * text: every name in --expect-names is extractable (NFC, whitespace-collapsed)
  * glyphs: no .notdef ("NO GLYPH") glyphs in any text
  * sizes: no visible or invisible text below --min-size (default 5.5 pt)
  * strokes: at least one stroked path
  * optional: raster diff of page 1 against a canvas PNG (--compare)

Usage:
  pdfcheck.py chart.pdf --size 1728x2592 --expect-names names.txt
  pdfcheck.py chart.pdf --size 792x1008 --compare canvas.png --diff-out diff.png
Exit status: 0 when every requested check passes, 1 otherwise, 2 on usage errors.
"""

import argparse
import json
import sys
import unicodedata

try:
    import pymupdf
except ImportError:  # PyMuPDF < 1.24 only ships the fitz name
    import fitz as pymupdf  # type: ignore


def nfc(s):
    return unicodedata.normalize("NFC", s)


def collapse(s):
    return " ".join(nfc(s).split())


def parse_size(s):
    try:
        w, h = s.lower().replace("×", "x").split("x")
        return float(w), float(h)
    except Exception:
        raise argparse.ArgumentTypeError("size must look like 1728x2592 (points)")


def page_fonts(doc, pno):
    out = []
    for xref, ext, ftype, basefont, name, enc, *_ in doc.get_page_fonts(pno, full=True):
        out.append({
            "xref": xref,
            "name": basefont,
            "resource": name,
            "type": ftype,
            "ext": ext,
            "encoding": enc,
            "embedded": ext not in ("n/a", "", None),
        })
    return out


def text_spans(page):
    """All text spans with their sizes (includes invisible text)."""
    d = page.get_text("dict", flags=pymupdf.TEXTFLAGS_DICT & ~pymupdf.TEXT_PRESERVE_IMAGES)
    for block in d.get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                yield span


def notdef_count(page):
    n = 0
    samples = []
    try:
        trace = page.get_texttrace()
    except Exception:
        return None, []
    for span in trace:
        for ch in span.get("chars", []):
            uni, gid = ch[0], ch[1]
            if gid == 0 and uni not in (32, 160):
                n += 1
                if len(samples) < 10:
                    samples.append(chr(uni) if uni > 0 else "?")
    return n, samples


def drawings_count(page):
    strokes = fills = 0
    for d in page.get_drawings():
        t = d.get("type")
        if t in ("s", "fs"):
            strokes += 1
        if t in ("f", "fs"):
            fills += 1
    return strokes, fills


def raster_diff(page, png_path, diff_out=None):
    """Mean absolute difference (0-255) and share of clearly different pixels."""
    ref = pymupdf.Pixmap(png_path)
    if ref.alpha:
        ref = pymupdf.Pixmap(ref, 0)
    if ref.n != 3:
        ref = pymupdf.Pixmap(pymupdf.csRGB, ref)
    zoom_x = ref.width / page.rect.width
    zoom_y = ref.height / page.rect.height
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom_x, zoom_y), alpha=False, colorspace=pymupdf.csRGB)
    w, h = min(pix.width, ref.width), min(pix.height, ref.height)
    try:
        from PIL import Image, ImageChops, ImageFilter

        a = Image.frombytes("RGB", (pix.width, pix.height), pix.samples).crop((0, 0, w, h))
        b = Image.frombytes("RGB", (ref.width, ref.height), ref.samples).crop((0, 0, w, h))
        # soften anti-aliasing differences between the two rasterisers
        a2 = a.filter(ImageFilter.GaussianBlur(1))
        b2 = b.filter(ImageFilter.GaussianBlur(1))
        diff = ImageChops.difference(a2, b2).convert("L")
        hist = diff.histogram()
        total = w * h
        mean = sum(i * c for i, c in enumerate(hist)) / total
        changed = sum(hist[48:]) / total
        if diff_out:
            ImageChops.invert(diff.point(lambda v: min(255, v * 4))).save(diff_out)
        return {"method": "pil", "width": w, "height": h, "meanAbs": round(mean, 3), "changedPct": round(changed * 100, 3)}
    except ImportError:
        # pure-Python fallback on a 4x downsampled copy
        step = 4
        sa, sb = pix.samples, ref.samples
        tot = cnt = changed = 0
        for y in range(0, h, step):
            ra, rb = y * pix.stride, y * ref.stride
            for x in range(0, w, step):
                ia, ib = ra + x * 3, rb + x * 3
                dmax = max(abs(sa[ia] - sb[ib]), abs(sa[ia + 1] - sb[ib + 1]), abs(sa[ia + 2] - sb[ib + 2]))
                tot += dmax
                cnt += 1
                if dmax >= 48:
                    changed += 1
        return {"method": "sampled", "width": w, "height": h, "meanAbs": round(tot / cnt, 3), "changedPct": round(changed * 100 / cnt, 3)}


def check(args):
    report = {"file": args.pdf, "ok": True, "errors": []}

    def fail(msg):
        report["ok"] = False
        report["errors"].append(msg)

    doc = pymupdf.open(args.pdf)
    report["pages"] = doc.page_count
    pages = range(doc.page_count) if args.page is None else [args.page - 1]

    boxes = []
    for pno in pages:
        p = doc[pno]
        mb, tb = p.mediabox, p.trimbox
        boxes.append({
            "page": pno + 1,
            "mediabox": [round(mb.width, 3), round(mb.height, 3)],
            "trimbox": [round(tb.width, 3), round(tb.height, 3)],
        })
    report["mediabox"] = boxes[0]["mediabox"] if boxes else None
    report["trimbox"] = boxes[0]["trimbox"] if boxes else None
    if args.size:
        want_w, want_h = args.size
        bad = [b for b in boxes if abs(b["trimbox"][0] - want_w) > args.size_tolerance or abs(b["trimbox"][1] - want_h) > args.size_tolerance]
        report["size_ok"] = not bad
        if bad:
            fail(f"page size {bad[0]['trimbox']} (trim) != {want_w}x{want_h} on page {bad[0]['page']}")

    fonts = {}
    for pno in pages:
        for f in page_fonts(doc, pno):
            fonts[f["xref"]] = f
    report["fonts"] = list(fonts.values())
    report["type3"] = sum(1 for f in fonts.values() if f["type"] == "Type3")
    report["not_embedded"] = [f["name"] for f in fonts.values() if not f["embedded"]]
    if report["type3"]:
        fail(f"{report['type3']} Type 3 font(s)")
    if report["not_embedded"]:
        fail("fonts not embedded: " + ", ".join(report["not_embedded"]))

    text = []
    min_size = None
    small = []
    small_count = 0
    for pno in pages:
        page = doc[pno]
        text.append(page.get_text("text"))
        for span in text_spans(page):
            if not span.get("text", "").strip():
                continue
            size = span.get("size", 0)
            if min_size is None or size < min_size:
                min_size = size
            if size < args.min_size - 0.01:  # 0.01 pt: float noise in text matrices
                small_count += 1
                if len(small) < 20:
                    small.append({"page": pno + 1, "text": span["text"][:60], "size": round(size, 3)})
    full = collapse(" ".join(text))
    report["text_chars"] = len(full)
    report["min_font_size"] = round(min_size, 3) if min_size is not None else None
    report["small_text"] = small
    report["small_text_count"] = small_count
    if small_count:
        fail(f"{small_count} text span(s) below {args.min_size} pt")

    if args.expect_names:
        with open(args.expect_names, encoding="utf-8") as fh:
            names = [collapse(line) for line in fh if line.strip()]
        missing = [n for n in names if n not in full]
        report["names_checked"] = len(names)
        report["missing_names"] = missing
        if missing:
            fail(f"{len(missing)} of {len(names)} names not extractable")

    nd_total = 0
    nd_samples = []
    for pno in pages:
        n, s = notdef_count(doc[pno])
        if n is None:
            nd_total = None
            break
        nd_total += n
        nd_samples += s
    report["notdef_glyphs"] = nd_total
    if nd_total:
        fail(f"{nd_total} NO GLYPH (.notdef) glyph(s): {''.join(nd_samples[:10])}")

    strokes = fills = 0
    for pno in pages:
        s, f = drawings_count(doc[pno])
        strokes += s
        fills += f
    report["strokes"] = strokes
    report["fills"] = fills
    if args.require_strokes and strokes == 0:
        fail("no stroked paths")

    if args.compare:
        d = raster_diff(doc[0], args.compare, args.diff_out)
        report["diff"] = d
        if d["meanAbs"] > args.max_diff or d["changedPct"] > args.max_changed:
            fail(f"raster differs from {args.compare}: meanAbs {d['meanAbs']} (max {args.max_diff}), changed {d['changedPct']}% (max {args.max_changed}%)")

    return report


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("pdf")
    ap.add_argument("--size", type=parse_size, help="expected trim size in points, WxH")
    ap.add_argument("--size-tolerance", type=float, default=0.5)
    ap.add_argument("--expect-names", help="UTF-8 file, one displayed name per line")
    ap.add_argument("--min-size", type=float, default=5.5, help="smallest allowed text size in pt")
    ap.add_argument("--page", type=int, help="check only this page (1-based)")
    ap.add_argument("--require-strokes", action=argparse.BooleanOptionalAction, default=True)
    ap.add_argument("--compare", help="canvas PNG of page 1 to diff against")
    ap.add_argument("--diff-out", help="write a diff visualisation PNG here")
    ap.add_argument("--max-diff", type=float, default=6.0, help="max mean absolute difference (0-255)")
    ap.add_argument("--max-changed", type=float, default=2.0, help="max percent of clearly different pixels")
    args = ap.parse_args(argv)
    try:
        report = check(args)
    except Exception as e:  # unreadable PDF etc.
        report = {"file": args.pdf, "ok": False, "errors": [f"{type(e).__name__}: {e}"]}
    json.dump(report, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
