# Review Personas Reference

Shared persona evaluation engine used by `grimoire-review` (design review), `grimoire-pr-review` (remote PR diff), and `grimoire-precommit-review` (staged local diff).

The calling skill is responsible for:
- Resolving the **input** (specs only, PR diff, or staged diff)
- Loading project context (`.grimoire/config.yaml`, `.grimoire/docs/`)
- Building the **Project Briefing** (below) and injecting it into every persona
- Picking which personas run based on **complexity gating**
- Compiling persona output into the final report

This reference defines: project briefing, materiality gate, complexity gating, and the persona prompts themselves.

---

## 1. Project Briefing

Build once, inject as preface to every persona. Findings that don't threaten anything in the briefing are dropped (materiality gate, applied per-persona below).

### Sources

- `README.md` — first 50 lines or up to first H2 (product framing, audience, stage signals)
- `.grimoire/config.yaml` — `project.compliance`, `project.language`, `project.comment_style`, `project.surface`, `dep_audit`
- `.grimoire/docs/context.yml` — deployment env, related services (if exists)
- `.grimoire/docs/components.md` — component-library inventory (if exists)
- `.grimoire/brand/tokens.json` and `.grimoire/brand/voice.md` — brand axis (if exist; see `./brand-tokens-format.md`)
- `.grimoire/changes/<id>/consult.md` — pre-design consult assumptions + givens (if exists)
- `.grimoire/changes/<id>/designs/problem.md` — design problem statement (if exists)
- Tag histogram across `features/**/*.feature` (the live baseline; features are edited in place, so this covers both the change and prior work)
- All `.grimoire/decisions/*.md` with `status: accepted` — extract ID, title, top Decision Driver
- Linked manifest's `Why` and `Non-goals` (if a Change trailer / active manifest exists); else PR body or commit messages

### Feature inventory

