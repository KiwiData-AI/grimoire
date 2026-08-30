# Health Check Reference

One definition, two scopes. This file IS the health check — there is no other definition to defer to. Consumers cite it and add nothing:

- `grimoire-pr` runs **§A** as its per-change gate before creating a PR.
- `grimoire-apply` runs **§A** during finalization.
- The `grimoire health` CLI command implements **§B**'s `mechanical` rows as its spec-drift metric.
- `grimoire-discover`'s Health phase runs `grimoire health`, then walks **§B**'s `judgment` rows.

## Kinds

Every row carries a **kind**:

- `mechanical` — an exact command or file read, implementable in the CLI. The row's How column is the implementation.
- `judgment` — an agent assessment. Report honest reasoning with the evidence you actually read. Never present a judgment finding with grep-style certainty, and never fabricate certainty you don't have.

## §A Per-change (apply finalization and grimoire-pr gate)

Apply runs active-change rows before durable updates and the pre-cleanup row
after establishing durable commit identity. It runs post-cleanup rows against
the staged durable state before final review. Grimoire-pr runs post-cleanup and
finalized-change rows after the final commit. Blockers stop finalization or the
PR until fixed. Warnings are listed in the PR description.

| # | State | Check | Kind | How | Severity |
|---|-------|-------|------|-----|----------|
| 1 | active | tasks.md is fully checked, or every open task has an explicit deferral note | mechanical | read tasks.md | blocker |
| 2 | active/finalized | Every non-merge branch commit body contains at least one `Change:` line; related change IDs may differ between commits | mechanical | inspect each commit from the target-branch merge base through `HEAD` with `git log --no-merges --format="%H%x00%B%x00"`; fail any commit body without a `Change:` line | blocker |
| 3 | pre-cleanup | Before cleanup, at least one ordinary commit carries the selected change ID and contains durable verified work without active change-folder scaffolding | mechanical | inspect commits containing `Change: <change-id>` and their changed paths; require one with no `.grimoire/changes/<change-id>/` path | blocker |
| 4 | post-cleanup | Each added decision meets the ADR bar: non-obvious and records rejected alternatives (criteria: Policies) | judgment | read changed live decisions | blocker |
| 5 | post-cleanup | Added or edited constraint rows cite a passing test or gate and contain no `TODO` verification cells (criteria: Policies) | mechanical | read the constraint diff and resolve each cited test or gate | blocker |
| 6 | post-cleanup | Code comments and durable docs in the diff contain no ADR-id or change-id references | mechanical | inspect the durable diff for `ADR-`, `decisions/0`, and the change-id | blocker |
| 7 | post-cleanup | The configured BDD runner reports no undefined steps for changed live features | mechanical | run the configured runner in dry-run/check mode on changed live features | blocker (warning: list `@not-implemented` tags in the PR description) |
| 8 | active | Manifest status is `implementing` | mechanical | read manifest frontmatter | warning (correct before durable updates) |
| 9 | finalized | The ephemeral change folder is absent and the final commit carries `Change: <change-id>` and `Final-production-review: approved` | mechanical | inspect the filesystem and selected final commit trailers | blocker |
| 10 | finalized | PR inputs are available from branch history and changed live features and decisions; explicit selection resolves multiple related change IDs | mechanical | read the merge-base diff and all `Change:` lines; require a selected change ID when more than one exists | blocker |

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
- Report-only: the health check fixes nothing. Section A blockers stop apply
  finalization or PR creation. Workflow skills perform all state changes.

## Policies

The criteria behind four rows are normative rules whose single home is AGENTS.md (Conventions). This file cites them and does not restate them:

- **ADR bar** — governs §A#3 and §B#3's non-obvious bar.
- **Proven-only constraints register** — governs §A#4 and §B#2.
