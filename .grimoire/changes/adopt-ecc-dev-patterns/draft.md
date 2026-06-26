# Draft: Adopt ECC-derived dev-discipline patterns

> Living design doc (kind: refactor). Source of truth at rest = the projected homes
> (skills, references, ADR, CONTRIBUTING). This doc is reference-only after projection and
> deleted at apply finalize. See [0034].

## Why
A review of the ECC repo (an "agent OS") surfaced ~10 genuinely strong dev-discipline
mechanisms buried under OS sprawl. Seven were selected for adoption. Each hardens an
existing grimoire surface (review, verify, bug, audit, skill authoring, ADR handling) with
a concrete, copy-pasteable mechanism — no new agent-OS surface. Solved when each mechanism
lives in its one home and the existing skills reference it.

Provenance: ideas distilled from `github.com/affaan-m/ECC`; concepts adopted, not vendored.

## Non-goals
- Not importing ECC's agent-OS surface (continuous-learning daemons, cost telemetry,
  council/fleet orchestration, per-language agent/command proliferation, marketplaces).
- Not adding new CLI commands or CI checks (no CI scope creep).
- Not mandating browser/MCP tooling — the run-the-app verify mode is optional, degrades to
  INCONCLUSIVE when tooling is absent.
- Not adding a hand-maintained ADR index that duplicates ADR frontmatter (would break DRY /
  one-home). Index, if any, is generated or deferred — see Decision D5.

## Feature Changes
- (none) — all targets are skill prose, references, an ADR, and CONTRIBUTING. Skills are pure
  markdown ([0010]); reviewers and verify are skill instructions, not CLI behavior, so no
  `.feature` admits under the four-gate test.

## Decisions
- **ADDED** `0036-capability-surface-selection.md` (proposed) — where a capability belongs
  (rule/skill vs CLI vs MCP vs reference). The one genuinely novel cross-cutting decision
  here; the governance gate that keeps grimoire focused. Builds on [0010], [0030], [0032].

## The seven items and their homes

### Item 1 — Reviewer Pre-Report Gate + named false-positive catalog
**Home:** `skills/references/review-personas.md` — new §2c (after §2b Severity Calibration),
applied by the diff-review personas (Senior Engineer, Security code-level scan, Code Style).
- **Pre-Report Gate** — 4 yes/no questions before any finding is written: exact line cited?
  concrete failure mode (input → state → bad outcome)? read callers + tests? severity
  defensible? Any "no/unsure" → downgrade or drop. HIGH/CRITICAL additionally require the
  snippet + failure scenario + why existing guards don't catch it.
- **Common false positives — skip these** — enumerated catalog of recurring LLM mis-flags
  with the disqualifying condition each time: null-deref when the prior line narrows the type;
  N+1 on fixed-cardinality / DataLoader paths; missing-await on intentional fire-and-forget
  (`void`/comment); `Math.random()` security theater in non-crypto context; missing-validation
  when a traced caller already validates; unhandled-rejection on a `.catch`-chained promise.
- Closing test: "would a senior engineer on this team actually change this in review? If no,
  skip." Complements the materiality gate (reactive/abstract) with a proactive/specific filter.

### Item 2 — Regression-test discipline (mechanical gate before AI self-review; name the test after the bug)
**Home:** `skills/grimoire-bug/SKILL.md` (primary) + a one-line cross-reference in
`skills/grimoire-verify/SKILL.md`.
- State the self-review blind-spot rationale: AI fixes → AI reviews own fix → "looks correct"
  → bug persists, because the same assumptions ride into both steps. Therefore the mechanical
  gate (configured test + build) is the source of truth and runs *before* any AI judgement.
- Convention: every fix gets one regression test named after the bug. grimoire-bug already
  requires a repro test (§3) and a baseline (§2b) — this adds the naming convention + the
  "mechanical gate is truth, not self-review" framing. Reinforces `feedback_test_baseline`.

