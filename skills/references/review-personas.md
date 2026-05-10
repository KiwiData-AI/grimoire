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
- `.grimoire/config.yaml` — `project.compliance`, `project.language`, `project.comment_style`, `dep_audit`
- `.grimoire/docs/context.yml` — deployment env, related services (if exists)
- Tag histogram across `.grimoire/changes/**/*.feature` + `.grimoire/archive/**/*.feature`
- All `.grimoire/decisions/*.md` with `status: accepted` — extract ID, title, top Decision Driver
- Linked manifest's `Why` and `Non-goals` (if a Change trailer / active manifest exists); else PR body or commit messages

### Feature inventory

- Glob `.grimoire/changes/**/*.feature` + `.grimoire/archive/**/*.feature`
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
**Users:** <who, scale, trust level>
**Data sensitivity:** <none | pii | financial | phi — derived from tag histogram + compliance>
**Threat surface:** <only tags with count >0, e.g. auth=4, pii=3, payment=2>

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
- A briefing axis it threatens (stage, data sensitivity, active constraint, threat-surface tag), OR
- A concrete feature-inventory gap

Rules:
- If the inventory shows the concern is already covered elsewhere, drop the finding or downgrade to a cross-feature integration note.
- Findings with no briefing anchor are dropped. Don't manufacture findings to hit a quota.
- Treat accepted ADRs as constraints, not suggestions. If a persona thinks one is wrong, name the ADR by ID and propose superseding it.
- Before flagging a missing capability (rate limit, audit log, etc.), check the feature inventory for a sibling feature that already covers it.

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

### Diff review (PR + pre-commit)

| Signal | Depth |
|---|---|
| Docs only, ≤50 lines | Senior engineer + Code Style skim |
| Linked complexity 1-2, diff <200 lines, no security tags | Senior engineer + Security quick scan + Code Style |
| Linked complexity 3, OR diff touches auth/data/API | All relevant personas (skip Data if no schema, skip QA if no user-facing) |
| Linked complexity 4, OR diff >500 lines, OR multi-domain | All personas mandatory |

User can override: "full review", "just security", "just code style", etc.

---

## 4. Personas

Each persona below names what it evaluates. The calling skill points the persona at the right input (specs for design review, diff hunks for PR / pre-commit). Apply the materiality gate to every finding. Flag as **blocker** (must fix before merge / commit / coding) or **suggestion**.

### 4.1 Product Manager

Skip if the change is purely internal (no user-facing behavior).

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
- **Simplicity**: Simplest design that solves the problem? Unnecessary abstraction, indirection, premature generalization, config-driven where direct call would do?
- **Architecture**: Decisions sensible for this codebase? Will this paint us into a corner?
- **Conventions** *(PR/pre-commit)*: Does new code match file layout, naming, and patterns already in the touched areas? Check `.grimoire/docs/<area>.md` if present.
- **Reuse**: Existing utilities/functions that were re-implemented? `grep` for similar names; check area docs' reusable-code lists.
- **Dead code** *(PR/pre-commit)*: Functions added but not called, imports unused, commented-out code, stubs with no implementation.
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

#### Code-level scan *(PR/pre-commit only)*

- **Secrets**: Grep diff for hardcoded keys, tokens, passwords, cloud credentials, JWT secrets. Any hit = **blocker**.
- **Injection**: Raw SQL with string concatenation, shell-exec with user input, `eval`/`exec`, unsafe deserialization. Tag OWASP + CWE.
- **Input validation**: New endpoints without schema validation, file uploads without size/type limits, path params used directly in filesystem calls.
- **Auth**: New routes/handlers missing auth decorators / middleware. Compare against neighbors in same file.
- **Dependencies**: New packages — check name is real (typosquat risk), check `dep_audit` output if committed. Flag packages with zero downloads or suspicious maintainers.
- **PII**: New logging that could emit PII; new storage of personal data without encryption.
- **Cross-service auth**: If `context.yml` lists related services, are service-to-service calls authenticated?

#### Compliance

If `project.compliance` configured, verify per `./security-compliance.md` (section "Compliance Framework Verification"). Security-tagged scenario in linked change with no corresponding verification = **blocker**.

#### Tagging

Every security finding gets OWASP 2021 + CWE tags. See CWE quick-reference in `./security-compliance.md`.

### 4.4 QA Engineer

Skip if change is purely internal.

Evaluate:
- **Test presence**: Every new user-facing behavior has a test? Every scenario from linked feature file has step definitions?
- **Test quality**: Tests asserting outputs, or just that code "ran"? Over-mocked tests = red flag.
- **Negative paths**: For each happy path, is there a failure-path test?
- **Edge cases**: Empty states, concurrent users, interruptions, boundary values?
- **Observability**: New feature — how will it be debugged in prod? Structured logs / metrics / error surfaces?
- **Regression risk** *(PR/pre-commit)*: Which existing tests cover the touched code? Were any tests removed or weakened?
- **Accessibility**: New UI — keyboard nav, aria labels, contrast?

### 4.5 Data Engineer

Skip unless change touches migrations, models, schema, or external API clients.

Read:
- `.grimoire/changes/<change-id>/data.yml` — proposed schema changes (design)
- `.grimoire/docs/data/schema.yml` — current baseline

Evaluate:
- **Migrations**: Safe on live DB? Adding NOT NULL without default on large table = **blocker**. Renames without two-step migration = **blocker**.
- **Indexes**: New foreign keys with no index? New query patterns against unindexed columns?
- **Naming**: New fields follow existing schema conventions?
- **Backwards compatibility**: Will schema change break existing API consumers, queries, or reports?
- **Breaking contract**: `data.yml` vs `schema.yml` — removed/renamed/retyped response fields or new required request fields = **blocker** unless migration path documented.
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
- **Comments — content**: Do comments reference current task / fix / PR / caller ("added for X", "used by Y", "fix for issue #123")? These rot — **suggestion** to remove or rewrite as durable rationale.
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

## Summary
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