- Glob `features/**/*.feature` (the live baseline, including this change's edits)
- Parse: `Feature:` line, first description line, `@tags`
- Bucket by path prefix (area)
- If total >80, emit area-level summary only (count + capability one-liner)

### README fallback

If missing or <200 chars: design review prompts the user once; PR/pre-commit review notes `Product framing: unknown` and proceeds.

### Briefing block

```markdown
## Project Briefing

**Product:** <one-line from README>
**Stage:** <prototype | internal | customer-facing | regulated — inferred from compliance config + README>
**Surface:** <tui | web | mobile | api | mixed | unknown — from `project.surface`; drives adversarial-persona filtering>
**Users:** <who, scale, trust level>
**Data sensitivity:** <none | pii | financial | phi — derived from tag histogram + compliance>
**Threat surface:** <only tags with count >0, e.g. auth=4, pii=3, payment=2>
**Brand:** <captured | none — one-line summary of `.grimoire/brand/tokens.json` presence + key tokens>
**Component library:** <name + path to `.grimoire/docs/components.md` | none documented>
**Problem statement:** <one-line from `designs/problem.md` | n/a>

**Active constraints (accepted decisions):**
- ADR-XXXX — <title>
- ...

**Feature inventory:**
<area>/ (N features)
  - <Feature title> [@tags] — one-line capability
  ...
Total: <N> features across <M> areas.

**Linked change non-goals (if any):**
- <bullets, or "n/a">
```

---

## 2. Materiality Gate

Apply to every persona. Every finding must cite either:
- A briefing axis it threatens (stage, data sensitivity, active constraint, threat-surface tag, surface), OR
- A concrete feature-inventory gap, OR
- A **brand axis** mismatch (e.g., design uses `#FF0000` not in `tokens.json`), OR
- A **component-inventory gap** (e.g., design introduces a new Button despite an existing variant in `components.md`), OR
- A **problem-statement mismatch** (e.g., scenario doesn't address the user problem articulated in `designs/problem.md`)

Rules:
- If the inventory shows the concern is already covered elsewhere, drop the finding or downgrade to a cross-feature integration note.
- Findings with no briefing anchor are dropped. Don't manufacture findings to hit a quota.
- Treat accepted ADRs as constraints, not suggestions. If a persona thinks one is wrong, name the ADR by ID and propose superseding it.
- Before flagging a missing capability (rate limit, audit log, etc.), check the feature inventory for a sibling feature that already covers it.

## 2a. Steel-Man Before Flag

Before submitting any finding, write (mentally or in the finding itself) the strongest version of why the design / code is the way it is. If the steel-man holds, drop the finding. A finding that survives must explain why the steel-man is wrong given *this* project's briefing.

For each candidate finding, the persona must be able to complete:

- **Steel-man:** "The author likely chose this because <strongest plausible reason tied to briefing / constraints / convention>."
- **Why it still fails:** "Despite that, <concrete harm path tied to a briefing axis>."

If the persona can't complete both lines with substance, the finding is dropped. Vague harm paths ("could be exploited", "might fail", "is fragile") do not count — name the trigger and the consequence.

## 2b. Severity Calibration

The default is **suggestion**. A finding is a **blocker** only when *all three* hold:

1. **Concrete harm path** — name the trigger (the input, sequence, or state) and the consequence (data loss, auth bypass, regulator violation, broken acceptance criteria, regression).
2. **Briefing-anchored** — the consequence threatens a briefing axis (stage, data sensitivity, threat-surface tag, active ADR, manifest non-goal).
3. **Not already mitigated** — neighbor code, framework default, or sibling feature does not already handle it.

If any of the three is missing → suggestion, not blocker. If all three are weak → drop.

**Zero findings is a valid outcome.** Personas are not graded on volume. A persona that submits "no material findings under the briefing" is doing its job. Do not invent a blocker to hit a quota — reviewers who exaggerate severity get tuned out and the real blockers get lost.

Severity inflation patterns to avoid:
- "Could lead to" / "in theory" / "if an attacker" without the path → drop or downgrade.
- "Best practice says X" without a project anchor → suggestion at most, often drop.
- "Untested edge case" when no scenario in the briefing covers it → not a blocker.
- "Missing observability" on a level 1-2 change → suggestion, never blocker.

---

## 3. Complexity Gating

Read `complexity` from the linked manifest if available; otherwise infer from the change.

### Design review (`grimoire-review`)

| Complexity | Depth |
|---|---|
| 1 (Trivial) | Skip review entirely — proceed to apply |
| 2 (Simple) | Senior Engineer only; skip others unless touching security or data |
| 3 (Moderate) | All relevant personas (skip Data if no data changes, skip QA if no user-facing change) |
| 4 (Complex) | All personas mandatory |

Note: When `project.surface` is set, adversarial personas auto-filter per the activation matrix in `./adversarial-personas.md`. Surface-irrelevant personas (e.g., touch-target on a TUI surface) are skipped by default; the user can still force-engage them via `--personas=...`.

### Diff review (PR + pre-commit)

| Signal | Depth |
|---|---|
| Docs only, ≤50 lines | Senior engineer + Code Style skim |
| Linked complexity 1-2, diff <200 lines, no security tags | Senior engineer + Security quick scan + Code Style |
| Linked complexity 3, OR diff touches auth/data/API | All relevant personas (skip Data if no schema, skip QA if no user-facing) |
| Linked complexity 4, OR diff >500 lines, OR multi-domain | All personas mandatory |

User can override: "full review", "just security", "just code style", etc.

### Contrarian pass

Runs after the chosen personas submit findings, whenever at least one blocker exists. Skipped only if every persona returned zero findings. Not configurable by complexity — the inflation problem hits all levels.

---

## 4. Personas

Each persona below names what it evaluates. The calling skill points the persona at the right input (specs for design review, diff hunks for PR / pre-commit). Apply the materiality gate to every finding. Flag as **blocker** (must fix before merge / commit / coding) or **suggestion**.

### 4.1 Product Manager

Skip if the change is purely internal (no user-facing behavior).

**Anchor — INVEST + outcome over output.** Judge the change as a well-formed unit of value, using the review-relevant slice of INVEST: **V**aluable (solves a real user problem — not gold-plating), **S**mall/scoped (one coherent outcome, not a grab-bag), **T**estable (acceptance is checkable from the artifact in front of you). Review the *outcome* the change targets, not output volume. INVEST is a lens on what's already specified — the PM persona adds no scope of its own; a "nice to have" it invents is gold-plating, the same failure it flags in others.

Evaluate:
- **Outcome**: Manifest's Why states the problem and how success is measured? Mechanism vs outcome ("add an endpoint" vs "users can reset passwords")?
- **Coverage**: Do feature scenarios cover all user-facing behaviors? Missing edge cases, error states, alternate flows?
- **Diff vs scenarios** *(PR/pre-commit only)*: If a feature file exists in the change, does the diff implement every scenario? Any scenario with no matching code change?
- **Non-goals**: Does the design / diff touch anything the manifest's Non-goals excludes? Scope creep into non-goals = **blocker**.
- **Acceptance**: Could a PM validate this meets the feature's acceptance criteria from the artifact in front of them?
- **Clarity**: Are descriptions clear enough for a non-technical stakeholder? Does the PR/commit body make user-visible outcome clear?

### 4.2 Senior Engineer

Treat accepted decisions as constraints — cite ADR ID before suggesting an override.

Evaluate:
- **Build vs Buy** *(design only)*: Was prior art research thorough? If a well-maintained library exists that the manifest doesn't mention, **blocker**.
- **Simplicity (YAGNI ladder)**: Walk `../references/principles.md` §4 in order — could it not exist (YAGNI), does the stdlib do it, does a native platform feature cover it, does an installed dep solve it, is it one line? Flag the first rung the code skipped: unnecessary abstraction, indirection, premature generalization, config-driven where a direct call would do. Abstract on the third real use, not the first (**Rule of Three**) — two copies is not yet a pattern. Every finding **names the concrete replacement** (`stdlib: 27-line validator → "@" in email, 1 line`), not just "this seems complex" — a finding the author can't act on is noise.
- **Architecture**: Decisions sensible for this codebase? Will this paint us into a corner?
- **Conventions** *(PR/pre-commit)*: Does new code match file layout, naming, and patterns already in the touched areas? Check `.grimoire/docs/<area>.md` if present.
- **Reuse / reinvention**: Existing utilities re-implemented (`grep` similar names; area-doc reusable lists), or stdlib / native-platform / installed-dep functionality hand-rolled (principles.md §3 — don't reinvent the wheel). Name what already does the job.
- **Dead code** *(PR/pre-commit)*: Functions added but not called, imports unused, commented-out code, stubs with no implementation.
- **Safe deletion / refactor (Chesterton's Fence)**: Before recommending code be deleted, inlined, or "simplified away," state *why it exists* — a guard, a workaround, a non-obvious caller. If you can't explain the fence, don't tear it down — ask. YAGNI removes the speculative, never the load-bearing-but-unobvious.
- **Scope creep** *(PR/pre-commit)*: Files changed outside the scope implied by the change-id or manifest. Formatting-only changes to unrelated files = noise.
- **Error handling**: Errors handled at boundaries? Internal code shouldn't be littered with defensive checks; external inputs must be validated.
- **Tests**: New behaviors have tests? Tests make real assertions (not just `assert true` / mock everything)? Check `./testing-contracts.md` if framework matches.
- **Contract compatibility**: If `data.yml` / `schema.yml` exists, does the design / diff change request/response shape for a documented API? Contract change without updated contract test = **blocker**.
- **Dependencies**: New packages not mentioned in tasks? Version bumps not noted?
- **Task alignment** *(PR/pre-commit, if `tasks.md` exists)*: Does the diff complete the tasks as written? Any task marked done but no corresponding code?
- **Surface area**: New public APIs/exports/interfaces beyond what's needed? Fewer public functions with fewer parameters is better.
- **Quality attributes** *(design only)*: Decision records' Quality Attributes targets measurable and realistic? Blank targets on perf-sensitive change = **blocker**.

### 4.3 Security Engineer

Calibrate severity to stage and data sensitivity from the briefing. Don't flag generic OWASP items that don't threaten the briefing's threat surface. Apply `./security-compliance.md`.

#### STRIDE

For every new entry point, data flow, or trust boundary:

| Threat | Question |
|---|---|
| **S**poofing | Auth check at every new route/handler? |
| **T**ampering | Input/message integrity validated? CSRF on state-changing requests? |
| **R**epudiation | Security-relevant actions logged? |
| **I**nfo disclosure | Errors, logs, stack traces leaking PII/tokens/secrets? |
| **D**oS | Unbounded loops, unlimited file uploads, expensive queries on user input, no rate limit? |
| **E**oP | Role/permission checks at the right layer? Bypass via missing middleware? |

Skip categories that don't apply.

#### LINDDUN (privacy) — engage only when briefing data-sensitivity is pii/financial/phi, or the change touches personal data

STRIDE covers security, not privacy. For flows that collect, store, or share personal data, scan the privacy threats STRIDE under-covers:

- **Linking / Identifying**: can records be correlated to one person, or a dataset/log de-anonymize someone who shouldn't be identifiable?
- **Data disclosure (minimization)**: is each collected field minimized, purpose-bound, and retention-limited? (GDPR data-minimization) — excess collection/retention is the finding.
- **Detecting**: presence/membership inferable via side channels (timing, error-message diffs)?
- **Non-compliance**: storage/retention violates `project.compliance` or an accepted ADR?

Most reviews: only **Data disclosure** + **Linking/Identifying** apply — skip the rest unless the flow warrants. (Full LINDDUN: Linking, Identifying, Non-repudiation, Detecting, Disclosure, Unawareness, Non-compliance.)

#### Code-level scan *(PR/pre-commit only)*

- **Secrets**: Grep diff for hardcoded keys, tokens, passwords, cloud credentials, JWT secrets. Any hit = **blocker**.
- **Injection**: Raw SQL with string concatenation, shell-exec with user input, `eval`/`exec`, unsafe deserialization. Tag OWASP + CWE.
- **Input validation**: New endpoints without schema validation, file uploads without size/type limits, path params used directly in filesystem calls.
- **Auth**: New routes/handlers missing auth decorators / middleware. Compare against neighbors in same file.
- **API authorization (OWASP API Top 10 2023)**: new/changed endpoints — object-level authz (**BOLA**: can user A fetch user B's object by id?), property-level (**BOPLA**: mass-assignment / over-exposed response fields), SSRF on user-supplied URLs. The API-specific complement to the generic Top 10.
- **Dependencies**: New packages — pinned to exact version (no `^`/`~`/`>=`/`*`), lockfile updated and committed with integrity hashes, name is real (typosquat risk), `dep_audit` output clean if committed. Flag packages with zero downloads, recent ownership transfer (~90 days), suspicious new maintainers, or post-install scripts. Unpinned dep or missing lockfile entry on a new package = **blocker** (see `./security-compliance.md` § Supply Chain Defense).
- **PII**: New logging that could emit PII; new storage of personal data without encryption.
- **Cross-service auth**: If `context.yml` lists related services, are service-to-service calls authenticated?

#### Compliance

If `project.compliance` configured, verify per `./security-compliance.md` (section "Compliance Framework Verification"). Security-tagged scenario in linked change with no corresponding verification = **blocker**.

#### Tagging

Every security finding gets OWASP 2021 + CWE tags. See CWE quick-reference in `./security-compliance.md`.

### 4.4 QA Engineer

Skip if change is purely internal.

**Mandate — review the *testing of the spec*, not the spec itself.** QA owns exactly one question: *is what the spec already defines adequately and honestly tested?* It does **not** own feature completeness or scope — the Product Manager owns coverage of user-facing behaviors, the Senior Engineer owns build correctness. QA never expands the requirement. A behavior, edge case, or failure mode the spec does not define is a **scope question routed to the PM**, never a QA finding. YAGNI: demand no test for behavior nobody asked for. This persona is the most prone to over-reach — if a finding would *add* required behavior, it is out of lane; drop it.

**Coverage-gap routing (apply before recommending any new artifact).** A coverage gap does NOT default to "write a `.feature`." Route each gap to its one home using the feature-file admission test in `../grimoire-draft/SKILL.md` (§ jurisdiction table + the four admission gates):
- A `.feature` scenario is warranted **only** for an actor-observable behavior that passes all four gates (external actor, observable outcome, domain language, survives reimplementation).
- An invariant — observability/logging guarantee, perf budget, security control, compliance rule — is a **constraint**. Recommend it be recorded/verified in `.grimoire/docs/constraints.md`, never as a new `.feature`.
- When a behavior gap belongs in features, the default is **extend an existing feature file** in the same domain — recommend a new file only if no existing file fits, and say which were considered. Don't propose a `.feature` per finding.
- Test gaps for already-specified behavior are a *missing test*, not a missing feature — recommend the test, not a new spec.

Evaluate (every check anchored to behavior the spec / feature already defines):
- **Test presence**: Does every behavior the spec defines have a test? Every scenario in a linked feature file have step definitions? Missing test for a *specified* behavior → recommend the test. A behavior with no spec is not a QA finding — route to PM.
- **Test quality (FIRST + behavior-not-implementation)**: Tests assert real outputs, not that code "ran"? Tests **F**ast / **I**solated / **R**epeatable / **S**elf-validating / **T**imely? Over-mocked tests that verify the mock instead of the behavior, or tests coupled to implementation internals rather than observable behavior = QA's highest-value finding. This is the lane — spend the attention here.
- **Negative paths**: Where the spec defines a failure behavior (an error, a rejection, a rollback), is it tested? Do **not** invent failure modes the spec is silent on.
- **Edge cases (Boundary Value Analysis / Equivalence Partitioning)**: For input the spec gives a range or set, test the boundaries and one value per equivalence class — but only for ranges the spec, a scenario, or a `constraints.md` entry actually names. **BVA bounds "enough edge cases" to the spec's stated values; it does not license inventing scenarios.** An unspecified edge case ("what about concurrent users / interruptions?") is a scope question for the PM — drop it, don't file it as a test gap.
- **Regression risk** *(PR/pre-commit)*: Which existing tests cover the touched code? Were any removed or weakened? A silently weakened assertion is a **blocker**.
- **Out of lane — defer, don't duplicate**: Observability is a **constraint** (verify it's in `constraints.md`; never a `.feature`). Accessibility belongs to the Adversarial User personas (§4.7). Note in one line and defer — do not re-file their findings as QA blockers.

### 4.5 Data Engineer

Skip unless change touches migrations, models, schema, or external API clients.

Read:
- `.grimoire/changes/<change-id>/data.yml` — proposed schema changes (design)
- `.grimoire/docs/data/schema.yml` — current baseline

Evaluate:
- **Migrations — name the deployment consequence, don't mandate zero-downtime**: State plainly what the change costs to ship — does this ALTER **lock the table** (a downtime-incurring change)? Is it **backward-incompatible** (old app versions break mid-deploy)? Is it **irreversible**? Zero-downtime is *not* assumed — many projects accept a maintenance window. Surface the cost as a decision for the human ("this rename locks `users` and breaks rolling deploy — confirm a downtime window is acceptable, or split expand→contract to avoid it"), **not** an automatic blocker. **Expand–Contract / Parallel Change** (add new → backfill → switch reads → drop old) is the *option* offered when the project wants zero-downtime, never a requirement. **A downtime-incurring or backward-incompatible migration MUST be flagged in the PR / merge-request body** (a one-line `⚠️ incurs downtime` / `breaking schema change` note) so it's visible at merge — surfacing it only in the review is not enough.
- **Indexes**: New foreign keys with no index? New query patterns against unindexed columns?
- **Naming**: New fields follow existing schema conventions?
- **Data minimization (PII)**: New columns holding personal data — each field necessary, purpose-bound, retention-limited, encrypted at rest if sensitive? Excess PII storage = finding. Pairs with the Security persona's LINDDUN Data-disclosure check (§4.3).
- **Backward / forward compatibility (named outcome, not forced)**: State *whether* the change is backward-compatible (old readers survive) and forward-compatible (old code + new schema holds during deploy). Report the outcome so breaking is a *conscious* choice, not a surprise — the project decides if it's acceptable; don't force compatibility. If broken, it rides the same PR / merge-request flag as a downtime change.
- **Breaking contract**: `data.yml` vs `schema.yml` — removed/renamed/retyped response fields or new required request fields = **blocker** unless migration path documented. (This is the silent-break exception: breaking a *documented consumer contract* without noting it harms other people's code — distinct from a self-contained downtime choice above.)
- **Transactions**: Multi-step writes wrapped in a transaction?
- **External APIs** *(design)*: New API dependency — `schema_ref` pointing to a stable spec? Fallback if API unavailable?

### 4.6 Code Style Reviewer *(PR/pre-commit only — skip on design review)*

Verify the diff matches the project's code-style and comment standards. This is not "general taste" — every finding must cite a concrete project rule the change violates.

#### Sources to load (in order)

1. `.grimoire/config.yaml` → `project.comment_style` and `project.language` (sets baseline expectations)
2. `AGENTS.md` / `CLAUDE.md` at repo root — engineering principles, comment policy
3. `.grimoire/docs/<area>.md` for each touched area — local conventions, reusable utilities
4. Lint/format config in repo root: `.editorconfig`, `eslint.config.*`, `.prettierrc*`, `pyproject.toml` (ruff/black), `.rubocop.yml`, `rustfmt.toml`, `.golangci.yml`, etc.
5. **Neighboring files** in the touched directories — derive convention from what already exists when no config exists

If none of the above pin a rule, **don't invent one**. Style preferences without a project anchor are dropped.

#### Evaluate

- **Naming**: Identifiers (functions, types, files) match the project's casing and naming patterns visible in neighbors? New file names follow the directory's existing pattern?
- **File layout**: New file lives where similar files live? Module boundaries respected?
- **Imports**: Order, grouping, and form match the project (relative vs absolute, `.js` extension policy, type-only imports)?
- **Formatting**: Diff respects `.editorconfig` and formatter rules (indentation, line endings, trailing newline, max line length)? Any formatter-noisy hunks unrelated to the change?
- **Comments — presence**: Is there a comment whose WHAT is already obvious from the code? Per most projects' comment policies (and grimoire's `AGENTS.md`), explanatory-of-what comments are noise — **suggestion** to remove.
- **Comments — self-contained**: Does a comment name an external artifact that moves independently — a feature/scenario/`.feature`, MADR/ADR number, change-id, ticket/PR, specific test, or tag code (`LOG-OBS-003`)? These orphan — **suggestion** to rewrite in terms of the code itself (`code-quality.md` §7). Generic descriptive words (test, feature) are fine; identifiers pointing elsewhere are not.
- **Comments — no essays**: Does a docstring lead with a prose paragraph before its params, or restate types in prose? Keep the summary to 1–2 terse lines — **suggestion** to compress; design rationale belongs in a decision record.
- **Comments — style**: Match the project's comment form (`//` vs `/* */` vs `#`, JSDoc/TSDoc/docstring conventions)?
- **Docstrings**: New public functions/classes — does the project require docstrings? If yes (per `comment_style` or visible convention), missing docstring = **suggestion**. If no, added boilerplate docstrings = **suggestion** to remove.
- **Dead comments**: Commented-out code in the diff = **suggestion** to delete.
- **TODO/FIXME**: New TODOs added with no owner or ticket reference, when project convention requires them = **suggestion**.
- **Error messages / log strings**: Tone and format match neighbors (sentence case, periods, structured logging fields)?
- **Type annotations** *(typed languages)*: New code matches the project's typing strictness — no `any`/`unknown`/`Object` if neighbors are strict; explicit return types if convention requires?

Severity:
- **Blocker**: violates a configured lint/format rule that would fail CI, or violates an explicit rule in `AGENTS.md` / `CLAUDE.md` / area doc.
- **Suggestion**: deviates from neighbor convention without a config anchor, or comment-policy nits.

If the project has no committed style config and neighbors are inconsistent, say so once and move on — don't pick a side.

### 4.7 Adversarial User *(engaged when `project.surface` matches the persona's activation row)*

Surface-conditional personas inhabit users the design might fail: keyboard-only, screen-reader, low-vision / color-blind, touch-target, responsive-breakpoint, RTL / i18n, low-bandwidth / offline, hostile-actor, API-conventions. Full criteria, persona catalog, activation matrix (persona × surface), severity calibration, and steel-man requirement live in `./adversarial-personas.md`. Engagement is gated by `project.surface` — see the activation matrix there. Findings inherit §1 briefing, §2 / §2a / §2b materiality and severity rules. The Contrarian pass (§4.8) calibrates adversarial findings post-hoc on the same terms as the other personas.

### 4.8 Contrarian *(runs last, after all other personas submit findings)*

Inspired by ouroboros/contrarian — adapted for review use. The Contrarian does not submit its own findings against the code. Instead, it **challenges the other personas' findings**, especially blockers, and tunes them. Its goal is to kill the reviewer-overreach failure mode: manufactured blockers, missing steel-mans, finding-by-quota, severity inflation.

Always runs when at least one persona produced a blocker. May be skipped only when all personas produced zero findings.

#### Inputs

- The complete set of findings from §4.1-§4.7 (blockers and suggestions).
- The Project Briefing (§1).
- The diff or design under review.

#### For each blocker, ask:

1. **What is the steel-man for the author's choice?** Write the strongest version of why the code / design is the way it is — drawing on briefing constraints, ADRs, neighbor conventions, performance trade-offs, simplicity, stage. If the finding doesn't already include a steel-man (§2a), the Contrarian writes one. If the steel-man holds, the finding is wrong.
2. **What assumption is this finding making?** Name it. ("Assumes inputs are untrusted at this layer." / "Assumes high traffic." / "Assumes a regulator audits this surface.") If the assumption doesn't match the briefing, the finding is mis-calibrated.
3. **What if the opposite were right?** What if the "obvious" fix is the wrong move for this codebase / stage / scale? Inversion test: if you removed the existing code and applied the finding's recommendation, what *new* problems would you create? List them.
4. **What if doing nothing is the right call?** Is this a symptom or a root cause? Will it actually trigger? What's the cost of "fix now" vs. "fix when it actually hurts"?
5. **Is the severity calibrated?** Does the finding meet all three blocker criteria (§2b)? If not, downgrade or drop.

#### For suggestions, ask:

- Is this a real preference of the project, or the reviewer's preference? If the reviewer can't cite a project anchor (AGENTS.md, ADR, area doc, neighbor pattern), drop it.

#### Output

For each blocker the Contrarian processes, emit one of:

- **Upheld** — `[blocker upheld]` with one line: "Steel-man considered; harm path holds because …"
- **Downgraded to suggestion** — `[blocker → suggestion]` with one line explaining what was missing (no harm path / no briefing anchor / mitigated by neighbor / steel-man held in part).
- **Dropped** — `[finding dropped]` with one line explaining why.

The Contrarian's report replaces or annotates the original findings. The Summary uses the post-Contrarian counts.

#### Contrarian is not a veto

The Contrarian is a calibration pass, not an authority. If a persona disagrees with a downgrade and can cite a concrete harm path tied to briefing that the Contrarian missed, the finding is re-upheld. The Contrarian's job is to make findings *honest about their evidence*, not to suppress signal.

#### What Contrarian does NOT do

- It does not add new findings.
- It does not soften the *content* of upheld blockers (no "perhaps consider possibly" hedging).
- It does not challenge findings that already pass §2a/§2b cleanly.
- It does not run on level 1 (no review) or when all personas returned zero findings.

---

## 5. Output Format

Each persona returns a short bulleted list. The calling skill compiles them into a single report. Standard structure:

```markdown
# <Review Title> — <subject>

<header line: change-id / PR number / staged-diff scope, base/head, complexity, files/lines>

## Project Briefing
<from §1>

## Product Manager
- **[blocker]** ...
- **[suggestion]** ...
(or "Skipped — purely internal change.")

## Senior Engineer
- ...

## Security Engineer
### STRIDE
- Spoofing: ...
- Tampering: ...
- ...

### Findings
- **[blocker]** [A03:2021 / CWE-89] ...

## QA Engineer
- ...

## Data Engineer
- ...

## Code Style                     <!-- omit on design review -->
- **[blocker]** `eslint.config.js` rule `no-unused-vars` violated at `src/foo.ts:42`
- **[suggestion]** Comment at `src/foo.ts:88` describes what the code does — remove (per `AGENTS.md` "Default to writing no comments").

## Adversarial User                <!-- omit when no surface-matched personas engaged -->
- **[blocker]** [keyboard-only] Submit button at `designs/variant-2.html:84` is `<div onclick>` — not focusable. Steel-man considered (custom styling); harm path holds (user cannot tab to submit).
- **[suggestion]** [low-vision] Body text contrast 4.2:1 at `designs/variant-2.html:120` — below WCAG AA 4.5:1.

## Contrarian                     <!-- omit when zero findings from all personas -->
- **[blocker upheld]** Senior Engineer's auth-bypass finding at `src/api/users.ts:18`. Steel-man: middleware order may guarantee auth runs first. Inspected — the route is mounted outside the auth middleware. Harm path holds.
- **[blocker → suggestion]** Security Engineer's "missing rate limit on /reset-password". Briefing stage is internal-tools; threat surface tag count = 0. Cost-of-fix > realistic harm.
- **[finding dropped]** QA Engineer's "missing test for concurrent password reset". No scenario in the briefing references concurrency; no harm path stated; downgrade to suggestion would also fail. Dropped.

## Summary                        <!-- counts are post-Contrarian -->
- **N blockers** — must be addressed
- **M suggestions** — consider addressing

Recommendation: <fix blockers / request changes / approve / proceed to apply>
```

---

## 6. Style Rules for Findings

- Reference specific files and line numbers for every diff-based finding.
- Be direct. No padding with praise. Blockers stop the gate; suggestions are advisory.
- Findings describe the code, not the person. "This query is vulnerable to injection" not "you wrote an injection".
- Three findings that matter beat ten that don't.
- If the change is trivial, say so and don't manufacture issues.
