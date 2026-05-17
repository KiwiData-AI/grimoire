---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
recorded-by: Claude (backfill via grimoire-audit on 2026-05-17)
---

# Intent-gated branch-guard via Claude UserPromptSubmit hook

## Context and Problem Statement
Grimoire wants to catch the common failure mode of starting new-feature work on the wrong branch (dirty branch, branch already mid-feature, branch named for something unrelated). The catch needs to happen *before* drafting begins — once a manifest is written on the wrong branch, recovery is fiddly.

This decision is distinct from ADR-0012 (dual-hook-strategy), which addresses installing **both** Claude Code hooks and git pre-commit hooks for `grimoire check` enforcement at commit time. ADR-0012 is about **install topology**; this ADR is about the **detection strategy** used inside one specific Claude hook (`UserPromptSubmit`) to decide when to intervene. The two ADRs compose.

Two interception points are available: the Claude Code AI assistant (via a `UserPromptSubmit` hook) and the git pre-commit hook (which fires too late — drafting artifacts already exist on disk).

## Decision Drivers
- Catch the problem at the earliest possible moment — when the user states intent, not when they commit
- Don't false-positive on prompts that aren't about new features ("explain X", "fix this bug")
- Don't block the user when the branch is fine
- Be reversible — the user should be able to override if the guard is wrong

## Considered Options
1. **Single git pre-commit hook** — catch after files are written
2. **Single Claude UserPromptSubmit hook** — catch before drafting begins, no intent detection (always prompt)
3. **Dual: Claude hook with intent regex + branch-guard skill** — Claude hook runs `grimoire branch-check` on every prompt, which uses a regex to detect new-feature intent and only blocks when intent is detected AND branch is unfit
4. **No automation — rely on convention** — document the rule, trust contributors

## Decision Outcome
Chosen option: **Intent-gated branch-guard: Claude UserPromptSubmit hook running `grimoire branch-check`, combined with new-feature intent detection.** The hook fires on every user prompt but only intervenes when (a) the prompt expresses new-feature intent (via a regex covering "add a feature", "let's build", "let's add", etc.) AND (b) the branch is unfit (dirty, or mapped to a different active change). For all other prompts, the hook exits silently with code 0.

This is enforced in `src/core/branch-check.ts` (`runBranchCheck`, `detectNewFeatureIntent`, `evaluateBranchCheck`) and surfaced as the `grimoire-branch-guard` skill.

**Prompt handling commitment.** The hook reads the user prompt from stdin, runs the intent regex against it in-process, and uses git plumbing to read branch state. The prompt content is never logged, persisted to disk, or transmitted off-machine. This commitment is load-bearing for user trust; any future telemetry, regex-tuning logger, or remote analytics on prompt content requires superseding this ADR.

### Consequences
- Good: Catches the problem at the earliest possible moment, before any drafting artifacts exist.
- Good: Silent on non-feature prompts — no friction for normal use.
- Good: When it does fire, the message names the conflicting state (dirty files, other active change) so the user knows what to do.
- Good: The branch suggestion is derived from the user's own prompt, so accepting it is a single Yes.
- Bad: Intent detection is regex-based — false negatives are possible on creatively-worded prompts.
- Bad: Adds a code path that runs on every Claude prompt; performance must stay sub-second.
- Bad: Requires Claude Code (or a compatible harness) — the guard doesn't fire for users on other AI assistants.

### Quality Attributes

| Attribute        | Target | Measurement |
|------------------|--------|-------------|
| Latency (p95)    | <500ms wall-clock per invocation | `time grimoire branch-check < sample-prompt.txt` against a representative prompt in a repo with the typical change-count |
| Throughput       | n/a — one invocation per user prompt | — |
| Availability     | hook never crashes the parent Claude session — failures degrade to "exit 0, no intervention" | unit tests in `branch-check.test.ts` cover exception paths |
| Privacy (CIA — Confidentiality) | Prompt content never leaves the process | grep `branch-check.ts` for file writes, network calls, or telemetry imports — must return zero |

### Cost of Ownership
- **Maintenance burden**: The intent regex needs occasional tuning as people word prompts differently.
- **Ongoing benefits**: A whole class of "feature work on the wrong branch" cleanups is eliminated.
- **Sunset criteria**: Revisit if false positives outpace true positives, or if a non-Claude harness becomes the primary target.

### Confirmation
Measurable signals:
- `time grimoire branch-check < prompt.txt` p95 under 500ms across the test fixtures in `branch-check.test.ts`
- `grep -rn "writeFile\|appendFile\|fetch\|http" src/core/branch-check.ts` returns zero hits (prompt-handling commitment is structurally enforced)
- Unit tests in `branch-check.test.ts` cover: dirty-branch block, active-change-mismatch block, non-feature-prompt silent-exit, branch-name suggestion derivation
