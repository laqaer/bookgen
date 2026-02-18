#!/usr/bin/env python3
"""
BookOps — End-to-end book publishing pipeline.

Commands:
  python3 bookops.py generate-all books/my_book.yaml   # Full pipeline
  python3 bookops.py new "My Book Title"                # Create new book profile
  python3 bookops.py manuscript books/my_book.yaml      # Manuscript only
  python3 bookops.py marketing books/my_book.yaml       # Marketing assets only
"""

from __future__ import annotations

import argparse
import os
import random
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import bookgen


def count_words(text: str) -> int:
    return len(re.findall(r"\b[\w'-]+\b", text))


def slugify(text: str) -> str:
    cleaned = re.sub(r"[^a-z0-9\\s-]", "", text.lower())
    return re.sub(r"\\s+", "-", cleaned.strip())


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  wrote: {path}")


# ---------------------------------------------------------------------------
# Pipeline modules — each returns {relative_path: content}
# ---------------------------------------------------------------------------

def render_ideation(profile: bookgen.BookProfile) -> Dict[str, str]:
    full_title = f"{profile.title}: {profile.subtitle}" if profile.subtitle else profile.title
    thesis = f"""# Thesis & Positioning

## Title
{full_title}

## Core Thesis
{profile.thesis_primary}

## Boundary
{profile.thesis_boundary}

## Positioning
{profile.positioning}

## Target Audience
{chr(10).join(f'- {a}' for a in profile.audience)}

## Differentiation
{chr(10).join(f'- {d}' for d in profile.differentiation)}

## Strategy
{profile.strategy}
"""

    outline = f"# Chapter Outline\n\n"
    for idx, ch in enumerate(profile.chapters, 1):
        outline += f"## {idx}. {ch.title}\n\n"
        outline += f"{ch.premise}\n\n"
        if ch.sections:
            for s in ch.sections:
                outline += f"- {s}\n"
            outline += "\n"

    return {
        "ideation/thesis_positioning.md": thesis,
        "ideation/chapter_outline.md": outline,
    }


def render_cover_prompts(profile: bookgen.BookProfile) -> Dict[str, str]:
    full_title = f"{profile.title}: {profile.subtitle}" if profile.subtitle else profile.title
    genre_style = {
        "nonfiction": "Clean, professional design. Bold typography. Minimal illustration. Think Bloomberg or Economist aesthetic.",
        "thriller": "Dark, moody atmosphere. High contrast. Cinematic feel. Think movie poster.",
        "sci-fi": "Futuristic elements. Neon accents on dark backgrounds. Clean tech aesthetic.",
        "romance": "Warm color palette. Elegant typography. Emotional imagery.",
        "fantasy": "Rich, detailed imagery. Dramatic lighting. Epic scope.",
    }.get(profile.genre.lower(), "Professional, genre-appropriate design.")

    prompts = f"""# Cover Design Prompts

## Book
{full_title}
By {profile.author_name}

## Genre
{profile.genre}

## Design Direction
{genre_style}

## AI Image Prompt (for DALL-E / Midjourney)
Book cover for "{profile.title}" — {profile.subtitle}. {genre_style} The design should work at thumbnail size on Amazon. Title text should be the dominant element. Professional publishing quality.

## Typography Notes
- Title: Large, bold, high-contrast
- Subtitle: Smaller, complementary weight
- Author: Bottom third, clean sans-serif
- Spine: Title + Author, readable at bookshelf distance

## Color Palette Suggestions
- Primary: Based on genre conventions
- Accent: One strong contrasting color for title
- Background: Should make text pop at any size

## Thumbnail Test
The cover MUST be readable and compelling at 120x180px (Amazon search results size).
"""
    return {"design/cover_prompts.md": prompts}


def render_metadata(profile: bookgen.BookProfile) -> Dict[str, str]:
    full_title = f"{profile.title}: {profile.subtitle}" if profile.subtitle else profile.title
    meta = f"""# Book Metadata

## Title
{profile.title}

## Subtitle
{profile.subtitle}

## Author
{profile.author_name}

## Publisher
{profile.publisher_name}

## Full Title
{full_title}

## Genre / Category
{profile.genre}

## BISAC Categories (suggested)
- Primary: [Select from https://bisg.org/page/BISACSubjectCodes]
- Secondary: [Select appropriate secondary category]

## Keywords (7 for KDP)
1. {profile.genre}
2. {profile.title.split()[0].lower() if profile.title else 'book'}
3. {profile.audience[0] if profile.audience else 'general readers'}
4. [Add keyword 4]
5. [Add keyword 5]
6. [Add keyword 6]
7. [Add keyword 7]

## Description (for book stores)
{profile.thesis_primary}

Target audience: {', '.join(profile.audience[:3])}.

## Author Bio
{profile.author_name} — {profile.author_tagline}
"""
    return {"publishing/metadata.md": meta}


