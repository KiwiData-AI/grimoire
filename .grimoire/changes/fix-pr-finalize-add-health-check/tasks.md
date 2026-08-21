# Tasks: fix-pr-finalize-add-health-check

> **Change**: `/grimoire:pr` becomes the finalization gate (definition stays in apply §7); one shared health-check reference feeds the pr gate; mechanical repo-wide drift checks integrate into `grimoire health` (one command, one report); discover gains a Health phase; AGENTS.md gains the bypass invariant + policy rules.
> **Features**: `see-project-health.feature` (MODIFIED — new scenario "Health reports spec-process drift")
> **Decisions**: `.grimoire/decisions/0039-pr-gate-enforces-finalization.md`
> **Test command**: `npm run test:bdd` (cucumber-js) · unit: `npx vitest run`
> **Status**: 4/11 tasks complete

Doc/skill tasks are `verify: none` (validated by regression runs + the acceptance walkthrough). Edit `skills/` (tracked source), NEVER `.claude/skills/` (gitignored install copy). NOTE: the new scenario in `see-project-health.feature` is undefined until section 2 — the working-tree pre-commit gate blocks ALL commits until its steps go green, so no mid-work commits before then.

## Reuse (cite, don't duplicate)
- Finalize definition — `skills/grimoire-apply/SKILL.md` §7 (~line 326): pr cites it, repeats no steps
- Metric/report machinery — `src/core/health.ts` (`Metric` rows + overall score, `runHealth` :31, existing `DriftItem` + `detectConventionsDrift` :210 as the in-file pattern for drift detection)
- Debt-register format — `skills/references/refactor-register-format.md` + existing `.grimoire/docs/debt-register.yml`
- Description generator — `grimoire pr` CLI (`src/core/pr.ts:27` `generatePr`; `--create` exists; skill keeps Security/Deployment-impact appendices)
- Trailer read — `git log main..HEAD --format="%(trailers:key=Change,valueonly)"` (per-change); `git log main` variant for repo-wide coverage
- Shared-reference pattern — `skills/references/review-personas.md` (one definition, many consumers)
- Step-def conventions — `features/steps/cli.steps.ts` (`this.run(["health"])` steps exist for the current health scenario)

## 1. Health-check reference (the shared definition)
<!-- context:
  - notes/grimoire-health-check-spec.md  (§2 — source tables)
  - .grimoire/decisions/0039-pr-gate-enforces-finalization.md
  - skills/references/refactor-register-format.md
-->
- [x] 1.1 (verify: none) Create `skills/references/health-check.md`: intro (two scopes, one definition; consumers cite this file; distinct from nothing — this IS the health definition; the `grimoire health` command implements its mechanical rows). Every row carries a **kind** column: `mechanical` (exact command/read, CLI-implementable) or `judgment` (agent assessment — report honest reasoning, never grep-style certainty). **§A Per-change** (grimoire-pr gate; blockers unless noted): note's 2A #1–7, with #6 generalized to "configured BDD runner (`config.tools.bdd_test`) reports no undefined steps for touched features (warning: `@not-implemented` tags listed in PR description)"; #2 carries the exact trailer one-liner. **§B Repo-wide** (`grimoire health` + discover): note's 2B #1–8, #7 generalized to "configured `checks:` gates pass; each documented exemption still justified (judgment)". Mark mechanical: stale change folders, TODO/nonexistent-test register cells, terminal-ADR lingering + ADR-refs-in-comments sweep, broken doc links, archive trees, trailer coverage. Mark judgment: ADR non-obvious bar, feature-vs-surface staleness, exemption justification. **Report**: the report is `grimoire health`'s output — no separate report file; severity `fix-now`/`review`/`info`; report-only (only §A blockers stop a PR; no auto-fix). **Policies**: cite the AGENTS.md ADR-bar and proven-only-register rules (task 6.1) for §A#3/#4 and §B#2/#3 criteria; do not restate.
<!-- SESSION: 1.1 done. §B kinds in row order: 1 mechanical, 2 mechanical, 3 split (mechanical: terminal lingering, one-way supersession links, count creep · judgment: non-obvious bar), 4 mechanical, 5 judgment, 6 mechanical, 7 split (mechanical: gates pass · judgment: exemption justification), 8 mechanical. Trailer coverage on main = info-level sub-item of §B#1 (same git read: `git log main --format="%(trailers:key=Change,valueonly)"`), not a 9th row. §B carries a Severity column (2.3 needs it): #1 fix-now(merged)/review(stalled)/info(coverage%), #2 fix-now, #3 review (count creep info) — terminal ADR = review, matching 2.2's expectation, #4 review, #5 review (`@not-implemented` inventory info), #6 review, #7 fix-now(failing gate)/review(exemption), #8 review. §A#2 one-liner: `git log main..HEAD --format="%(trailers:key=Change,valueonly)"`. §A#7 = warning, flip done by grimoire-pr at finalize (health check itself never mutates). -->


