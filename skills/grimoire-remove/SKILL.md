---
name: grimoire-remove
description: Remove a feature or deprecate a decision through a tracked, deliberate change. Use when the user wants to decommission functionality with full impact assessment.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-remove

Remove a feature or deprecate a decision through a tracked, deliberate change.

Use `../references/testing-lifecycle.md` for delivery and final-verification ownership after the removal enters the planned-change lifecycle.

## Triggers
- User wants to remove, deprecate, or sunset a feature
- User wants to supersede or retire an architecture decision
- Loose match: "remove", "delete", "deprecate", "sunset", "retire" with feature/decision reference

## Routing
- Feature was never documented → `grimoire-audit` first to establish baseline
- Want to change behavior (not remove it) → `grimoire-draft`
- Want to clean up code quality → `grimoire-refactor`

## Workflow

### 1. Identify What's Being Removed
- Ask the user what they want to remove and why
- Read the existing `.feature` file(s) or ADR(s) being targeted
- Confirm scope: removing an entire feature? Specific scenarios? A decision?

### 2. Assess Impact and Dependents
Before routing the change:
- **Search the codebase** for code implementing the feature/decision
- **Check other features** — does anything depend on the behavior being removed?
- **Check decisions** — does removing this feature invalidate any ADRs?
- **Check step definitions** — what test code will need to be removed?

Present the impact summary to the user:
> "Removing the document overview tab will affect: `document_review/views.py`, `templates/review/overview.html`, 3 step definitions in `test_document_review.py`, and the 'Document Overview Tab' requirement in `features/documents/review.feature`. The 'Error Detail Modal' feature in the same file is independent and won't be affected."

Block removal while active dependents remain. The user must choose whether to remove, migrate, or retain each dependent.

### 3. Approve Deletion Scope
Present the full removal impact to the user:
- What's being removed (features, scenarios, decisions)
- What code will be deleted
- Which dependents were found and how each will be handled
- What remains untouched
- Migration path

Obtain explicit approval for the deletion scope. Do not edit or delete files before approval.

### 4. Route Through the Planned-Change Lifecycle

After approval, route the approved removal through `grimoire-draft` and `grimoire-plan`. Provide the impact assessment, deletion scope, migration path, and dependent resolutions as design input.

Draft owns the removal design. Plan edits live durable artifacts and creates implementation tasks. Remove does not create artifact copies, manifests, or tasks.

## Important
- Removal is a first-class operation, not a hack. It gets the same rigor as adding a feature.
- Draft must document why the removal is needed and its migration path.
- Always check for dependencies before removing. Don't orphan related features or break shared steps.
- Plan edits affected feature files live on the branch after the design is approved.
- After removal, remaining features must still pass. Verify owns final confirmation.
- Git history and decision records preserve the removal rationale.

## Done
When the impact and deletion scope are approved, the workflow is complete. Proceed to `grimoire-draft`, then `grimoire-plan`.
