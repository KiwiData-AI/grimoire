# Grimoire

**Spec-driven AI development framework.** Encodes decades of software engineering discipline — requirements, design review, TDD, change management, traceability — into AI coding workflows so they can't be skipped.

```
Your request → Gherkin spec → Implementation plan → Red-green BDD → Verified, auditable code
```

<!-- GRIMOIRE:HEALTH:START -->
<!-- GRIMOIRE:HEALTH:END -->

## Why Grimoire

The software industry spent decades learning hard lessons about building reliable systems. AI coding agents have abandoned most of these practices, hoping LLMs will magically produce correct code without discipline. They don't — AI-generated code has [1.7x more bugs](RESEARCH.md), [76% of LLM refactoring suggestions are hallucinations](RESEARCH.md), and developers using AI are [19% slower while believing they're faster](RESEARCH.md).

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
npm install -g @kiwidata/grimoire
```

<details>
<summary>Install from source</summary>

Requires Node.js 20+ and git.

```bash
git clone https://github.com/kiwi-data/grimoire.git
cd grimoire
npm install
npm run build
npm link              # makes `grimoire` available globally
grimoire --version    # should print 0.1.2
```

To update after pulling new changes:

```bash
cd /path/to/grimoire
git pull
npm run build

cd /path/to/your-project
grimoire update       # refreshes AGENTS.md + skills to latest
```

To unlink: `npm unlink -g @kiwidata/grimoire`

</details>

## Quick Start

```bash
cd my-project
grimoire init          # Auto-detect tools, configure checks, install skills
grimoire map           # Snapshot codebase structure into .grimoire/docs/
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

<details>
<summary>What <code>grimoire init</code> creates</summary>

Interactive setup that auto-detects your project's tools and asks preferences for commit style, doc generator, AI agents, security tools, and compliance frameworks (OWASP, PCI-DSS, HIPAA, SOC2, GDPR, ISO 27001). Creates:

- `AGENTS.md` — workflow instructions read by AI coding assistants
- `.grimoire/config.yaml` — tool configuration and check pipeline
- `.grimoire/` — decisions, docs, change tracking, archive directories
- `features/` — where Gherkin specs live
- `.claude/skills/` — Claude Code skill definitions (ignored by other agents)
- `.git/hooks/pre-commit` — runs `grimoire check` before commits

Use `grimoire init --no-detect` to skip interactive tool detection. Most unconfigured steps are skipped, but **security, dep_audit, secrets, and best_practices have built-in LLM fallbacks** that run automatically — every project gets baseline security scanning out of the box.

</details>

## Workflow

### 1. Draft — Define what you're building

Grimoire routes your request to the right format:

- **"Users should be able to log in with 2FA"** → Gherkin feature
- **"We should use PostgreSQL instead of MySQL"** → MADR decision record
- **"The login page is broken"** → `/grimoire:bug` (reproduce first, then fix)
- **"A tester found a problem"** → `/grimoire:bug-report` → `/grimoire:bug-triage` → routed fix

Produces `.feature` files (with security tags like `@security`, `@auth`, `@pii`, `@pci-dss` when applicable), decision records, `data.yml` for schema changes, and a manifest tracking the change.

### 2. Plan — Generate concrete tasks

Every scenario becomes a pair: write the step definition (test), then write the production code. Tasks reference exact file paths, exact assertions, and real patterns from area docs. Data changes (models, migrations) are ordered before feature code.

The plan skill reads `.grimoire/docs/` to find reusable utilities, coding patterns, and where new code should go — so the AI plans with real codebase knowledge, not guesses.

### 3. Review — Multi-perspective design review (optional)

Five personas validate the change before any code is written:

- **Product manager** — completeness, missing edge cases, unclear requirements
- **Senior engineer** — simplicity, code reuse, architecture fit, task quality
- **Security engineer** — STRIDE threat analysis, OWASP Top 10 / CWE classification, compliance verification (PCI-DSS, HIPAA, GDPR, SOC2 when configured), input validation, auth boundaries, vulnerable dependencies, secrets
- **QA engineer** — testability, negative scenarios, edge cases, observability, regression risk
- **Data engineer** — schema design, migration safety, index coverage (when `data.yml` present)

