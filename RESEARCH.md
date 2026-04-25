# Grimoire — Research & Design Notes

Background research and design rationale compiled during grimoire's development. This document preserves context for future conversations and explains the "why" behind design choices.

---

## Common Issues with LLM Coding Agents

Compiled April 2026 from developer discussions (Reddit, Hacker News), academic papers (arXiv), industry reports (IEEE Spectrum, Fortune, CodeRabbit), and developer blogs. These represent the most widely reported problems across tools like Cursor, Copilot, Claude Code, Aider, and Windsurf.

### 1. Context Window & Memory Limitations

The core constraint that cascades into most other problems. A medium-sized codebase exploration (reading 20 files, running tests, parsing output) easily generates 100-150K tokens. Models with 128K windows hit their limit partway through a single task. Performance degrades *before* the advertised limit — a model claiming 200K tokens typically becomes unreliable around 130K. Agents spend ~60% of their time searching for code, not writing it. They lack persistent memory of their action history within a single task.

### 2. Hallucinations & Fabrication

Up to 42% of AI-generated code snippets contain hallucinations — invented function signatures, nonexistent libraries, wrong API parameters. ~5.2% of package suggestions from commercial models don't exist ("slopsquatting"), and attackers have begun registering these hallucinated package names with malware. The model fills gaps in understanding with pattern-matched guesses. When the codebase is too large for the context window, the agent gets a sliced, incomplete view and confabulates the rest. Semantic errors (incorrect conditions, wrong boundaries) are consistent across all models regardless of size.

### 3. Breaking Existing Code / Regressions

75% of AI coding agent maintenance iterations introduce some form of regression. Agents overwrite files, change dependencies, or refactor in ways that introduce subtle bugs. Catastrophic incidents include: Claude Code deleting a developer's entire production setup (2.5 years of records), and a Replit agent wiping data for 1,200+ executives during a code freeze. Agents optimize for the test in front of them without considering downstream consequences.

### 4. The Fix Loop / Infinite Cycling

Agents get stuck repeating the same failed fix indefinitely. The pattern: push a fix → something breaks → push the same or similar fix → cycle. Context blindness means error logs get truncated in the context window, so the agent thinks the error persists even when it's a different error. Agents may "verify" fixes by running commands they think pass but which actually fail silently. Without explicit step limits, timeout constraints, and deduplication, agents will loop until they exhaust token budgets.

### 5. Inconsistent Style & Convention Violations

Without explicit context about codebase conventions, AI uses whatever patterns it considers most common *globally* — mixing error handling patterns, naming conventions, and architectural styles within the same project. Code looks like it was written by a different team on every file. The mitigation requires explicit guidelines files (AGENTS.md, .cursorrules, etc.) and automated linting/formatting enforcement. Most teams don't realize this until the inconsistency is already widespread.

### 6. Poor Performance on Existing/Legacy Codebases

Agents are tuned for generating new code, not navigating existing code. Without firm guardrails, agents "wander off into the wilderness and eventually generate nonsensical, often uncompilable code." Real-world benchmark accuracy: Claude-3 achieved 45.7% on 140 real GitHub tasks; other models scored lower. Complex legacy codebases with institutional knowledge, novel algorithms, subtle integration requirements, and domain-specific problems with sparse training data are where AI tools fail hardest. Runtime bugs are significantly higher in real-world projects vs. synthetic benchmarks.

### 7. Code Quality & Security Vulnerabilities

45% of AI-generated code fails security tests. Python snippets show a 29.5% weakness rate; JavaScript 24.2%. Fortune 50 enterprises saw a 10x increase in security findings per month (1,000 → 10,000+) correlated with AI code adoption. AI-generated code creates 1.7x more bugs than human-written code. Refactoring dropped from 25% of changes in 2021 to 10% in 2024 — a 60% decline — as developers skip cleanup and let AI accumulate debt. Projected $1.5 trillion in technical debt by 2027 largely attributed to AI-generated code.

### 8. The Productivity Paradox

A controlled study found developers using AI were on average 19% slower, yet convinced they were faster. 96% of developers who use coding assistants daily say they don't fully trust AI-generated code, yet keep using it. Senior engineers report spending more time correcting AI suggestions than writing code manually. The initial gains have plateaued as tasks that AI "saves time on" are offset by time spent reviewing, correcting, and debugging AI output.

