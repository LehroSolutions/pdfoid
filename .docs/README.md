# .docs — PDFoid Internal Documentation

This folder is meant to be the maintainers’ “truth set”: a compact, structured reference for how the codebase works and how to safely modify it.

## Contents
- [Codebase Map](codebase-map.md)
- [Architecture & Data Flow](architecture.md)
- [PDF Pipeline Notes](pdf-pipeline.md)
- [State Management (Zustand)](state-management.md)
- [Known Limitations](known-limitations.md)
- [Open-source + Hosted Distribution](open-source-distribution.md)
- [Glossary](glossary.md)

### ADRs (Architecture Decision Records)
- [ADR-001: PDF Text Editing Fidelity](adrs/ADR-001-pdf-text-editing-fidelity.md)
- [ADR-002: Zustand Selector Stability](adrs/ADR-002-zustand-selector-stability.md)

### Runbooks
- [Debugging React/Zustand Loops](runbooks/debugging-react-zustand-loops.md)
- [Improving Find/Replace Quality](runbooks/pdf-find-replace-quality.md)

## How to use
- Start with [Codebase Map](codebase-map.md) to find the right file.
- Read [PDF Pipeline Notes](pdf-pipeline.md) before touching find/replace or page ops.
- Read [State Management](state-management.md) before adding new store selectors.
