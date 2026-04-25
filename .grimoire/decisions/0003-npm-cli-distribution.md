---
status: accepted
date: 2026-04-01
decision-makers: [Fred]
---

# Distribute as npm package, not Python CLI

## Context and Problem Statement
Grimoire needs to be installable on any developer machine regardless of what language their project uses. The CLI scaffolds files and validates structure — it doesn't need to be in the same language as the consuming project.

## Decision Drivers
- Cross-platform ease of installation
- No virtualenv or Python version issues for non-Python projects
- TypeScript is the same language as OpenSpec (reference implementation)
- Node.js >=20 is ubiquitous on developer machines

## Considered Options
1. npm package (TypeScript CLI via Commander.js)
2. Python package (Click or Typer)
3. Go binary (cross-compiled)

## Decision Outcome
Chosen option: "npm package", because `npx @kiwidata/grimoire init` works on any machine with Node — no virtualenv, no Python version management. The consuming projects can be any language.

### Consequences
- Good: Single command install, works everywhere Node exists
- Good: ESM + TypeScript gives good DX for contributors
- Bad: Node.js is a dependency even for non-JS projects
- Bad: Not ideal for environments without Node (rare for developer machines)

### Confirmation
If grimoire can be installed and used on Python, Go, and TypeScript projects without language-specific setup, the decision is validated.
