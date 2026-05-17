---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
recorded-by: Claude (backfill via grimoire-audit on 2026-05-17)
---

# Use jscpd for duplicate code detection

## Context and Problem Statement
The grimoire `map` and `health` commands report duplicate code blocks across the repo. The `discover` skill uses the duplicate list to populate "Known Duplicates" sections in area docs. We need a duplicate detector that handles multiple languages, runs without configuration, and writes JSON output we can consume.

## Decision Drivers
- Multi-language out of the box (TS/JS, Python, Go, Rust at minimum)
- JSON output for programmatic consumption
- Runnable as a dev dependency, not a service
- Predictable performance on the repo sizes grimoire targets

## Considered Options
1. **jscpd** — token-based clone detector, JSON output, multi-language
2. **PMD CPD** — JVM-based, mature, requires Java on path
3. **simian** — old, proprietary
4. **Hand-roll** — write our own AST-based detector

## Decision Outcome
Chosen option: **jscpd**, because it's a Node-native dev dep (fits our `package.json`), supports all the languages grimoire targets, emits JSON we can consume with no parsing layer, and the configuration is one file (`.jscpd.json`). It runs as a child process from `src/core/map.ts` so a failure in the detector doesn't crash `grimoire map`.

### Consequences
- Good: One dev dep, no JVM, no extra runtime.
- Good: JSON output drops straight into `.grimoire/docs/.snapshot.json` under `duplicates`.
- Good: The `dupignore` file gives users a path to suppress known-acceptable duplicates without touching code.
- Bad: Token-based detection has false positives on boilerplate (imports, type definitions).
- Bad: Configuration knobs are limited compared to AST-based detectors.

### Cost of Ownership
- **Maintenance burden**: One dev dep; stable cadence.
- **Ongoing benefits**: Duplicates surface automatically during `map`/`health`, which feeds the refactor skill.
- **Sunset criteria**: Revisit if false-positive rate forces us to ignore the report, or if jscpd is abandoned.

### Confirmation
Measurable signals:
- `grimoire map --duplicates` populates the `duplicates.clones` array in `.grimoire/docs/.snapshot.json` on every run
- `grimoire health` "duplicates" metric is computable directly from the snapshot
- `grimoire-discover` reads `duplicates.clones` into area docs' "Known Duplicates" sections without invoking jscpd again
