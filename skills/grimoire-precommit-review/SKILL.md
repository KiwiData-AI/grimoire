---
name: grimoire-precommit-review
description: Multi-persona code review of your own staged (or unstaged) local diff before you commit. Same engine as grimoire-pr-review and grimoire-review, applied to `git diff --cached`. Catches blockers in the dev loop instead of after a teammate opens the PR.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-precommit-review

Review your own uncommitted diff before you commit. Applies the shared persona engine in `../references/review-personas.md` to the staged diff (or, on request, all unstaged changes), cross-referenced with the active grimoire change.

This is the dev-loop counterpart to `grimoire-pr-review`. Run it before `grimoire-commit`. If it returns blockers, fix them; if only suggestions, decide which to address. Designed to be fast — default scope is the senior engineer + security quick scan + code style, with the full persona stack opt-in.

## Triggers
- User asks to review their own change before committing
- Loose match: "review my changes", "review staged", "review before commit", "precommit review", "check my diff", "review what I'm about to commit"
- Implicit: user about to run `grimoire-commit` on a non-trivial diff and asks for a sanity check

## Routing
- Reviewing a teammate's PR → `grimoire-pr-review`
- Reviewing the spec / design before any code exists → `grimoire-review`
- Writing the commit message itself (no review) → `grimoire-commit`
- Verifying scenarios pass after merge → `grimoire-verify`
- Reviewing your own change post-push, pre-merge → `grimoire-pr` (post-impl review section)

## Prerequisites
- Working directory is a git repo
- Some staged or unstaged changes exist (`git diff --cached` non-empty, or user opts in to unstaged)
- Optional: `.grimoire/` directory with `config.yaml`, active change in `.grimoire/changes/<id>/`, and decisions / docs

## Workflow

### 1. Resolve the Diff

Default scope: **staged only**.

```sh
git diff --cached
git diff --cached --stat
git diff --cached --name-only
```

If staged is empty:
- Check unstaged: `git diff` and `git diff --stat`
- If unstaged exists, ask: "Nothing staged. Review unstaged changes (`git diff`), or review staged + unstaged combined? Or stage first?"
- If both empty, stop: "Nothing to review."

If both staged and unstaged exist, ask which to review (default: staged only — that's what's about to be committed).

If the diff is very large (>2000 lines changed), ask: review full diff, focus on a subset of files, or review file-by-file?

Record: scope (staged | unstaged | both), file list, +adds / -dels, base commit (`git rev-parse HEAD`).

### 2. Find Active Grimoire Change

```sh
ls .grimoire/changes/
```

- Zero changes → no linked artifacts; proceed using diff alone
- One change → load it as the linked change
- Multiple changes → list them and ask the user which (if any) the diff belongs to. User can answer "none" if this is a config / dep / formatting change

For the linked change, read:
- `manifest.md` (Why, Non-goals, complexity)
- All `.feature` files in the change
- Decision records
- `tasks.md`
- `data.yml` (if present)

Cross-check filenames in the diff against `tasks.md` references — surface mismatches as a senior-engineer finding.

### 3. Gather Project Context
- `.grimoire/config.yaml` — language, tools, `commit_style`, `comment_style`, `project.compliance`, `dep_audit`, `precommit_review` (if set)
- `.grimoire/docs/context.yml` — deployment env, related services
- `.grimoire/docs/data/schema.yml` — current data baseline
- Relevant `.grimoire/docs/<area>.md` for directories touched by the diff
- Repo root: `AGENTS.md`, `CLAUDE.md`, `.editorconfig`, lint/format config files (for the code-style persona)

### 4. Build Project Briefing
Follow `../references/review-personas.md` §1 (Project Briefing). README fallback: note `Product framing: unknown` and proceed silently — pre-commit review is fast-path; don't block on prompts.

Inject as preface to every persona run below.

### 5. Pick Depth — Pre-Commit Default

Pre-commit review is in the dev loop, so default is lighter than PR review. Read `complexity` from the linked manifest if present; otherwise infer from the diff.

| Signal | Default depth |
|---|---|
| Docs / config / formatter only, ≤50 lines | Code Style only |
| Diff <200 lines, no security/auth/data files touched, complexity ≤2 | Senior Engineer + Security quick scan + Code Style |
| Diff touches auth / models / migrations / external API / >200 lines | Senior Engineer + Security (full STRIDE + code-level scan) + Code Style + relevant of QA/Data |
| Complexity 4 OR diff >500 lines OR multi-domain | All personas mandatory |

Read `precommit_review.depth` from `.grimoire/config.yaml` if set (`quick` | `full`) — that overrides the inference.

