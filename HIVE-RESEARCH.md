# DEEP RESEARCH MODE — QUEEN capability card

**Deployment:** drop this file beside the other hive cards. No session needed to *host*
it — research runs inside the OX-MASTER session whenever triggered. Workers may also be
launched with it for isolated deep-dives.

**Trigger it:** ask QUEEN directly (*"deep-research: <question>"*), or drop a question
into `RESEARCH-QUEUE.md` — the Queen picks queued items up on its next wake and files
the report under `RESEARCH/<slug>.md`.

---

## 1. When to enter research mode

- The human asks a question whose answer needs evidence beyond the current context.
- A RED defect, proposal, or merge decision hinges on an external claim that was never
  verified (a paper's numbers, a library's behaviour, a vendor's statement).
- A decision is reversible-but-expensive and a half-hour of evidence beats an opinion.
- Related-work scans: is this idea already done? What did prior art measure?

Do NOT enter for questions the repository itself already answers definitively — read the
code/docs instead; research mode is for knowledge outside the tree.

## 2. The loop

1. **Frame.** Write the question as the decision it feeds: *"what must we know to choose/
   act?"* If no decision hangs on it, demote to a curiosity note.
2. **Decompose** into 2–5 sub-questions answerable independently.
3. **Local first.** Repository state, docs, logs, prior run artifacts — cheapest evidence,
   and often the question dissolves ("we already measured this").
4. **Gather externally.** Web search + fetch primary sources (papers, official repos,
   model cards, changelogs). Multiple query phrasings; both confirming and disconfirming
   searches.
5. **Verify proportionally.** Claims that drive decisions need two independent sources or
   one primary source read directly. Runnable claims get executed, not trusted.
6. **Synthesize** into the report template below. State unknowns explicitly — "could not
   verify X" is a finding.
7. **Route results:** facts → the relevant doc/board row; ideas → `PROPOSALS.md`;
   decisions → operator briefing with recommendation.

## 3. Report template (`RESEARCH/<slug>.md`)

```markdown
# <Question as title>
Date | Triggered by | Time-box spent
## Decision this feeds
## Findings
- [verified] claim — source URL/path ×2
- [single-source] claim — source
- [inferred] claim — reasoning chain
## Disconfirming evidence found
## Could not verify
## Recommendation
## Sources
```

Confidence tags are mandatory. `[verified]` requires two independent sources or one
primary; `[inferred]` must show its chain.

## 4. Discipline

- **Primary over secondary.** Read the paper/repo/changelog, not the blog about it.
- **Search for the refutation.** One deliberate disconfirming query per major claim.
- **Time-box honestly.** Note minutes spent; research expands to fill attention.
- **No covert implementation.** Findings route through PROPOSALS/board like anything
  else; research never becomes a licence to edit.
- **Archive the trail.** Every URL and file path goes in the report; future sessions
  must re-trace your steps without re-searching.

## 5. Lineage

Proto-instances that proved the value: upstream-bot 404 diagnosis (workflow config
audit), TurboQuant ICLR/OpenReview verification, BGE-M3 title correction, FreeToken
authorship confirmation, sbert URL migration catch — all were ad-hoc runs of this loop
that caught real errors in high-stakes citations. This card makes the discipline
standard instead of heroic.
