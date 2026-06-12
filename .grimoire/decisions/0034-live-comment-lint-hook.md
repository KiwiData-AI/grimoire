---
status: accepted
date: 2026-06-10
decision-makers: [Fred]
---

# Enforce comment quality at write time with a PreToolUse hook

## Context and Problem Statement
AI agents repeatedly write verbose, redundant comments despite instructions in skills, memories, and prompts. Those channels are advisory — the model can ignore them, and does. The existing `doc_style` check runs only at commit time (`grimoire check`), too late and too coarse to change behavior mid-edit. We need enforcement at the point the agent writes, not after.

## Decision Drivers
- Advisory text (skills/memories/prompts) does not bind model behavior; only tool-boundary enforcement does
- Must catch edits from subagents, not just the main agent
- Must not duplicate what real linters (eslint/ruff) already enforce
- Must not loop (Anti-Loop Protocol) — checks must be deterministic, never LLM
- Must stay opt-in and grimoire-scoped — no global footprint
- Surface must stay tiny; every false positive trains the user to ignore the hook

## Considered Options
1. Stronger prompts/skills/memories — keep tuning advisory text
2. PreToolUse hook running a deterministic comment linter on the changed portion, denying the write with an override pragma
3. PostToolUse hook — flags after the write lands (cannot deny; only feeds back)
4. PostToolUse hook that calls an LLM to judge comment quality
5. Auto-strip — hook deletes offending comments itself

## Decision Outcome
Chosen option: "PreToolUse hook, deterministic, changed-portion-only, deny-with-override", because it enforces at the tool boundary (binds main agent and subagents alike) and denies the call *before* the write — so no half-written file is left behind, unlike PostToolUse (option 3), which fires after the write and can only feed text back. It converges deterministically (delete the comment → pass) and reuses the existing `doc-style.ts` rules. Option 1 is what already failed. Option 4 violates the Anti-Loop Protocol and the "no LLM in a blocking hook" rule. Option 5 risks destroying wanted comments and is hard to do safely.

Scope is deliberately two checks that no linter covers:
- **verbose_comments** — multi-line standalone comment blocks and external-artifact references (reuses `VOLATILE_RE` and the 2-line prose threshold from `doc-style.ts`)
- **placeholder_stubs** — truncated/half-done markers (`// ... existing code`, `not implemented`, ellipsis-only bodies)

Debug leftovers and commented-out code are **out of scope** — eslint (`no-console`, `no-debugger`) and ruff (`T20`, `ERA001`) already catch them at the commit gate. We do not reimplement linters.

Mechanics:
- Runs on `PreToolUse` for `Write|Edit`, inspecting `tool_input` before the write lands.
- Lints **only the changed portion**: for `Edit`, `tool_input.new_string`; for `Write`, the proposed content diffed against the file on disk (a new file = all lines). Pre-existing lines the edit does not touch are never inspected — no git index involved, so new and untracked files are covered too.
- `grimoire-lint-ok` pragma on the comment suppresses that one finding — the agent can keep a genuinely-needed comment by saying so explicitly.
- Behavior controlled by `project.comment_lint: block | warn | off`; absent or `off` is a no-op. `grimoire init` writes the hook and sets `block`, and `grimoire update` adds it to already-initialised projects. This is why it appears only in grimoire-enabled projects — it ships through `init`/`update`, like the existing hooks (see 0012).
- `block` → deny the call (exit 2) with the offending lines on stderr; the write never lands and the agent retries. `warn` → allow, advisory. `off` → no-op.

### Consequences
- Good: Denies before the write — no half-written file; the agent cannot skip it; catches subagent edits
- Good: Reuses `doc-style.ts`; no new comment-parsing logic to maintain
- Good: Deterministic — no LLM, no loop, no API cost in the hook
- Good: Opt-in and grimoire-scoped; zero global footprint
- Bad: A third hook mechanism alongside the two from 0012
- Bad: PreToolUse fires before every Write/Edit — must stay fast (single file, changed portion only)
- Bad: Write-time enforcement is Claude Code-only (PreToolUse is a Claude Code event); other agents (Cursor, Aider, etc.) are covered only by the commit-time `doc_style` gate
- Bad: `placeholder_stubs` can false-positive on legitimate abstract stubs (e.g. a `not implemented` thrower) — the override pragma is the escape
- Bad: False positives erode trust; mitigated by tiny scope and the override pragma

### Confirmation
If an agent writes a verbose comment in a grimoire project with `comment_lint: block`, the write is denied with the offending line before it lands, and the agent either tightens the comment or adds `grimoire-lint-ok` — and editing an unrelated line in a file that already holds a verbose comment is allowed — the decision is validated.
