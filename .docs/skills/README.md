# SKILL.md — PDFoid Skills & Tooling Map

This document describes the tools used in this codebase, the skills required to use them well, and how “DEEPWIKI”-style documentation fits into modern AI/agent workflows.

## Why this exists
PDFoid spans UI engineering, PDF rendering/manipulation, local “AI” summarization, and state management. Those domains have different failure modes (coordinate mismatches, font/rendering issues, async worker pitfalls, infinite render loops). This file makes the expected competency surface explicit.

---

## Tooling in this repo (and the skill behind it)

### 1) React 18 + TypeScript
**Used for**: UI composition, interaction, stateful workflows.

**Skills required**:
- Component boundaries: keep rendering pure; push side effects into hooks.
- Dependency correctness: stable callbacks (`useCallback`) and memoization (`useMemo`) only when needed.
- Strict typing: treat TypeScript errors as design feedback; prefer explicit types on public store APIs.
- Debugging: interpret React warnings (e.g., `getSnapshot`/subscription loops) and trace to state/selector identity.

**Common failure modes**:
- Infinite update loops from unstable store snapshots/selectors.
- “Fixing” with `useEffect` hacks instead of stabilizing data sources.

### 2) Vite (build + dev server)
**Used for**: fast iteration, chunk splitting, modern ESM.

**Skills required**:
- Debugging HMR: distinguish dev-only behavior from production bundling.
- Understanding code splitting tradeoffs (bundle sizes vs. cacheability).

### 3) Zustand (state management)
**Used for**: annotation state, PDF editor state, UI toasts/modals.

**Skills required**:
- Selector stability: avoid returning new object/array literals from selectors unless using `useShallow`.
- Subscription correctness: values that drive UI must live *inside* the store state, not only in closure variables.
- Derivations: expose derived values as state when UI must subscribe to them (e.g., undo/redo counts).

**Common failure modes**:
- External mutable variables (outside store state) that React can’t subscribe to.
- Returning changing references from `useSyncExternalStore`-backed hooks.

### 4) pdf.js (`pdfjs-dist`) — rendering & text extraction
**Used for**: rendering PDF pages into canvas; extracting text items for search.

**Skills required**:
- Coordinate systems: canvas pixels vs CSS pixels vs PDF points.
- Worker constraints: ArrayBuffer cloning to avoid detached buffers; correct worker version/URL.
- Text extraction reality: PDF “text” isn’t always semantic text; it can be glyph positioning instructions.

**Common failure modes**:
- Wrong click/draw mapping after zoom (CSS size != internal canvas buffer size).
- Over-trusting extracted text positions for editing.

### 5) pdf-lib — document mutation
**Used for**: insert pages/images, rotate/crop, flatten annotations, export.

**Skills required**:
- Understand PDF content model: pdf-lib can add/overlay content easily; true in-place text editing is hard.
- Safety constraints: don’t erase large areas; enforce bounds checks.

**Important limitation**:
- In many PDFs, “edit existing text” is not reliably possible client-side without deep content-stream editing.
  Overlay replacement (draw white box + draw new text) is a pragmatic approach, but it cannot guarantee perfect
  font/kerning parity with the original.

### 6) Tailwind CSS
**Used for**: consistent layout, responsive UI.

**Skills required**:
- Utility composition: prefer consistent patterns; avoid one-off magic styling.
- Accessibility: ensure focus states, contrast, and hit targets.

### 7) Local “AI” utilities (TextRank/RAKE-like heuristics)
**Used for**: summarization and keyword extraction, on-device.

**Skills required**:
- Don’t oversell: treat as heuristics, not “LLM understanding.”
- Performance awareness: large documents can be CPU-heavy; consider workers for future.

---

## What “DEEPWIKI” means in modern AI/agent work

In the AI space, a “deep wiki” is less about being long and more about being *queryable and decision-oriented*. It supports:

- **Agent / RAG-style cognition**: structured docs act as a stable knowledge base that tools or agents can retrieve from.
- **Project memory**: architectural decisions, constraints, and invariants are written down so future work doesn’t regress.
- **Operational clarity**: what to change, where, why, and how to validate it.

A DEEPWIKI is effective when it contains:
- **Problem statements** and constraints (what cannot be broken).
- **Architecture** diagrams and data flow.
- **Decision records (ADRs)**: why a library/approach was chosen and tradeoffs.
- **Runbooks**: “how to debug X” and “how to test Y.”

In other words: it’s documentation optimized for *maintenance, retrieval, and correctness*, not prose.

---

## Skill ladder (what to learn first)

1. **Canvas + coordinate systems** (PDF viewer & annotation accuracy)
2. **Zustand subscription/selector discipline** (avoid infinite loops)
3. **pdf.js extraction limits** (search vs edit)
4. **pdf-lib mutation model** (what’s feasible client-side)
5. **Accessibility + responsive UI** (keyboard, ARIA, scaling)

---

## Quick self-checks (aligned with improved_dev_rules.md)

Before implementing a new feature:
- What is the *actual* user goal vs the UI request?
- What invariants exist (coordinate correctness, no infinite loops, PDF export integrity)?
- What are the failure cases and how do we degrade?
- How will we verify success (manual steps + automated checks)?