Issues flagged as **blocker** or **suggestion**. Security findings tagged with OWASP category and CWE ID. Skip for small/low-risk changes.

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
- **Security compliance** — verifies plan-stage security patterns were followed (parameterized queries, bcrypt, no hardcoded secrets), checks review blockers were addressed, runs OWASP Top 10 surface scan on the diff, validates security-tagged scenarios (`@security`, `@auth`, `@pii`, `@pci-dss`, etc.)
- **Dead features** — specs that exist but code no longer implements

### 6. PR & Archive

`grimoire pr` generates a PR description from manifests, features, decisions, and task progress. Optional `--review` runs an LLM review of the actual diff. `--create` creates via `gh` or `glab`.

`grimoire archive` syncs features to baseline, accepts decisions, updates data schema, and archives the manifest.

## Walkthrough

Full grimoire cycle end-to-end — adding two-factor authentication to an existing login feature.

<details>
<summary>Expand walkthrough</summary>

### Draft

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

### Plan

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
- [ ] 2.2 Implement `VerifyTOTPView` in `src/views/auth.py`

## 3. Error Cases
- [ ] 3.1 Write step defs for scenario: "Login rejected with expired TOTP code"
- [ ] 3.2 Write step defs for scenario: "Login rejected with invalid TOTP code"

## 4. Verification
- [ ] 4.1 Run `pytest tests/ -k "auth"` — all new scenarios green
- [ ] 4.2 Run `pytest tests/` — no regressions in existing tests
```

### Apply

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

  ...continues through all tasks...

Task 4.2: Full regression check
  → Running: pytest tests/
  ✓ 47 passed, 0 failed
```

Every commit includes `Change: add-2fa-login` trailer. `tasks.md` is updated in real time.

### Verify

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

### PR & Archive

```bash
grimoire pr --create        # Creates PR via gh with full description
grimoire archive add-2fa-login  # Syncs features, accepts decision, archives manifest
```

The feature files move to `features/auth/login.feature` (baseline). The decision moves to `.grimoire/decisions/0003-totp-library.md` with status `accepted`. The manifest is archived to `.grimoire/archive/`.

`grimoire trace src/views/auth.py:42` now shows: commit `abc123` → Change: `add-2fa-login` → features: `auth/login.feature` → decision: `0003-totp-library.md`.

</details>

<details>
<summary>Bug walkthrough — report → triage → fix</summary>

Tester hits a failure during exploratory checkout. Developer reproduces, classifies, fixes, hands back for verification.

### Report

Tester runs Playwright against staging and a checkout step fails. They run `/grimoire:bug-report` and paste the Playwright output (or hand it via the Playwright MCP):

```
You: /grimoire:bug-report
     [pastes Playwright failure: timeout on #place-order, screenshot, trace.zip]
```

The skill scans `features/checkout/*.feature` for matching scenarios, references the affected spec, and writes a structured report:

```
.grimoire/bugs/0042-place-order-timeout/
├── report.md           # Reproduction steps, env, severity, spec refs
└── artifacts/
    ├── screenshot.png
    └── trace.zip
```

**report.md** lists: failing scenario (`features/checkout/place-order.feature:23`), exact steps, expected vs actual, env (browser, build SHA), and a confidence note (`high — Playwright trace shows network 504 from /api/orders`).

### Triage

Developer picks it up, runs `/grimoire:bug-triage 0042`. The skill classifies into one of 8 categories (code, infra, config, data, third-party, security, docs, not-a-bug) and routes:

```
Bug 0042: place-order timeout
  Category: CODE (small)
  Root cause hypothesis: missing timeout on outbound payment-provider call
  Spec coverage: place-order.feature covers happy path; no timeout scenario
  Route: /grimoire:bug (reproduce-first fix in current repo)
  Suggested feature gap: add "payment provider unavailable" scenario
```

For `INFRA/CONFIG` it would emit a ticket stub for the platform team. For `SECURITY` it routes to the restricted workflow with confidential handling.

