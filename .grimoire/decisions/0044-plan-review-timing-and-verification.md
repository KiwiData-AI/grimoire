---
status: proposed
date: 2026-09-01
decision-makers: [Fred]
---

# Plan review timing and use a change-level verification lifecycle

## Context and Problem Statement

Grimoire's per-section paired and autonomous execution model couples review timing, production-edit permissions, task completion, and patch approval. It encourages technical micro-sections and repeated verification. “Focused verification” does not require an exact narrow command, while both planned tasks and apply can run the full suites.

This decision supersedes [0043]. Grimoire still needs planning-time control over review attention, but implementation should remain fast and adaptable.

## Decision Drivers

- Preserve full-suite baseline capture before code changes.
- Preserve strict red-green proof for every feature slice.
- Make implementation feedback tactical and fast.
- Spend user review time on high-leverage structure and one complete code diff.
- Keep plans to one or two substantial feature sections by default.
- Adapt immediately when the user corrects an implementation approach.
- Keep optional per-file review in the harness instead of portable Grimoire state.

## Considered Options

1. Planned review timing with tactical red-green tasks and change-level review and verification.
2. Existing paired and autonomous execution with per-section checkpoint and patch state.
3. Fully autonomous implementation with only final review and verification.

## Decision Outcome

Chosen option: **planned review timing with a change-level lifecycle**, because it preserves user control where structure is costly while removing routine implementation ceremony.

Planning assigns one review timing to each substantial activity:

- `structure-before` reviews data models, repository layout, ownership boundaries, DRY-sensitive design, performance-sensitive design, and other costly-to-reverse shapes before implementation. After approval, the agent implements autonomously.
- `slice-after` lets the agent implement autonomously. All such work joins one consolidated pre-commit review after implementation.

Each implementation task is one vertical feature slice. It contains the test change, production change, and one exact command used to demonstrate red and green. The command selects only the new or changed tests and uses a verified runner acceleration option when available.

Apply follows three change-level stages:

1. Run every configured test suite once and record the accepted baseline.
2. Implement feature slices with exact tactical red-green commands.
3. Invoke `grimoire-verify` once. It runs deterministic and Grimoire-specific static checks, invokes `grimoire-precommit-review` once, applies tactical correction verification, then runs every configured unit and BDD suite once against the baseline.

`grimoire-precommit-review` is the single general code and best-practice review. `grimoire-verify` does not also run an LLM-backed `best_practices` check.

User-directed implementation corrections apply immediately. Grimoire records one terse lesson when remaining work is affected, updates only affected unchecked tasks, reruns affected tactical tests, and continues. It does not create a checkpoint, report, approval cycle, persona rerun, or plan-wide reconciliation.

Optional per-file review remains a harness-level user control. Grimoire does not encode it in `tasks.md` or implement provider-specific harness behavior.

### Consequences

- Good: Full suites run only at the two change boundaries.
- Good: Inner-loop tests target the behavior under implementation.
- Good: Planning directs review attention without controlling every production edit.
- Good: One or two substantial sections reduce context and coordination overhead.
- Good: User corrections improve remaining work immediately.
- Good: Harnesses can still provide per-file review when requested.
- Bad: Broad regressions may surface only during final verification.
- Bad: Plans must know the project's exact test-selection syntax.
- Bad: Runner acceleration options remain framework-specific.

### Cost of Ownership

- **Maintenance burden**: Keep plan, apply, verify, workflow features, examples, and contract tests aligned with the three-stage lifecycle and review-timing vocabulary.
- **Ongoing benefits**: Faster implementation, fewer agent restarts, fewer duplicate suite runs, and review attention matched to user priorities.
- **Sunset criteria**: Revisit if tactical commands are frequently invalid or final verification finds regressions that a predictable intermediate impact check would have caught.

### Confirmation

- Planning examples use one or two substantial feature sections and no Verification section.
- Every example feature task contains its test, implementation, and exact tactical red-green command.
- Apply specifies baseline once, tactical red-green implementation, and one `grimoire-verify` invocation.
- Verify invokes `grimoire-precommit-review` once before running final suites once.
- Workflow contract tests reject paired patch-only requirements and duplicate full-suite verification.
- `npm run test:bdd`, `npx vitest run`, and configured non-test checks pass.
