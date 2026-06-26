# Tasks: Adopt ECC-derived dev-discipline patterns

Branch: `feat/adopt-ecc-dev-patterns`. Each task is independently verifiable. No `.feature`
changes. Order: ADR first (item 4 is referenced by item 8's reviewer flag), then references,
then skills, then docs.

## Item 4 — Capability-surface ADR
- [x] T1. Create `.grimoire/decisions/0036-capability-surface-selection.md` (status: proposed)
  from `template.md`. Context: grimoire must resist becoming an agent OS. Options: (a) no
  policy, (b) ordered surface-selection rule. Outcome: ordered rule — deterministic always-on
  → AGENTS.md rule; on-demand workflow → skill; one-shot deterministic → CLI/script; MCP only
  when universal AND stateful; reference doc for heavy rubrics. Drivers: focus, context cost,
  one-home. Link Decision Drivers to [0010], [0030], [0032]. Confirmation: new skills/MCP cite
  this ADR in review.

## Item 1 — Reviewer Pre-Report Gate + false-positive catalog
- [x] T2. In `skills/references/review-personas.md`, add **§2c Pre-Report Gate** after §2b
  (line ~117, before the `---` at 118). Content: the 4-question gate + HIGH/CRITICAL extra
  requirements. State it applies to the diff-review personas (Senior Engineer §4.2 code-level,
  Security §4.3 code-level scan, Code Style §4.6).
- [x] T3. In the same file, add **§2d Common False Positives — skip these**: the enumerated
  catalog (null-deref after type-narrowing; N+1 on fixed-cardinality/DataLoader; missing-await
  on intentional fire-and-forget; `Math.random()` non-crypto; missing-validation when caller
  validates; `.catch`-handled rejection). Each with its disqualifying condition + the
  "trace the type / trace the caller" instruction. Close with the senior-engineer test.
- [x] T4. Add one line to §4.2 Senior Engineer and §4.3 Security code-level scan pointing to
  §2c/§2d ("Run the Pre-Report Gate (§2c) and check §2d before filing"). Keep it terse.

## Item 8 — ADR lifecycle + supersession + reviewer flag
- [x] T5. In `.grimoire/decisions/template.md`, change the `status:` guidance to include the
  full vocabulary in a comment: `proposed | accepted | deprecated | superseded by NNNN`.
- [x] T6. In `AGENTS.md` "Decision Numbering" section (line ~248-251), expand: add `deprecated`
  state; require a superseding ADR to back-link the ADR it replaces, and the superseded ADR to
  name its replacement in its status. Keep DRY — state the rule once.
- [x] T7. In `skills/references/review-personas.md` §4.2 Senior Engineer, add a bullet:
  architectural decision in the diff/design with no ADR recorded → finding (route to an ADR via
  grimoire-draft). Add matching Contrarian awareness in §4.8 inputs if needed (one line).

## Item 2 — Regression-test discipline
- [x] T8. In `skills/grimoire-bug/SKILL.md`: (a) §3/§4 — add the convention "name the regression
  test after the bug" (the repro test IS that test; name it `<bug>-regression` or equivalent per
  framework). (b) Add a short note (§6 or §7) that the configured mechanical gate is the source
  of truth and runs before any AI self-review — cite the self-review blind-spot in one line.
- [x] T9. In `skills/grimoire-verify/SKILL.md` §3.D, add a one-line xref: a fix without a
  bug-named regression test is a gap (see grimoire-bug).

## Item 3 — Run-the-app verification mode
- [x] T10. In `skills/grimoire-verify/SKILL.md`, add a new optional section (after §3.D,
  before §4) **"3.E Behavioral Verification (optional)"**: drive the running app read-only by
  default (mutations need explicit opt-in + non-prod target); verdict enum
  `SHIP / SHIP WITH FIXES / DO NOT SHIP / INCONCLUSIVE`; **no baseline ⇒ INCONCLUSIVE, never
  silent PASS**; click-path final-state check (action → {sets,resets} map; final state must
  match the label/spec). State plainly: if the app can't be driven, report INCONCLUSIVE and
  fall back to static verification. Update the Report format (§7) to carry the verdict when run.

## Item 5 — Deterministic audit discipline
- [x] T11. In `skills/grimoire-audit/SKILL.md` §3.5 and §6, tighten detection discipline —
  NOT the tooling. Keep codebase-memory-mcp as the detection engine per [0029]/[0030]
  (`search_graph` / `get_architecture`); grep stays only where MCP has no answer (e.g. `@skip`
  age via `git blame`, already in §6). The discipline added: detection reproducible for the same
  commit, exact `file:line` evidence on every finding, the LLM summarizes/interviews and does not
  score by vibe. Add a "Prioritize" output = top-actions list with exact paths (most-risk first).
  No grep-for-graph swap, no new CLI/script.

## Item 7 — Skill-authoring leanness
- [x] T12. In `CONTRIBUTING.md`, add a "Skill authoring: keep it lean" subsection: progressive
  disclosure (SKILL.md lean, heavy rubrics → `skills/references/*.md` loaded on demand); soft
  thresholds (SKILL.md > ~400 lines, description > ~30 words → split to a reference). Note these
  are review-time conventions, not CI gates. Add the capability-surface pointer here too (item 4,
  link 0036 — do not restate).

## Verify
- [x] T13. Re-read each projected home against draft.md (projection completeness, per [0034]).
  Run `grimoire check` locally for the full gate (lint/format/etc.) before commit. Confirm no
  `.feature`/CLI behavior changed (so no test changes needed). Flip ADR 0036 + manifest status
  appropriately at PR.