### Fix

Developer runs `/grimoire:bug 0042`. Reproduce-first discipline:

```
1. Write failing test reproducing the bug
   → tests/checkout/test_place_order.py::test_payment_timeout
   → pytest -k test_payment_timeout
   ✗ FAILED — reproduces the timeout

2. Add timeout + retry to PaymentClient.charge()
   → src/checkout/payment.py
   → pytest -k test_payment_timeout
   ✓ PASSED

3. Full regression
   → pytest tests/checkout/
   ✓ 31 passed
```

Skill also drafts the missing scenario into `features/checkout/place-order.feature` (under a `# pending tester sign-off` comment) and appends a tester verification checklist to `report.md`:

```
.grimoire/bugs/0042-place-order-timeout/report.md (verification section)
- [ ] Original Playwright scenario passes against the fix branch
- [ ] New "payment provider unavailable" scenario passes
- [ ] No regression in existing checkout suite
```

Commit trailer: `Bug: 0042-place-order-timeout`. Tester runs through the checklist, marks complete, and the bug archives alongside the change.

</details>

<details>
<summary>PR review walkthrough — multi-persona review of a teammate's PR</summary>

Reviewing PR #312 from a teammate. Run `/grimoire:pr-review 312` (or paste the PR URL).

The skill fetches the diff via `gh pr view 312 --json` + `gh pr diff 312`, loads relevant area docs and feature files, and runs the multi-persona lens (PM, engineer, security, QA, data — same set as `/grimoire:review` on outgoing changes):

```
PR #312: Add bulk export endpoint
  Spec coverage: features/exports/bulk-export.feature ✓ (3 scenarios)
  Decisions referenced: 0021-export-pagination.md ✓

  PM lens          ⚠ scope drift — diff also touches user-search; not in PR description
  Engineering lens ✗ N+1 in src/exports/serializer.py:48 (loop calls user.profile)
  Security lens    ✗ no rate limit on /api/exports/bulk — DoS risk (CWE-770)
  QA lens          ⚠ no scenario for partial-failure path (some rows succeed, some fail)
  Data lens        ✓ schema unchanged
```

Output is structured Markdown ready to paste as a PR comment, or wired through `gh pr comment 312 --body-file review.md`. Each finding includes file:line, severity, and a suggested change — same format the post-implementation review uses on your own diffs (`grimoire pr --review`), so reviewers and authors share one mental model.

</details>

## Scope & Boundaries

Grimoire owns the **inner loop** — the Dev and Sec portions of DevSecOps. Ops is explicitly out of scope.

### What Grimoire covers

| Area | What it does | How |
|---|---|---|
| Requirements engineering | Gherkin specs as executable acceptance tests | Draft skill |
| Architecture decisions | MADR records with cost-of-ownership | Draft skill |
| Design review | Multi-persona review before code is written | Review skill |
| Test-driven development | Strict red-green BDD enforcement | Apply skill |
| Test quality | Static analysis for weak/empty/tautological tests | `grimoire test-quality`, verify skill |
| Regression prevention | All existing tests must pass; regressions block completion | Apply + verify skills |
| Change management | Manifests, task tracking, session resumption, archive | Full lifecycle |
| Traceability | Every commit → change → feature → decision | `grimoire trace` |
| Security review | STRIDE threat modeling, OWASP/CWE tagging at design time | Review + plan + verify skills |
| Security tooling | SAST, SCA, secrets scanning in pre-commit pipeline | `grimoire check` |
| Bug discipline | Reproduce-first fixes, structured triage, confidential security handling | Bug workflow skills |
| Exploratory testing | Gap analysis, coverage mapping, charter-based sessions | Bug-explore + bug-session skills |
| Tech debt tracking | Structured debt register with severity and formal exceptions | Refactor skill |
| CI integration | Spec validation + checks + test quality with GHA annotations | `grimoire ci` |

### What Grimoire does not cover

**Ops is out of scope.** The outer loop — deploy, run, monitor, scale — requires infrastructure and environment management that a repo-local framework cannot own:

