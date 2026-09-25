# RUNBOOK

## Goal

Generate and maintain a deterministic first-draft nonfiction manuscript with configurable chapter length and stable tone.

## Prerequisites

- Python 3.9+
- Local filesystem write access to the project folder

## Generate Draft (Default)

```bash
python3 bookgen.py
```

Default behavior:

- Creates `manuscript/` if missing.
- Generates all required markdown files.
- Compiles `book.md` at repository root.
- Uses `--words-per-chapter 4000` and `--seed 42`.

## Core CLI Options

```bash
python3 bookgen.py --words-per-chapter 4200 --seed 101 --output-dir manuscript_alt
```

- `--words-per-chapter`: target chapter length (enforced range: 3000-5000)
- `--seed`: deterministic variation for phrasing and paragraph ordering
- `--output-dir`: directory for manuscript files
- `--overwrite`: reuse an existing non-empty output directory
- `--compile-only`: skip generation and compile from existing manuscript files

## Safe Re-Run Behavior

- If `--output-dir` exists and is non-empty:
- With `--overwrite`: files are replaced in that directory.
- Without `--overwrite`: generator writes to `output_dir_YYYYMMDD_HHMMSS`.

## Compile Only

```bash
python3 bookgen.py --compile-only --output-dir manuscript --overwrite
```

This reads existing markdown files and rebuilds `book.md`.

## Makefile Shortcuts

```bash
make generate
make compile
make clean
```

## Editing Workflow

1. Update chapter specs and phrase banks in `bookgen.py`.
2. Regenerate with a fixed seed for deterministic diffs.
3. Replace citation placeholders during evidence pass.
4. Run legal and fact-check review before publication.

## Publishing Workflow (High Level)

1. Finalize manuscript and citations.
2. Produce print interior and EPUB.
3. Upload and proof on KDP and IngramSpark.
4. Produce audiobook via ACX.
5. Execute launch sequence across email, podcasts, and Substack.

## Quality Gates

- Chapter word counts within configured target window.
- No fabricated quotes or citations.
- No conspiratorial certainty framing.
- Every chapter includes Core Claim, Case Studies, What This Changes, Skeptic's Corner.
