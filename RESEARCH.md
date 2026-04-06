# Grimoire — Research & Design Notes

Compiled from initial design sessions. This document preserves context for future conversations.

## Current State (as of 2026-04-05)

**What exists:** A working npm package (`@kiwi-data/grimoire`) with CLI and 10 Claude Code skills. Builds cleanly. Smoke-tested `grimoire init`.

**Project location:** `~/Code/grimoire`

**What's built:**
- TypeScript CLI (Commander.js, ESM) with commands: `init`, `update`, `list`, `status`, `validate`, `archive`, `map`, `check`, `log`, `trace`, `docs`, `health`
- 10 skills: `draft`, `plan`, `apply`, `verify`, `audit`, `remove`, `discover`, `review`, `bug`, `commit`
- AGENTS.md (universal LLM instructions with managed block markers for multi-LLM support, engineering principles)
- Templates: manifest (with YAML frontmatter for status + branch), example.feature, MADR decision record, mapignore, mapkeys
- Validation: Gherkin (Feature, Scenario, Scenario Outline + Examples), MADR (frontmatter, required sections), manifest (status field)
- Conflict detection: warns when multiple changes touch the same .feature file
- `grimoire update` command to refresh AGENTS.md + skills in consuming projects
- `grimoire map` command: structural codebase scanner with `.grimoire/mapignore` and `.grimoire/mapkeys` config, `--duplicates` flag (jscpd), `--refresh` for detecting undocumented areas
- `grimoire check` command: config-driven pre-commit pipeline (lint → format → duplicates → complexity → unit_test → bdd_test → security → best_practices), supports `--continue`, `--skip`, `--json`
- Auto-detection during init: language, package manager, linter, formatter, test frameworks, BDD framework, complexity tools, security tools, doc tools, comment style — confirms with user (Y/n/edit)
- Central config: `.grimoire/config.yaml` with `project:` section (language, package_manager, commit_style, doc_tool, comment_style), tool configs, check pipeline order, LLM command
- Data schema documentation: YAML format in `.grimoire/docs/data/schema.yml` supporting SQL tables, document collections, and external APIs with `schema_ref` pointers
- Audit trail: `grimoire log` generates release notes from archived changes (filterable by date/git tag), `grimoire trace <file[:line]>` traces any file back to the grimoire change that created it via git commit trailers
- Git conventions: mandatory `Change: <change-id>` git trailer on all commits during a grimoire change, feature branch naming `<type>/<change-id>` (feat/, fix/, refactor/, chore/)
- Human-readable docs: `grimoire docs` generates OVERVIEW.md from all grimoire artifacts — project summary, architecture, features with scenarios, data model, decisions, recent changes, active work
- Project health score: `grimoire health` measures grimoire completeness (features, decisions, area docs, data schema, test coverage, unit coverage, duplicates, complexity), outputs visual bar chart, `--badges README.md` writes shields.io badges with managed block markers

**Key design principles:**
- Framework-agnostic: works with Behave, Cucumber.js, pytest-bdd, Playwright, etc. Skills read the project's existing test setup.
- Multi-LLM: AGENTS.md is the universal instruction file. Claude Code skills are thin wrappers.
- Strict red-green BDD: tests must fail before production code is written. False-positive anti-patterns explicitly called out.
- tasks.md IS the plan: apply skill explicitly tells LLMs not to re-plan. Plans must be detailed enough to execute without thinking (exact file paths, exact assertions).
- Two formats: Gherkin for behavioral requirements, MADR for architecture decisions. Clear routing rules.
- Simple over clever: engineering principles in AGENTS.md govern all stages — less code, no premature abstractions, use what exists, small surface area.
- Reproduce before you fix: bug skill enforces failing test before any code changes.
- Multi-perspective review: optional design review with product manager, senior engineer, security engineer, and data engineer personas before coding starts.
- Full audit trail: mandatory git trailers link commits → changes, `grimoire trace` follows the chain backward, `grimoire log` assembles release notes forward. Feature branches named `<type>/<change-id>` tie git history to grimoire changes.

**What's NOT built yet:**
- Not published to npm yet
- No tests for the CLI itself (vitest is in devDeps but no test files)
- No `grimoire new change` CLI command (changes are created by the LLM via skills)
- No CI/CD pipeline
- Has not been tested end-to-end on a real project

**Target ecosystem:** Kiwi Data projects — React frontend (shake), FastAPI servers, Django backend (bake). Each has different test paradigms. Grimoire is intentionally not prescriptive about frameworks.

**Problem status:**
- Problems 1-3 (spec bloat, requirements truth, architecture truth): SOLVED by design — features/ is current state, not deltas
- Problem 4 (non-DRY code): ADDRESSED — `grimoire map --duplicates` runs jscpd, discover skill inventories reusable utilities, plan skill reads reuse inventory before generating tasks, check pipeline catches new duplicates
- Problem 5 (codebase navigation): ADDRESSED — `grimoire map` produces structural snapshot, discover skill generates area docs in `.grimoire/docs/` with key files, boundaries, and "where new code goes" guidance, data schema in `.grimoire/docs/data/schema.yml`
- Problem 6 (code style): ADDRESSED — discover skill documents patterns and conventions per area, plan skill reads area docs and references real patterns, engineering principles enforce simplicity, check pipeline runs linter/formatter, init auto-detects and configures tools
- Problem 7 (audit trail): ADDRESSED — mandatory `Change:` git trailers link commits to changes, `grimoire trace` follows file → commit → change → manifest → features/decisions, `grimoire log` generates release notes from archive, feature branch naming convention `<type>/<change-id>`
- Problem 8 (unified app state view): ADDRESSED — `grimoire docs` generates OVERVIEW.md assembling features, decisions, architecture, data model, changes, and active work into a single browsable document

See "Problems Grimoire Solves" section below for full analysis and future work ideas for each.

**Next steps to consider:**
- Try `grimoire init` + full draft/plan/review/apply cycle on a real Kiwi Data project
- Write CLI tests
- Publish to npm
- Add `grimoire new change <id>` CLI command for scaffolding changes without skills
- Auto-generate PR descriptions from manifest + review findings

---

## Problems Grimoire Solves

These are real problems observed across months of working with AI coding agents (Claude, Codex, Cursor, etc.) and spec-driven tools. Each problem directly motivated a grimoire design decision.

### Problem 1: Specs bloat and lose authority over time
**What happens:** Tools like OpenSpec accumulate change deltas over time. To understand the current state of a feature, you have to mentally replay a chain of ADDED/MODIFIED/REMOVED operations across multiple change files. The "truth" is scattered across the archive. Nobody knows what the current spec actually says without archaeology.

**How grimoire addresses this:** Feature files in `features/` ARE the current state. They're complete, standalone `.feature` files — not deltas. When a change is applied, the proposed `.feature` file **replaces** the baseline entirely. There's no delta chain to replay. If you want to know what the login feature does, read `features/auth/login.feature`. That's it. The manifest in `.grimoire/archive/` preserves WHY something changed, but the feature file itself is always the authoritative current state.

### Problem 2: No source of truth for requirements
**What happens:** Requirements live in Jira tickets, Slack threads, Notion docs, PR descriptions, and people's heads. The LLM has no single place to look to understand "what should this system do?" So it guesses, asks repeatedly, or implements based on incomplete context.

**How grimoire addresses this:** `features/` is the single source of truth for behavioral requirements. Every user-facing behavior is a Gherkin scenario. The LLM reads the feature files before implementing anything. If a behavior isn't in a feature file, it doesn't exist as a requirement. The draft skill enforces this — you can't implement without first writing the spec.

### Problem 3: No source of truth for architecture
**What happens:** Architecture decisions live in old Slack conversations, tribal knowledge, or nowhere. The LLM doesn't know why PostgreSQL was chosen over MySQL, why the service layer is separated from the controller layer, or what the team's conventions are. So it makes its own (often wrong) architectural choices.

**How grimoire addresses this:** `decisions/` holds MADR decision records. Every significant technical choice gets a record: what was decided, what alternatives were considered, and why. The LLM reads these before implementing. The plan skill checks decisions for constraints. The verify skill confirms decisions were followed.

### Problem 4: LLMs write non-DRY code and re-implement existing functions
**What happens:** The LLM doesn't know a helper function already exists, so it writes a new one. Or it copies similar logic into three places instead of extracting a shared function. Over time this creates massive duplication. The LLM is essentially blind to the broader codebase — it only sees what it explicitly reads.

**Status: ADDRESSED.**

Grimoire now has multiple mechanisms targeting non-DRY code:

- **`grimoire map --duplicates`** — runs jscpd (token-based duplicate detection via Rabin-Karp) and includes clone data in the snapshot
- **`/grimoire:discover`** — generates area docs with a "Reusable Code" inventory table listing specific functions/classes that MUST be reused, and a "Known Duplicates" section from jscpd data
- **`/grimoire:plan`** — reads `.grimoire/docs/` before generating tasks, includes a "Reuse" section at the top of tasks.md, and tasks should consolidate rather than add duplicates
- **`grimoire check`** — pipeline includes a duplicates step (jscpd) that catches new duplication at pre-commit time
- **Engineering principles** in AGENTS.md — "Use what exists", "Don't abstract early" guide all LLM behavior

**Remaining opportunities:**
- The verify skill could include a post-implementation duplication check
- Adapt bake's framework-specific review skills into grimoire-compatible patterns

### Problem 5: LLMs can't navigate large codebases
**What happens:** In a large project, the LLM doesn't know where things should go. It creates new files in the wrong location, puts logic in the wrong module, or doesn't follow the project's organizational patterns. This stems from not having a mental model of the codebase.

**Status: ADDRESSED.**

Grimoire now has a full codebase mapping and navigation system:

- **`grimoire map`** — CLI command that produces `.grimoire/docs/.snapshot.json` with directory tree, key files (entry points, configs, route files), file extension counts. User-configurable via `.grimoire/mapignore` and `.grimoire/mapkeys`.
- **`/grimoire:discover`** — reads the snapshot and generates area docs in `.grimoire/docs/`, each with Purpose, Boundaries, Key Files, Reusable Code, Patterns, and "Where New Code Goes" sections. Also generates `.grimoire/docs/data/schema.yml` documenting data models, relationships, and external API contracts.
- **`grimoire map --refresh`** — diffs against existing `index.yml` to find undocumented or removed areas
- **`/grimoire:plan`** — reads `.grimoire/docs/` and `.grimoire/docs/data/schema.yml` before generating tasks, referencing real paths, patterns, and existing utilities

**Remaining opportunities:**
- ADRs could include "module boundary" decisions
- The audit skill could trigger a discover pass as part of onboarding

### Problem 6: Generated code doesn't match team style
**What happens:** The LLM writes code that's functionally correct but stylistically inconsistent. Different naming conventions, different patterns, different error handling approaches than what the team uses. The codebase becomes a patchwork.

**Status: ADDRESSED.**

Grimoire now enforces code style through multiple layers:

- **`/grimoire:discover`** — documents naming conventions, structural patterns, and style exemplars per area in `.grimoire/docs/`. Points to specific files as examples to follow.
- **`/grimoire:plan`** — reads area docs before generating tasks, references real patterns and conventions. Tasks reference specific files as "follow this pattern."
- **`grimoire init`** — auto-detects linters, formatters, doc tools, and comment style (google/numpy/sphinx/jsdoc/tsdoc). Stores preferences in `.grimoire/config.yaml` project section.
- **`grimoire check`** — pipeline runs configured linter and formatter at pre-commit time, plus LLM-based best practices review
- **Engineering principles** in AGENTS.md — "Obvious structure: follow the project's existing file layout, naming conventions, and patterns"
- **`/grimoire:review`** — senior engineer persona checks for consistency with existing patterns

**Remaining opportunities:**
- The verify skill could include a post-implementation style check
- "Style exemplar" convention could be formalized further

### Problem 7: Changes are hard to audit
**What happens:** You look at a PR and can't tell: what requirement drove this change? Was this change planned or ad-hoc? Did it follow the architecture? Are there tests? Is the scope right or did it creep?

**Status: ADDRESSED.**

Grimoire now has a complete audit trail from code back to requirements:

- **Mandatory git trailers**: Every commit during a grimoire change MUST include `Change: <change-id>` as a git trailer (enforced in commit skill, apply skill, AGENTS.md). Optional `Scenarios:` and `Decisions:` trailers add context. Standard git trailers, parseable by `git log --format="%(trailers)"`.
- **Feature branch convention**: `<type>/<change-id>` (e.g., `feat/add-2fa-login`, `fix/handle-null-pricing`). Created before first commit in apply and bug workflows. Manifest `branch:` field links change to branch.
- **`grimoire trace <file[:line]>`**: Given any file (or specific line), traces backward through git history, extracts `Change:` trailers, and looks up each change in archive/active changes. Shows the full chain: code → commit → change → manifest → features → decisions.
- **`grimoire log`**: Reads `.grimoire/archive/`, extracts manifest summaries, features, decisions, scenarios. Filterable by `--from`/`--to` (dates or git tags). Groups by month. `--json` for programmatic use. Purpose-built for release notes.
- **Commit skill**: Writes contextual commit messages following configured style, includes change context in trailers, suggests branch creation.

**The trace chain**: `git blame file.py:42` → commit `abc123` → trailer `Change: add-2fa-login` → `.grimoire/archive/2026-04-05-add-2fa-login/manifest.md` → features + decisions + why.

**Ideas for future work:**
- Auto-generate PR descriptions from manifest + review findings
- `grimoire report` command: full audit-ready summary for a single change

### Problem 8: No single view of app state (design + behavior + tests)
**What happens:** The current state of the application is fragmented across multiple sources: features describe behavior, ADRs describe architecture, test results describe what passes, code describes what's actually built, coding standards describe how it should be written, and none of these are connected into a single coherent picture. You can't answer "what is the current state of this application?" without reading all of them separately and assembling it in your head.

**Status: ADDRESSED.**

Grimoire now has a unified, human-readable view of the project:

- **`grimoire docs`** — generates `.grimoire/docs/OVERVIEW.md`, a single document assembling all grimoire artifacts into a browsable project guide:
  - Project summary (language, tools, conventions from config)
  - System architecture (area overview + purpose/boundaries from area docs)
  - Features grouped by capability (user stories + scenario names from `.feature` files)
  - Data model (field/type/constraint tables from `schema.yml`, external APIs with endpoints)
  - Architecture decisions (summary table + context/outcome from MADR records)
  - Recent changes (from archive)
  - Active work (in-progress changes with task progress)
- **`grimoire trace`** — links any file back through commits → changes → features → decisions
- **`grimoire log`** — assembles change history into release notes
- **Underlying artifacts**: `features/` for behavioral truth, `.grimoire/decisions/` for architectural truth, `.grimoire/docs/` for codebase area docs, `.grimoire/docs/data/schema.yml` for data model truth

Viewable in GitHub, VS Code, or any markdown viewer. Refreshable with `grimoire docs` anytime.

**Ideas for future work:**
- Tags in feature files that link to decisions: `@decision:0003` on a scenario that depends on that ADR
- Integrate `grimoire health` into `grimoire docs` to include scores in the overview

### Existing Tooling Reference: Bake Skills

The bake project (`~/Code/kiwi-dev/bake/.claude/commands/`) has mature skills that grimoire should learn from and potentially integrate:

| Skill | What it does | Relevant to problems |
|-------|-------------|---------------------|
| `/standards:discover` | Scans codebase, extracts tribal knowledge into documented standards | 4, 5, 6 |
| `/standards:index` | Maintains standards index for quick LLM reference | 5, 6 |
| `/django:review-best-practices` | Reviews for readability, DRY, security, Django conventions | 4, 6, 7 |
| `/django:review-maintainability` | 7-phase review: DRY, naming, complexity, test quality, misplaced code | 4, 5, 6, 7 |
| `/django:deprecation-analysis` | Dead code, unused functions, stale dependencies | 4 |
| `/docstrings:sphinx` | Auto-generate documentation | 8 |
| `/django:review-admindocs` | Model/view documentation standards | 6, 8 |

These are currently Django-specific. A key grimoire design task is adapting these patterns into framework-agnostic skills that work across React, FastAPI, Django, and other stacks.

### The Meta-Problem: Codebase Entropy

All eight problems compound into one meta-problem: **codebase entropy**. Without structure, AI-assisted development accelerates the rate at which a codebase becomes harder to maintain. More code, more duplication, more inconsistency, more undocumented decisions, fewer tests that actually test things.

Grimoire's core thesis is that **the fix is upstream, not downstream**. You don't fix codebase entropy by reviewing harder or linting more. You fix it by requiring that every behavioral change starts with a spec, every spec becomes an executable test, every architectural choice is documented, and every implementation follows a plan that references the actual codebase. The structure comes before the code, not after.

**Honest assessment:** All eight problems are now addressed. Problems 1-3 solved by design. Problems 4-6 with enforcement mechanisms (jscpd, area docs, check pipeline). Problem 7 with git trailers, trace, and log. Problem 8 with `grimoire docs` + `grimoire health` (including shields.io badges and unit test coverage). The next phase should focus on testing grimoire end-to-end on a real Kiwi Data project and publishing to npm.

---

## Common Issues with LLM Coding Agents (Industry Research)

Compiled April 2026 from developer discussions (Reddit, Hacker News), academic papers (arXiv), industry reports (IEEE Spectrum, Fortune, CodeRabbit), and developer blogs. These represent the most widely reported problems across tools like Cursor, Copilot, Claude Code, Aider, and Windsurf.

