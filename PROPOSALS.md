# Improvement Proposals

any BEE may append ideas here while working: tools worth building, perf wins, redundant
steps, free functionality. One idea per entry, newest last. QUEEN curates this file
and packages the best entries as decision-ready briefs for the human.

## Template

### <slug> - <one-line title>
Proposed by: <worker> | Date: <YYYY-MM-DD> | Effort: S/M/L | Risk: low/med/high
Problem: <what slows or breaks work today>
Proposal: <the change>
Impact: <what improves, for whom>

## Open
### claims-gate-encoding - Harden claims gate against UTF-16LE index decoding
Proposed by: QUEEN | Date: 2026-08-26 | Effort: S | Risk: low
Problem: BEE-BETA-3 reports `git diff --cached --name-only` output decoded as UTF-16LE in
their session, corrupting staged-path matching inside scripts/check-claims.mjs (--cached
checks only; worktree verification unaffected). They bypassed hooks to land S8.
Proposal: pin encoding explicitly (execSync with `-c core.quotepath=false` plus explicit
Buffer->UTF8 decode), add a regression test with forced codepage, and document
CLAIMS_GATE=skip as the sanctioned bypass when toolchain encoding misbehaves.
Impact: gate becomes session-proof; no worker needs to bypass again.
### claims-seat-latch - Reject claims overwrites while a task worktree exists
Proposed by: BEE-BETA-5 | Date: 2026-08-26 | Effort: S | Risk: low
Problem: during the OX→BEE rename, two same-number instances held one Task_ID: the successor
overwrote `.claims/E3.json` last-writer-wins while the predecessor was mid-edit in the same
`../hivebench-E3` worktree, interleaving two incompatible designs into one untracked package.
Proposal: `scripts/check-claims.mjs` refuses a claim-file write whose worker string differs
from the existing entry while `../hivebench-<Task_ID>` still exists; worktree creation writes
a sentinel (worker + timestamp) that removal requires. QUEEN arbitrates genuine reassignments
by clearing both explicitly.
Impact: same-seat collisions become loud at the gate instead of silent file races; renames
and drone resets stop poisoning in-flight work.
## Accepted (converted to board rows)

### claims-seat-latch - Reject claims overwrites while a task worktree exists
Proposed by: BEE-BETA-5 | Date: 2026-08-26 | Effort: S | Risk: low
Problem: during the OX→BEE rename, two same-number instances held one Task_ID: the successor
overwrote `.claims/E3.json` last-writer-wins while the predecessor was mid-edit in the same
`../hivebench-E3` worktree, interleaving two incompatible designs into one untracked package.
Proposal: `scripts/check-claims.mjs` refuses a claim-file write whose worker string differs
from the existing entry while `../hivebench-<Task_ID>` still exists; worktree creation writes
a sentinel (worker + timestamp) that removal requires. QUEEN arbitrates genuine reassignments
by clearing both explicitly.
Impact: same-seat collisions become loud at the gate instead of silent file races; renames
and drone resets stop poisoning in-flight work.

## Accepted (converted to board rows)
## Declined


### hybrid-assembly - Recent raw tail + curated body budget split
Proposed by: QUEEN | Date: 2026-08-26 | Effort: M | Risk: med
Problem: paired A/B (598 turns) shows strict losses concentrate on recency-heavy turns
(fifo-only 62 vs hive-only 25) where same-domain recent chunks beat relevance-ranked
selection - the Threat 6 ceiling live. Focal has get_recent_chunks(3) for drift only;
no guaranteed recency slice reaches assembly.
Proposal: focal budget split - reserve K tokens (configurable, e.g. 20%) for the last-N
raw turns as a pinned recent tail; curated chunks fill the remainder. Config knob
recent_tail_tokens, off-by-default variant preserved for A/B replay comparability.
Impact: converts the strict-loss class (recency-heavy drift turns) without touching
ranking; directly testable against the same corpus via paired_ab rerun.
