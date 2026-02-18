#!/usr/bin/env python3
"""
BookGen — Generic manuscript generator for any book profile YAML.

Supports nonfiction and fiction genres. Two modes:
  - Template mode (default): deterministic, offline, phrase-bank based
  - LLM mode (--llm): uses OpenRouter API for AI-generated content

Usage:
  python3 bookgen.py books/my_book.yaml
  python3 bookgen.py books/my_book.yaml --llm
  python3 bookgen.py books/my_book.yaml --words-per-chapter 5000 --seed 101
"""

from __future__ import annotations

import argparse
import json
import os
import re
import random
import sys
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# YAML parser (minimal, no dependencies)
# ---------------------------------------------------------------------------

class SimpleYAMLParser:
    """Minimal YAML parser for maps/lists/scalars with 2-space indentation."""

    def __init__(self, text: str) -> None:
        self.lines: List[Tuple[int, str, int]] = []
        for line_no, raw in enumerate(text.splitlines(), start=1):
            if not raw.strip():
                continue
            stripped = raw.lstrip(" ")
            if stripped.startswith("#"):
                continue
            indent = len(raw) - len(stripped)
            self.lines.append((indent, stripped.rstrip(), line_no))
        self.idx = 0

    def parse(self) -> Any:
        if not self.lines:
            return {}
        return self._parse_block(self.lines[0][0])

    def _parse_block(self, indent: int) -> Any:
        if self.idx >= len(self.lines):
            return {}
        line_indent, content, _ = self.lines[self.idx]
        if line_indent < indent:
            return {}
        if content.startswith("- "):
            return self._parse_list(indent)
        return self._parse_map(indent)

    def _parse_list(self, indent: int) -> List[Any]:
        items: List[Any] = []
        while self.idx < len(self.lines):
            line_indent, content, line_no = self.lines[self.idx]
            if line_indent < indent or (line_indent == indent and not content.startswith("- ")):
                break
            if line_indent > indent:
                self.idx += 1
                continue
            item_value = content[2:].strip()
            self.idx += 1
            if item_value and ":" in item_value:
                # Inline key: "- title: foo" — treat as start of a map
                # Re-parse this line plus any children as a map
                # We need to back up and handle it specially
                colon_pos = item_value.index(":")
                key = item_value[:colon_pos].strip().strip('"').strip("'")
                val_str = item_value[colon_pos + 1:].strip()
                item_map: Dict[str, Any] = {}
                if val_str:
                    item_map[key] = self._parse_scalar(val_str)
                elif self.idx < len(self.lines) and self.lines[self.idx][0] > indent:
                    nested_indent = self.lines[self.idx][0]
                    item_map[key] = self._parse_block(nested_indent)
                else:
                    item_map[key] = ""
                # Parse remaining keys at the nested indent level
                if self.idx < len(self.lines):
                    # Find the indent of sibling keys (typically indent + 2)
                    sibling_indent = indent + 2
                    while self.idx < len(self.lines):
                        li, lc, ln = self.lines[self.idx]
                        if li < sibling_indent or (li == indent and lc.startswith("- ")):
                            break
                        if li == sibling_indent and ":" in lc and not lc.startswith("- "):
                            cp = lc.index(":")
                            k = lc[:cp].strip().strip('"').strip("'")
                            vs = lc[cp + 1:].strip()
                            self.idx += 1
                            if vs:
                                item_map[k] = self._parse_scalar(vs)
                            elif self.idx < len(self.lines) and self.lines[self.idx][0] > sibling_indent:
                                ni = self.lines[self.idx][0]
                                item_map[k] = self._parse_block(ni)
                            else:
                                item_map[k] = ""
                        elif li == sibling_indent and lc.startswith("- "):
                            # This is a nested list that should have been caught as a value
                            break
                        else:
                            self.idx += 1
                items.append(item_map)
            elif item_value:
                items.append(self._parse_scalar(item_value))
            elif self.idx < len(self.lines) and self.lines[self.idx][0] > indent:
                nested_indent = self.lines[self.idx][0]
                items.append(self._parse_block(nested_indent))
            else:
                items.append("")
        return items

    def _parse_map(self, indent: int) -> Dict[str, Any]:
        data: Dict[str, Any] = {}
        while self.idx < len(self.lines):
            line_indent, content, line_no = self.lines[self.idx]
            if line_indent < indent:
                break
            if line_indent > indent:
                self.idx += 1
                continue
            if content.startswith("- "):
                break
            if ":" not in content:
                self.idx += 1
                continue
            colon_pos = content.index(":")
            key = content[:colon_pos].strip().strip('"').strip("'")
            value_str = content[colon_pos + 1:].strip()
            self.idx += 1
            if value_str:
                data[key] = self._parse_scalar(value_str)
            elif self.idx < len(self.lines) and self.lines[self.idx][0] > indent:
                nested_indent = self.lines[self.idx][0]
                data[key] = self._parse_block(nested_indent)
            else:
                data[key] = ""
        return data

    @staticmethod
    def _parse_scalar(value: str) -> Any:
        v = value.strip()
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            return v[1:-1]
        if v.lower() == "true":
            return True
        if v.lower() == "false":
            return False
        try:
            return int(v)
        except ValueError:
            pass
        try:
            return float(v)
        except ValueError:
            pass
        return v