### 9. Non-Determinism & Unpredictability

The same prompt can produce different results every time. This makes debugging agent behavior nearly impossible — you can't reliably reproduce a failure. CJ's viral "AI Coding Sucks" rant captured widespread developer sentiment: "the joy of programming replaced by frustration with unpredictable LLMs that take shortcuts."

### 10. Developer Experience Frustrations

Usage limits and throttling without notice (Pro subscribers reported weekly caps dropping from 40-50 hours to 6-8 hours). Slow operations (Cursor's git commit message generation taking over a minute). High CPU, memory, and battery drain, especially in larger projects. Incomplete indexing for large projects — dynamic calls and complex inheritance are poorly understood. Loss of developer agency — the joy of programming replaced by "yelling at a black box."

### 11. The "Vibe Coding" Debt Crisis

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

## AI Coding Tools Landscape

Research into what tools, patterns, and approaches developers use to work effectively with AI coding agents (April 2026).

### Spec-Driven Development Tools

| Tool | Type | What it does |
|------|------|-------------|
| **Kiro** (AWS) | IDE | Code OSS-based IDE with Requirements → Design → Tasks workflow using EARS notation. Deep AWS integration. |
| **GitHub Spec Kit** | CLI | Vendor-neutral spec-driven toolkit: Specify → Plan → Tasks → Implement. Works across Copilot, Claude Code, Gemini CLI, Cursor. MIT licensed. |

The spec-driven pattern is gaining adoption: write requirements before code, generate plans from specs, implement from plans. Addy Osmani calls it "waterfall in 15 minutes."

### Codebase Context & Understanding

| Tool | What it does | Key mechanism |
|------|-------------|---------------|
| **Aider repo-map** | Concise map of classes, functions, relationships | Tree-sitter tag extraction, PageRank-style file ranking |
| **Repomix** | Packs entire repo into single AI-friendly file | Tree-sitter compression (~70% token reduction). 22K+ stars. |
| **Sourcegraph Cody** | Enterprise multi-repo AI assistant | "Search-first" RAG over full codebase |
| **Greptile** | Deep codebase-aware PR review | Semantic graph of repositories. 82% bug catch rate. |
| **Augment Code** | Context engine for large codebases | Knowledge graph (not just embeddings) |

The best tools go beyond file listings to extract the API surface — function signatures, class hierarchies, and import relationships. This is what Aider's repo-map and Repomix's Tree-sitter compression do.

### AI Code Review

| Tool | What it does | Notable |
|------|-------------|---------|
| **CodeRabbit** | Automated PR review (free for OSS) | 2M+ repos connected. Highest volume but also highest false-positive rate. |
| **Graphite Agent** | AI review with stacked PRs | <3% unhelpful comment rate. 96% positive feedback. |
| **Qodo** (CodiumAI) | Multi-agent review + test generation | Highest F1 score (60.1%). Persistent Rules System learns your standards. |
| **BugBot** (Cursor) | Parallel PR review | 8 parallel review passes with randomized diff order. 2M+ PRs/month. |
| **GitHub Copilot Code Review** | Native GitHub review | CodeQL + ESLint integration. 1M users in first month. |

Qodo's test generation is differentiated — it generates complete tests with meaningful assertions, not stubs.

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

### Deliberate Omissions

Things grimoire intentionally doesn't do, and why:

- **Full Tree-sitter AST parsing** — Uses regex-based symbol extraction instead. Avoids native dependency (tree-sitter requires compilation). Covers 90% of cases. Can upgrade later if regex proves insufficient.
- **RAG / vector embeddings** — Area docs + symbol maps are a structured alternative. Structured data is more predictable and debuggable than vector search.
- **IDE integration** — CLI + skills, not an IDE plugin. Works with any editor/agent via AGENTS.md.
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

## Design Decisions

Key design choices and the rationale behind them.

### Gherkin + MADR (two-format repo)

Behavioral requirements live in `.feature` files, architecture decisions in MADR format. Gherkin is executable (Cucumber, pytest-bdd, Behave), MADR is structured and parseable (YAML frontmatter, required sections). Neither format alone covers both concerns.

OpenSpec uses a custom WHEN/THEN markdown format that isn't executable. Gherkin's `Given/When/Then` captures preconditions explicitly and has a mature tool ecosystem. MADR is the most structured ADR format — YAML frontmatter enables validation, status tracking, and tooling.

### Features at root, everything else in .grimoire/

`features/` must be at project root for BDD framework compatibility (Behave requires `steps/` inside features dir). Everything else (decisions, docs, config, changes, archive) consolidates under `.grimoire/`.

### Manifests over deltas

OpenSpec uses ADDED/MODIFIED/REMOVED sections within spec files. Grimoire uses a manifest.md that describes the change + proposed `.feature` files that represent the FULL desired state. Simpler mental model: manifest = why, proposed features = what. No delta chain to replay.

### npm CLI for distribution

Chose npm over Python CLI for cross-platform ease. `npx @kiwidata/grimoire init` works on any machine with Node — no virtualenv or Python version issues. The consuming projects can be any language; the CLI just scaffolds files and validates structure.

### Multi-LLM via AGENTS.md

AGENTS.md is the universal instruction file. Tool-specific skills (Claude Code's SKILL.md) are thin wrappers. Any LLM can follow the workflow by reading AGENTS.md. `grimoire init` writes managed block markers (`<!-- GRIMOIRE:START/END -->`) so grimoire instructions coexist with other content.

### Strict red-green BDD

LLMs are notorious for writing tests that always pass — empty step definitions, trivial assertions, mocked-out everything. The apply skill enforces: every step definition MUST fail before production code is written. If a test passes immediately, it's broken. Anti-patterns are explicitly called out: `pass` bodies, `assert True`, circular assertions, swallowed exceptions.

### tasks.md IS the plan (no re-planning)

LLMs tend to enter plan mode even when a plan already exists. Grimoire addresses this:
- Explicit instructions: "tasks.md IS the plan. Do not re-plan."
- Plans are detailed enough to execute without thinking (exact file paths, exact assertions)
- Resume-friendly format: context block at top, `- [x]` for done, next agent finds first `- [ ]`

### Audit skill for existing codebases

`/grimoire:audit` crawls the codebase to discover undocumented features and implicit architecture decisions. It interviews the user in batches of 3-5 findings rather than dumping a massive list. Primary onboarding path for adding grimoire to an existing project.

### Feature removal as first-class operation

Removing a feature gets the same rigor as adding one — tracked change with manifest (documenting WHY and migration path), impact assessment, and cleanup tasks.

### Mandatory git trailers for audit trail

Every commit during a grimoire change MUST include `Change: <change-id>` as a git trailer. This is what makes `grimoire trace` and `grimoire log` work. Standard git trailers, parseable by `git log --format="%(trailers)"`.

### Data schema as YAML

Chose YAML over DBML because it handles both SQL tables and document stores (Mongo, DynamoDB) with nested objects/arrays. Also supports external API contracts with `schema_ref` pointers. YAML is already in the stack and LLMs read/write it trivially.

### Multi-perspective design review

Optional review step with four personas: product manager (completeness), senior engineer (simplicity), security engineer (vulnerabilities), data engineer (schema design, when data.yml present). Each flags issues as blocker or suggestion. Skippable for small/low-risk changes.

### Thinking/coding agent separation

Separate agent configuration for planning/review (thinking) and implementation (coding). Use a stronger model for design and a faster model for implementation — same pattern as Aider's Architect mode.

### Subagent per task in apply

The apply skill spawns a fresh subagent per task (or group of 2-3) to avoid context bloat. `tasks.md` is the coordination mechanism — handoff blocks pass context between sessions.

---

## Gherkin & Architecture Research

### Traceability chain

There is no automatic traceability from `.feature` → production code. The chain is:
```
.feature file → step definitions → support/helper layer → production code
```
Each link is maintained by convention, not tooling. Grimoire adds traceability via git trailers: `grimoire trace` follows code → commit → change → manifest → features → decisions.

### Best practices from the ecosystem

- Step defs organized by **domain concept**, not by feature file (Cucumber explicitly calls feature-coupled step defs an anti-pattern)
- Tags for cross-cutting mapping: `@service-auth`, `@component-billing`
- Feature files describe WHAT, never HOW — architecture lives in the step def / helper layer
- In hexagonal/DDD shops, step defs wire to domain ports, not HTTP endpoints
- Don't encode architecture in .feature files — the manifest notes affected modules; features stay purely behavioral

### Directory conventions

**pytest-bdd (Python):**
```
tests/
  features/
    auth/login.feature
  step_defs/
    conftest.py          # shared/common steps
    test_login.py        # feature-specific steps
```

**Cucumber (general):**
```
features/
  *.feature
  step_definitions/
    customer_steps.rb    # by domain concept
  support/
    env.rb
```

### Fitness functions (making decisions testable)

From "Building Evolutionary Architectures" (Neal Ford et al.):
- ADR says "service layer must not depend on controller layer"
- A test (ArchUnit in Java, import-linter in Python) enforces it
- ADR captures *why*, fitness function enforces *what*

---

## Origin & Inspiration

Grimoire is inspired by OpenSpec's workflow patterns but uses standard formats (Gherkin, MADR) instead of custom markdown. The name comes from medieval books of magic — a spellbook of instructions. Requirements are incantations that conjure software.

### What we borrowed from OpenSpec

- **3-stage workflow:** create → implement → archive (grimoire: draft → plan → apply → verify → archive)
- **CLI as state machine, agent as brain:** The CLI answers "what's possible?" and the agent does the actual work
- **Managed block markers:** AGENTS.md sections bounded by `<!-- GRIMOIRE:START/END -->`
- **Archive pattern:** completed changes move to `archive/YYYY-MM-DD-<name>/`

### Where grimoire diverges

- Gherkin instead of custom WHEN/THEN format (executable specs)
- MADR for architecture decisions (OpenSpec doesn't capture these)
- Red-green BDD enforcement (OpenSpec doesn't enforce test discipline)
- Codebase intelligence (map, symbols, area docs, data schema)
- Pre-commit pipeline and test quality analysis
- Audit trail via git trailers

### Bake project reference

The bake project (`~/Code/kiwi-dev/bake/.claude/commands/`) has mature Django-specific skills (discover, review-best-practices, review-maintainability, deprecation-analysis) that informed grimoire's framework-agnostic equivalents.

---

## AI Tech Debt & Refactoring Tools Landscape

Research into what tools exist for AI-powered tech debt detection, tracking, and refactoring — and where grimoire-refactor fits (April 2026).

### Formal Frameworks for Tech Debt

**There is no "Gherkin for tech debt."** No single dominant machine-readable specification exists. The landscape:

| Format | What it is | Adoption | Grimoire usage |
|--------|-----------|----------|----------------|
| **SARIF** | OASIS standard JSON schema for static analysis results | High (GitHub, Microsoft, SonarQube) | Too heavy for human-authored debt tracking. Could be an export format. |
| **CodeClimate Issue Spec** | JSON schema with categories, severity, remediation_points, fingerprint | Medium (GitLab adopted it) | Borrowed: category taxonomy, severity levels, fingerprint for dedup. |
| **SQALE** | Methodology mapping remediation cost to ISO 25010 quality characteristics | Medium (SonarQube used it) | Informed prioritization ordering. Too formal for a YAML register. |
| **Fowler's Quadrant** | Deliberate/Inadvertent × Prudent/Reckless | High (conceptual) | Adopted: required field when accepting debt via exceptions. |
| **SEI/CMU TDI** | Academic taxonomy: description, consequences, causes, evidence | Low (research only) | Borrowed: `consequences` and `causes` fields in register items. |
| **.snyk / .trivyignore** | Acceptance files with expiry dates and justifications | High (security tools) | Model for `debt-exceptions.yml` — accept with reason, owner, expiry. |
| **Stepsize** | IDE extension for annotating debt inline | Medium | Closest to a formal register. Manual-only, no AI detection. |
| **TechnicalDebtRecords** (GitHub) | Open-source Go tool with 17-field records | Very low | MADR-like in spirit but virtually no adoption. |

Grimoire's register format combines CodeClimate structure (categories, fingerprint) + SEI/CMU fields (consequences, causes) + Fowler quadrant (intent classification) + .snyk pattern (exceptions with expiry).

### AI Coding Assistants — Refactoring Features

| Tool | Detection | AI Refactoring | Debt Register | Exceptions | Workflow |
|------|-----------|---------------|--------------|------------|----------|
| **Cursor** | Duplicates, anti-patterns | Multi-file Composer (10-100+ files) | No | No | IDE only |
| **GitHub Copilot + Code Quality** | CodeQL-based (public preview Oct 2025) | Coding agent (1-2 file changes) | Partial (backlog view) | No | PR checks, quality gates |
| **Sourcegraph Cody** | Codebase-wide context | Batch Changes (multi-repo) | No | No | Enterprise, no free tier |
| **Windsurf** (Cognition AI) | Pattern detection | Cascade agent (multi-file) | No | No | IDE only |
| **Tabnine** | PR-level code review | Chat-based suggestions | No | No | Enterprise only |
| **Amazon Q / AWS Transform** | Migration-scoped | Best for upgrades (1.1B+ lines processed) | No | No | CI/CD native, AWS-centric |
| **JetBrains AI + Junie** | IntelliJ inspections | Autonomous multi-step refactoring | No | No | IDE + new CLI/SDK |

**Key finding:** GitClear research shows Copilot correlates with increased code churn and decreased code reuse — it may *create* debt faster than it removes it. Refactoring dropped from 25% of changes (2021) to 10% (2024) — a 60% decline — attributed to AI-generated code skipping cleanup.

### Dedicated Code Quality / Tech Debt Tools

| Tool | Detection | Refactoring | Register | Exceptions | Pricing |
|------|-----------|-------------|----------|------------|---------|
| **CodeScene** | Best-in-class (hotspots, behavioral, CodeHealth) | ACE agent (newer) | Partial (dashboards, trends) | No | €18/author/mo |
| **SonarQube** | Strong (rule-based, debt-in-minutes, SQALE) | AI CodeFix (GPT-4o/Claude) | Partial (baselines, quality gates) | `//NOSONAR` (no reason/expiry) | Community free, Dev $170/yr |
| **DeepSource** | AI-native, sub-5% false positive rate | Autofix AI | No | No | Free OSS, Team $24/user/mo |
| **Codacy** | SAST, SCA, DAST, secrets | AI Guardrails | No | No | $15/user/mo |
| **CodeClimate** | Duplication, complexity, file health | No | No (GPA scores only) | No | Free OSS, paid from $16/user/mo |
| **Snyk Code** | Security-focused SAST (80% fix accuracy) | AI autofixes | No | `.snyk` policy files | Free tier, Team $25/mo |
| **Qodana** (JetBrains) | 3,000+ IntelliJ inspections in CI | No AI | Partial (baselines) | No | Free Community, $12/contributor/mo |
| **Stepsize** | None (manual annotation) | None | **Yes** (the only real register) | No | Free tier, Team $12/user/mo |
| **Qodo** (CodiumAI, $70M Series B) | Multi-agent review | Test generation | No | No | Enterprise |
| **Byteable** | Semantic graph analysis | Autonomous CI/CD refactoring | Partial (audit trail) | No | Enterprise |

### Claude Code / MCP Skills for Tech Debt

| Skill/Tool | Source | What It Does | Register? |
|------------|--------|-------------|-----------|
| **tech-debt-tracker** | alirezarezvani/claude-skills | 3-component: Scanner, Prioritizer, Dashboard. 4-phase roadmap. | No |
| **Technical Debt Analyzer** | mcpmarket.com | Identifies/quantifies/prioritizes with ROI-based remediation plans. | No |
| **Tech Debt Finder** | mcpmarket.com | Basic code issue identification. | No |
| **/refactor-suggest** | DEV Community | Static analysis for refactoring opportunities ranked by severity. CI-compatible. | No |
| **Code Refactoring Expert** | mcpmarket.com | AI-guided refactoring skill. | No |
| **Claude Command Suite** | qdhenry/Claude-Command-Suite | 216+ commands including `/dev:refactor-code`. | No |

**All existing Claude Code skills treat debt as ephemeral** — scan, report, done. Nothing persists across sessions, nothing tracks status, nothing supports exceptions or acceptance.

### Open Source AI Refactoring

| Project | Approach | Status |
|---------|----------|--------|
| **FlightVin/automated-refactoring** | Cron-based LLM scan → auto PR | Research prototype |
| **llm-refactoring-plugin** | JetBrains plugin using LLMs | Research |
| **oceansen/debtguardian.ai** | GitHub repo scanner for tech/security debt | Early stage |
| **Refact.ai** | Open source (BSD 3-Clause) AI coding agent, self-hostable | Active, model-agnostic |
| **SDK4ED Toolbox** | EU research project: TD principal, interest, breaking point | Academic |

### Academic Research

| Paper | Key Finding |
|-------|-------------|
| **DebtGuardian** (Springer, 2025) | First open-source LLM framework for detecting TD from source code changes. Zero-shot + few-shot prompting with guardrails validation. |
| **PromptDebt** (ACM, 2025) | Identifies "prompt smells" and "prompt requirement smells" as new debt categories specific to LLM projects. |
| **Self-Admitted TD in LLM Software** (arXiv, Jan 2026) | LLM code has median 1,144 days before first self-admitted debt appears. 3 LLM-specific debt types identified. |
| **LLM-Driven Code Refactoring** (Queen's U, 2025) | **Up to 76% of initial LLM refactoring suggestions are hallucinations.** Multi-gate validation required. |
| **Enterprise Architecture Debt via LLMs** (arXiv, April 2026) | Uses LLMs to analyze unstructured documentation for architecture-level debt. |

The Queen's University finding (76% hallucination rate) is critical — grimoire's red-green BDD cycle in the apply phase directly mitigates this. A hallucinated refactoring that breaks behavior will fail the red-green test.

### Where grimoire-refactor Sits

**No existing tool combines all three: AI detection + structured register + exception/acceptance workflow.**

| Capability | grimoire-refactor | Nearest competitor |
|------------|-------------------|-------------------|
| Multi-dimensional scanning (9 categories) | Yes | CodeScene (~6 dimensions) |
| Structured YAML debt register with fingerprint dedup | Yes | Stepsize (UI-based, not file-based) |
| Exception/acceptance with Fowler quadrant | **Unique** | SonarQube `//NOSONAR` (no reason/expiry) |
| Expiring exceptions | **Unique** | `.snyk` (security only) |
| Consequences field (forces "what if we don't fix") | **Unique** | CodeScene shows productivity impact |
| Feeds into plan→apply pipeline | **Unique** | All others: detect → maybe fix ad-hoc |
| Works across LLM agents (Claude, Codex, Cursor) | Yes | CodeScene ACE (IDE only) |
| Hotspot analysis (churn × complexity) | Yes (borrowed from CodeScene's approach) | CodeScene (the originator) |

**Competitive advantages:**
1. The exception/acceptance workflow is genuinely novel — no tool in the market lets you formally accept debt with reason, intent classification, owner, and expiry date
2. Pipeline integration closes the loop: detect → register → accept/fix → draft → plan → apply → resolved
3. Red-green BDD in the apply phase mitigates the 76% hallucination rate in LLM refactoring suggestions
4. File-based YAML register works with any editor/agent — no SaaS dependency, no vendor lock-in

**Risks:**
- CodeScene's behavioral analysis is more sophisticated (organizational patterns, knowledge silos) — grimoire's hotspot scan is a simpler approximation
- LLM-driven scanning will have false positives — the triage flow (batches of 3-5, user decides) mitigates this
- Register maintenance requires discipline — monthly re-scans and exception expiry help

### Sources

- CodeScene — codescene.com/manage-and-reduce-technical-debt
- Stepsize — stepsize.com/technical-debt
- SonarQube — docs.sonarsource.com (SQALE, metrics, issue management)
- CodeClimate Analyzer Spec — github.com/codeclimate/platform/blob/master/spec/analyzers/SPEC.md
- SARIF OASIS Standard — docs.oasis-open.org/sarif/sarif/v2.1.0
- SQALE — wikipedia.org/wiki/SQALE
- SEI CMU — sei.cmu.edu/blog/got-technical-debt-track-technical-debt
- Martin Fowler — martinfowler.com/bliki/TechnicalDebtQuadrant.html
- GitHub Code Quality — github.blog/changelog/2025-10-28-github-code-quality-in-public-preview
- AWS Transform — aws.amazon.com/blogs/devops/aws-transform-custom
- GitClear AI Code Quality Report — gitclear-public.s3.us-west-2.amazonaws.com
- Queen's University — LLM-Driven Code Refactoring: Opportunities and Limitations (2025)
- DebtGuardian — Springer (2025)
- PromptDebt — ACM (2025)
- alirezarezvani/claude-skills — github.com
- DEV Community — /refactor-suggest article
- Qodo $70M Series B — techcrunch.com (March 2026)

---

## AI Testing Harnesses for QA Testers

Research into whether an AI harness exists for QA testers — equivalent to how Claude Code/Cursor/Kiro serve developers — but focused on helping human testers be more effective (April 2026).

### The Gap

The AI tooling ecosystem has split into two lanes, neither of which serves QA testers:

1. **Developer harnesses** (Claude Code, Cursor, Kiro, OpenSpec, spec-kit) — help devs *build*
2. **Autonomous QA agents** (QA.tech, Momentic, QA Wolf) — try to *replace* testers entirely

Nobody has built the middle thing: **an AI harness that makes human testers better at their job.** QA Wolf explicitly named this gap in a January 2026 blog post: "AI IDE tools are built for developers, which means everyone else — PMs, execs, and manual testers — is left in the dark."

Industry data: 89% of organizations say they use GenAI in quality engineering, but only 15% have scaled it successfully. 45% of practitioners believe manual testing is irreplaceable. The tools being built are either autonomous agents trying to replace testers or bolt-on AI features in existing SaaS platforms.

### What a Tester Harness Would Look Like

- Read specs/requirements → generate exploratory test charters and session plans
- Guide a tester through a session, suggesting edge cases and areas to probe
- Structure and enrich bug reports in real-time (flag missing repro steps, suggest severity, normalize language)
- Maintain session context ("you already tested the happy path, here are the error paths you haven't hit")
- CLI or lightweight UI, not a heavy SaaS platform
- Structured, machine-readable bug reports that could drive automated reproduction or verification

### Closest Existing Tools

#### Tester-Focused (but not harnesses)

| Tool | What it does | Form factor | Gap |
|------|-------------|-------------|-----|
| **TestKase** (testkase.com) | AI structures bug reports, flags missing info, suggests severity, normalizes language | Web SaaS | No CLI, no session guidance, no spec integration |
| **Bugasura** (bugasura.io) | Exploratory session tracking, auto-bug-logging, context doc uploads | Chrome extension | Browser-only, no spec-driven test planning |
| **Jam** (jam.dev) | One-click bug reports with auto-captured repro steps, console logs, network requests | Browser extension | Capture tool, not a testing assistant |
| **FlowLens** | Captures video, network, console, DOM events; produces "AI-ready bug reports"; integrates with MCP agents | Chrome extension | Capture/export only, no session guidance |
| **TestCollab QA Copilot** (testcollab.com/qa-copilot) | Generates test cases from requirements/screenshots/URLs, has CLI (`qac`) | Web SaaS + CLI | CLI is a pipeline trigger, not a tester workbench |

#### AI-Augmented Test Management (SaaS platforms with AI bolted on)

| Tool | AI Feature | Limitation |
|------|-----------|------------|
| **Qase** (qase.io) | AI test case generation, run management, reporting | Full SaaS, not a tester-centric harness |
| **Testomat.io** | Creates tests from Jira/GitHub issues or plain text | Web-based, developer-consumption focused |
| **BrowserStack Test Management** | AI parses unstructured requirements into test cases | Web-based, enterprise |

#### Autonomous Agents (Replace testers, don't assist them)

| Tool | What it does | Why it's not what we want |
|------|-------------|--------------------------|
| **QA.tech** | Scans app, finds flows, generates and runs tests, creates bug reports | Replaces testers, doesn't empower them |
| **QA Wolf** | Managed QA service with AI | Managed service, not a tool |
| **Momentic** (momentic.ai) | AI agent explores apps, finds critical flows, generates tests | Developer/CI-facing |

#### AI Exploratory Testing (Mostly conceptual)

No purpose-built tools exist. The current state of the art is raw LLM prompting:

- **Xray + AI** describes using AI as a "brainstorming partner" during exploratory sessions — not a standalone tool
- **Kualitee** published "30 Expert AI Prompts for QA Teams" — people are using raw prompts, not products
- Blog posts describe using ChatGPT to generate session-based exploratory test charters (Charter ID, Mission, Areas of Focus, Timebox) — prompt engineering, not tooling

### Structured Bug Reporting Standards

There is no dominant open standard for structured, machine-readable bug reports:

| Format/Tool | What it is | Adoption |
|-------------|-----------|----------|
| **GitHub Issue Forms** | YAML-based templates, validated fields, version-controlled | High (GitHub-only) |
| **GitLab Issue Templates** | Markdown-based, repo-stored, group/instance inheritance | High (GitLab-only) |
| **IEEE 829 Anomaly Report** | Formal standard for defect documentation | Low (heavyweight) |
| **JUnit XML** | De facto CI/CD test result format | High (results only, not reports) |
| **Allure JSON** | Rich test results: nested steps, attachments, labels, links | Medium |
| **TAP** (Test Anything Protocol) | Simple text-based test result protocol | Medium |

Research shows "steps to reproduce" appears in 83% of bug reports in large OSS projects, and structured templates with field descriptions are the #1 requested feature by developers (75%).

### Spec-Driven Testing Tools (adjacent)

| Tool | Type | What it does | Relevance |
|------|------|-------------|-----------|
| **fspec** (github.com/sengac/fspec) | CLI | Gherkin-based "coding factory" that auto-generates tests from Given/When/Then, enforces TDD, has rollback/checkpoints | Closest peer — but developer-facing, not tester-facing |
| **Tessl** (tessl.io) | IDE/CLI | 1:1 spec-to-code mapping, reverse-engineers specs from code, test guardrails | Closed beta, developer-facing |
| **Gauge** (gauge.org, ThoughtWorks) | CLI | Markdown-based test specs (not Gherkin), multi-language, plugin architecture | Open source, but test automation not test assistance |
| **Concordion** (concordion.org) | Library | Plain-English executable specs as "living documentation" | Java/.NET, developer-facing |
| **testRigor** (testrigor.com) | SaaS | Plain English executable test specs, no Gherkin needed | Automation, not tester assistance |

### Grimoire Opportunity

Given grimoire already uses Gherkin for behavioral specs, this is a natural extension:

1. **Specs in → test charters out:** `.feature` files + manifest → exploratory test charters with session plans, edge cases, and risk areas
2. **Structured bug reports as artifacts:** Bug reports as structured files (YAML or Markdown with frontmatter) that live alongside features — traceable via git trailers like changes
3. **Session guidance:** AI reads the spec, knows what's been tested, suggests what to probe next
4. **Bug → change pipeline:** Verified bug report feeds directly into `grimoire draft` as a change request
5. **Report enrichment:** AI flags missing repro steps, suggests severity, checks against existing features for regression indicators

This would make grimoire the first tool to close the full loop: **spec → build → test → report → fix** — all structured, all traceable, all file-based.

### Sources

- QA Wolf — "AI IDEs are simply the wrong tool for the QA job" (January 2026)
- TestKase — testkase.com/blog/ai-better-bug-reports
- Bugasura — bugasura.io/ai-issue-tracker
- Jam — jam.dev/ai
- FlowLens — Chrome Web Store
- TestCollab — testcollab.com/qa-copilot
- Qase — qase.io
- QA.tech — qa.tech
- Momentic — momentic.ai
- Xray — getxray.app/blog/ai-in-exploratory-testing
- Kualitee — kualitee.com/blog/ai/expert-ai-prompts-for-qa-teams
- Gauge — gauge.org
- fspec — github.com/sengac/fspec
- Tessl — tessl.io; Martin Fowler — "Understanding SDD: Kiro, spec-kit, and Tessl"
- ACM — "Bug Report Templates in Open-Source Software" (dl.acm.org/doi/fullHtml/10.1145/3671016.3671401)
- AI Testing Adoption Gap — medium.com (2025-2026 QA Engineers survey)
- TestCollab — "Claude Code for QA Testing: 6 Practical Use Cases"

---

## Open Questions

- How do we handle Background sections that need to change across features?
- Should the archive keep the proposed .feature files or just the manifest? (Git has the history either way)
- Should decisions be numbered globally or per-capability?