def render_kdp_listing(profile: bookgen.BookProfile) -> Dict[str, str]:
    full_title = f"{profile.title}: {profile.subtitle}" if profile.subtitle else profile.title
    listing = f"""# KDP Listing

## Title & Subtitle
- Title: {profile.title}
- Subtitle: {profile.subtitle}

## Author
{profile.author_name}

## Description (4000 char max)
{profile.thesis_primary}

Written for {', '.join(profile.audience[:3])}, this book provides {profile.positioning or 'a comprehensive guide to the subject'}.

Key features:
{chr(10).join(f'• {d}' for d in profile.differentiation[:5])}

## Pricing Strategy
- Ebook: $9.99 (70% royalty tier)
- Paperback: $16.99
- Hardcover (via IngramSpark): $24.99

## Launch Pricing
- Week 1: $4.99 ebook (promotional)
- Week 2-4: $6.99
- Month 2+: $9.99 (full price)

## Categories
Select 2 BISAC categories that match your audience's browsing habits.

## Keywords
Focus on buyer-intent keywords, not generic terms.
"""
    return {"publishing/kdp_listing.md": listing}


def render_marketing_copy(profile: bookgen.BookProfile, seed: int) -> Dict[str, str]:
    full_title = f"{profile.title}: {profile.subtitle}" if profile.subtitle else profile.title
    rng = random.Random(seed)

    email_sequence = f"""# Email Launch Sequence

## Email 1: Problem Awareness (Day -14)
Subject: The {profile.title.split(':')[0].split()[0]} problem no one talks about

Body: You've probably noticed [pain point related to {profile.thesis_primary[:50]}]. Most people accept it. But there's a better way...

CTA: Reply and tell me — what's your biggest challenge with this?

## Email 2: Credibility + Teaser (Day -7)
Subject: I spent [time period] researching {profile.title.split(':')[0].lower()}

Body: Share the research journey. Preview 1-2 key insights. Build anticipation.

CTA: Pre-save the book / join the launch list

## Email 3: Launch Day (Day 0)
Subject: 🚀 {profile.title} is live

Body: The book is here. Here's exactly what you'll learn and why it matters.

CTA: Buy now [link] — launch week price of $4.99

## Email 4: Social Proof (Day +3)
Subject: "This changed how I think about..." — early reader

Body: Share 2-3 early reviews/reactions. Address common objections.

CTA: Grab your copy before price goes up

## Email 5: Last Chance (Day +7)
Subject: Price goes up tomorrow

Body: Urgency + value recap + reader results.

CTA: Last chance at launch price
"""

    social_posts = f"""# Social Media Launch Kit

## Twitter/X Thread
1/ I just published "{profile.title}" — here's the core idea in 5 tweets:

2/ {profile.thesis_primary[:200]}

3/ Most people think [common misconception]. The data shows something different.

4/ Key insight from Chapter 1: [pull from first chapter premise]

5/ The book is live now. Launch price: $4.99 → [link]

## LinkedIn Post
I'm excited to announce my new book: {full_title}

After extensive research, I've distilled [topic] into a practical framework for {', '.join(profile.audience[:2])}.

Key takeaways:
{chr(10).join(f'→ {d}' for d in profile.differentiation[:3])}

Link in comments.

## Instagram Caption
New book alert 📚

{profile.title} — {profile.subtitle}

{profile.thesis_primary[:150]}...

Link in bio. Launch week special: $4.99
"""

    podcast_pitch = f"""# Podcast Outreach Template

## Subject Line
Guest pitch: Author of "{profile.title}" — [specific angle for their show]

## Body
Hi [Host name],

I'm the author of "{full_title}" and I think your audience would love a conversation about [specific topic from book that matches their show].

My core argument: {profile.thesis_primary[:200]}

This matters for your listeners because [specific connection to their audience].

I can discuss:
{chr(10).join(f'- {ch.title}' for ch in profile.chapters[:3])}

Happy to send a review copy or jump on a quick pre-call.

Best,
{profile.author_name}
"""

    return {
        "marketing/email_sequence.md": email_sequence,
        "marketing/social_posts.md": social_posts,
        "marketing/podcast_pitch.md": podcast_pitch,
    }


