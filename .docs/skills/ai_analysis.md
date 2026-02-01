# Skill: Local AI Analysis

## Context
Local summarization (TextRank) and keyword extraction (RAKE) are performed without external APIs to preserve privacy and speed.

## Algorithms
1. **TextRank**: Graph-based ranking for sentences.
2. **RAKE/TF-IDF**: Frequency and co-occurrence extraction for keywords.

## Operational Constraints
* **Content Extraction**: `pdfjs-dist` text extraction can be messy. Scrub extra whitespaces and filter out page numbers before analysis.
* **Performance**: Large documents (>50 pages) can block the main thread. 

## Self-Improvement Protocol
- [ ] If summary is too short, check the sentence splitting regex (support `.` `!` `?`).
- [ ] Verify that stop-words are properly filtered to avoid "the", "and", "a" in keywords.
- [ ] Consider moving the AI logic to a Web Worker if UI lag is detected during "Analyze" phase.