User can override per-run: "full review", "just security", "just style", "skip product".

### 6. Run Personas
For each selected persona, follow its evaluation criteria in `../references/review-personas.md` §4 against the **diff** (with linked artifacts as cross-reference). Apply the materiality gate (§2) — every finding cites a briefing axis or feature-inventory gap, or is dropped.

Persona scope for pre-commit review:
- 4.1 Product Manager — only when the diff touches user-facing behavior AND a feature file exists in the linked change. Otherwise skip.
- 4.2 Senior Engineer — always
- 4.3 Security Engineer — always; STRIDE only on hunks introducing new entry points / trust boundaries; full code-level scan
- 4.4 QA Engineer — only when diff touches user-facing behavior or adds/removes tests
- 4.5 Data Engineer — only when diff touches migrations / models / schema / external API client
- 4.6 Code Style Reviewer — always (the highest-value, lowest-cost persona for pre-commit)
- 4.7 Adversarial User — engage per matrix in `../references/adversarial-personas.md` when the diff touches a user-facing surface
- 4.8 Contrarian — runs last when any persona produced a blocker; calibrates other personas' findings post-hoc

### 6.5 Visual Fidelity (cheap tier)

Follow `../references/visual-fidelity.md` for the code-phase invocation (staged diff scope, auto-invoked when `.grimoire/brand/tokens.json` exists). Skip silently when tokens.json is absent and the diff has no styling-surface changes. Fold the engine's output under the "Visual Fidelity" section of the report.

### 7. Present Findings

Compile into the standard report layout (§5 of the personas reference):

```markdown
# Pre-Commit Review

**Scope:** <staged | unstaged | both>
**Linked change:** <change-id or "none">
**Complexity:** <1-4 or "inferred: low">
**Files changed:** <N>  **Lines:** +<add> / -<del>
**Depth:** <quick | full>

## Project Briefing
<briefing block, condensed if quick depth>

## Senior Engineer
- ...

## Security Engineer
### STRIDE
- ...
### Findings
- ...

## Code Style
- **[blocker]** `eslint.config.js` rule `no-unused-vars` violated at `src/foo.ts:42`
- **[suggestion]** Comment at `src/bar.ts:88` describes what the code does — remove (per `AGENTS.md` "Default to writing no comments")

(Other personas if selected.)

## Summary
- **N blockers** — fix before commit
- **M suggestions** — consider addressing

Recommendation: <fix blockers, then proceed to grimoire-commit / approve, ready to commit>
```

### 8. Decide Next Step

Read `precommit_review.block_on` from `.grimoire/config.yaml` if set (`blocker` | `none`). Default: `blocker`.

- **Blockers exist + `block_on: blocker`**: tell the user to fix and re-run; do NOT call `grimoire-commit` automatically. Offer to walk through the blockers one by one.
- **Only suggestions**: present them; ask whether to address before committing or proceed.
- **Clean**: confirm "Ready to commit." and suggest `grimoire-commit`.

Never run `git commit` from this skill. Commit message generation lives in `grimoire-commit`.

### 9. Optional: Hook Mode

If invoked from a git pre-commit hook (env var `GRIMOIRE_HOOK=1` or argument `--hook`):
- Suppress the briefing block (too noisy for hook output)
- Print only blockers (suggestions to a side file: `.grimoire/.last-precommit-suggestions.md`)
- Exit code 1 if blockers exist and `block_on: blocker`; exit 0 otherwise
- Wire-up is manual: user adds `grimoire precommit-review --hook` to `.git/hooks/pre-commit`. Don't auto-install — the existing `grimoire init` already wires `grimoire check --changed`, and LLM-driven review is opt-in (slower, costs tokens)

This skill does not currently ship a CLI command; hook mode is provided as a convention so a future CLI wrapper can implement it without breaking the skill contract.

## Important
- This is a code review against an uncommitted diff — reference specific files and line numbers for every finding.
- Be direct. Blockers stop the commit; suggestions are advisory.
- Findings describe the code, not the author.
- If the diff is too large or sprawling for a meaningful review, say so — offer to focus on a subset rather than a shallow full-pass.
- Never `git commit`, `git add`, or `git stash` from this skill.
- The Code Style persona MUST cite a project anchor for every finding (config rule, `AGENTS.md` / `CLAUDE.md` line, area doc, or visible neighbor convention). General taste is dropped.
- All persona evaluation criteria, the materiality gate, the briefing structure, and the complexity-depth table live in `../references/review-personas.md`. Don't duplicate them here — read that file when running a persona.

## Done
When the report is presented, the workflow is complete. If clean, suggest `grimoire-commit`. If blockers exist, suggest the user fix them and re-run.