def load_yaml(path: Path) -> Dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    return SimpleYAMLParser(text).parse()


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class ChapterSpec:
    title: str
    premise: str
    sections: List[str] = field(default_factory=list)


@dataclass
class BookProfile:
    slug: str
    title: str
    subtitle: str
    genre: str  # nonfiction, thriller, sci-fi, romance, fantasy, etc.
    tone: str
    audience: List[str]
    thesis_primary: str
    thesis_boundary: str
    chapters: List[ChapterSpec]
    author_name: str
    author_tagline: str
    publisher_name: str
    differentiation: List[str] = field(default_factory=list)
    positioning: str = ""
    strategy: str = ""
    goal: str = ""


def as_list(v: Any) -> List[str]:
    if isinstance(v, list):
        return [str(x) for x in v]
    if isinstance(v, str) and v:
        return [v]
    return []


def build_profile(config: Dict[str, Any]) -> BookProfile:
    book = config.get("book", config)
    author = config.get("author", {})
    publisher = config.get("publisher", {})
    thesis = book.get("thesis", {})

    chapters = []
    raw_chapters = book.get("chapters", [])
    if not isinstance(raw_chapters, list):
        raw_chapters = []
    for ch in raw_chapters:
        if isinstance(ch, dict):
            chapters.append(ChapterSpec(
                title=ch.get("title", "Untitled Chapter"),
                premise=ch.get("premise", ""),
                sections=as_list(ch.get("sections", [])),
            ))

    return BookProfile(
        slug=book.get("slug", slugify(book.get("title", "untitled"))),
        title=book.get("title", "Untitled"),
        subtitle=book.get("subtitle", ""),
        genre=book.get("genre", "nonfiction"),
        tone=book.get("tone", "professional"),
        audience=as_list(book.get("audience", [])),
        thesis_primary=thesis.get("primary", "") if isinstance(thesis, dict) else str(thesis),
        thesis_boundary=thesis.get("boundary", "") if isinstance(thesis, dict) else "",
        chapters=chapters,
        author_name=author.get("name", "Unknown Author"),
        author_tagline=author.get("tagline", ""),
        publisher_name=publisher.get("name", author.get("name", "Self-Published")),
        differentiation=as_list(book.get("differentiation", [])),
        positioning=book.get("positioning", ""),
        strategy=book.get("strategy", ""),
        goal=book.get("goal", ""),
    )


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def count_words(text: str) -> int:
    return len(re.findall(r"\b[\w'-]+\b", text))


def slugify(text: str) -> str:
    cleaned = re.sub(r"[^a-z0-9\s-]", "", text.lower())
    return re.sub(r"\s+", "-", cleaned.strip())


def ensure_dir(path: Path, overwrite: bool = False) -> Path:
    if not path.exists():
        path.mkdir(parents=True)
        return path
    if overwrite or not any(path.iterdir()):
        path.mkdir(parents=True, exist_ok=True)
        return path
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    alt = path.parent / f"{path.name}_{stamp}"
    alt.mkdir(parents=True)
    return alt


# ---------------------------------------------------------------------------
# Phrase banks (genre-adaptive)
# ---------------------------------------------------------------------------

NONFICTION_OPENERS = [
    "{focus} becomes clearer when we examine the underlying mechanisms.",
    "A recurring pattern in {focus} is that routine processes generate outsized consequences.",
    "The key analytical move is to follow the process steps, because formal authority often hides in timing and format.",
    "This section treats the subject as a system of incentives, constraints, and feedback loops.",
    "What appears as contradiction in public debate often reflects different vantage points within the same system.",
    "Understanding {focus} requires separating documented mechanisms from speculative narratives.",
    "The evidence suggests a more nuanced picture than popular accounts typically provide.",
    "Careful analysis reveals that {focus} operates through layered processes rather than singular decisions.",
]