### Issue 1: Context Window & Memory Limitations

The core constraint that cascades into most other problems. A medium-sized codebase exploration (reading 20 files, running tests, parsing output) easily generates 100-150K tokens. Models with 128K windows hit their limit partway through a single task. Performance degrades *before* the advertised limit — a model claiming 200K tokens typically becomes unreliable around 130K. Agents spend ~60% of their time searching for code, not writing it. They lack persistent memory of their action history within a single task.

### Issue 2: Hallucinations & Fabrication

Up to 42% of AI-generated code snippets contain hallucinations — invented function signatures, nonexistent libraries, wrong API parameters. ~5.2% of package suggestions from commercial models don't exist ("slopsquatting"), and attackers have begun registering these hallucinated package names with malware. The model fills gaps in understanding with pattern-matched guesses. When the codebase is too large for the context window, the agent gets a sliced, incomplete view and confabulates the rest. Semantic errors (incorrect conditions, wrong boundaries) are consistent across all models regardless of size.

### Issue 3: Breaking Existing Code / Regressions

75% of AI coding agent maintenance iterations introduce some form of regression. Agents overwrite files, change dependencies, or refactor in ways that introduce subtle bugs. Catastrophic incidents include: Claude Code deleting a developer's entire production setup (2.5 years of records), and a Replit agent wiping data for 1,200+ executives during a code freeze. Agents optimize for the test in front of them without considering downstream consequences.

### Issue 4: The Fix Loop / Infinite Cycling

Agents get stuck repeating the same failed fix indefinitely. The pattern: push a fix → something breaks → push the same or similar fix → cycle. Context blindness means error logs get truncated in the context window, so the agent thinks the error persists even when it's a different error. Agents may "verify" fixes by running commands they think pass but which actually fail silently. Without explicit step limits, timeout constraints, and deduplication, agents will loop until they exhaust token budgets.

### Issue 5: Inconsistent Style & Convention Violations

Without explicit context about codebase conventions, AI uses whatever patterns it considers most common *globally* — mixing error handling patterns, naming conventions, and architectural styles within the same project. Code looks like it was written by a different team on every file. The mitigation requires explicit guidelines files (AGENTS.md, .cursorrules, etc.) and automated linting/formatting enforcement. Most teams don't realize this until the inconsistency is already widespread.

### Issue 6: Poor Performance on Existing/Legacy Codebases

Agents are tuned for generating new code, not navigating existing code. Without firm guardrails, agents "wander off into the wilderness and eventually generate nonsensical, often uncompilable code." Real-world benchmark accuracy: Claude-3 achieved 45.7% on 140 real GitHub tasks; other models scored lower. Complex legacy codebases with institutional knowledge, novel algorithms, subtle integration requirements, and domain-specific problems with sparse training data are where AI tools fail hardest. Runtime bugs are significantly higher in real-world projects vs. synthetic benchmarks.

### Issue 7: Code Quality & Security Vulnerabilities

45% of AI-generated code fails security tests. Python snippets show a 29.5% weakness rate; JavaScript 24.2%. Fortune 50 enterprises saw a 10x increase in security findings per month (1,000 → 10,000+) correlated with AI code adoption. AI-generated code creates 1.7x more bugs than human-written code. Refactoring dropped from 25% of changes in 2021 to 10% in 2024 — a 60% decline — as developers skip cleanup and let AI accumulate debt. Projected $1.5 trillion in technical debt by 2027 largely attributed to AI-generated code.

### Issue 8: The Productivity Paradox

A controlled study found developers using AI were on average 19% slower, yet convinced they were faster. 96% of developers who use coding assistants daily say they don't fully trust AI-generated code, yet keep using it. Senior engineers report spending more time correcting AI suggestions than writing code manually. The initial gains have plateaued as tasks that AI "saves time on" are offset by time spent reviewing, correcting, and debugging AI output.

### Issue 9: Non-Determinism & Unpredictability

The same prompt can produce different results every time. This makes debugging agent behavior nearly impossible — you can't reliably reproduce a failure. CJ's viral "AI Coding Sucks" rant captured widespread developer sentiment: "the joy of programming replaced by frustration with unpredictable LLMs that take shortcuts."

### Issue 10: Developer Experience Frustrations

