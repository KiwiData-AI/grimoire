---
status: accepted
date: 2026-07-03
decision-makers: [Fred]
---

# Delegate docstring-format enforcement to pydoclint; make comment policy reach every session

## Context and Problem Statement

Projects declare `comment_style` (sphinx/google/numpy) in `.grimoire/config.yaml`, but agents kept writing docstrings in the wrong format and littering redundant comments. Three gaps: (1) the style never reached agents — it lived only in config.yaml and OVERVIEW.md, neither loaded in a normal coding session; (2) the built-in `doc_style` check emits only `warning` severities and the step fails only on `critical`, so the commit gate could never block format drift; (3) grimoire's hand-rolled regex checks only detect cross-style markers (`Args:` vs `:param`), not whether sections match the function signature. Amends the scope of 0034 (see its amendment note).

## Decision Drivers

- We do not reimplement linters (0034 driver, reaffirmed)
- One authoritative home per fact-type: the project's docstring style must be stated once and reach every agent, every session (0031)
- AGENTS.md is the universal instruction file (0004)
- Legacy codebases must be adoptable without fixing hundreds of files first
- Enforcement must be deterministic at the commit gate

## Considered Options

1. Harden the built-in regex checks (escalate mismatches to `critical`, scope to changed files)
2. Delegate to pydoclint via a configurable `tools.doc_style` command, keep the regex check as zero-config fallback
3. Ruff `pydocstyle` (D) rules
4. Keep advisory-only and rely on prompts

## Decision Outcome

Chosen option: "Delegate to pydoclint", because it validates sphinx/google/numpy styles *and* checks sections against the actual function signature — strictly stronger than the regex check — is pure Python (portable, no native deps), fast, and ships a baseline mode for gradual adoption on drifted codebases. Ruff (option 3) does not support sphinx (astral-sh/ruff#6606). Option 1 reimplements a linter and risks bricking commits on legacy repos. Option 4 is what already failed.

Mechanics:
- `runStep` now honors a configured `tools.doc_style` command (same builtin-override pattern as `complexity`); the built-in regex check remains the zero-config fallback for languages without a configured tool.
- `grimoire init` defaults `tools.doc_style` to `pydoclint --style=<comment_style> .` for Python projects with a supported style, and prints the install command matched to the package manager (uv/poetry/pip). `grimoire update` migrates existing configs the same way (mirrors the `comment_lint` migration).
- Reach: AGENTS.md gains a "Comments" section (comment ladder: no comment → rename → ≤2-line constraint; no comments restating well-named variables; short names; docstring format). `init`/`update` inject a "Project Comment Style" directive naming the project's concrete style into the managed block, and ensure CLAUDE.md carries an `@AGENTS.md` import so Claude Code loads the policy every session.
- `best_practices` LLM review prompt now flags comments that restate adjacent code or identifiers.

### Consequences

- Good: Real signature-aware docstring validation; grimoire's regex rules stop growing
- Good: The commit gate can actually fail on format drift (pydoclint exit code), with `--baseline` for legacy adoption
- Good: Style policy reaches every agent and every session through AGENTS.md and the CLAUDE.md import
- Bad: pydoclint must be installed in the project environment; grimoire prints the command but does not install it
- Bad: Default only covers Python; JS/TS format enforcement needs a manual `tools.doc_style` command (e.g. eslint-plugin-jsdoc)
- Bad: pydoclint does not cover pep257-only style; those projects keep the advisory built-in check

### Confirmation

On a Python project with `comment_style: sphinx`, a commit introducing an `Args:`-style docstring fails `grimoire check doc_style` via pydoclint, and a fresh session's agent writes `:param:` docstrings without being told — the decision is validated.