def render_monetization(profile: bookgen.BookProfile) -> Dict[str, str]:
    strategy = f"""# Monetization Strategy

## Revenue Streams

### 1. Book Sales
- Ebook (KDP): $9.99 × 70% = $6.99/unit
- Paperback (KDP): $16.99 × ~35% = ~$5.95/unit
- Audiobook (ACX): $14.99 × 40% = ~$6.00/unit

### 2. Premium Content ($29-99/mo)
- Weekly deep-dive newsletter on {profile.title.split(':')[0].lower()} topics
- Exclusive case studies and analysis
- Community access (Discord/Circle)

### 3. Course ($199-499)
- "Master {profile.title.split(':')[0]}" — 6-week cohort or self-paced
- Based on book framework, expanded with exercises
- Upsell from book buyers via email sequence

### 4. Consulting/Speaking ($2,000-10,000)
- Keynotes on {profile.positioning or profile.title.split(':')[0].lower()}
- Workshop facilitation for teams
- Advisory retainers for organizations

### 5. Licensing
- Corporate bulk purchases for teams
- Course licensing for training programs

## Funnel
Book ($10) → Newsletter (free) → Premium ($29/mo) → Course ($299) → Consulting ($5K+)
"""
    return {"monetization/strategy.md": strategy}


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_generate_all(args: argparse.Namespace) -> None:
    """Generate everything: manuscript, cover prompts, metadata, KDP listing, marketing, monetization."""
    config_path = Path(args.config).resolve()
    config = bookgen.load_yaml(config_path)
    profile = bookgen.build_profile(config)

    book_root = Path(args.output_root or ".").resolve() / "books" / profile.slug
    book_root.mkdir(parents=True, exist_ok=True)

    full_title = f"{profile.title}: {profile.subtitle}" if profile.subtitle else profile.title
    print(f"BookOps generate-all — {full_title}")
    print(f"  Output: {book_root}")
    print()

    # 1. Manuscript
    print("📝 Generating manuscript...")
    manuscript_dir = book_root / "manuscript"
    manuscript_dir.mkdir(parents=True, exist_ok=True)
    bookgen.generate_manuscript(profile, manuscript_dir, args.words_per_chapter, args.seed,
                                use_llm=args.llm, llm_model=args.model)
    bookgen.compile_book(profile, manuscript_dir, book_root / "book.md")

    # 2. All pipeline modules
    modules = [
        ("💡 Ideation...", render_ideation(profile)),
        ("🎨 Cover prompts...", render_cover_prompts(profile)),
        ("📋 Metadata...", render_metadata(profile)),
        ("📦 KDP listing...", render_kdp_listing(profile)),
        ("📣 Marketing copy...", render_marketing_copy(profile, args.seed)),
        ("💰 Monetization...", render_monetization(profile)),
    ]

    for label, file_map in modules:
        print(label)
        for rel_path, content in file_map.items():
            write_file(book_root / rel_path, content)

    # Summary
    book_md = book_root / "book.md"
    total_words = count_words(book_md.read_text(encoding="utf-8")) if book_md.exists() else 0
    print(f"\n✅ Pipeline complete: {book_root}")
    print(f"   Manuscript: {total_words:,} words")
    print(f"   Files generated: {sum(len(m[1]) for m in modules) + len(list(manuscript_dir.glob('*.md')))}")


def cmd_manuscript(args: argparse.Namespace) -> None:
    """Generate manuscript only."""
    config_path = Path(args.config).resolve()
    config = bookgen.load_yaml(config_path)
    profile = bookgen.build_profile(config)

    book_root = Path(args.output_root or ".").resolve() / "books" / profile.slug
    manuscript_dir = book_root / "manuscript"
    manuscript_dir.mkdir(parents=True, exist_ok=True)

    print(f"📝 Generating manuscript for: {profile.title}")
    bookgen.generate_manuscript(profile, manuscript_dir, args.words_per_chapter, args.seed,
                                use_llm=args.llm, llm_model=args.model)
    bookgen.compile_book(profile, manuscript_dir, book_root / "book.md")

    total = count_words((book_root / "book.md").read_text(encoding="utf-8"))
    print(f"\n✅ Manuscript: {total:,} words → {book_root / 'book.md'}")


def cmd_marketing(args: argparse.Namespace) -> None:
    """Generate marketing assets only."""
    config_path = Path(args.config).resolve()
    config = bookgen.load_yaml(config_path)
    profile = bookgen.build_profile(config)

    book_root = Path(args.output_root or ".").resolve() / "books" / profile.slug

    print(f"📣 Generating marketing for: {profile.title}")
    for rel_path, content in render_marketing_copy(profile, args.seed).items():
        write_file(book_root / rel_path, content)
    print("✅ Marketing assets generated")


