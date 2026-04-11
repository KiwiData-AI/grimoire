---
status: accepted
date: 2026-04-05
decision-makers: [Fred]
---

# Use LLM fallbacks for security, secrets, dep_audit, and best_practices checks

## Context and Problem Statement
Grimoire's check pipeline needs security scanning, secrets detection, dependency auditing, and best practices review. Many projects don't have dedicated tools configured for these. Should grimoire skip unconfigured checks, require tool installation, or provide a fallback?

## Decision Drivers
- Every project should get baseline security scanning out of the box
- Users shouldn't need to install bandit/semgrep/gitleaks just to start
- LLM-based review catches different issues than static tools (contextual understanding vs pattern matching)
- Must not block projects that prefer real tools over LLM checks

## Considered Options
1. LLM fallback — run an LLM with a security/secrets/audit prompt when no tool is configured
2. Require tools — fail or warn until the user configures a real tool
3. Skip unconfigured checks — silently skip checks with no tool
4. Bundle free tools — ship gitleaks/semgrep as dependencies

## Decision Outcome
Chosen option: "LLM fallback", because it gives every project baseline coverage with zero setup. Projects that configure real tools get those instead — the LLM fallback only activates when `name: llm` is set or no tool is configured for a check category. LLM prompts are piped via stdin (see ADR-0006) to avoid shell injection.

### Consequences
- Good: Every `grimoire init` project gets security, secrets, and best practices checks immediately
- Good: No native dependencies to install or manage
- Good: LLM catches contextual issues that pattern-matching tools miss
- Bad: LLM checks are slower and cost tokens
- Bad: LLM checks are non-deterministic — same code may get different findings
- Bad: No SARIF/structured output for CI integration (unlike semgrep or bandit)

### Confirmation
If a project with no security tools configured runs `grimoire check` and gets meaningful security findings from the LLM fallback, the decision is validated.
