# ADR-001: PDF Text Editing Fidelity

## Status
Proposed (needs a product decision)

## Context
The current find/replace implementation uses pdf.js for text search + pdf-lib to apply changes by drawing a white "erase" rectangle and then drawing replacement text. This is fast and works for many simple PDFs, but it is not true in-place text editing.

Symptoms users can see:
- Typographic mismatch (kerning/spacing/font substitution)
- Baseline drift (text sits too high/low)
- "Morphed" look, especially when the original PDF uses embedded/subset fonts
- Erase rectangles that either miss pixels or remove nearby content

## Goals
- Make edited PDFs look like "a better reader" (high fidelity), not like scanned/overlaid text.
- Preserve text extractability/searchability where possible.
- Avoid destructive changes to unrelated content.

## Options
### A) Keep overlay replacement (current)
- What: redact region (rectangle) + draw new text.
- Pros: local-only, simple, works offline.
- Cons: cannot guarantee typographic match; not true editing.

### B) True content-stream editing (edit operators)
- What: parse and rewrite PDF content streams (TJ/Tj, text matrices, font resources).
- Pros: highest fidelity when it works; preserves vector quality.
- Cons: hard; requires robust PDF parsing/rewrite; many edge cases (ligatures, composite fonts, encoding maps, subset fonts).

### C) Hybrid: structured redaction + reflow overlay
- What: explicitly treat replace as redaction (intentional) and re-render replacement using consistent UI rules.
- Pros: honest UX; predictable output; safer than trying to emulate original typography.
- Cons: still overlay; not indistinguishable.

### D) Server-side processing
- What: use a dedicated PDF engine/service for editing.
- Pros: best fidelity and feature coverage.
- Cons: privacy/security implications, infrastructure cost, offline no longer possible.

### E) OCR-first workflow (for scanned PDFs)
- What: detect scanned pages -> OCR -> create a text layer; edits apply to the text layer.
- Pros: meaningful editing for scans.
- Cons: introduces OCR errors; needs language models/engines; still not identical to original.

## Decision
Pending. The current approach (A) is acceptable only if the product positions find/replace as a redaction-style overlay.

## Recommendation
- If the requirement is "indistinguishable" edits: pursue (B) or (D).
- If the requirement is "readable, consistent, honest": pursue (C) and adjust UI copy to communicate redaction semantics.
- If targeting scanned PDFs: add (E) as an explicit mode.

## Implications
- (B)/(D) change the architecture and testing strategy.
- (C) mainly changes UX language + replacement rendering rules.

## Follow-ups
- Add a short product note: “Replace edits are applied as overlays (redactions), not true PDF text rewriting.” unless (B)/(D) is chosen.
