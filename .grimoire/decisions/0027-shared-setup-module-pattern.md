---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
recorded-by: Claude (backfill via grimoire-audit on 2026-05-17)
---

# Extract shared init/update logic into shared-setup.ts

## Context and Problem Statement
`src/core/init.ts` (first-time setup) and `src/core/update.ts` (refresh in an already-initialised project) share substantial logic: directory scaffolding, AGENTS.md upsert with marker-based blocks, skill installation, template installation. Earlier snapshots showed ~70+ duplicated lines between them. We needed a way to share that logic without forcing one command to import from the other.

## Decision Drivers
- Eliminate the largest duplicate cluster reported by jscpd
- Avoid `init` importing `update` (or vice versa) — they shouldn't be coupled directionally
- Keep the entry points (`initProject`, `updateProject`) readable as orchestrators
- Make the shared helpers reusable for any future command that needs to lay down grimoire files

## Considered Options
1. **Extract to `shared-setup.ts`** — neutral module both commands import
2. **Make `update` call `init`** — overloads `init` with an idempotent path
3. **Class hierarchy** — base class with template methods, `init`/`update` subclasses
4. **Leave duplicated** — accept the duplication

## Decision Outcome
Chosen option: **Extract to `shared-setup.ts`**, because it gives both `init.ts` and `update.ts` a clean, named dependency without making them aware of each other. The module exports verbs (`ensureDirectories`, `installSkillFiles`, `installTemplates`, `upsertAgentsFile`, `upsertManagedBlock`, `buildManagedBlock`, `generateAgentFiles`) that read like a setup vocabulary. Future commands (e.g. a hypothetical `grimoire repair`) can compose the same helpers.

### Consequences
- Good: The largest reported duplicate cluster is gone; the snapshot now shows only small residual clones.
- Good: `init.ts` and `update.ts` read as orchestrators that compose shared steps.
- Good: New init/update logic naturally lands in `shared-setup.ts` rather than being copied into both places.
- Good: Clear convention reinforced in `.grimoire/docs/core.md` — "if it touches files in both flows, put it in shared-setup".
- Bad: Three files instead of two; finding code is one indirection deeper.
- Bad: The module name `shared-setup.ts` is generic — naming it well requires it to keep a narrow purpose.

### Cost of Ownership
- **Maintenance burden**: Minimal; the helpers are stable, small, and tested.
- **Ongoing benefits**: Future "lay down grimoire files" commands have a ready-made toolkit.
- **Sunset criteria**: Revisit if the module bloats past ~15 helpers (split into focused modules then), or if init and update diverge so much that the shared layer is mostly conditionals.

### Confirmation
Measurable signals:
- `.grimoire/docs/.snapshot.json` `duplicates.clones` contains no entry where both files are `src/core/init.ts` and `src/core/update.ts` with `lines ≥ 10`
- Total duplicated lines in `duplicates.totalDuplicatedLines` trends down (or stays flat) across snapshots
- New init/update PRs touch `src/core/shared-setup.ts` rather than copying logic between the two entry points
