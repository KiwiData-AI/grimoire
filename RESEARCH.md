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

Chose npm over Python CLI for cross-platform ease. `npx @kiwi-data/grimoire init` works on any machine with Node — no virtualenv or Python version issues. The consuming projects can be any language; the CLI just scaffolds files and validates structure.

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

## Open Questions

- How do we handle Background sections that need to change across features?
- Should the archive keep the proposed .feature files or just the manifest? (Git has the history either way)
- Should decisions be numbered globally or per-capability?