def cmd_new(args: argparse.Namespace) -> None:
    """Create a new book profile YAML."""
    title = args.title
    slug = bookgen.slugify(title)

    yaml_content = f"""book:
  slug: {slug}
  title: "{title}"
  subtitle: "Your Subtitle Here"
  genre: nonfiction
  goal: self-publish
  strategy: Self-publish on KDP, build audience through content marketing.
  positioning: Describe your unique angle here.
  tone: professional, accessible
  audience:
    - primary reader type
    - secondary reader type
    - tertiary reader type
  thesis:
    primary: Your core argument or promise in one sentence.
    boundary: What this book is NOT about.
  differentiation:
    - unique angle 1
    - unique angle 2
    - unique angle 3
  chapters:
    - title: "Chapter 1: Opening"
      premise: "Set up the core problem or hook."
      sections:
        - section one
        - section two
        - section three
    - title: "Chapter 2: Foundation"
      premise: "Establish the key framework."
      sections:
        - section one
        - section two
    - title: "Chapter 3: Deep Dive"
      premise: "Explore the main content."
      sections:
        - section one
        - section two
    - title: "Chapter 4: Application"
      premise: "Show practical applications."
      sections:
        - section one
        - section two
    - title: "Chapter 5: Conclusion"
      premise: "Synthesize and call to action."
      sections:
        - section one
        - section two

author:
  name: AnteMass Publishing
  tagline: your tagline here
  credentials:
    - credential 1
    - credential 2
  platforms:
    - website.com

publisher:
  name: AnteMass Publishing
  imprint: AnteMass Books
"""

    output_path = Path(f"books/{slug}.yaml")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_path.exists() and not args.overwrite:
        print(f"Error: {output_path} already exists. Use --overwrite to replace.", file=sys.stderr)
        sys.exit(1)

    output_path.write_text(yaml_content, encoding="utf-8")
    print(f"✅ Created book profile: {output_path}")
    print(f"   Edit it, then run: python3 bookops.py generate-all {output_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="BookOps — End-to-end book publishing pipeline.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Commands:
  generate-all <config>   Generate manuscript + all publishing assets
  manuscript <config>     Generate manuscript only
  marketing <config>      Generate marketing assets only
  new <title>             Create a new book profile YAML

Examples:
  python3 bookops.py generate-all books/my_book.yaml
  python3 bookops.py generate-all books/my_book.yaml --llm
  python3 bookops.py new "My Amazing Book"
  python3 bookops.py manuscript books/my_book.yaml --words-per-chapter 5000
""",
    )

    sub = parser.add_subparsers(dest="command", help="Pipeline command")

    # generate-all
    p_all = sub.add_parser("generate-all", help="Generate manuscript + all publishing assets")
    p_all.add_argument("config", help="Path to YAML book profile")
    p_all.add_argument("--output-root", default=None, help="Root output directory (default: current dir)")
    p_all.add_argument("--words-per-chapter", type=int, default=4000)
    p_all.add_argument("--seed", type=int, default=42)
    p_all.add_argument("--llm", action="store_true", help="Use LLM for content generation")
    p_all.add_argument("--model", default="anthropic/claude-sonnet-4")
    p_all.add_argument("--overwrite", action="store_true")

    # manuscript
    p_ms = sub.add_parser("manuscript", help="Generate manuscript only")
    p_ms.add_argument("config", help="Path to YAML book profile")
    p_ms.add_argument("--output-root", default=None)
    p_ms.add_argument("--words-per-chapter", type=int, default=4000)
    p_ms.add_argument("--seed", type=int, default=42)
    p_ms.add_argument("--llm", action="store_true")
    p_ms.add_argument("--model", default="anthropic/claude-sonnet-4")
    p_ms.add_argument("--overwrite", action="store_true")

    # marketing
    p_mk = sub.add_parser("marketing", help="Generate marketing assets only")
    p_mk.add_argument("config", help="Path to YAML book profile")
    p_mk.add_argument("--output-root", default=None)
    p_mk.add_argument("--seed", type=int, default=42)
    p_mk.add_argument("--overwrite", action="store_true")

    # new
    p_new = sub.add_parser("new", help="Create a new book profile YAML")
    p_new.add_argument("title", help="Book title")
    p_new.add_argument("--overwrite", action="store_true")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "generate-all": cmd_generate_all,
        "manuscript": cmd_manuscript,
        "marketing": cmd_marketing,
        "new": cmd_new,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
