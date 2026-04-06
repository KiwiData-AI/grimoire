# Grimoire

**BDD-powered AI coding assistant.** Everything you need to maintain solid, well-tested code when building with LLMs.

Grimoire solves the [11 most common problems](#problems-grimoire-solves) with AI-assisted development: context window limits, hallucinations, regressions, fix loops, style drift, poor codebase navigation, security gaps, and the "vibe coding" debt crisis. It does this by making every code change start with a spec and end with a passing test.

```
Your request → Gherkin spec → Implementation plan → Red-green BDD → Verified, auditable code
```

<!-- GRIMOIRE:HEALTH:START -->
<!-- GRIMOIRE:HEALTH:END -->

## Why Grimoire

AI coding agents are powerful but undisciplined. Without structure, they hallucinate APIs, break existing features, write tests that prove nothing, and produce codebases nobody understands. The bigger the codebase, the worse it gets.

Grimoire adds the missing discipline:

- **Specs before code** — every behavior is a Gherkin `.feature` file that doubles as an executable acceptance test
- **Plans before implementation** — concrete task lists with exact file paths, not "implement the feature"
- **Tests that actually test** — mandatory red-green BDD cycle with assertion quality checks
- **Codebase knowledge without exploration** — area docs, data schemas, and symbol maps so the AI doesn't waste context reading files
- **Full audit trail** — every commit traces back to a requirement via git trailers
- **Architecture decisions on record** — MADR decision records so the AI doesn't re-litigate choices

Works with **any AI coding agent** that reads AGENTS.md: Claude Code, Cursor, Codex, Windsurf, Cline, Aider, and more.

## Install

```bash
npm install -g @kiwi-data/grimoire
```

## Quick Start

```bash
cd my-project
grimoire init          # Auto-detect tools, configure checks, install skills
grimoire map --symbols # Scan codebase + extract function signatures
```

Then talk to your AI assistant:

```
You: "Users should be able to log in with 2FA"

→ /grimoire:draft    Creates login.feature with Given/When/Then scenarios
→ /grimoire:plan     Generates tasks: write step defs, then production code
→ /grimoire:review   (optional) Product, security, and engineering review
→ /grimoire:apply    Implements with strict red-green BDD
→ /grimoire:verify   Confirms all scenarios pass, no regressions
→ grimoire archive    Syncs to baseline, archives manifest
→ grimoire pr         Generates PR description from artifacts
```

## Problems Grimoire Solves

Based on [industry research](RESEARCH.md) into the most common issues with AI coding agents (April 2026):

| # | Problem | How Grimoire Addresses It | Rating |
|---|---------|--------------------------|--------|
| 1 | **Context window limits** | Area docs + data schema + symbol maps replace raw codebase exploration. Subagent-per-task prevents context bloat. | Partial |
| 2 | **Hallucinations** | Area docs ground the AI in real file paths and function signatures. Verify + check catch consequences. | Partial |
| 3 | **Regressions** | Red-green BDD, verify step, check pipeline, feature branches. Existing tests must keep passing. | **Strong** |
| 4 | **Fix loops** | Max 3 attempts per task with different approaches. After 3 failures, stop and ask the user. | Partial |
| 5 | **Style drift** | Area docs document conventions. Plan references real patterns. Check pipeline enforces linting/formatting. | **Strong** |
| 6 | **Poor codebase navigation** | `grimoire map --symbols` + `/grimoire:discover` gives the AI a structural map without reading every file. | **Strong** |
| 7 | **Security & quality gaps** | Check pipeline: lint → format → duplicates → complexity → tests → security → dep audit → secrets → best practices. | Partial |
| 8 | **Productivity paradox** | Structured workflow (spec → plan → apply) reduces time spent correcting AI output. | Indirect |
| 9 | **Non-determinism** | Specs define success criteria. If the output passes verify + check, it meets the spec regardless of how it got there. | Partial |
| 10 | **Developer experience** | Out of scope (tool-level, not workflow-level). | — |
| 11 | **Vibe coding debt** | Every piece of code traces to a spec, a plan, and a decision. Code nobody understands is structurally impossible. | **Strong** |

## Workflow

### 1. Draft — Define what you're building

Grimoire routes your request to the right format:

- **"Users should be able to log in with 2FA"** → Gherkin feature
- **"We should use PostgreSQL instead of MySQL"** → MADR decision record
- **"The login page is broken"** → `/grimoire:bug` (reproduce first, then fix)

Produces `.feature` files, decision records, `data.yml` for schema changes, and a manifest tracking the change.

### 2. Plan — Generate concrete tasks

Every scenario becomes a pair: write the step definition (test), then write the production code. Tasks reference exact file paths, exact assertions, and real patterns from area docs. Data changes (models, migrations) are ordered before feature code.

The plan skill reads `.grimoire/docs/` to find reusable utilities, coding patterns, and where new code should go — so the AI plans with real codebase knowledge, not guesses.

### 3. Review — Multi-perspective design review (optional)

Four personas validate the change before any code is written:

- **Product manager** — completeness, missing edge cases, unclear requirements
- **Senior engineer** — simplicity, code reuse, architecture fit, task quality
- **Security engineer** — input validation, auth boundaries, vulnerable dependencies, secrets
- **Data engineer** — schema design, migration safety, index coverage (when `data.yml` present)

Issues flagged as **blocker** or **suggestion**. Skip for small/low-risk changes.

### 4. Apply — Build with strict red-green BDD

For each task:
1. Write the step definition (test)
2. Run it — **must fail** (red). A test that passes immediately is broken.
3. Write production code
4. Run it — **must pass** (green)
5. Test quality check — verify strong assertions, not `assert True`
6. Mark done, move to next task

**Session management:** Each task (or group of 2-3) runs in a fresh subagent to avoid context bloat. `tasks.md` is the coordination mechanism — if the session is interrupted, the next agent picks up where you left off.

**Stuck detection:** After 3 failed attempts with different approaches on a single task, the agent stops and asks for help instead of looping.

### 5. Verify — Confirm everything works

- **Completeness** — all tasks done
- **Correctness** — every scenario has a step definition with real assertions
- **Coherence** — architecture decisions are followed
- **Test quality** — flags weak assertions (`assert True`, `toBeDefined()`), empty bodies, tautological tests
- **Dead features** — specs that exist but code no longer implements

### 6. PR & Archive

`grimoire pr` generates a PR description from manifests, features, decisions, and task progress. Optional `--review` runs an LLM review of the actual diff. `--create` creates via `gh` or `glab`.

`grimoire archive` syncs features to baseline, accepts decisions, updates data schema, and archives the manifest.

## Codebase Intelligence

### Symbol Extraction

```bash
grimoire map --symbols      # Extract function signatures, classes, exports
grimoire map --compress     # Also generate compressed .symbols.md
```

Extracts the API surface of your codebase — function signatures, class definitions, methods, exports, and constants across Python, TypeScript, JavaScript, Go, and Rust. No native dependencies.

The symbol map feeds into area docs and the plan skill, giving the AI function-level knowledge of the codebase without reading every source file.

### Area Docs (for LLMs)

`grimoire map` + `/grimoire:discover` generates docs in `.grimoire/docs/`:

- Purpose and boundaries of each module
- Key files with responsibilities
- **Reusable code inventory** — exact function names, file paths, line numbers that MUST be reused
- Naming conventions and structural patterns
- Where new code of each type should go
- Known duplicate code

The plan and apply skills read these instead of exploring the raw codebase — dramatically reducing context usage and hallucinations.

### Data Schema

`.grimoire/docs/data/schema.yml` — your entire data layer in one file:

```yaml
users:
  type: table
  source: src/models/user.py:12
  fields:
    id: { type: integer, pk: true }
    email: { type: varchar, unique: true, not_null: true }
    role: { type: enum, values: [admin, member, guest] }

stripe_payments:
  type: external_api
  schema_ref: https://stripe.com/docs/api/charges
  client: src/integrations/stripe.py
```

Works for SQL tables, document collections, and external API contracts. The AI reads this instead of model files.

### For Humans

`grimoire docs` generates `.grimoire/docs/OVERVIEW.md` — project summary, architecture, features, data model, decisions, recent changes, and active work in one browsable document.

## Pre-Commit Pipeline

```
grimoire check

  lint             ✓ passed   (0.8s)
  format           ✓ passed   (0.3s)
  duplicates       ✓ passed   (1.2s)
  complexity       ✓ passed   (0.5s)
  unit_test        ✓ passed   (3.4s)
  bdd_test         ✓ passed   (2.1s)
  security         ✓ passed   (12.1s)
  dep_audit        ✓ passed   (1.0s)
  secrets          ✓ passed   (0.4s)
  best_practices   ✓ passed   (8.2s)

  9 passed, 0 failed, 1 skipped
```

Tools are auto-detected during `grimoire init`. Supports linters, formatters, test frameworks, duplicate detection (jscpd), complexity analysis, security scanners, dependency auditing (npm audit, pip-audit, safety), secret detection (detect-secrets, gitleaks, trufflehog), and LLM-based reviews.

### Hooks

`grimoire init` sets up enforcement hooks:

- **Claude Code** — `.claude/hooks.json` with pre-commit checks and trailer verification
- **Git** — `.git/hooks/pre-commit` as fallback for other agents/editors

## Test Quality Intelligence

```bash
grimoire test-quality              # Analyze all test files
grimoire test-quality tests/**     # Specific files
```

Static analysis that catches weak tests before they provide false confidence:

- **Empty bodies** — `pass`, `...`, no-op functions that always pass
- **Missing assertions** — test functions with no `assert`/`expect` calls
- **Weak assertions** — `assert True`, `toBeDefined()`, `is not None`, `len() > 0`
- **Tautological tests** — asserting a value equals itself

Supports Python and JavaScript/TypeScript. Integrated into the apply skill (quality gate per task) and verify skill (test intelligence phase).

## Project Health

```
grimoire health

  features          100%  ██████████  12 scenarios in 5 files
  decisions          89%  █████████░  8/9 current
  area docs          75%  ████████░░  6/8 areas documented
  data schema       100%  ██████████  4 models documented
  test coverage      60%  ██████░░░░  3/5 features have step definitions
  unit coverage      82%  █████████░  82% line coverage
  duplicates           —              2 clones detected
  complexity           —              no high-complexity functions

  Overall            84%  █████████░
```

```bash
grimoire health --badges README.md  # Write shields.io badges
```

## Audit Trail

Every commit includes a `Change:` git trailer:

```
feat(auth): add TOTP verification

Change: add-2fa-login
Scenarios: "Login with valid TOTP code", "Login with expired TOTP code"
```

- **`grimoire trace src/auth.py:42`** — trace any line back through commits → changes → features → decisions
- **`grimoire log`** — release notes from archived changes, filterable by date or git tag

Branches follow `<type>/<change-id>`: `feat/add-2fa-login`, `fix/handle-null-pricing`.

## Agent Configuration

`grimoire init` asks for your preferred agents:

```yaml
# .grimoire/config.yaml
llm:
  thinking:              # Used for planning, review
    command: claude
    model: opus
  coding:                # Used for implementation, checks
    command: claude
    model: sonnet
```

Separate thinking and coding agents let you use a stronger model for design and a faster model for implementation (like Aider's Architect mode).

## Skills Reference

| Skill | Purpose |
|-------|---------|
| `/grimoire:draft` | Draft features and/or decisions collaboratively |
| `/grimoire:plan` | Generate detailed implementation tasks from specs |
| `/grimoire:review` | Multi-perspective design review (optional) |
| `/grimoire:apply` | Execute tasks with strict red-green BDD |
| `/grimoire:verify` | Post-implementation verification + test quality |
| `/grimoire:audit` | Discover undocumented features and decisions |
| `/grimoire:remove` | Tracked feature removal with impact assessment |
| `/grimoire:discover` | Generate area docs and data schema from codebase |
| `/grimoire:bug` | Disciplined bug fix with reproduction test first |
| `/grimoire:commit` | Contextual commit messages with change trailers |
| `/grimoire:pr` | Generate PR description + optional diff review |

## CLI Reference

| Command | Description |
|---------|-------------|
| `grimoire init [path]` | Initialize grimoire (auto-detects tools, installs skills, sets up hooks) |
| `grimoire update [path]` | Update AGENTS.md, skills, and hooks to latest version |
| `grimoire list` | List active changes (with conflict detection) |
| `grimoire list --features` | List feature files |
| `grimoire list --decisions` | List decision records |
| `grimoire status <id>` | Show change status, branch, and task progress |
| `grimoire validate [id]` | Validate features, decisions, and manifests |
| `grimoire archive <id>` | Archive a completed change |
| `grimoire map` | Structural codebase scan |
| `grimoire map --symbols` | Extract function signatures, classes, exports |
| `grimoire map --compress` | Generate compressed symbol map (`.symbols.md`) |
| `grimoire map --duplicates` | Run jscpd duplicate detection |
| `grimoire map --refresh` | Diff against existing docs, show gaps |
| `grimoire check [steps...]` | Run pre-commit pipeline |
| `grimoire pr [id]` | Generate PR description from change artifacts |
| `grimoire pr --create` | Create PR via gh/glab |
| `grimoire pr --review` | Run post-implementation LLM review of diff |
| `grimoire test-quality [files]` | Analyze test files for quality issues |
| `grimoire log [--from] [--to]` | Generate change log / release notes |
| `grimoire trace <file[:line]>` | Trace file to originating grimoire change |
| `grimoire docs` | Generate human-readable project overview |
| `grimoire health [--badges]` | Project health score with optional badges |

Most commands support `--json` for machine-readable output.

## Multi-LLM Support

Grimoire works with any AI coding assistant that reads AGENTS.md:

- **Claude Code** — full skill support via `.claude/skills/`, hooks via `.claude/hooks.json`
- **Codex, Cursor, Windsurf, Cline, Aider, etc.** — read AGENTS.md for workflow instructions

AGENTS.md is an [open standard](https://agents.md/) supported by 60K+ repos. Grimoire generates and manages the grimoire section within it.

## Walkthrough: A Complete Change

Here's what a full grimoire cycle looks like end-to-end — adding two-factor authentication to an existing login feature.

### 1. Draft

```
You: "Users should verify their identity with a TOTP code after entering their password"
```

The AI runs `/grimoire:draft` and produces:

```
.grimoire/changes/add-2fa-login/
├── manifest.md              # Why, what's changing, scope
├── features/
│   └── auth/
│       └── login.feature    # Updated with 2FA scenarios
└── decisions/
    └── 0003-totp-library.md # Chose pyotp over django-otp
```

**login.feature:**
```gherkin
Feature: Login with two-factor authentication
  As a user
  I want to verify my identity with a second factor
  So that my account is protected from unauthorized access

  Background:
    Given I am a registered user with 2FA enabled

  Scenario: Successful login with valid TOTP code
    Given I have entered valid credentials
    When I enter a valid TOTP code
    Then I should be redirected to the dashboard
    And my session should be marked as fully authenticated

  Scenario: Login rejected with expired TOTP code
    Given I have entered valid credentials
    When I enter an expired TOTP code
    Then I should see an error message "Code expired"
    And I should remain on the verification page

  Scenario: Login rejected with invalid TOTP code
    Given I have entered valid credentials
    When I enter an invalid TOTP code
    Then I should see an error message "Invalid code"
    And I should remain on the verification page
```

You review and approve. Manifest status: `draft` → `approved`.

### 2. Plan

The AI runs `/grimoire:plan`, reads the approved features + area docs + data schema, and generates `tasks.md`:

```markdown
# Tasks: add-2fa-login

> **Change**: Add TOTP-based 2FA to login
> **Features**: auth/login.feature
> **Decisions**: 0003-totp-library.md
> **Test command**: `pytest tests/ -k "auth"`
> **Status**: 0/8 tasks complete

## 1. Data Layer
- [ ] 1.1 Add `totp_secret` field to User model in `src/models/user.py`
      - CharField, nullable, 32 chars
      - Migration: add nullable column (safe for live DB)
- [ ] 1.2 Run `python manage.py makemigrations && python manage.py migrate`

## 2. TOTP Verification
- [ ] 2.1 Write step defs in `tests/step_defs/test_auth.py` for scenario: "Successful login with valid TOTP code"
      - Given: create user with 2FA enabled, generate valid TOTP secret
      - When: POST to `/verify-totp/` with valid code from `pyotp.TOTP(secret).now()`
      - Then: assert response redirects to `/dashboard/` (status 302)
      - Then: assert session `is_2fa_verified` is True
- [ ] 2.2 Implement `VerifyTOTPView` in `src/views/auth.py`:
      - Accept POST with `code` field
      - Validate against user's `totp_secret` using `pyotp`
      - On success: set `session['is_2fa_verified'] = True`, redirect to dashboard
      - On failure: re-render verification page with error

## 3. Error Cases
- [ ] 3.1 Write step defs for scenario: "Login rejected with expired TOTP code"
      ...
- [ ] 3.2 Write step defs for scenario: "Login rejected with invalid TOTP code"
      ...

## 4. Verification
- [ ] 4.1 Run `pytest tests/ -k "auth"` — all new scenarios green
- [ ] 4.2 Run `pytest tests/` — no regressions in existing tests
```

You review and approve.

### 3. Apply

The AI runs `/grimoire:apply`, creates branch `feat/add-2fa-login`, and works through tasks:

```
Task 1.1: Add totp_secret field to User model
  → Editing src/models/user.py
  ✓ Done

Task 2.1: Write step defs for "Successful login with valid TOTP code"
  → Writing tests/step_defs/test_auth.py
  → Running: pytest tests/ -k "successful_login_with_valid_totp"
  ✗ FAILED (red) — good, test correctly fails without production code

Task 2.2: Implement VerifyTOTPView
  → Writing src/views/auth.py
  → Running: pytest tests/ -k "successful_login_with_valid_totp"
  ✓ PASSED (green)
  → Test quality check: assert response.status_code == 302 ✓ strong assertion
  → Marking task 2.2 complete

  ...continues through all tasks...

Task 4.2: Full regression check
  → Running: pytest tests/
  ✓ 47 passed, 0 failed
```

Every commit includes `Change: add-2fa-login` trailer. `tasks.md` is updated in real time.

### 4. Verify

The AI runs `/grimoire:verify`:

```markdown
# Verification Report: add-2fa-login

## Summary
- Scenarios verified: 3
- Decisions verified: 1
- Issues found: 0 critical, 1 suggestion

## Verified Scenarios
- [x] "Successful login with valid TOTP code" — step def in test_auth.py:42
- [x] "Login rejected with expired TOTP code" — step def in test_auth.py:67
- [x] "Login rejected with invalid TOTP code" — step def in test_auth.py:85

## Suggestions
- Consider adding a rate-limiting scenario for repeated failed TOTP attempts

Recommendation: Ready to archive.
```

### 5. PR & Archive

```bash
grimoire pr --create        # Creates PR via gh with full description
grimoire archive add-2fa-login  # Syncs features, accepts decision, archives manifest
```

The feature files move to `features/auth/login.feature` (baseline). The decision moves to `.grimoire/decisions/0003-totp-library.md` with status `accepted`. The manifest is archived to `.grimoire/archive/2026-04-05-add-2fa-login/`.

`grimoire trace src/views/auth.py:42` now shows: commit `abc123` → Change: `add-2fa-login` → features: `auth/login.feature` → decision: `0003-totp-library.md`.

---

## Config Reference

Full `.grimoire/config.yaml` schema. Generated by `grimoire init` with auto-detection.

```yaml
# Grimoire project configuration
version: 1

# Project metadata — used by skills and AGENTS.md
project:
  language: typescript           # Auto-detected: python, typescript, javascript, go, rust
  package_manager: npm           # Auto-detected: npm, yarn, pnpm, uv, poetry, pip, cargo
  commit_style: conventional     # conventional, angular, or custom
  doc_tool: typedoc              # sphinx, mkdocs, typedoc, jsdoc, rustdoc, godoc
  comment_style: tsdoc           # google, numpy, sphinx, jsdoc, tsdoc, pep257

# Where specs live
features_dir: features           # Gherkin feature files
decisions_dir: .grimoire/decisions  # MADR decision records

# AI agent configuration
llm:
  thinking:                      # Used for planning, review, design
    command: claude               # CLI command to invoke the agent
    model: opus                   # Model hint (agent-specific)
  coding:                        # Used for implementation, checks
    command: claude
    model: sonnet

# Tool configuration — each key matches a check step name
tools:
  lint:
    name: eslint                 # Display name
    command: npx eslint .        # Run command (for general use)
    # check_command:             # Override for check pipeline (if different from command)

  format:
    name: prettier
    check_command: npx prettier --check .

  unit_test:
    name: vitest
    command: npx vitest run

  bdd_test:
    name: cucumber-js
    command: npx cucumber-js

  complexity:
    name: eslint-complexity
    command: "npx eslint --rule 'complexity: [warn, 10]' ."

  duplicates:
    name: jscpd
    command: npx jscpd --reporters console

  security:
    name: bandit                 # Or: semgrep, npm audit, or LLM fallback
    command: bandit -r .
    # For LLM-based security review (when no dedicated tool):
    # name: llm
    # prompt: "Review these changed files for security vulnerabilities"

  dep_audit:
    name: npm audit              # Or: pip-audit, safety, yarn audit, pnpm audit
    check_command: npm audit --audit-level=high

  secrets:
    name: gitleaks               # Or: detect-secrets, trufflehog
    check_command: gitleaks detect --no-git
    # For LLM-based secret scanning (when no dedicated tool):
    # name: llm
    # prompt: "Review these changed files for hardcoded secrets..."

  best_practices:
    name: llm                    # Always LLM-based
    prompt: "Review these changed files for best practices violations"

# Check pipeline — ordered list of steps to run
# Each step name must match a key in `tools` above
checks:
  - lint
  - format
  - duplicates
  - complexity
  - unit_test
  - bdd_test
  - security
  - dep_audit
  - secrets
  - best_practices
```

### Tool Config Options

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name or `"llm"` for LLM-based checks |
| `command` | No | Shell command to run the tool |
| `check_command` | No | Override command for the check pipeline (e.g., `prettier --check` vs `prettier --write`) |
| `prompt` | No | Prompt text for LLM-based checks (only when `name: llm`) |

If a tool has neither `command`, `check_command`, nor `name: llm`, the step is skipped with "not configured."

### LLM Config Options

| Field | Description | Default |
|-------|-------------|---------|
| `llm.thinking.command` | CLI command for the thinking agent | `claude` |
| `llm.thinking.model` | Model hint for planning/review | (none — agent default) |
| `llm.coding.command` | CLI command for the coding agent | `claude` |
| `llm.coding.model` | Model hint for implementation | (none — agent default) |

**Backward compatibility:** The legacy flat format `llm: { command: "claude" }` is still supported and maps to both thinking and coding.

---

## Migrating from v0.1

If you initialized a project with grimoire v0.1, run `grimoire update` to get the latest skills and AGENTS.md. The only config change is the LLM format:

**v0.1 format (still works):**
```yaml
llm:
  command: claude
```

**v0.2 format (new features):**
```yaml
llm:
  thinking:
    command: claude
    model: opus
  coding:
    command: claude
    model: sonnet
```

The v0.1 format is automatically mapped to both thinking and coding agents. You only need to update if you want separate agents.

**New check steps:** v0.2 adds `dep_audit` and `secrets` to the default check pipeline. Add them to your `checks` list in `config.yaml` if you want them:

```yaml
checks:
  - lint
  - format
  - duplicates
  - complexity
  - unit_test
  - bdd_test
  - security
  - dep_audit      # NEW — dependency vulnerability scanning
  - secrets        # NEW — hardcoded secret detection
  - best_practices
```

**New CLI commands:** `grimoire pr`, `grimoire test-quality`, `grimoire map --symbols`, `grimoire map --compress`.

**New skill:** `/grimoire:pr` — installed by `grimoire update`.

**Hooks:** Run `grimoire init` again (safe — won't overwrite existing files) to generate `.claude/hooks.json` and `.git/hooks/pre-commit`.

---

## Contributing

### Development Setup

```bash
git clone https://github.com/kiwi-data/grimoire.git
cd grimoire
npm install
npm run build        # Compile TypeScript
npm run dev          # Watch mode
```

### Project Structure

```
grimoire/
├── src/
│   ├── cli/index.ts            # CLI entry point — registers all commands
│   ├── commands/               # Command definitions (thin — delegate to core/)
│   │   ├── init.ts
│   │   ├── map.ts
│   │   ├── check.ts
│   │   ├── pr.ts
│   │   ├── test-quality.ts
│   │   └── ...
│   ├── core/                   # Business logic
│   │   ├── init.ts             # Project initialization + tool detection
│   │   ├── detect.ts           # Auto-detection of linters, formatters, test frameworks
│   │   ├── map.ts              # Codebase scanning + snapshot generation
│   │   ├── symbols.ts          # Symbol extraction (functions, classes, exports)
│   │   ├── check.ts            # Pre-commit pipeline runner
│   │   ├── pr.ts               # PR description generation
│   │   ├── test-quality.ts     # Test quality static analysis
│   │   ├── hooks.ts            # Claude Code + git hook generation
│   │   └── ...
│   └── utils/
│       ├── config.ts           # Config types + loader (with backward compat)
│       └── paths.ts            # Project root detection
├── skills/                     # Claude Code skill definitions
│   ├── grimoire-draft/SKILL.md
│   ├── grimoire-plan/SKILL.md
│   ├── grimoire-apply/SKILL.md
│   ├── grimoire-verify/SKILL.md
│   ├── grimoire-review/SKILL.md
│   ├── grimoire-pr/SKILL.md
│   └── ...
├── templates/                  # Files copied during grimoire init
│   ├── decision.md             # MADR template
│   ├── manifest.md             # Change manifest template
│   ├── example.feature         # Example Gherkin file
│   ├── mapignore               # Default directories to skip
│   └── mapkeys                 # Key file definitions
├── AGENTS.md                   # Universal LLM instructions (installed into projects)
├── bin/grimoire.js             # CLI entry script
└── RESEARCH.md                 # Design notes, industry research, landscape analysis
```

### Adding a New Skill

1. Create `skills/grimoire-<name>/SKILL.md` with trigger, prerequisites, workflow, and important notes
2. Add `"grimoire-<name>"` to the `skillNames` array in both `src/core/init.ts` and `src/core/update.ts`
3. Build and test: `npm run build && node bin/grimoire.js update .`

Skills are pure markdown — they're instructions for the AI, not executable code. The AI reads the SKILL.md and follows the workflow. Keep them specific enough that any LLM can execute without ambiguity.

### Adding a New CLI Command

1. Create `src/commands/<name>.ts` — thin wrapper that parses args and calls core
2. Create `src/core/<name>.ts` — business logic
3. Register in `src/cli/index.ts`
4. Update types in `src/utils/config.ts` if the command needs new config

### Adding a New Tool Detection

1. Add a `detect<Tool>` function in `src/core/detect.ts`
2. Add it to the `checks` array in `detectTools`
3. Add the category to `CATEGORY_LABELS` and `CATEGORY_ORDER` in `src/core/init.ts`
4. Add LLM fallback in `buildDetectedConfig` if appropriate

### Running Tests

```bash
npm test             # vitest (when tests are written)
npm run lint         # eslint
npm run build        # type-check via tsc
```

## Philosophy

- **Features are tests.** A `.feature` file is both the requirement and the acceptance test.
- **Red-green is mandatory.** A test must fail before it passes. If it doesn't fail, it's not a real test.
- **Decisions are documented.** Architecture choices that aren't written down get relitigated.
- **Reproduce before you fix.** Every bug gets a failing test before any code changes.
- **Simple over clever.** Less code, fewer abstractions, smallest surface area.
- **Verify before using.** Confirm imports, functions, and packages exist before writing code that depends on them.
- **Removal is deliberate.** Removing a feature gets the same rigor as adding one.
- **The fix is upstream.** You don't fix codebase entropy by reviewing harder — you fix it by requiring specs before code.

## License

MIT