## 2. grimoire health — spec-drift metric (the code)
<!-- context:
  - features/see-project-health.feature  (new scenario)
  - features/steps/cli.steps.ts
  - src/core/health.ts
  - src/core/health.test.ts
  - skills/references/health-check.md  (from 1.1 — §B mechanical rows are the spec)
-->
- [x] 2.1 (verify: scenario) Step defs in `features/steps/cli.steps.ts` for "Health reports spec-process drift": Given scaffolds a project plus (a) `.grimoire/changes/stale-change/` with a `manifest.md` dated >30 days (frontmatter date) and 0 checked tasks, (b) a `constraints.md` row whose verification cell says `TODO`; When reuses the existing health step (`this.run(["health"])`); Then asserts exit 0 and output contains the stale change-id and flags the TODO register row. Red first (current health has no drift metric).
- [x] 2.2 (verify: characterization) Extend `src/core/health.test.ts` with spec-drift cases pinning what BDD doesn't: terminal ADR (status `superseded by NNNN`) still present → flagged `review`; `ADR-`/`decisions/0` reference inside a source-file comment → flagged; broken relative link in `.grimoire/docs/OVERVIEW.md` → flagged; archive dir `.grimoire/archive/` → flagged; clean fixture → drift metric passes with no items. Red first.
- [x] 2.3 Implement `checkSpecDrift(root): Promise<Metric>` in `src/core/health.ts`, wired into `runHealth`'s metric list, following the existing `detectConventionsDrift`/`Metric` pattern (src/core/health.ts:210): stale change folders (manifest frontmatter date >30d with no checked tasks, or change-id present in `git log main --format="%(trailers:key=Change,valueonly)"`), register cells containing `TODO` or naming a test id not found by repo grep, terminal ADRs + ADR-references in code comments/docs, broken relative links in `.grimoire/docs/*.md`, archive/backup trees under `.grimoire/`, `Change:` trailer coverage on main (info-level %). Severity per health-check.md §B. Git reads via the existing `execFileAsync` pattern; every item = one report line with severity + one-line suggested action. Report-only — no writes.
<!-- SESSION: 2.1–2.3 done, red-first both levels. Metric name is `spec_drift`; `checkSpecDrift(root): Promise<Metric>` sits in src/core/health.ts in a "Spec-process drift" section after checkConventionsDrift, wired 6th into runHealth's Promise.all. Metric gained optional `items?: SpecDriftItem[]` ({ severity: "fix-now"|"review"|"info"; message; action }); JSON (`--json`) exposes metrics[].items; pretty mode prints one indented line per item (severityColor: red/yellow/dim). Score: 100 when no non-info items, else 0; label "N drift items". Helpers: mainChangeTrailers (one `git log main --format=%H%x09%(trailers:key=Change,valueonly,separator=%x2C)` read serves merged-change detection AND the info coverage % item; null when main absent — coverage item then skipped), findStaleChanges/stalledItem (manifest fm `date` >30d + 0 `- [x]` in tasks.md), findUnprovenConstraints/staleCitations (TODO cell fix-now; backticked path tokens → existence, non-path tokens → `git grep -F --untracked`, exit 1 = stale, other errors skip), findTerminalDecisions (status contains superseded/deprecated → review), findDecisionReferences (`git grep -E "ADR-[0-9]|decisions/0"` excluding .grimoire/decisions + .grimoire/changes → review per hit line), findBrokenDocLinks (.grimoire/docs/*.md non-recursive, relative md links → review), findArchiveTrees (/archive|backup/i under .grimoire → review). Git via execFileAsync explicit argv (no sh -c). All report-only. Sections 3–6: the CLI report IS §B mechanical; `grimoire health` on THIS repo will list real findings (3 TODO register rows, decision-ref sweep hits in skills/notes) — expected, report-only. BDD: new Given writes manifest date 2026-01-01 + 2 unchecked tasks + TODO constraints row; Thens read spec_drift items from JSON. health.test.ts: exec mock now reset in top-level beforeEach (mockImplementation leaks survive clearAllMocks). Counts: 442 unit (437 baseline +5), 22 BDD scenarios, lint 0 errors. -->