### Item 3 — Run-the-app verification mode (verdict enum + INCONCLUSIVE≠PASS + final-state check)
**Home:** `skills/grimoire-verify/SKILL.md` — new optional section "Behavioral Verification".
- Reality gap: despite the skill's promise, verify today only runs configured test suites +
  reads code; it never drives the running app.
- Add an *optional* behavioral mode: drive the running app (read-only by default; mutations
  need explicit opt-in + non-prod target), emit a verdict ∈
  `SHIP / SHIP WITH FIXES / DO NOT SHIP / INCONCLUSIVE`. **No baseline ⇒ INCONCLUSIVE, never a
  silent PASS** — same integrity rule grimoire already applies to test-baseline triage.
- Click-path final-state check: build an action → {sets, resets} side-effect map and ask "is
  the FINAL state what the label/spec promises?" — catches behavioral spec mismatches static
  reading misses. No mandated tooling; if the app can't be driven, the mode reports INCONCLUSIVE.

### Item 4 — Capability-surface-selection policy (→ ADR 0036 + CONTRIBUTING pointer)
**Home:** `0036-capability-surface-selection.md` (the decision) + a short CONTRIBUTING section
that links it (no restating — DRY).
- Ordered decision rule for where a new capability belongs: deterministic always-on → AGENTS.md
  rule; on-demand workflow → skill; one-shot deterministic → CLI/script; **MCP only when
  universal AND stateful** (schemas tax every session's context). This is the written "should
  this even be a skill?" gate — the structural antidote to becoming an agent OS.

### Item 5 — Deterministic audit discipline
**Home:** `skills/grimoire-audit/SKILL.md` — tighten the dead-feature / stale-decision /
conventions-drift detection (§3.5, §6) to be deterministic and exact.
- Principle (discipline, not tooling): detection stays on codebase-memory-mcp per [0029]/[0030]
  (`search_graph` / `get_architecture`) — grep only where MCP has no answer (e.g. `@skip` age via
  `git blame`). MCP queries are themselves deterministic. The added discipline: reproducible for
  the same commit, exact `file:line` evidence per finding, the LLM summarizes/interviews and does
  not score by vibe. Output a prioritized top-actions list with exact paths.
- No grep-for-graph swap, no new CLI/script (respects no-CI-scope-creep); a discipline +
  output-format edit applying existing "pre-validate / don't reinvent" principles, so no ADR.

### Item 7 — Skill-authoring leanness (progressive disclosure + size thresholds)
**Home:** `CONTRIBUTING.md` — skill-authoring guidance.
- Convention: SKILL.md stays lean; heavy rubrics/catalogs live in `skills/references/*.md`
  loaded on demand (grimoire already does this — make it explicit so it scales).
- Soft thresholds for our own skills (lint-by-review, not CI): SKILL.md > ~400 lines,
  reference > heavy, frontmatter description > ~30 words → consider splitting to a reference.
  Cautionary lesson: ECC has 271 skills, ~7 use references/ — they failed to apply this at
  scale and bloated.

### Item 8 — ADR lifecycle + supersession links + reviewer-flags-missing-ADR
**Home:** `AGENTS.md` (Decision Numbering / lifecycle) + `.grimoire/decisions/template.md`
(status vocabulary) + `skills/references/review-personas.md` (reviewer flag).
- Lifecycle: add `deprecated` to the status vocabulary alongside `proposed / accepted /
  superseded by NNNN`; a superseding ADR must back-link the one it replaces, and the superseded
  ADR's status must name the replacement (AGENTS.md already half-states this — complete it).
- Reviewer flag: a PR/design that makes an architectural decision without recording an ADR is a
  Senior Engineer / Contrarian finding. (Keep the format/location — MADR in `.grimoire/decisions/`.)
- Index: NOT a hand-maintained file (DRY). See D5.

## Decision ledger
- **D1 — No `.feature` files in this change.** All targets are skill prose / references / ADR /
  docs; nothing passes the four-gate feature admission test. *Resolved: confirmed against
  grimoire-draft jurisdiction table.*
- **D2 — One ADR only (0036), not seven.** Only capability-surface is a novel cross-cutting
  trade-off. Items 5 and 7 are applications of existing principles; minting an ADR each is the
  exact backfill failure grimoire-audit §3 warns against. *Resolved: ADR for 4 only.*
- **D3 — Run-the-app verify is opt-in, not mandatory.** Mandating browser/MCP tooling would add
  an agent-OS dependency and break "works with any agent". *Resolved: optional mode, degrades to
  INCONCLUSIVE.*
- **D4 — Pre-report gate is additive to the materiality gate, not a replacement.** Materiality =
  "does this matter to THIS project"; pre-report = "is this even a real issue". They stack.
  *Resolved: new §2c, both apply.*
- **D5 — No static ADR index.** A hand-maintained index duplicates ADR frontmatter (status,
  title) → second home, breaks DRY (`feedback_dry_one_way`). Options were (a) generated index
  via CLI, (b) reviewer-flag only, (c) defer. *Resolved: defer the index; ship lifecycle +
  supersession links + reviewer flag now. A generated index can follow as its own change if the
  navigation need proves real.*
- **D6 — Item 5 targets grimoire-audit, not a new self-health command.** ECC's harness-audit is
  a self-config audit; grimoire's nearest analog (repo-health) is already `grimoire health` TS.
  Rather than expand TS / add a command, apply the *discipline* (reproducible, exact-path,
  prioritized) to grimoire-audit's existing detection prose. *Resolved: prose + output edit.*
- **D7 — Item 5 keeps codebase-memory-mcp; no grep swap.** ECC's "deterministic = grep/scripts"
  is ECC's tooling, not the transferable idea. grimoire already aligned on the MCP graph for
  auditing ([0029]/[0030]) and MCP queries are deterministic. The kernel adopted is the discipline
  (reproducible, exact evidence, prioritized, LLM-summarizes-not-scores), engine unchanged.
  *Resolved: MCP-first stays.*

## Other artifacts (projection targets)
- **MODIFIED** `skills/references/review-personas.md` — §2c Pre-Report Gate + FP catalog (item 1);
  reviewer-flags-missing-ADR (item 8).
- **MODIFIED** `skills/grimoire-bug/SKILL.md` — regression-test naming + mechanical-gate framing (item 2).
- **MODIFIED** `skills/grimoire-verify/SKILL.md` — Behavioral Verification mode (item 3); xref item 2.
- **MODIFIED** `skills/grimoire-audit/SKILL.md` — deterministic detection + prioritized output (item 5).
- **ADDED** `.grimoire/decisions/0036-capability-surface-selection.md` (item 4).
- **MODIFIED** `CONTRIBUTING.md` — capability-surface pointer (item 4); skill-authoring leanness (item 7).
- **MODIFIED** `AGENTS.md` — ADR lifecycle / supersession (item 8).
- **MODIFIED** `.grimoire/decisions/template.md` — add `deprecated` to status vocab (item 8).

## Assumptions
- Editing skill/reference prose is the right grimoire-native way to change skill behavior, since
  skills are pure markdown ([0010]) and have no `.feature` home. *Evidence: existing changes
  (e.g. 0034) modify SKILL.md directly as "Other artifacts".*
- The pre-report gate + FP catalog raise reviewer precision without suppressing real findings,
  because it stacks with — does not replace — the Contrarian re-uphold path. *Unvalidated on
  live reviews; mitigated by keeping Contrarian's "not a veto" rule.*

## Pre-Mortem
- **Catalog rot.** The FP catalog ages as language idioms shift. *Mitigation: keep it short and
  principle-led (trace the type / trace the caller), not an exhaustive lint list.*
- **Verify mode scope-creeps into a browser harness.** *Mitigation: opt-in, no mandated tooling,
  INCONCLUSIVE default; the section stays prose, not code.*
- **ADR backfill flood.** Tempting to mint ADRs for items 5/7. *Mitigation: D2 — one ADR; the
  rest are principle applications.*
- **Index DRY violation creeps back.** Someone adds a static index "for convenience".
  *Mitigation: D5 documents the call; revisit only as a generated artifact.*