NONFICTION_DEVELOPMENT = [
    "When we trace the decision pipeline, several structural factors emerge that shape outcomes independently of individual intent.",
    "Procedural defaults become powerful when institutional memory is concentrated in narrow units and turnover is high elsewhere.",
    "The practical dilemma is balancing operational efficiency with accountability that remains meaningful over time.",
    "Data from multiple sources converges on a key finding: the system's outputs depend more on structural incentives than on the intentions of any single actor.",
    "Historical precedent shows that similar dynamics have played out across different contexts and time periods.",
    "The interaction between formal rules and informal practices creates outcomes that neither designers nor participants fully anticipated.",
    "Independent review of the evidence suggests both institutional competence and institutional blind spots operating simultaneously.",
    "Cross-referencing multiple data sources reveals patterns that no single perspective captures completely.",
]

NONFICTION_CLOSERS = [
    "For the reader, the operational question is which mechanisms can be audited and which remain insulated from correction.",
    "This reframing shifts the debate from personality-driven explanations to structural diagnostics.",
    "The strongest claims should stay proportional to the strongest available evidence.",
    "In practice, improvement comes from mapping who can challenge a decision, on what timeline, and with which evidence.",
    "The evidence warrants cautious conclusions rather than sweeping pronouncements.",
]

FICTION_OPENERS = [
    "The {focus} shifted as {character} stepped into the scene, sensing something was off.",
    "{character} had always known that {focus} was more complicated than it appeared.",
    "It started, as these things usually do, with a detail no one else noticed.",
    "The moment {character} saw it, everything clicked into place—and nothing made sense.",
    "Dawn broke over the city, but {character} hadn't slept. The {focus} demanded attention.",
]

FICTION_DEVELOPMENT = [
    "Every instinct said to walk away, but the evidence pointed somewhere darker.",
    "The conversation lasted three minutes, but it changed the trajectory of everything that followed.",
    "Details accumulated like snow—individually insignificant, collectively transformative.",
    "There was a logic to the pattern, if you were willing to follow it far enough.",
    "Trust was the currency here, and it was rapidly devaluing.",
    "The silence that followed said more than the words that preceded it.",
    "Each new piece of information contradicted the last, forming a puzzle that resisted completion.",
    "The world outside continued as if nothing had changed. Inside, everything had.",
]

FICTION_CLOSERS = [
    "And so it ended—not with revelation, but with the quiet weight of understanding.",
    "The answer had been there all along. It just required the right question.",
    "Some doors, once opened, refuse to close again.",
    "Tomorrow would bring new complications. But tonight, there was clarity.",
    "The story wasn't over. Stories like this never really are.",
]


def get_phrase_bank(genre: str):
    if genre.lower() in ("thriller", "sci-fi", "romance", "fantasy", "fiction", "mystery"):
        return FICTION_OPENERS, FICTION_DEVELOPMENT, FICTION_CLOSERS
    return NONFICTION_OPENERS, NONFICTION_DEVELOPMENT, NONFICTION_CLOSERS


# ---------------------------------------------------------------------------
# Template-based generation
# ---------------------------------------------------------------------------

def generate_paragraph(rng: random.Random, openers, development, closers,
                       focus: str, character: str = "the protagonist") -> str:
    opener = rng.choice(openers).format(focus=focus, character=character)
    body = [rng.choice(development) for _ in range(rng.randint(2, 4))]
    closer = rng.choice(closers)
    return f"{opener} {' '.join(body)} {closer}"