## 3. grimoire-pr skill — the gate
<!-- context:
  - skills/grimoire-pr/SKILL.md
  - skills/grimoire-apply/SKILL.md  (§7, cite only)
  - skills/references/health-check.md  (from 1.1)
  - notes/grimoire-health-check-spec.md  (§1a–1c)
-->
- [ ] 3.1 (verify: none) Rewrite frontmatter `description:`: "Finalize a grimoire change and create its PR — health check, decision statuses, deferral logging, change-folder removal, then description + `gh pr create`. Use whenever the user asks to create a PR and `.grimoire/changes/` is non-empty."
- [ ] 3.2 (verify: none) Replace Prerequisites (delete the lines 24–27 contradiction): change folder exists; `tasks.md` complete or every open task carries an explicit deferral note; work committed on a feature branch. Update Routing to match (incomplete tasks without deferral notes → back to apply).
- [ ] 3.3 (verify: none) Reorder Workflow: 1 Select (keep) · 2 Gather artifacts (keep) · 3 Run health-check §A — blockers stop with a fix list; warnings collected · 4 Ensure finalized — folder still present → execute `grimoire-apply` §7 (cite, repeat nothing; add only: open tasks with deferral notes → debt-register entries, refactor-register format, `category: deferred-task`, source change-id in `detail`) · 5 Description via `grimoire pr <change-id>` CLI (replace the hand-written §3 template; keep Deployment-impact guidance and §4 post-impl review as conditional appendices) · 6 Create PR (`grimoire pr --create` or gh/glab; keep push check). Update Done + Important (drop "folder already removed at finalize" phrasing).

## 4. grimoire-apply skill — harden finalize
<!-- context:
  - skills/grimoire-apply/SKILL.md  (§7 and Done)
-->
- [ ] 4.1 (verify: none) §7 intro gains one line: finalize is part of apply, not optional — a session ending at "tests green" without finalizing leaves the change unfinished; `/grimoire:pr` executes this section before any PR. Done section: same note + route to `/grimoire:pr`. Additive and small — do not reflow §7 step 4 (spec-site branch touches that region).

## 5. grimoire-discover skill — Health phase
<!-- context:
  - skills/grimoire-discover/SKILL.md
  - skills/references/health-check.md  (from 1.1)
  - notes/grimoire-health-check-spec.md  (§3)
-->
- [ ] 5.1 (verify: none) Add "### 7.5 Health Check (repo-wide)" between §7 Generate Index and §8 Present Summary: run `grimoire health` (mechanical rows, integrated report), then walk health-check.md §B judgment rows and report reasoning; REPORT-ONLY (user approves any fix/deletion); onward routing — stale merged changes → confirm + delete; spec/impl mismatch → `grimoire-verify`; tech debt → `grimoire-refactor`; unproven register rows → small change via `grimoire-draft` or trivial direct fix. §8: include drift headline counts. Triggers: add "health check", "drift report", "pre-release check", "spring cleaning", "what's stale". Frontmatter `description:`: append "Also runs the repo-wide health check (drift report)." One line in Important: periodic re-runs make discover the recurring reality-check.

## 6. AGENTS.md — invariant + policies
<!-- context:
  - AGENTS.md  (line 169 stage list; Conventions section)
-->
- [ ] 6.1 (verify: none) (a) Line 169: "**PR** (`grimoire pr`)" → "**PR** (`/grimoire:pr`)". (b) Workflow invariants: add "Never create a PR with `gh pr create` directly while `.grimoire/changes/` contains an active change — route through `/grimoire:pr` so finalization happens." (c) Conventions: add the ADR-bar rule (only non-obvious decisions with recorded rejected alternatives; trivial/feature-description ADRs are deleted, not landed) and the proven-only constraints-register rule (a row may not exist without a passing test or gate; the register legend states this). Terse, matching style; these are the normative homes health-check.md cites.

## 7. Verification
- [ ] 7.1 Run `npx vitest run` and `npm run test:bdd` — new scenario + unit cases green, zero regressions (branch baseline: 446 unit / 23 scenarios before this change)
- [ ] 7.2 Run `node bin/grimoire.js health` on this repo — integrated report renders code metrics + spec-drift rows; report-only
- [ ] 7.3 Run `node bin/grimoire.js update` — refreshes the gitignored `.claude/skills/` copies; spot-check `.claude/skills/grimoire-pr/SKILL.md` matches `skills/`
- [ ] 7.4 Acceptance walkthrough (meta — this change is the subject): at this change's own PR time, run `/grimoire:pr`; this task is checked off DURING that run (health-check §A treats it as satisfied by the run in progress, not a blocker). The run must: pass §A, finalize per apply §7, generate the description via `grimoire pr`, create the PR.
