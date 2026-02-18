# BookGen: AI-Powered Book Publishing Pipeline

Generate, publish, and sell books with AI — from idea to Amazon listing in one command.

```
idea → outline → manuscript → formatted → published → marketed
```

## Features

- **YAML-driven book profiles** — Define your book once, generate everything
- **Multi-genre support** — Nonfiction, thriller, sci-fi, romance, fantasy, mystery
- **Dual generation modes:**
  - 🏗️ **Template mode** (default) — Deterministic, offline, instant generation
  - 🤖 **LLM mode** (`--llm`) — AI-powered via OpenRouter (Claude, GPT, Gemini, etc.)
- **Full publishing pipeline** — Manuscript, cover prompts, KDP listing, marketing copy, monetization strategy
- **Reproducible builds** — Same seed = same output, every time
- **Zero dependencies** — Pure Python, no pip install needed

## Quickstart

```bash
# Clone
git clone https://github.com/laqaer/bookgen.git
cd bookgen

# Generate a complete book (template mode)
python3 bookgen.py books/the_4am_protocol.yaml

# Generate with AI (requires OPENROUTER_API_KEY)
export OPENROUTER_API_KEY=sk-or-...
python3 bookgen.py books/agent_economics.yaml --llm

# Full pipeline: manuscript + cover + KDP + marketing + monetization
python3 bookops.py generate-all books/prediction_markets.yaml

# Create a new book profile
python3 bookops.py new "Your Book Title Here"
```

## How It Works

### 1. Define Your Book (YAML)

```yaml
book:
  slug: my-book
  title: My Book
  subtitle: A Great Subtitle
  genre: nonfiction
  tone: analytical, accessible
  audience:
    - professionals
    - curious readers
  thesis:
    primary: Your core argument in one sentence.
  chapters:
    - title: "Chapter 1: The Hook"
      premise: "Why this matters."
      sections:
        - problem setup
        - key evidence
        - implications
```

### 2. Generate

```bash
# Just the manuscript
python3 bookgen.py books/my-book.yaml

# Everything (manuscript + publishing assets)
python3 bookops.py generate-all books/my-book.yaml
```

### 3. Output Structure

```
books/my-book/
├── book.md                    # Complete compiled manuscript
├── manuscript/                # Individual chapter files
│   ├── 00_front_matter.md
│   ├── 01_ch01_the-hook.md
│   └── ...
├── ideation/                  # Thesis & outline docs
├── design/                    # Cover prompts & specs
├── publishing/                # KDP listing & metadata
├── marketing/                 # Email sequences, social posts, podcast pitches
└── monetization/              # Revenue strategy
```

## CLI Reference

### bookgen.py — Manuscript Generator

```
python3 bookgen.py <config.yaml> [options]

Options:
  --words-per-chapter N    Target words per chapter (default: 4000)
  --seed N                 Deterministic seed (default: 42)
  --output-dir DIR         Custom output directory
  --overwrite              Overwrite existing output
  --llm                    Use LLM via OpenRouter
  --model MODEL            OpenRouter model (default: anthropic/claude-sonnet-4)
  --compile-only           Just compile existing files into book.md
```

### bookops.py — Publishing Pipeline

```
python3 bookops.py generate-all <config.yaml>    # Full pipeline
python3 bookops.py manuscript <config.yaml>       # Manuscript only
python3 bookops.py marketing <config.yaml>        # Marketing only
python3 bookops.py new "Title"                    # New book profile
```

## Book Profiles Included

| Book | Genre | Niche |
|------|-------|-------|
| Shadows and Structures | Nonfiction | Governance & institutional power |
| The 4AM Protocol | Self-help | Productivity & morning routines |
| Agent Economics | Technology | AI agents & market disruption |
| Prediction Markets | Finance | Forecasting & trading |

## LLM Mode

Set your OpenRouter API key and use `--llm`:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
python3 bookgen.py books/agent_economics.yaml --llm --model google/gemini-2.5-flash
```

Supported models: Any model on [OpenRouter](https://openrouter.ai/models) — Claude, GPT-4, Gemini, Llama, DeepSeek, etc.

Falls back to template mode automatically if the API is unavailable.

## Pricing

| | Free CLI | Pro ($49/mo) | Agency ($199/mo) |
|---|----------|-------------|-------------------|
| Template generation | ✅ | ✅ | ✅ |
| LLM generation | BYO key | Included | Included |
| YAML profiles | Unlimited | Unlimited | Unlimited |
| Auto-formatting | — | EPUB + PDF | EPUB + PDF + Print |
| KDP auto-publish | — | ✅ | ✅ |
| Marketing automation | — | Basic | Full suite |
| Books per month | Unlimited | 10 | Unlimited |
| Support | GitHub Issues | Email | Priority + Slack |

**[Get Pro →](https://bookgen.dev)** (coming soon)

## Publisher

Built by **AnteMass Publishing**.

## License

MIT