def render_chapter_template(profile: BookProfile, spec: ChapterSpec, chapter_idx: int,
                            words_target: int, seed: int) -> str:
    rng = random.Random(seed + chapter_idx * 9973)
    openers, development, closers = get_phrase_bank(profile.genre)

    is_fiction = profile.genre.lower() in ("thriller", "sci-fi", "romance", "fantasy", "fiction", "mystery")

    lines: List[str] = []
    lines.append(f"# {spec.title}")
    lines.append("")

    if spec.premise:
        if is_fiction:
            lines.append(f"*{spec.premise}*")
        else:
            lines.append(f"> {spec.premise}")
        lines.append("")

    # Generate sections
    sections = spec.sections if spec.sections else ["main discussion"]
    words_per_section = max(300, words_target // len(sections))

    for sec_idx, section in enumerate(sections):
        if not is_fiction:
            lines.append(f"## {section.title() if section[0].islower() else section}")
            lines.append("")

        section_words = 0
        para_idx = 0
        while section_words < words_per_section:
            para = generate_paragraph(rng, openers, development, closers,
                                      focus=section, character="the protagonist")
            lines.append(para)
            lines.append("")
            section_words += count_words(para)
            para_idx += 1

    # Pad to target if needed
    text = "\n".join(lines)
    while count_words(text) < words_target:
        focus = rng.choice(sections) if sections else "the topic"
        para = generate_paragraph(rng, openers, development, closers,
                                  focus=focus, character="the protagonist")
        text = text.rstrip() + "\n\n" + para + "\n"

    return text


# ---------------------------------------------------------------------------
# LLM-based generation (OpenRouter)
# ---------------------------------------------------------------------------

def llm_generate_chapter(profile: BookProfile, spec: ChapterSpec, chapter_idx: int,
                         words_target: int, model: str = "anthropic/claude-sonnet-4") -> str:
    """Generate a chapter using OpenRouter API."""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("Warning: OPENROUTER_API_KEY not set. Falling back to template mode.", file=sys.stderr)
        return ""

    genre_instruction = {
        "nonfiction": "Write authoritative nonfiction prose. Use evidence-based reasoning, cite concepts by name, and maintain an analytical tone.",
        "thriller": "Write gripping thriller fiction. Use short sentences for tension, longer ones for atmosphere. Include sensory details and psychological depth.",
        "sci-fi": "Write compelling science fiction. Ground speculative elements in plausible science. Balance worldbuilding with character and plot momentum.",
        "romance": "Write engaging romance fiction. Focus on emotional dynamics, chemistry between characters, and meaningful character development.",
        "fantasy": "Write immersive fantasy prose. Build the world through action and dialogue rather than exposition dumps.",
        "fiction": "Write compelling fiction with strong characters, vivid settings, and narrative momentum.",
        "mystery": "Write engaging mystery prose. Plant clues fairly, build suspense, and maintain logical consistency.",
    }.get(profile.genre.lower(), "Write clear, engaging prose appropriate for the genre.")

    sections_text = "\n".join(f"  - {s}" for s in spec.sections) if spec.sections else "  - (develop as appropriate)"

    prompt = f"""You are writing Chapter {chapter_idx} of a book.

Book: "{profile.title}: {profile.subtitle}"
Genre: {profile.genre}
Tone: {profile.tone}
Audience: {', '.join(profile.audience[:3])}
Book thesis: {profile.thesis_primary}

Chapter title: {spec.title}
Chapter premise: {spec.premise}
Sections to cover:
{sections_text}

{genre_instruction}

Write approximately {words_target} words. Format in Markdown with the chapter title as # heading and sections as ## headings.
Do NOT include meta-commentary about the writing process. Just write the chapter content directly."""

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max(4000, words_target * 2),
        "temperature": 0.7,
    }

    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/laqaer/bookgen",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"]
    except (urllib.error.URLError, KeyError, json.JSONDecodeError) as e:
        print(f"Warning: LLM request failed for chapter {chapter_idx}: {e}", file=sys.stderr)
        return ""


# ---------------------------------------------------------------------------
# Front matter and back matter
# ---------------------------------------------------------------------------

def render_front_matter(profile: BookProfile) -> str:
    full_title = f"{profile.title}: {profile.subtitle}" if profile.subtitle else profile.title
    lines = [
        f"# {full_title}",
        "",
        f"**By {profile.author_name}**",
        "",
        f"Published by {profile.publisher_name}",
        "",
        "---",
        "",
        "## About This Book",
        "",
    ]

    if profile.thesis_primary:
        lines.append(profile.thesis_primary)
        lines.append("")

    if profile.audience:
        lines.append("**For:** " + ", ".join(profile.audience))
        lines.append("")

    lines.extend([
        "---",
        "",
        "## Table of Contents",
        "",
    ])

    for idx, ch in enumerate(profile.chapters, 1):
        fname = f"{idx:02d}_ch{idx:02d}_{slugify(ch.title)[:40]}.md"
        lines.append(f"{idx}. [{ch.title}]({fname})")

    lines.extend(["", "---", ""])
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main generation pipeline
# ---------------------------------------------------------------------------

