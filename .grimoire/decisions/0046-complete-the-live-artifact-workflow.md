---
status: proposed
date: 2026-09-03
decision-makers: [Fred]
---

# Complete the live-artifact workflow across CLI and skills

## Context and Problem Statement

ADR 0031 replaced change-folder specification copies with live branch edits and Git history. Several CLI commands and workflow skills still implement the removed storage model. Manifest states, schema projection, alternate workflow entry points, and finalization also express competing ownership rules.

## Decision Drivers

- One authoritative workflow and one home for every artifact.
- Git owns branch diffs and durable change history.
- Active change folders remain ephemeral coordination only.
- Existing commands must not imply copied specifications exist.
- Cleanup should delete obsolete machinery instead of adding compatibility code.

## Considered Options

1. Complete the live-artifact migration and remove copy-based behavior.
2. Preserve old command behavior through a compatibility adapter.
3. Restore proposed specification copies in active change folders.

## Decision Outcome

Chosen option: **complete the live-artifact migration and remove copy-based behavior**, because compatibility would retain the duplicate state ADR 0031 removed.

- Planned changes use Draft → Plan → optional Review → Apply → Verify → PR.
- Draft designs only. Plan projects features, decisions, constraints, and schema changes directly into durable live homes.
- Active change folders contain ephemeral coordination artifacts only.
- Manifest states are `draft`, `approved`, and `implementing`. Folder removal represents finalization; `accepted` remains an ADR status.
- `grimoire validate` validates live durable artifacts and active coordination.
- `grimoire list` and `grimoire status` report coordination without claiming copied specifications.
- `grimoire diff` is removed. Native Git owns branch and working-tree diffs.
- Alternate workflow skills produce findings or route into the standard lifecycle. They do not create durable artifacts before Plan.

### Consequences

- Good: CLI behavior matches the documented artifact model.
- Good: Schema facts no longer have a change-local second home.
- Good: Every skill has one stage owner and one transition path.
- Good: Removing obsolete code reduces maintenance and validation branches.
- Bad: Users of `grimoire diff` must use native Git.
- Bad: Existing active changes using proposed copies require manual migration.

### Quality Attributes

| Attribute | Target | Measurement |
|-----------|--------|-------------|
| Consistency | No shipped copy-based workflow | Contract tests and repository searches find no proposed artifact paths |
| Maintainability | One lifecycle definition | Skills link to stage owners and shared references instead of restating mechanics |

### Cost of Ownership

- **Maintenance burden**: Keep CLI contract tests, skills, generated documentation, and metadata aligned with the live-artifact model.
- **Ongoing benefits**: Fewer commands, fewer artifact states, and fewer contradictory instructions.
- **Sunset criteria**: Revisit only if Git cannot provide required diff or history behavior.

### Confirmation

- CLI tests prove validation reads live artifacts and list/status report coordination only.
- CLI registration and documentation omit `grimoire diff`.
- Skill contract tests reject proposed artifact copies, change-local schema copies, alternate stage ownership, and obsolete manifest states.
- Generated documentation accurately identifies executable and manual features.
- Npm package metadata identifies version `0.4.1`; marketplace metadata describes the current spike/testing policy.
