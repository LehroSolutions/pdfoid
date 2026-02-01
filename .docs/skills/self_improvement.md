# Skill: Ralph Loops Protocol (Self-Improvement)

## Overview
The "Ralph Loops" technique is an autonomous iterative refinement loop. The agent (Antigravity) repeatedly analyzes its own output, runs tests, and adjusts the implementation until a "perfect" or "stable" state is reached.

## The Protocol

### Step 1: Baseline Analysis
* Read the target file and its associated tests.
* Execute `npm test` or specific verification scripts.
* Capture errors and warnings.

### Step 2: Implementation / Modification
* Apply fixes or enhancements based on the previous error logs.
* Add "Robustness" tests (edge cases: null inputs, out-of-bounds coordinates, large files).

### Step 3: Automated Verification
* Run the tests again.
* If ❌: Feed the failure back into Step 1.
* If ✅: Move to Step 4.

### Step 4: Visual/Secondary Audit
* Use the `read_browser_page` (if applicable) or `ls` to verify file state.
* Manually check code quality (DRY, SRP, Types).
* If "Good enough" is reached, break the loop.

## Guardrails
* **Max Iterations**: 5 loops per feature to prevent infinite recursion/token waste.
* **Gutter Detection**: If the same error persists for 2 loops, pivot the approach (read more docs/ADRs).

## Reporting
Each loop iteration should be documented in the `task_boundary` summary as:
`[Ralph Loop #X] Task: [Fixing Coordinates] Status: [Success/Fail] Error: [Logs]`