- **Deployment automation** — CD pipelines, environment promotion, rollback, blue-green/canary deploys
- **Integration and e2e testing** — need running services, realistic data, and production-like infrastructure
- **Performance and load testing** — requires dedicated infrastructure and load generators
- **Monitoring and observability** — APM, alerting, SLOs, incident response tooling
- **Infrastructure as code** — Terraform, Pulumi, Kubernetes manifests
- **Feature flags and progressive rollout**

Grimoire captures environment context (`.grimoire/docs/context.yml`) so the AI understands deployment topology, and the review skill flags when changes need integration or performance testing. But orchestrating those tests is platform work, not framework work.

### Security model

Grimoire's security capabilities are **AI-mediated at design time**, not static analysis enforcement at build time. The review skill runs STRIDE threat modeling, the plan skill mandates proven security patterns (OAuth2, bcrypt, parameterized queries), and the verify skill checks that guidance was followed. The check pipeline runs SAST/SCA/secrets tools when configured.

This means security coverage depends on: (1) configuring the right tools in your check pipeline, and (2) the AI following its own instructions. Projects that run `grimoire init` with detection get solid defaults. Projects that skip detection should configure `tools.security`, `tools.dep_audit`, and `tools.secrets` in `.grimoire/config.yaml`.

Grimoire does not provide compliance framework enforcement (OWASP ASVS checklists, CWE mapping), SBOM generation, artifact signing, or DAST. These require dedicated security tooling.

## Features

### Codebase Intelligence

```bash
grimoire map                # Structural snapshot (.grimoire/docs/.snapshot.json)
grimoire map --refresh      # Diff against existing docs, show gaps
grimoire map --duplicates   # Run jscpd duplicate detection
grimoire map --depth <n>    # Max directory depth to scan (default 4)
```

Snapshots the directory layout, language mix, and per-area metrics so area docs and plans don't have to re-explore the tree. No native dependencies.

For richer intelligence (call graphs, data flow tracing, dependency analysis), grimoire integrates with [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp). `grimoire init` offers to install it.

### Area Docs & Data Schema

`grimoire map` + `/grimoire:discover` generates docs in `.grimoire/docs/`:

- Purpose and boundaries of each module
- Key files with responsibilities
- **Reusable code inventory** — exact function names, file paths, line numbers
- Naming conventions, structural patterns, where new code goes

`.grimoire/docs/data/schema.yml` captures your data layer — SQL tables, document collections, external API contracts — so the AI reads this instead of model files.

`grimoire docs` generates a browsable `.grimoire/docs/OVERVIEW.md` project summary.

### Pre-Commit Pipeline

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

Auto-detected during `grimoire init`. Any tool can use `name: llm` with a `prompt:` for AI-powered review. Also sets up enforcement hooks for Claude Code (`.claude/hooks.json`) and git (`.git/hooks/pre-commit`).

### Test Quality

```bash
grimoire test-quality              # Analyze all test files
grimoire test-quality tests/**     # Specific files
```

Static analysis catching weak tests: empty bodies, missing assertions, weak assertions (`assert True`, `toBeDefined()`), tautological tests. Supports Python and JS/TS. Integrated into apply (per-task gate) and verify (test intelligence).

### Bug Workflow

<details>
<summary>Full bug lifecycle for teams with testers and developers</summary>

```
Tester finds issue → /grimoire:bug-report → structured report with spec references
                                                    ↓
Developer picks it up → /grimoire:bug-triage → classify root cause
                                                    ↓
                          ┌─────────────┬───────────┼───────────────┐
                          ↓             ↓           ↓               ↓
                      CODE (small)  CODE (big)  INFRA/CONFIG     SECURITY
                      /grimoire:bug  → draft    route to team    confidential fix
                      (repro → fix   manifest   (create ticket)  (restricted workflow)
                       → tester        stub)
                       checklist)
```

**Bug reports** accept output from testing tools (Playwright, Cypress, Postman, k6) via MCP or pasted directly — auto-extracting failed assertions, screenshots, and reproduction steps.

**Triage** classifies into 8 categories (code, infrastructure, configuration, data, third-party, security, documentation, not-a-bug) and routes to the right team. Security issues follow a restricted workflow with confidential handling.

