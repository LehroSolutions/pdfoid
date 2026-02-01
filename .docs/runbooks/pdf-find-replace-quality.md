# Runbook: Improving Find/Replace Output Quality

## Context
Current replace behavior draws an erase rectangle and then draws replacement text. This can look "morphed" depending on fonts and transforms.

## When it looks bad
- Subset fonts or custom embedded fonts
- Rotated/skewed text runs
- Tight kerning and ligatures
- Complex layouts (tables, multi-column)

## What to adjust (in order)
1. Match filtering: skip rotated/skewed runs to avoid destructive edits.
2. Rectangle safety: never erase outside the matched bounds.
3. Font sizing: clamp replacement font size down when replacement is wider than original.
4. Baseline positioning: prefer using pdf.js text transform-derived baseline.

## If fidelity is a hard requirement
See ADR: `.docs/adrs/ADR-001-pdf-text-editing-fidelity.md`.