Usage limits and throttling without notice (Pro subscribers reported weekly caps dropping from 40-50 hours to 6-8 hours). Slow operations (Cursor's git commit message generation taking over a minute). High CPU, memory, and battery drain, especially in larger projects. Incomplete indexing for large projects — dynamic calls and complex inheritance are poorly understood. Loss of developer agency — the joy of programming replaced by "yelling at a black box."

### Issue 11: The "Vibe Coding" Debt Crisis

25% of startups in YC's Winter 2025 batch had codebases that were 95% AI-generated. 40%+ of junior developers admit to deploying AI-generated code they don't fully understand. Senior engineers cite "development hell" when working with AI-generated codebases nobody comprehends. Forrester predicts by 2026, 75% of technology decision-makers will face moderate-to-severe technical debt from AI-generated code. 54% of engineering leaders plan to hire fewer junior developers, creating a future shortage of experienced debuggers.

### Sources

- Addy Osmani — "My LLM coding workflow going into 2026"
- IEEE Spectrum — "Newer AI Coding Assistants Are Failing in Insidious Ways"
- CodeRabbit — "AI vs Human Code Gen Report: AI code creates 1.7x more issues"
- Cerbos — "The Productivity Paradox of AI Coding Assistants"
- arXiv — "What's Wrong with Your Code Generated by LLMs" (2407.06153)
- arXiv — "A Deep Dive Into LLM Code Generation Mistakes" (2411.01414)
- Fortune — "An AI agent destroyed this coder's entire database"
- Awesome Agents — "75% of AI Coding Agents Break Working Code Over Time"
- Tom's Hardware — Claude Code / Replit production deletion incidents
- The Register — "AI code suggestions sabotage software supply chain"
- Trend Micro — "Slopsquatting: When AI Agents Hallucinate Malicious Packages"
- JetBrains — "Coding Guidelines for Your AI Agents"
- arXiv — "Vibe Coding in Practice: Flow, Technical Debt, and Guidelines" (2512.11922)
- Hacker News threads on AI coding in complex codebases (2025-2026)

---

## Grimoire Assessment Against Industry Issues

Honest assessment of how grimoire v0.1 addresses (or doesn't) each of the 11 common issues identified above. Rating: **Strong** (directly mitigates), **Partial** (helps but doesn't solve), **Indirect** (side effect of other design choices), **None** (not addressed).

### Issue 1: Context Window & Memory — Partial

**What grimoire does:**
- `grimoire map` produces a compact structural snapshot (`.snapshot.json`) so the agent doesn't need to explore the filesystem to understand project layout
- `grimoire discover` generates area docs — the agent reads a focused markdown file instead of scanning dozens of source files
- Spec-driven scoping (draft → plan → apply) forces small, focused changes rather than open-ended "improve the app" sessions that blow out context
- `tasks.md` IS the plan — the apply skill doesn't re-plan, reducing context churn
- Feature files and decision records are concise, structured documents that compress well in context

**What it doesn't do:**
- No token budget tracking or awareness — grimoire doesn't know when the agent is approaching context limits
- No mechanism to checkpoint and resume across context resets
- No automatic context pruning (e.g., "you've read 15 files, here's a summary instead")
- The area docs + snapshot approach helps but doesn't fundamentally change the constraint — very large codebases still overwhelm
- No integration with tool-level context management (e.g., Claude Code's conversation compression)

**Verdict:** Grimoire reduces the *need* for large context by pre-computing navigational information, but doesn't manage context size itself. The scoping discipline is the biggest win — small, planned changes need less context than exploratory ones.

### Issue 2: Hallucinations & Fabrication — Partial

**What grimoire does:**
- `grimoire discover` documents real APIs, real functions, real patterns — the agent reads actual codebase facts rather than guessing
- `grimoire plan` references specific files and existing utilities from area docs, grounding the plan in reality
- `grimoire verify` catches implementation that doesn't match specs — if the agent hallucinated an API, the verification step surfaces it
- `grimoire check` runs the real linter, real tests, real security scanner — hallucinated code that doesn't compile or pass tests gets caught
- Engineering principles ("Use what exists", "Read area docs first") steer agents toward documented reality

**What it doesn't do:**
- Can't prevent the model from hallucinating during any individual step — hallucination is a model-level problem
- No package/import validation (would catch slopsquatting)
- Area docs are only as good as the last `discover` run — stale docs could themselves become a source of hallucination
- No fact-checking mechanism (e.g., "verify this import exists before using it")

**Verdict:** Grimoire reduces hallucination *opportunity* by giving agents real information to work from, and catches hallucination *consequences* via verify + check. But it can't prevent the model from hallucinating in the moment.

### Issue 3: Breaking Existing Code / Regressions — Strong

**What grimoire does:**
- Red-green BDD cycle is mandatory: every scenario becomes a test that must fail first, then pass. Existing tests must still pass.
- `grimoire verify` checks completeness (all tasks done), correctness (scenarios have real assertions), and coherence (code matches specs, decisions followed)
- `grimoire check` runs the full test suite, linter, and security scanner before code leaves the branch
- Feature branch convention isolates changes — work happens on `feat/<change-id>`, not main
- `grimoire bug` enforces reproduction-first: write a failing test that captures the bug, then fix it, then verify no regressions
- Scoped changes: each change has a manifest listing exactly which features and decisions are affected. Scope creep is visible.
- Conflict detection: `grimoire detect` warns when multiple active changes touch the same `.feature` file

**What it doesn't do:**
- Can't prevent regressions in untested code paths — if there's no test, there's no safety net
- No integration test awareness (grimoire focuses on BDD acceptance tests, not integration/E2E coverage)
- Doesn't catch subtle behavioral changes that pass tests but change semantics (the "tests pass but the behavior is wrong" problem)
- No rollback mechanism if a change breaks things after merge

**Verdict:** This is grimoire's strongest area. The mandatory red-green cycle, verify step, and check pipeline create multiple layers of regression defense. The remaining gap is untested code — grimoire helps the disciplined developer but can't force coverage on legacy code.

### Issue 4: The Fix Loop / Infinite Cycling — Partial

**What grimoire does:**
- Plan/execute separation: `tasks.md` IS the plan. The apply skill works through tasks sequentially and doesn't re-plan. This prevents the "try random things until something works" pattern.
- Each task is concrete: specific file, specific assertion, specific implementation. The agent doesn't need to figure out *what* to do, only *how*.
- `grimoire verify` at the end provides a clear pass/fail — either specs are met or they aren't, with specific issues listed
- The bug skill requires a reproduction test first — the fix loop can't happen because the success criterion (test passes) is defined upfront

**What it doesn't do:**
- No step limit or loop detection within a task — if the agent gets stuck on task 3, grimoire doesn't notice
- No deduplication of failed attempts ("you already tried this exact approach")
- No automatic fallback strategy ("if this fails 3 times, try a different approach" or "ask the user")
- No timeout mechanism
- The apply skill in autonomous mode could theoretically cycle within a single task

**Verdict:** Grimoire's structured workflow prevents the *macro* fix loop (bouncing between unrelated changes) but doesn't prevent the *micro* fix loop (retrying the same approach on a single task). The concrete task definitions help — there's less room to wander — but loop detection would be a valuable addition.

### Issue 5: Inconsistent Style & Convention Violations — Strong

**What grimoire does:**
- `grimoire init` auto-detects linters, formatters, doc tools, comment style and stores preferences in config
- `grimoire discover` documents naming conventions, structural patterns, and style exemplars per area, pointing to specific files as examples
- `grimoire plan` reads area docs and references real patterns — tasks say "follow the pattern in `src/services/auth.ts`"
- `grimoire check` runs the configured linter and formatter at pre-commit time
- AGENTS.md engineering principles: "Obvious structure: follow the project's existing file layout, naming conventions, and patterns"
- `grimoire review` senior engineer persona checks for consistency with existing patterns
- `grimoire check` includes an LLM-based best practices review step

**What it doesn't do:**
- Style docs are only as current as the last `discover` run
- No automatic style enforcement *during* generation (only catches issues after the fact via check)
- Can't prevent the model from ignoring documented patterns — it's guidance, not constraint

**Verdict:** Strong coverage through multiple layers: documentation (discover), planning (plan reads area docs), review (multi-persona), and enforcement (check pipeline). The main gap is real-time enforcement during code generation.

### Issue 6: Poor Performance on Existing/Legacy Codebases — Strong

**What grimoire does:**
- `grimoire map` gives the agent a structural understanding of the codebase without reading every file
- `grimoire discover` generates area docs with purpose, boundaries, key files, reusable code, patterns, and "where new code goes"
- `grimoire audit` is specifically designed for onboarding existing codebases — it discovers undocumented features and decisions, interviews the user, and creates specs retroactively
- `grimoire plan` reads area docs + data schema before generating tasks — the agent knows the codebase before writing code
- Data schema documentation captures database tables, document collections, and external API contracts
- Engineering principles steer agents toward understanding before acting

**What it doesn't do:**
- Can't capture *all* institutional knowledge — some things only exist in people's heads
- Area docs are static snapshots, not live indexes
- Complex runtime behavior (dynamic dispatch, metaprogramming, complex inheritance) won't show up in map/discover
- No support for understanding test fixtures, factory patterns, or complex test infrastructure

**Verdict:** This is one of grimoire's core strengths. The audit + discover + map pipeline is specifically designed to make existing codebases navigable for agents. The gap is dynamic/runtime complexity that static analysis can't capture.

### Issue 7: Code Quality & Security Vulnerabilities — Partial

**What grimoire does:**
- `grimoire check` pipeline includes: lint → format → duplicates → complexity → unit_test → bdd_test → security → best_practices
- Security scanner step is configurable (bandit for Python, eslint-plugin-security for JS, etc.)
- `grimoire review` includes a security engineer persona that reviews for vulnerabilities
- Engineering principles: "Errors at boundary — validate input at edges"
- Red-green BDD catches functional bugs via mandatory test coverage
- Complexity checking (via configured tools) catches overly complex code

**What it doesn't do:**
- Security scanning is only as good as the configured tool — no built-in vulnerability database
- No SAST/DAST integration beyond what the user configures
- No dependency vulnerability scanning (npm audit, safety, etc.)
- No secret detection (detecting hardcoded credentials, API keys)
- The security review persona is an LLM reviewing code — it's suggestive, not deterministic
- No supply chain security (lockfile integrity, package provenance)

**Verdict:** Grimoire provides the *framework* for quality and security checks but relies on external tools for the actual scanning. The multi-step check pipeline is solid scaffolding. The gap is that grimoire doesn't ship with or require specific security tools — it's only as secure as what the user configures during `init`.

### Issue 8: The Productivity Paradox — Indirect

**What grimoire does:**
- Forces deliberate work: draft (think) → plan (design) → apply (implement) → verify (check). This prevents the "just start coding and hope" pattern that causes the productivity paradox.
- Specs-first means the agent has clear success criteria before writing code
- Tasks are concrete enough that less time is spent on back-and-forth
- Verify step provides objective measurement of completeness — not "does it feel done?" but "do all scenarios pass?"

**What it doesn't do:**
- Can't measure or prove productivity gains — no built-in metrics
- Adds process overhead that could reduce throughput on small/trivial changes
- The productivity paradox is fundamentally about human cognitive biases, not tooling

**Verdict:** Grimoire doesn't directly address the productivity paradox, but its structured workflow may reduce the "time spent correcting AI" portion by front-loading the thinking. Whether this actually makes developers faster is an empirical question grimoire can't answer.

### Issue 9: Non-Determinism & Unpredictability — Partial

**What grimoire does:**
- Concrete task definitions reduce the space of possible outputs — "add a step definition for scenario X in file Y that asserts Z" has fewer valid implementations than "add login functionality"
- Verify step provides deterministic pass/fail regardless of how the code was generated
- Check pipeline (linter, tests, security) provides deterministic quality gates
- Feature files are the spec — even if the implementation varies, the acceptance criteria don't

**What it doesn't do:**
- Can't make LLMs deterministic — this is a fundamental model property
- No seed/temperature control or reproducibility mechanism
- No way to lock down a "known good" generation approach
- Two runs of the same plan may produce different (but both valid) implementations

**Verdict:** Grimoire can't fix non-determinism, but it bounds the *consequences* of non-determinism. If the output passes verify + check, it meets the spec regardless of how it got there. The unpredictability is contained within the constraints.

### Issue 10: Developer Experience Frustrations — None

**What grimoire does:**
- Not much — this is about the AI tools themselves (usage limits, performance, resource consumption), not about the development workflow

**What it doesn't do:**
- Can't fix usage limits, slow operations, high resource consumption, or incomplete indexing
- These are properties of the AI tools (Cursor, Claude Code, etc.), not the projects they work on
- Grimoire is a workflow layer on top of these tools, not a replacement for them

**Verdict:** Out of scope. Grimoire operates at the project/workflow level, not the tool/infrastructure level. The one indirect benefit is that structured, focused changes may reduce total token usage and thus be less likely to hit usage limits.

### Issue 11: The "Vibe Coding" Debt Crisis — Strong

**What grimoire does:**
- Every behavioral change requires a Gherkin spec — you can't "vibe code" without first articulating what you're building
- Every spec becomes an executable test — the code is verified against documented behavior
- Architecture decisions are recorded in MADR — the "why" is preserved, not just the "what"
- `grimoire docs` generates a human-readable overview — anyone can understand what the system does by reading it
- `grimoire health` measures project completeness and surfaces gaps
- `grimoire audit` retroactively documents existing undocumented code
- `grimoire trace` links any line of code back to the requirement that created it
- The full audit trail (specs → plans → commits → archive) means the codebase is never "code nobody understands"

**What it doesn't do:**
- Can't force developers to use grimoire — if they bypass it, the debt accumulates as before
- Doesn't prevent AI from generating code that's *correct but poorly structured* within a single task
- The overhead of specs + plans may discourage adoption for rapid prototyping

**Verdict:** This is grimoire's philosophical core. The entire framework exists to prevent the scenario where "nobody knows what this code does or why it's here." If used consistently, vibe coding debt is structurally impossible — every piece of code traces to a spec, a plan, and a decision.

### Summary Table

| # | Issue | Rating | Primary Mechanism |
|---|-------|--------|-------------------|
| 1 | Context Window & Memory | **Partial** | map, discover, scoped changes reduce context needs |
| 2 | Hallucinations | **Partial** | Area docs ground in reality; verify + check catch consequences |
| 3 | Regressions | **Strong** | Red-green BDD, verify, check pipeline, feature branches |
| 4 | Fix Loops | **Partial** | Plan/execute separation prevents macro loops; no micro loop detection |
| 5 | Style Violations | **Strong** | Discover → plan → check pipeline, AGENTS.md principles |
| 6 | Legacy Codebase Navigation | **Strong** | audit + discover + map pipeline |
| 7 | Quality & Security | **Partial** | Check pipeline scaffolding; depends on configured tools |
| 8 | Productivity Paradox | **Indirect** | Structured workflow may reduce correction time |
| 9 | Non-Determinism | **Partial** | Bounds consequences via verify + check, can't fix root cause |
| 10 | Developer Experience | **None** | Out of scope (tool-level, not workflow-level) |
| 11 | Vibe Coding Debt | **Strong** | Specs-first, audit trail, traceability — the philosophical core |

**Overall:** Grimoire is **Strong** on 4 issues (3, 5, 6, 11), **Partial** on 5 issues (1, 2, 4, 7, 9), **Indirect** on 1 (8), and **None** on 1 (10). The strongest coverage is on the issues most directly caused by lack of structure and process. The gaps are in areas that require model-level fixes (hallucination, non-determinism) or tool-level fixes (DX, resource consumption). The most actionable improvement opportunities are:

1. **Fix loop detection** (Issue 4) — add step limits, attempt deduplication, and fallback-to-user within the apply skill
2. **Dependency/secret scanning** (Issue 7) — add `npm audit`/`safety`/`detect-secrets` to the check pipeline defaults
3. **Context budget awareness** (Issue 1) — track approximate token usage and warn when approaching limits

---

## AI Coding Tools Landscape (April 2026)

Research into what tools, patterns, and approaches developers use to work effectively with AI coding agents. Compiled from practitioner blogs, tool docs, and community discussions.

### Spec-Driven Development Tools

| Tool | Type | What it does |
|------|------|-------------|
| **Kiro** (AWS) | IDE | Code OSS-based IDE with Requirements → Design → Tasks workflow using EARS notation. Deep AWS integration. |
| **GitHub Spec Kit** | CLI | Vendor-neutral spec-driven toolkit: Specify → Plan → Tasks → Implement. Works across Copilot, Claude Code, Gemini CLI, Cursor. MIT licensed. |
| **Grimoire** | CLI + Skills | Gherkin + MADR spec-driven development. Red-green BDD enforcement, audit trail, codebase mapping. |

The spec-driven pattern is gaining adoption: write requirements before code, generate plans from specs, implement from plans. Addy Osmani calls it "waterfall in 15 minutes."

### Codebase Context & Understanding

| Tool | What it does | Key mechanism |
|------|-------------|---------------|
| **Aider repo-map** | Concise map of classes, functions, relationships | Tree-sitter tag extraction, PageRank-style file ranking |
| **Repomix** | Packs entire repo into single AI-friendly file | Tree-sitter compression (~70% token reduction). 22K+ stars. |
| **Sourcegraph Cody** | Enterprise multi-repo AI assistant | "Search-first" RAG over full codebase |
| **Greptile** | Deep codebase-aware PR review | Semantic graph of repositories. 82% bug catch rate. |
| **Augment Code** | Context engine for large codebases | Knowledge graph (not just embeddings) |

**Key insight:** The best tools go beyond file listings to extract the API surface — function signatures, class hierarchies, and import relationships. This is what Aider's repo-map and Repomix's Tree-sitter compression do.

### AI Code Review

| Tool | What it does | Notable |
|------|-------------|---------|
| **CodeRabbit** | Automated PR review (free for OSS) | 2M+ repos connected. Highest volume but also highest false-positive rate. |
| **Graphite Agent** | AI review with stacked PRs | <3% unhelpful comment rate. 96% positive feedback. |
| **Qodo** (CodiumAI) | Multi-agent review + test generation | Highest F1 score (60.1%). Persistent Rules System learns your standards. |
| **BugBot** (Cursor) | Parallel PR review | 8 parallel review passes with randomized diff order. 2M+ PRs/month. |
| **GitHub Copilot Code Review** | Native GitHub review | CodeQL + ESLint integration. 1M users in first month. |

**Key insight:** Qodo's test generation is differentiated — it generates complete tests with meaningful assertions, not stubs. This is the kind of test intelligence grimoire should have.

### Configuration Standards

**AGENTS.md** is now an open standard under the Linux Foundation's AAIF. Supported by Claude Code, Cursor, Copilot, Gemini CLI, Windsurf, Aider, Zed, Warp, Roo Code. 60K+ repos on GitHub. Best practices: write by hand, keep updated, every line should solve a real problem.

Other config files (`.cursorrules`, `copilot-instructions.md`, `.windsurfrules`, `GEMINI.md`) are being superseded by AGENTS.md as the universal standard.

### Workflow Patterns That Work

Based on practitioner reports from Addy Osmani, builder.io, Honeycomb, and real-project retrospectives:

1. **Spec-first, chunk execution:** Write spec → break into small tasks → execute one at a time with tests between each → commit after each step.
2. **Fresh sessions per task:** Start new sessions for each task. Context accumulates and degrades quality. Use tasks.md/todolist as the coordination mechanism.
3. **Hybrid tool usage:** Use Cursor for UI/editing + Claude Code in terminal for heavy lifting. Aider's Architect mode for large refactors.
4. **Strong quality gates:** CI/CD with linting, type checking, and tests as the guardrail. Feed failure output back to the AI.
5. **Multiple model cross-check:** Use 2+ LLMs in parallel on the same problem. Each has distinct strengths.
6. **Git as safety net:** Commit after every small task. Use worktrees to sandbox parallel AI tasks.
7. **Architect mode (Aider):** Separate "thinking" model from "coding" model. The thinking model plans, the coding model applies diffs. Reduces hallucination in complex refactors.

### What Grimoire Adopted (v0.2 Enhancements)

Based on this landscape research, grimoire v0.2 added:

1. **Symbol extraction in `grimoire map --symbols`** — Regex-based extraction of function signatures, class definitions, exports, and methods across Python, TypeScript, JavaScript, Go, and Rust. Produces a structured symbol map that area docs and the plan skill can reference. `--compress` generates a compact `.symbols.md` file (like Repomix) that fits in an LLM context window.

2. **Fresh agent per task in apply** — The apply skill now recommends spawning a subagent per task (Claude Code) or starting fresh sessions every 2-3 tasks (other agents). Handoff blocks in `tasks.md` pass context between sessions without requiring full re-reads.

3. **Thinking/coding agent configuration** — `grimoire init` asks for preferred thinking agent (for planning/review) and coding agent (for implementation). Stored in `config.yaml` as `llm.thinking` and `llm.coding` with command + model. Backward-compatible with flat `llm.command` format.

4. **PR automation (`grimoire pr` + `/grimoire:pr`)** — New CLI command and skill that generates PR descriptions from grimoire manifests, with optional post-implementation LLM review of the actual diff. Supports `gh` and `glab` for direct PR creation.

5. **Claude Code hooks + git hooks** — `grimoire init` generates `.claude/hooks.json` (pre-commit: `grimoire check --changed`, post-commit: Change trailer verification) and a standard `.git/hooks/pre-commit` fallback for non-Claude environments.

6. **Test quality intelligence** — New `grimoire test-quality` CLI command with static analysis for weak assertions, empty bodies, missing assertions, and tautological tests. Python and JS/TS support. Integrated into the apply skill (quality gate after each test) and verify skill (test intelligence phase).

### What Grimoire Doesn't Do (Deliberate Omissions)

- **Full Tree-sitter AST parsing** — Uses regex-based symbol extraction instead. Avoids native dependency (tree-sitter requires compilation). Covers 90% of cases. Can upgrade to tree-sitter later if regex proves insufficient.
- **RAG / vector embeddings** — Grimoire's area docs + symbol maps are a structured alternative to embedding-based retrieval. Structured data is more predictable and debuggable than vector search.
- **IDE integration** — Grimoire is CLI + skills, not an IDE plugin. Works with any editor/agent via AGENTS.md.
- **Automated PR creation by default** — `grimoire pr` previews by default, creates only with `--create`. The audit trail is more important than automation speed.

### Sources

- Addy Osmani — "My LLM coding workflow going into 2026"
- builder.io — "50 Claude Code Tips and Best Practices"
- Martin Fowler — "Understanding SDD: Kiro, spec-kit, and Tessl"
- agents.md — Official AGENTS.md specification
- Aider — aider.chat documentation (repo-map, architect mode)
- Repomix — repomix.com documentation
- Faros.ai — "Best AI Coding Agents for 2026"
- Greptile, Sourcegraph Cody, Qodo documentation
- Hacker News and Reddit discussions on AI coding workflows (2025-2026)

---

## Origin & Inspiration

Grimoire is a spec-driven development framework for AI coding assistants. It uses Gherkin for behavioral requirements (executable as acceptance tests) and MADR for architecture decisions. Inspired by OpenSpec's workflow patterns but uses standard formats (Gherkin, MADR) instead of custom markdown.

The name "grimoire" comes from medieval books of magic — a spellbook of instructions. Requirements are incantations that conjure software.

Company context: Kiwi Data. Fred uses Python (Django, FastAPI), React/TypeScript, Behave for BDD, and has Cucumber integration in existing repos.

## What OpenSpec Does (and what we're borrowing)

### OpenSpec's 3-Stage Workflow
1. **Creating Changes** — proposal.md, spec deltas, optional design.md, tasks.md
2. **Implementing Changes** — work through tasks, track completion
3. **Archiving Changes** — move to archive, sync deltas to main specs

### OpenSpec's CLI Architecture
The CLI is surprisingly thin — mostly metadata and validation:

| CLI does | Agent does |
|----------|-----------|
| Dependency graph ("what artifact is ready next?") | All content creation |
| Templates/scaffolding instructions | File reads/writes |
| Spec validation (`--strict`) | Codebase analysis |
| Archive file moves | Intelligent merging |
| JSON status queries | User interaction, decisions |

**Key insight**: CLI as state machine, agent as the brain. The CLI answers "what's possible?" and the agent does the actual work.

### OpenSpec Skills (10 total)
1. `openspec-new-change` — scaffold a new change with guided workflow
2. `openspec-ff-change` — fast-forward: create all artifacts in one go
3. `openspec-continue-change` — resume artifact creation on existing changes
4. `openspec-apply-change` — implement tasks from completed change
5. `openspec-explore` — thinking mode, investigate without implementing
6. `openspec-verify-change` — validate implementation matches artifacts
7. `openspec-archive-change` — finalize and archive completed change
8. `openspec-bulk-archive-change` — archive multiple changes with conflict detection
9. `openspec-sync-specs` — sync delta specs to main specs (intelligent merge)
10. `openspec-onboard` — guided tutorial

### OpenSpec Orchestration Pattern Per Skill

**openspec-new-change**: Ask user what to build → derive kebab-case name → `openspec new change "<name>"` → `openspec status --change` → `openspec instructions <artifact>` → show template to user → STOP (one step at a time)

**openspec-continue-change**: `openspec list --json` → `openspec status --change` → find `ready` artifacts → `openspec instructions <artifact>` → read dependency artifacts → CREATE the artifact file → one artifact per invocation

**openspec-ff-change**: `openspec new change` → loop: status → instructions → write artifact → repeat until all done. Uses TodoWrite to track progress.

**openspec-apply-change**: `openspec list --json` → `openspec status` → `openspec instructions apply` → read context files (proposal, specs, design, tasks) → loop through pending tasks → implement code → mark `- [x]` → next task

**openspec-verify-change**: Read all artifacts → 3-dimension verification: completeness (checkboxes), correctness (search codebase for implementations), coherence (design adherence) → generate report with CRITICAL/WARNING/SUGGESTION

**openspec-sync-specs**: Find delta specs → read each delta + main spec → apply ADDED/MODIFIED/REMOVED/RENAMED intelligently → write updated main specs. Pure agent operation, no CLI.

**openspec-archive-change**: Check tasks complete → check for delta specs → offer sync → move to archive/YYYY-MM-DD-<name>/

### OpenSpec Spec Format (what we're replacing with Gherkin)
```markdown
### Requirement: Document Overview Tab
The document review page SHALL include an Overview tab...

#### Scenario: Overview tab is first in navigation
- **WHEN** the document review page is loaded
- **THEN** the Overview tab SHALL appear as the first tab
- **AND** the Overview tab SHALL be active by default
```

### OpenSpec Delta Format
```markdown
## ADDED Requirements
### Requirement: New Feature
...

## MODIFIED Requirements
### Requirement: Existing Feature (full replacement)
...

## REMOVED Requirements
### Requirement: Old Feature
**Reason**: ...
**Migration**: ...
```

## Why Gherkin Instead of OpenSpec's Format

| Aspect | OpenSpec WHEN/THEN | Gherkin |
|--------|-------------------|---------|
| Executable? | No — docs only | Yes — doubles as acceptance tests |
| Preconditions | Not explicit | `Given` captures preconditions clearly |
| Tool ecosystem | Custom validation only | Cucumber, pytest-bdd, Behave |
| Structure | Freeform markdown | Formal grammar (Feature, Background, Scenario, Given/When/Then) |
| Test generation | Manual | Step definitions generated from scenarios |
| Validation | `openspec validate --strict` | Gherkin parser + dry-run |

### Equivalent Gherkin
```gherkin
Feature: Document Review Overview Tab
  As a reviewer
  I want to see document properties at a glance
  So that I can quickly assess document context

  Background:
    Given I am logged in as a reviewer
    And I am viewing document "contract-123"

  Scenario: Overview tab is first and active by default
    When the document review page loads
    Then the Overview tab should be the first tab
    And the Overview tab should be active
```

## Why MADR for Architecture Decisions

### The Gap Gherkin Can't Fill
Gherkin is intentionally bad at non-functional requirements, architecture decisions, and technical trade-offs. These don't fit Given/When/Then. But not capturing them centrally is a mistake — architecture decisions rot faster than code when they're only in people's heads or scattered Slack threads.

### MADR (Markdown Any Decision Records) v4.0
MADR is the most structured, toolable ADR format available:

**Format:**
```markdown
---
status: {proposed | accepted | deprecated | superseded by ADR-NNNN}
date: YYYY-MM-DD
decision-makers: [list]
---

# [Short title: problem and solution]

## Context and Problem Statement
[Why are we making this decision?]

## Decision Drivers
- [Driver 1]
- [Driver 2]

## Considered Options
1. [Option A]
2. [Option B]

## Decision Outcome
Chosen option: "[Option]", because [justification].

### Consequences
- Good: [positive]
- Bad: [negative]

### Confirmation
[How will we verify this decision was correct?]

## Pros and Cons of the Options

### [Option A]
- Good, because [argument]
- Bad, because [argument]
```

**YAML frontmatter** is parseable — status, date, decision-makers can be validated in CI.

### ADR Tooling Ecosystem

| Tool | Language | Notes |
|------|----------|-------|
| adr-tools | Bash | The original by Nat Pryce. Creates/manages Nygard-format ADRs |
| log4brains | Node.js | CLI + static site generator with full-text search and decision graphs |
| git-adr | Rust | Stores ADRs in git notes, links to specific commits |
| adr-viewer | Python | Generates a website from ADRs |
| structured-madr | — | JSON Schema + GitHub Action for CI validation |

### Fitness Functions — Making Decisions Testable
From "Building Evolutionary Architectures" (Neal Ford et al.):
- ADR says "service layer must not depend on controller layer"
- A test (ArchUnit in Java, import-linter in Python) enforces it
- ADR captures *why*, fitness function enforces *what*

Python tools: `import-linter`, custom pytest checks, `pylint` custom rules.

### The Two-Format Pairing

| Concern | Format | Testable? |
|---------|--------|-----------|
| Behavioral requirements | Gherkin `.feature` files | Yes — pytest-bdd / Cucumber |
| Architecture decisions | MADR `.md` files | Partially — fitness functions |

## Scoping: What Grimoire Handles

### Behavioral Changes → Gherkin Features
- New user-facing functionality
- Changes to existing behavior
- Anything expressible as Given/When/Then

### Architecture Decisions → MADR
- Technology choices (database, framework, library)
- Non-functional requirements (performance targets, security policies)
- Structural decisions (module boundaries, API design, data models)
- Trade-off documentation (why X over Y)

### Out of Scope (redirect the user)
- **Bug fixes** — the feature file already describes correct behavior; just go fix the code
- **Refactoring** — no behavior change = no scenario change; might warrant an ADR if architectural
- **Config, dependency updates, formatting** — no behavioral or architectural impact

The draft skill's FIRST job is to qualify the request and route it:
- "Users should be able to log in with 2FA" → Gherkin feature
- "We should use PostgreSQL instead of MySQL" → ADR
- "The login page is broken" → Neither. Go fix the bug.
- "We need to handle 10k concurrent users" → ADR

## Grimoire's 3-Stage Flow

### Stage 1: Draft (`/grimoire:draft`)
- User describes what they want conversationally
- Agent qualifies: behavioral change? architectural decision? bug fix? Redirect if not grimoire territory.
- For behavioral: draft `.feature` files using Gherkin syntax
- For architectural: draft MADR decision record
- For changes touching both: create features AND decision records
- Collaborative back-and-forth to refine
- Write a manifest.md capturing intent and what changed
- Validate syntax (Gherkin parser for features, YAML frontmatter for decisions)

### Stage 2: Plan (`/grimoire:plan`)
- Read approved `.feature` files, decisions, and manifest
- Generate `tasks.md` — implementation checklist derived from scenarios
- Each task maps back to specific scenarios (traceability)
- Generate step definition stubs for new/modified scenarios
- If ADRs were created, include tasks for implementing the decision (e.g., "set up PostgreSQL", "add import-linter rule")

### Stage 3: Apply (`/grimoire:apply`)
- Work through tasks sequentially
- For features: implement production code + wire up step definitions
- For decisions: implement the architectural change
- The acceptance criteria IS the test — no separate "write tests" step
- Verify by running the feature files
- Mark tasks complete as you go

## Directory Structure

### In the Grimoire Repo (~/Code/grimoire — the distributable)
```
grimoire/
├── AGENTS.md                 # universal LLM instructions (any tool reads this)
├── RESEARCH.md               # design notes (this file)
├── templates/
│   ├── manifest.md           # change manifest template
│   ├── example.feature       # example Gherkin feature
│   ├── decision.md           # MADR template
│   ├── mapignore             # default ignore patterns for map
│   └── mapkeys               # default key file definitions
├── skills/                   # Claude Code skill definitions (10 skills)
│   ├── grimoire-draft/
│   ├── grimoire-plan/
│   ├── grimoire-review/
│   ├── grimoire-apply/
│   ├── grimoire-verify/
│   ├── grimoire-audit/
│   ├── grimoire-remove/
│   ├── grimoire-discover/
│   ├── grimoire-bug/
│   └── grimoire-commit/
├── src/
│   ├── cli/index.ts          # CLI entry point
│   ├── core/                 # command implementations
│   │   ├── init.ts           # init with auto-detection
│   │   ├── update.ts
│   │   ├── detect.ts         # tool auto-detection
│   │   ├── check.ts          # pre-commit pipeline
│   │   ├── map.ts            # codebase scanner
│   │   └── ...
│   └── utils/
│       ├── config.ts         # config loader (yaml)
│       └── paths.ts
```

### In a Consuming Project (after grimoire init)
```
my-project/
├── features/                 # ROOT LEVEL — Gherkin baseline (testing frameworks need this)
│   ├── auth/
│   │   ├── login.feature
│   │   └── totp-setup.feature
│   └── documents/
│       └── review.feature
├── .grimoire/
│   ├── config.yaml           # project config (tools, checks, preferences)
│   ├── mapignore             # patterns to exclude from map scan
│   ├── mapkeys               # key file definitions
│   ├── decisions/            # MADR baseline — architectural truth
│   │   ├── 0001-use-postgresql.md
│   │   ├── 0002-event-driven-pipeline.md
│   │   └── template.md
│   ├── docs/                 # generated by discover skill
│   │   ├── index.yml         # area index
│   │   ├── api.md            # area doc
│   │   ├── models.md         # area doc
│   │   ├── .snapshot.json    # from grimoire map
│   │   └── data/
│   │       └── schema.yml    # data models + external APIs
│   ├── changes/
│   │   └── add-2fa-login/
│   │       ├── manifest.md
│   │       ├── tasks.md
│   │       ├── data.yml      # proposed schema changes (if any)
│   │       ├── features/
│   │       │   └── auth/login.feature    # proposed state
│   │       └── decisions/
│   │           └── 0003-totp-library.md  # new ADR for this change
│   └── archive/
│       └── 2026-04-01-add-2fa-login/
│           └── manifest.md
├── AGENTS.md                 # includes grimoire section (or standalone)
```

Key decisions:
- `features/` at project root — Behave requires `steps/` inside features dir, other BDD frameworks also expect root-level features
- `.grimoire/` consolidates all grimoire artifacts — decisions, docs, config, changes, archive
- `data.yml` in changes captures proposed schema changes; merged to `schema.yml` on finalize

## Multi-LLM Architecture

### The Problem
OpenSpec works with 20+ AI assistants. Grimoire should too. Tool-specific skill formats differ:
- Claude Code: `SKILL.md` in `.claude/skills/`
- Cursor: `.cursorrules` or `.cursor/rules/`
- Codex: reads `AGENTS.md`
- Windsurf: reads `AGENTS.md` or `.windsurfrules`
- Most others: read `AGENTS.md` at repo root

### The Solution (borrowed from OpenSpec)
**AGENTS.md is the universal instruction file.** It contains the full workflow, conventions, and file format references. Any LLM that reads AGENTS.md can follow the grimoire workflow.

Tool-specific skills (like Claude Code's SKILL.md) are **thin wrappers** that:
1. Reference AGENTS.md for the core workflow
2. Add tool-specific invocation patterns (slash commands, etc.)
3. Use tool-specific features (Claude's AskUserQuestion, TodoWrite, etc.)

This means:
- **AGENTS.md** = the source of truth, works everywhere
- **skills/** = Claude Code optimized experience
- Any LLM can follow the workflow by reading AGENTS.md, even without skills

### Init for Different Tools
A `grimoire init` (or simple script) could:
1. Create `features/`, `decisions/`, `.grimoire/` directories
2. Copy/generate AGENTS.md with grimoire instructions
3. Optionally install Claude Code skills into `.claude/skills/`
4. Optionally create tool-specific config for Cursor, etc.

## Change Tracking: The Manifest

When modifying existing `.feature` files or adding decisions, we need to track what changed and why. The manifest captures intent:

```markdown
# Change: Add 2FA to Login

## Why
Compliance requires multi-factor auth for all user logins.

## Feature Changes
- **MODIFIED** `auth/login.feature` — added 2FA scenarios to existing login flow
- **ADDED** `auth/totp-setup.feature` — new feature for TOTP configuration

## Scenarios Added
- `login.feature`: "Login with valid TOTP code", "Login with expired TOTP code"

## Scenarios Modified
- `login.feature`: "Successful login" — now requires 2FA step after credentials

## Decisions
- **ADDED** `0003-totp-library.md` — chose pyotp over django-otp
```

When the change is applied:
- Proposed `.feature` files replace baseline versions in `features/`
- New decisions get numbered and moved to `decisions/`
- The manifest gets archived to `.grimoire/archive/YYYY-MM-DD-<name>/`
- Git diff gives line-level detail; the manifest gives intent

## Gherkin ↔ Architecture Research

### Key Finding
There is NO automatic traceability from `.feature` → production code. The chain is:
```
.feature file → step definitions → support/helper layer → production code
```
Each link is maintained by convention, not tooling.

### Best Practices
- **Step defs organized by domain concept**, NOT by feature file (Cucumber explicitly calls feature-coupled step defs an anti-pattern)
- **Tags for cross-cutting mapping**: `@service-auth`, `@component-billing`
- **Feature files describe WHAT, never HOW** — architecture lives in the step def / helper layer
- In hexagonal/DDD shops, step defs wire to domain ports, not HTTP endpoints
- **Don't encode architecture in .feature files** — the manifest notes affected modules; features stay purely behavioral

### Directory Conventions (from ecosystem)

**pytest-bdd (Python, most relevant):**
```
tests/
  features/
    auth/login.feature
  step_defs/
    conftest.py          # shared/common steps
    test_login.py        # feature-specific steps
```
Shared steps go in `conftest.py`; feature-specific steps in their test modules.

**Cucumber (general):**
```
features/
  *.feature
  step_definitions/
    customer_steps.rb    # by domain concept
  support/
    env.rb
```

### Traceability Tools
- Cucumber's built-in: feature → step def → test result (no further)
- Serenity BDD: living documentation from test results
- Tags (`@JIRA-1234`): manual linkage to tickets
- No widely-adopted tool for automatic feature → production code tracing

## Design Decisions Made

### 1. Two-format repo (Gherkin + MADR)
Behavioral requirements in `.feature` files, architecture decisions in MADR format. Each in its proper lane.

### 2. Features at project root, decisions in .grimoire/
`features/` must be at root for testing framework compatibility (Behave requires `steps/` inside features dir). `decisions/` moved to `.grimoire/decisions/` to consolidate grimoire artifacts.

### 3. .grimoire/ for working state and project metadata
Changes, archive, decisions, config, docs, and data schema all live under `.grimoire/`. Only `features/` stays at root due to BDD framework constraints.

### 4. Manifests over deltas
OpenSpec uses ADDED/MODIFIED/REMOVED sections within spec files. Grimoire uses a manifest.md that describes changes + proposed `.feature` files that represent the FULL desired state. Simpler mental model: manifest = why, proposed features = what.

### 5. npm CLI for distribution
Chose npm over Python CLI for cross-platform ease. `npx @kiwi-data/grimoire init` works on any machine with Node — no virtualenv or Python version issues. The CLI is TypeScript (Commander.js), same stack as OpenSpec. The consuming projects can be any language; the CLI just scaffolds files and validates structure.

### 6. Multi-LLM via AGENTS.md
AGENTS.md is the universal instruction file. Tool-specific skills are thin wrappers. Any LLM can follow the workflow. `grimoire init` writes AGENTS.md with managed block markers (`<!-- GRIMOIRE:START/END -->`) so it coexists with other instructions.

### 7. Python ecosystem alignment
pytest-bdd for running features. MADR tooling is language-agnostic. import-linter for fitness functions.

### 8. Strict red-green BDD (no false-positive tests)
LLMs are notorious for writing tests that always pass — empty step definitions, trivial assertions, mocked-out everything. Grimoire's apply skill enforces strict red-green: every step definition MUST fail before production code is written. If a test passes immediately, the LLM must stop and fix it before continuing. Anti-patterns are explicitly called out: `pass` bodies, `assert True`, circular assertions, swallowed exceptions.

### 9. Audit skill for existing codebases
An audit skill (`/grimoire:audit`) crawls the codebase to discover undocumented features and implicit architecture decisions. It interviews the user in batches of 3-5 findings rather than dumping a massive list. This is the primary onboarding path for adding grimoire to a project that already has code.

### 10. Feature removal as a first-class operation
Removing a feature gets the same rigor as adding one — a tracked change with manifest (documenting WHY and migration path), impact assessment, and tasks for cleaning up code + tests + related artifacts.

### 11. Prevent LLM re-planning when tasks.md exists
LLMs tend to enter plan mode even when a plan already exists, effectively duplicating work. Grimoire addresses this at three levels:

**a) Explicit anti-re-planning instructions in apply skill and AGENTS.md:**
"tasks.md IS the plan. Do not enter plan mode. Do not create your own plan." This is stated bluntly because LLMs tend to ignore subtle guidance.

**b) Plans detailed enough to execute without thinking:**
Vague tasks like "Implement login with 2FA" cause re-planning because the LLM doesn't know what files to edit. Grimoire's plan skill generates tasks with exact file paths, exact assertions, and exact implementation details. The plan skill reads the actual codebase to reference real paths and patterns.

**c) Resume-friendly task format:**
tasks.md starts with a context block (change summary, feature files, test command, progress count) so a new session can orient without re-reading every artifact. Completed tasks are `- [x]` — the next agent finds the first `- [ ]` and starts there.

### 12. Manifest status lifecycle
`status: draft | approved | implementing | complete` in YAML frontmatter. Tracks where a change is in the workflow. Updated by the LLM as work progresses. CLI reads it for reporting.

### 13. Conflict detection
`grimoire list` scans all active changes for overlapping `.feature` files and warns when multiple changes touch the same file. Prevents merge conflicts and coordination failures.

### 14. Verify skill for post-implementation auditing
`/grimoire:verify` checks three dimensions: completeness (tasks done), correctness (scenarios have real step defs with real assertions), coherence (decisions followed). Also detects dead features. Read-only — reports issues without fixing them.

### 15. Dead feature detection
Both audit and verify skills check for features that exist in specs but are no longer implemented: missing step defs, stub implementations, deleted modules. The audit skill interviews the user about each finding (remove/revive/update/skip).

### 16. `grimoire update` command
Refreshes AGENTS.md (managed block) and all skills in consuming projects when grimoire itself is upgraded. Same pattern as `openspec update`.

### 17. Mandatory git trailers for audit trail
Every commit during a grimoire change MUST include a `Change: <change-id>` git trailer. This is what makes the audit trail work — `grimoire trace` reads trailers to link code back to changes, `grimoire log` reads archived manifests to generate release notes. `Scenarios:` and `Decisions:` trailers add context. Enforced in the commit skill, apply skill, and AGENTS.md.

### 18. Feature branch naming convention
Branches follow `<type>/<change-id>` — e.g., `feat/add-2fa-login`, `fix/handle-null-pricing`. Created before first commit in apply and bug workflows. Links git history to grimoire changes at the branch level.

### 19. Data schema as YAML
Chose YAML over DBML for documenting data models because it handles both SQL tables and document stores (Mongo, DynamoDB) with nested objects/arrays. Also supports external API contracts with `schema_ref` pointers to OpenAPI specs, docs URLs, or local spec files. YAML is already in the grimoire stack and LLMs read/write it trivially.

### 20. Engineering principles as governance
AGENTS.md includes explicit engineering principles (simple over clever, less code, no premature abstraction, use what exists, small surface area) that govern all stages. These are not suggestions — they're constraints that the review skill's senior engineer persona actively checks against.

### 21. Multi-perspective design review
Optional review step between plan and apply with four personas: product manager (completeness), senior engineer (simplicity + feasibility), security engineer (vulnerabilities), data engineer (schema design, when data.yml present). Each flags issues as blocker (must fix) or suggestion (optional). The step is skippable for small/low-risk changes.

### 22. Disciplined bug fix workflow
Bugs get their own skill (`grimoire-bug`) that enforces: reproduce first (failing test), classify (code bug vs spec gap), fix, verify. If a bug reveals a missing scenario, the scenario is added directly to `features/` as a gap fill. Prevents the common pattern of "just change things until it seems to work."

## Skills (10 total)
1. `grimoire-draft` — qualify request, route to feature/ADR/neither, draft artifacts (incl. data.yml for schema changes), collaborate with user
2. `grimoire-plan` — derive detailed tasks with exact file paths and assertions, read codebase + area docs + data schema for context
3. `grimoire-review` — optional multi-perspective design review before coding: product manager, senior engineer, security engineer, data engineer (when data.yml present)
4. `grimoire-apply` — execute tasks (DO NOT re-plan), strict red-green BDD, review or autonomous mode, merge data.yml to schema.yml on finalize
5. `grimoire-verify` — post-implementation audit: completeness, correctness, coherence, dead feature detection
6. `grimoire-audit` — discover undocumented features/decisions, detect dead features, interview user
7. `grimoire-remove` — tracked feature removal with impact assessment and cleanup tasks
8. `grimoire-discover` — generate area docs + data schema from codebase snapshot, produces reuse inventory
9. `grimoire-bug` — disciplined bug fix: reproduce with failing test, classify (code bug vs spec gap), fix, verify
10. `grimoire-commit` — write contextual commit messages from staged diff + grimoire change context

## Workflow
draft → plan → **review** (optional) → apply → verify → archive

## CLI Commands
- `grimoire init [path]` — scaffold directories, auto-detect tools, install AGENTS.md + skills, generate config.yaml
- `grimoire update [path]` — refresh AGENTS.md + skills to latest version
- `grimoire list [--features|--decisions|--changes]` — show what exists, detect conflicts
- `grimoire status <change-id>` — manifest status, branch, artifact status, task progress (JSON for LLM)
- `grimoire validate [change-id] [--strict]` — validate Gherkin (incl. Scenario Outline), MADR, manifests
- `grimoire archive <change-id> [-y]` — sync to baseline, archive manifest
- `grimoire map [--duplicates] [--refresh]` — structural codebase scan, produces .snapshot.json
- `grimoire check [steps...] [--continue] [--skip] [--json]` — run pre-commit pipeline (lint, format, duplicates, complexity, tests, LLM reviews)
- `grimoire log [--from] [--to] [--json]` — generate change log / release notes from archived changes
- `grimoire trace <file[:line]> [--json]` — trace a file back to the grimoire change that created it
- `grimoire docs [-o path]` — generate human-readable project overview from all grimoire artifacts
- `grimoire health [--json] [--badges file]` — project health score with grimoire coverage metrics and shields.io badges

## Open Questions
- How do we handle Background sections that need to change across features?
- Should the archive keep the proposed .feature files or just the manifest? (Git has the history either way)
- How does this integrate with CI? (run features as part of test suite — probably just `pytest --bdd` in CI)
- Should decisions be numbered globally or per-capability?
- How do we handle decisions that get superseded? (MADR has a status field for this)