**Bug fixes** (`/grimoire:bug`) follow reproduce-first discipline and generate a tester verification checklist.

**Exploratory testing** (`/grimoire:bug-explore`) operates in tester mode (spec-only gap analysis), developer mode (code-level analysis), and onboard mode (tester's guide).

**Testing sessions** (`/grimoire:bug-session`) provide charter-based exploratory testing with progress tracking, inline bug filing, and structured debrief.

</details>

### Audit Trail

Every commit includes a `Change:` git trailer linking code → commit → change → feature → decision.

```bash
grimoire trace src/auth.py:42   # What requirement introduced this line?
grimoire log --from v1.0        # Release notes from archived changes
```

### Project Health

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

### Contract Testing

The plan, apply, and verify skills enforce a contract-first approach for external APIs:

- **Mock at the HTTP boundary only** — never mock internal code or client wrappers
- **Fixtures must match `schema.yml`** — test data mirrors the documented API contract
- **Contract drift detection** — verify flags when external API changes don't have matching test updates
- **Client code reads only documented fields** — prevents coupling to undocumented API behavior

### Caveman Mode

Token optimization for context-constrained agents. Set `project.caveman` in `.grimoire/config.yaml`:

| Level | Effect |
|-------|--------|
| `none` | Full AGENTS.md instructions (default) |
| `lite` | Trimmed explanations, same workflow |
| `full` | Minimal instructions, experienced users |
| `ultra` | Bare-minimum workflow skeleton |

### Conflict Detection

`grimoire list` detects when multiple active changes modify the same feature file and flags the conflict.

### Debt Register

The refactor skill maintains `.grimoire/debt-register.yml` — a persistent record of tech debt items with severity, Fowler quadrant classification (deliberate/inadvertent × prudent/reckless), fingerprint-based dedup, and aging signals. Formal exceptions live in `.grimoire/debt-exceptions.yml` with optional expiry dates.

### Multi-LLM Support

Grimoire works with any AI coding assistant that reads [AGENTS.md](https://agents.md/) (open standard, 60K+ repos):

- **Claude Code** — skills in `.claude/skills/`, hooks via `.claude/hooks.json`
- **OpenCode** — skills in `.opencode/skills/` (also reads `.claude/skills/` natively)
- **Codex (OpenAI)** — skills in `.agents/skills/`
- **Cursor** — `.cursor/rules/grimoire.mdc` (AGENTS.md derivative)
- **GitHub Copilot** — `.github/copilot-instructions.md` (AGENTS.md derivative)
- **Windsurf, Cline, Aider, etc.** — read `AGENTS.md` for workflow instructions

`grimoire init` prompts for which agents you use and installs skills to the correct path(s) for each. You can also pass `--agent` to select non-interactively:

```bash
grimoire init --agent claude --agent opencode   # skills to both dirs
grimoire init --agent cursor                    # .cursor/rules/grimoire.mdc
grimoire init --agent copilot                   # .github/copilot-instructions.md
```

## Reference

<details>
<summary>Skills</summary>

| Skill | Purpose |
|-------|---------|
| `/grimoire:draft` | Draft features and/or decisions collaboratively |
| `/grimoire:plan` | Generate detailed implementation tasks from specs |
| `/grimoire:review` | Multi-perspective design review (PM, engineer, security, QA, data) |
| `/grimoire:apply` | Execute tasks with strict red-green BDD |
| `/grimoire:verify` | Post-implementation verification + test quality |
| `/grimoire:audit` | Discover undocumented features and decisions |
| `/grimoire:remove` | Tracked feature removal with impact assessment |
| `/grimoire:discover` | Generate area docs and data schema from codebase |
| `/grimoire:refactor` | Find, prioritize, and track tech debt |
| `/grimoire:bug` | Disciplined bug fix with reproduction test first |
| `/grimoire:bug-report` | Structured bug reporting (accepts test tool output) |
| `/grimoire:bug-triage` | Classify and route bug reports |
| `/grimoire:bug-explore` | AI-guided exploratory testing and gap analysis |
| `/grimoire:bug-session` | Charter-based exploratory testing sessions |
| `/grimoire:branch-guard` | Enforce branch hygiene before starting new feature work (also wired as a hook) |
| `/grimoire:commit` | Contextual commit messages with change trailers |
| `/grimoire:pr` | Generate PR description + optional diff review |
| `/grimoire:pr-review` | Review a teammate's PR with the multi-persona lens |

</details>

<details>
<summary>CLI commands</summary>

| Command | Description |
|---------|-------------|
| `grimoire init [path]` | Initialize grimoire (auto-detects tools, installs skills, sets up hooks) |
| `grimoire init --agent <type>` | Add agent (claude/opencode/codex/cursor/copilot, repeatable) |
| `grimoire init --skip-agents` | Skip generating AGENTS.md instructions |
| `grimoire init --skip-skills` | Skip installing skills for selected agents |
| `grimoire init --no-detect` | Skip auto-detection of project tools |
| `grimoire init --install-codebase-memory-mcp` | Mark codebase-memory-mcp as a recommended integration |
| `grimoire init --install-caveman-plugin` | Mark caveman skill plugin as a recommended integration |
| `grimoire update [path]` | Update AGENTS.md, skills, and hooks to latest version |
| `grimoire update --skip-agents\|--skip-skills\|--skip-hooks\|--skip-templates\|--skip-config` | Skip parts of the update |
| `grimoire update --force-templates` | Overwrite existing template files |
| `grimoire list` | List active changes (with conflict detection) |
| `grimoire list --features` | List feature files |
| `grimoire list --decisions` | List decision records |
| `grimoire status <id>` | Show change status, branch, and task progress |
| `grimoire validate [id]` | Validate features, decisions, and manifests |
| `grimoire validate --strict` | Enable strict validation |
| `grimoire archive <id> [-y]` | Archive a completed change (`-y` skips confirmation) |
| `grimoire map` | Structural codebase scan |
| `grimoire map --duplicates` | Run jscpd duplicate detection |
| `grimoire map --refresh` | Diff against existing docs, show gaps |
| `grimoire map --depth <n>` | Max directory depth to scan (default 4) |
| `grimoire check [steps...]` | Run pre-commit pipeline |
| `grimoire ci` | Run CI pipeline |
| `grimoire ci --setup` | Generate `.github/workflows/grimoire.yml` template |
| `grimoire ci --annotations` | Output GitHub Actions annotations |
| `grimoire ci --skip <steps...>` | Skip specific check steps |
| `grimoire pr [id]` | Generate PR description from change artifacts |
| `grimoire pr --create` | Create PR via gh/glab |
| `grimoire pr --review` | Run post-implementation LLM review of diff |
| `grimoire test-quality [files]` | Analyze test files for quality issues |
| `grimoire log [--from <ref>] [--to <ref>]` | Generate change log / release notes |
| `grimoire trace <file[:line]>` | Trace file to originating grimoire change |
| `grimoire diff <id>` | Compare proposed change specs against the baseline |
| `grimoire docs [-o <path>]` | Generate human-readable project overview |
| `grimoire health` | Project health score |
| `grimoire health --badges <file>` | Write shields.io badges into a file (e.g., README.md) |
| `grimoire branch-check` | Branch-guard check (used by hook; `--hook`, `--prompt <text>`) |

Most commands support `--json` for machine-readable output. `grimoire check` also supports `--changed` (only changed files), `--continue` (run all steps even on failure), and `--skip <steps...>`.

</details>

<details>
<summary>Check pipeline tools</summary>

| Check step | What it does | Example tools |
|---|---|---|
| `lint` | Static analysis / linter | eslint, biome, ruff, flake8 |
| `format` | Code formatting | prettier, biome, black, ruff format |
| `unit_test` | Unit test runner | vitest, jest, pytest, go test |
| `bdd_test` | BDD / feature test runner | cucumber-js, behave, pytest-bdd |
| `duplicates` | Copy-paste detection | jscpd |
| `complexity` | Cyclomatic complexity | radon, eslint-complexity |
| `dead_code` | Unused code detection | knip, ts-prune, vulture |
| `doc_style` | Docstring/comment style compliance | Built-in (Google, NumPy, Sphinx, JSDoc, TSDoc) |
| `security` | Security scanner | bandit, semgrep, npm audit, or `name: llm` |
| `dep_audit` | Dependency vulnerability audit | npm audit, pip-audit, safety |
| `secrets` | Hardcoded secret detection | gitleaks, detect-secrets, trufflehog, or `name: llm` |
| `best_practices` | General code review | `name: llm` (LLM-powered) |

</details>

<details>
<summary>Full config schema</summary>

```yaml
# .grimoire/config.yaml

project:
  language: typescript           # Auto-detected: python, typescript, javascript, go, rust
  package_manager: npm           # Auto-detected: npm, yarn, pnpm, uv, poetry, pip, cargo
  commit_style: conventional     # conventional, angular, or custom
  doc_tool: typedoc              # sphinx, mkdocs, typedoc, jsdoc, rustdoc, godoc
  comment_style: tsdoc           # google, numpy, sphinx, jsdoc, tsdoc, pep257
  caveman: none                  # Token optimization: none, lite, full, ultra
  compliance:                    # Compliance frameworks (affects review, plan, verify, check)
    - owasp                      # Options: owasp, pci-dss, hipaa, soc2, gdpr, iso27001
    - gdpr

features_dir: features           # Gherkin feature files
decisions_dir: .grimoire/decisions  # MADR decision records

# Separate thinking (planning, review) and coding (implementation) agents
llm:
  thinking:
    command: claude
    model: opus
  coding:
    command: claude
    model: sonnet

# Tool configuration — each key matches a check step name
tools:
  lint:
    name: eslint
    command: npx eslint .
  format:
    name: prettier
    check_command: npx prettier --check .
  unit_test:
    name: vitest
    command: npx vitest run
  bdd_test:
    name: cucumber-js
    command: npx cucumber-js
  security:
    name: llm
    prompt: "Review these changed files for security vulnerabilities"

# Check pipeline — ordered list of steps (must match keys in tools)
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

# Bug tracking and testing tools
bug_trackers:
  - name: jira
    mcp:
      name: atlassian
      url: https://mcp.atlassian.com/v1/sse
      transport: sse

testing_tools:
  - name: playwright
    purpose: e2e
    mcp:
      name: playwright
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
```

</details>

## Contributing

<details>
<summary>Development setup and project structure</summary>

### Development Setup

```bash
git clone https://github.com/kiwi-data/grimoire.git
cd grimoire
npm install
npm run build        # Compile TypeScript
npm run dev          # Watch mode
npm test             # vitest
npm run lint         # eslint
```

### Project Structure

```
grimoire/
├── src/
│   ├── cli/index.ts            # CLI entry point
│   ├── commands/               # Command definitions (thin — delegate to core/)
│   ├── core/                   # Business logic
│   └── utils/                  # Config, path resolution, helpers
├── skills/                     # Claude Code skill definitions (SKILL.md per skill)
├── templates/                  # Files copied during grimoire init
├── AGENTS.md                   # Universal LLM instructions (installed into projects)
└── bin/grimoire.js             # CLI entry script
```

### Adding a New Skill

1. Create `skills/grimoire-<name>/SKILL.md` with trigger, prerequisites, workflow, and important notes
2. Add `"grimoire-<name>"` to the `skillNames` array in both `src/core/init.ts` and `src/core/update.ts`
3. Build and test: `npm run build && node bin/grimoire.js update .`

Skills are pure markdown — instructions for the AI, not executable code.

### Adding a New CLI Command

1. Create `src/commands/<name>.ts` — thin wrapper that parses args and calls core
2. Create `src/core/<name>.ts` — business logic
3. Register in `src/cli/index.ts`

### Adding a New Tool Detection

1. Add a `detect<Tool>` function in `src/core/detect.ts`
2. Add it to the `checks` array in `detectTools`
3. Add the category to `CATEGORY_LABELS` and `CATEGORY_ORDER` in `src/core/init.ts`

</details>

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
