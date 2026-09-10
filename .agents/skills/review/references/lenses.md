# Lenses

Use reviewer and, when required, reviewer-second as independently configured definitions. Select sections by what the artifact actually changes; do not spawn one agent for every section. Every independent pass uses a fresh context. Structural improvement is a default lens for substantive changes, not merely cosmetic advice.

| Section | Questions that matter |
|---|---|
| Intent and correctness | Does this implement the agreed behavior? What is missing, incorrect, or outside scope? |
| Standards | Which documented project requirements apply? Which violations remain after automated tooling? |
| Structure | Could a better domain shape remove special cases, shared state, wrappers, or coupling? Does the interface hide useful complexity? |
| Testing | Can a meaningful defect make the tests fail? Are expected results independent? Are the observation seams appropriate? |
| Security | Are trust boundaries, permissions, secrets, and private data protected? |
| Reliability | What happens under retry, cancellation, partial completion, concurrency, teardown, and restart? |
| Compatibility and migration | Who consumes the contract or data? Which intermediate deployed states must coexist? |
| Performance | Which realistic workload could regress, and what measurement would settle it? |
| Experience | Does the user flow behave as intended? Are accessibility, empty/error/loading states, and feedback adequate? |
| UI lifecycle and platform | Are timing, resource ownership, native-platform behavior, and framework-specific assumptions sound? |
| Prior feedback | Was a previous finding actually fixed at this revision, or did the surrounding assumptions change? |
| Agent instructions | Are triggers clear, references reachable, authority explicit, and completion criteria observable? |

An adversarial pass uses the same relevant sections with a skeptical stance. It is not a personality or another mandatory agent. Document review uses intent, completeness, decisions, feasibility, and verification criteria from the same lens collection. Comment concerns go through structure and the simplify comments section. A launch/deployment checklist is a review artifact until verifier actually executes permitted checks.

A review of a manual rewrite also checks the complete reconstructed obligation list and comparative evidence. A separate auditor assesses the work/decision record; that audit does not replace code review.