def generate_manuscript(profile: BookProfile, output_dir: Path,
                        words_per_chapter: int, seed: int,
                        use_llm: bool = False, llm_model: str = "anthropic/claude-sonnet-4") -> Path:
    """Generate full manuscript from a BookProfile. Returns output_dir used."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Front matter
    front = render_front_matter(profile)
    (output_dir / "00_front_matter.md").write_text(front, encoding="utf-8")

    # Chapters
    for idx, spec in enumerate(profile.chapters, 1):
        fname = f"{idx:02d}_ch{idx:02d}_{slugify(spec.title)[:40]}.md"

        if use_llm:
            content = llm_generate_chapter(profile, spec, idx, words_per_chapter, llm_model)
            if not content:  # fallback to template
                content = render_chapter_template(profile, spec, idx, words_per_chapter, seed)
        else:
            content = render_chapter_template(profile, spec, idx, words_per_chapter, seed)

        (output_dir / fname).write_text(content, encoding="utf-8")
        words = count_words(content)
        print(f"  {fname}: {words} words")

    return output_dir


def compile_book(profile: BookProfile, manuscript_dir: Path, output_path: Path) -> None:
    """Compile all manuscript files into a single book.md."""
    full_title = f"{profile.title}: {profile.subtitle}" if profile.subtitle else profile.title
    sections = [f"# {full_title}", "", f"By {profile.author_name}", "", "---", ""]

    for md_file in sorted(manuscript_dir.glob("*.md")):
        content = md_file.read_text(encoding="utf-8").strip()
        sections.extend(["", content, "", "---", ""])

    output_path.write_text("\n".join(sections), encoding="utf-8")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="BookGen — Generate manuscripts from YAML book profiles.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python3 bookgen.py books/my_book.yaml
  python3 bookgen.py books/my_book.yaml --llm
  python3 bookgen.py books/my_book.yaml --words-per-chapter 5000 --seed 101
  python3 bookgen.py books/my_book.yaml --llm --model google/gemini-2.5-flash
  python3 bookgen.py books/my_book.yaml --output-dir custom_output --overwrite
""",
    )
    parser.add_argument("config", help="Path to YAML book profile (e.g., books/my_book.yaml)")
    parser.add_argument("--words-per-chapter", type=int, default=4000,
                        help="Target words per chapter (default: 4000)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Seed for deterministic template generation (default: 42)")
    parser.add_argument("--output-dir", default=None,
                        help="Output directory (default: books/<slug>/manuscript)")
    parser.add_argument("--overwrite", action="store_true",
                        help="Overwrite existing output directory")
    parser.add_argument("--llm", action="store_true",
                        help="Use LLM (OpenRouter) for chapter generation instead of templates")
    parser.add_argument("--model", default="anthropic/claude-sonnet-4",
                        help="OpenRouter model for --llm mode (default: anthropic/claude-sonnet-4)")
    parser.add_argument("--compile-only", action="store_true",
                        help="Only compile existing manuscript files into book.md")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    config_path = Path(args.config).resolve()
    if not config_path.exists():
        print(f"Error: Config file not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    config = load_yaml(config_path)
    profile = build_profile(config)

    project_root = Path(__file__).resolve().parent
    if args.output_dir:
        output_dir = Path(args.output_dir).resolve()
    else:
        output_dir = project_root / "books" / profile.slug / "manuscript"

    book_dir = output_dir.parent
    book_dir.mkdir(parents=True, exist_ok=True)

    full_title = f"{profile.title}: {profile.subtitle}" if profile.subtitle else profile.title
    print(f"BookGen — {full_title}")
    print(f"  Genre: {profile.genre}")
    print(f"  Author: {profile.author_name}")
    print(f"  Chapters: {len(profile.chapters)}")
    print(f"  Mode: {'LLM (' + args.model + ')' if args.llm else 'Template'}")
    print(f"  Output: {output_dir}")
    print()

    if args.compile_only:
        if not output_dir.exists():
            print(f"Error: Manuscript directory not found: {output_dir}", file=sys.stderr)
            sys.exit(1)
    else:
        output_dir = ensure_dir(output_dir, args.overwrite)
        generate_manuscript(profile, output_dir, args.words_per_chapter, args.seed,
                            use_llm=args.llm, llm_model=args.model)

    compiled_path = book_dir / "book.md"
    compile_book(profile, output_dir, compiled_path)

    total_words = count_words(compiled_path.read_text(encoding="utf-8"))
    print(f"\nCompiled: {compiled_path} ({total_words:,} words)")


if __name__ == "__main__":
    main()
