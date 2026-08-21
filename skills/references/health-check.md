# Health Check Reference

One definition, two scopes. This file IS the health check — there is no other definition to defer to. Consumers cite it and add nothing:

- `grimoire-pr` runs **§A** as its per-change gate before creating a PR.
- The `grimoire health` CLI command implements **§B**'s `mechanical` rows as its spec-drift metric.
- `grimoire-discover`'s Health phase runs `grimoire health`, then walks **§B**'s `judgment` rows.

## Kinds

Every row carries a **kind**:

- `mechanical` — an exact command or file read, implementable in the CLI. The row's How column is the implementation.
- `judgment` — an agent assessment. Report honest reasoning with the evidence you actually read. Never present a judgment finding with grep-style certainty, and never fabricate certainty you don't have.

## §A Per-change (grimoire-pr gate)

Blockers stop the PR until fixed. Warnings are listed in the PR description.

| # | Check | Kind | How | Severity |
|---|-------|------|-----|----------|
| 1 | tasks.md fully checked, or each open task has an explicit deferral note (deferred tasks are logged to the debt register at finalize — see `refactor-register-format.md`) | mechanical | read tasks.md | blocker |
| 2 | Every commit on the branch carries the `Change:` trailer | mechanical | `git log main..HEAD --format="%(trailers:key=Change,valueonly)"` — every commit must yield the change-id | blocker |
| 3 | Each decision this change adds meets the ADR bar: non-obvious, records rejected alternatives; trivial/feature-description ADRs are deleted, not landed (criteria: Policies) | judgment | read the ADR diff | blocker |
| 4 | Constraint rows added/edited cite a passing test or gate — no "TODO" verification cells (criteria: Policies) | mechanical | grep the register diff for `TODO`; grep the repo for each cited test id | blocker |
| 5 | No ADR-id / change-id references in code comments or docs in the diff | mechanical | grep the diff for `ADR-`, `decisions/0`, the change-id | blocker |
| 6 | Configured BDD runner (`config.tools.bdd_test`) reports no undefined steps for touched features | mechanical | run the configured runner in dry-run/check mode on touched features | blocker (warning: `@not-implemented` tags listed in the PR description) |
| 7 | Manifest status is `implementing` | mechanical | read manifest frontmatter | warning (stale `draft`/`approved` corrected to `implementing` by grimoire-pr during finalize) |

## §B Repo-wide (`grimoire health` + grimoire-discover)

Produces the drift portion of the `grimoire health` report.

| # | Check | Kind | How | Signal of drift | Severity |
|---|-------|------|-----|-----------------|----------|
| 1 | Stale change folders: change-id appears in merged `Change:` trailers on main, or 0 tasks done for >30 days (manifest frontmatter date). Same git read also reports `Change:` trailer coverage on main as a % | mechanical | list `.grimoire/changes/*/`; `git log main --format="%(trailers:key=Change,valueonly)"`; read manifest date + tasks.md checkboxes | folder should be removed / change re-triaged | fix-now (merged) / review (stalled) / info (coverage %) |
| 2 | Constraint register: verification cells containing "TODO"; named test ids that no longer exist (criteria: Policies) | mechanical | grep the register for `TODO`; grep the repo for each named class/method — no hit = stale citation | proven-only rule violated / stale citation | fix-now |
| 3 | ADR corpus: terminal (superseded/deprecated) files lingering; one-way supersession links; count creep since last report; files failing the non-obvious bar (criteria: Policies) | mechanical (lingering, links, count) / judgment (non-obvious bar) | grep decision frontmatter/status lines; read both ADRs of each supersession pair; count files. Bar: read the ADR and reason | prune-candidates list | review (info: count creep) |
| 4 | ADR/change-id references in code comments or docs | mechanical | grep the repo for `ADR-`, `decisions/0`, active change-ids — outside `.grimoire/decisions/` and change folders | sweep list | review |
| 5 | Feature files: scenarios whose endpoints/surfaces no longer exist; untagged scenarios silently excluded by the tag filter; inventory of `@not-implemented` scenarios with age | judgment | read scenarios against the current code surface; reason about each, don't pattern-match | stale-spec list | review (info: `@not-implemented` inventory) |
| 6 | Docs (`OVERVIEW.md`, area docs): links to files that no longer exist | mechanical | resolve every relative link in `.grimoire/docs/*.md`; check the target exists | broken-link list | review |
| 7 | Gate health: configured `checks:` gates pass; each documented exemption still justified | mechanical (gates pass) / judgment (exemptions) | run each configured check; for each exemption, ask whether its stated reason still holds | gate report | fix-now (failing gate) / review (unjustified exemption) |
| 8 | Archive/backup trees inside `.grimoire/` (convention: git history is the record) | mechanical | list directories under `.grimoire/` matching archive/backup patterns | delete candidates | review |

## Report

The report is `grimoire health`'s output. There is no separate report file. Judgment rows (run by grimoire-discover) report in-session alongside it.

- One line per item: severity + one-line suggested action.
- Severity: `fix-now` / `review` / `info`.
- Report-only: the health check fixes nothing. The only gate effect is §A blockers stopping a PR. §A#7's status flip is performed by grimoire-pr during finalize, not by the check.

## Policies

The criteria behind four rows are normative rules whose single home is AGENTS.md (Conventions). This file cites them and does not restate them:

- **ADR bar** — governs §A#3 and §B#3's non-obvious bar.
- **Proven-only constraints register** — governs §A#4 and §B#2.
