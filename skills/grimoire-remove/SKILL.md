# grimoire-remove

Remove a feature or deprecate a decision through a tracked, deliberate change.

## Triggers
- User wants to remove, deprecate, or sunset a feature
- User wants to supersede or retire an architecture decision
- Loose match: "remove", "delete", "deprecate", "sunset", "retire" with feature/decision reference

## Workflow

### 1. Identify What's Being Removed
- Ask the user what they want to remove and why
- Read the existing `.feature` file(s) or ADR(s) being targeted
- Confirm scope: removing an entire feature? Specific scenarios? A decision?

### 2. Assess Impact
Before creating the change:
- **Search the codebase** for code implementing the feature/decision
- **Check other features** — does anything depend on the behavior being removed?
- **Check decisions** — does removing this feature invalidate any ADRs?
- **Check step definitions** — what test code will need to be removed?

Present the impact summary to the user:
> "Removing the document overview tab will affect: `document_review/views.py`, `templates/review/overview.html`, 3 step definitions in `test_document_review.py`, and the 'Document Overview Tab' requirement in `features/documents/review.feature`. The 'Error Detail Modal' feature in the same file is independent and won't be affected."

### 3. Create Removal Change
Scaffold `.grimoire/changes/<change-id>/`:
- Change ID: verb-led with `remove-` prefix (e.g., `remove-legacy-export`)

**Manifest** must include:
```markdown
# Change: Remove <feature/decision>

## Why
[Clear rationale for removal]

## Migration
[How users/systems should handle this going away]
[What replaces it, if anything]
[Timeline if gradual deprecation]

## Feature Changes
- **REMOVED** `<capability>/<name>.feature` — [or specific scenarios]

## Decisions
- **SUPERSEDED** `NNNN-title.md` — [if applicable]
```

**Proposed feature files:**
- Copy the current baseline `.feature` file
- Remove the targeted Feature/Scenarios
- If removing specific scenarios from a feature, the proposed file is the feature WITHOUT those scenarios
- If removing an entire feature file, note it in manifest (no proposed file needed — absence is the proposal)

### 4. Generate Tasks
Create `tasks.md` covering:

```markdown
## 1. Remove Production Code
- [ ] 1.1 Remove <specific code implementing the feature>
- [ ] 1.2 Remove <related templates/components>
- [ ] 1.3 Clean up imports and dead references

## 2. Remove Tests
- [ ] 2.1 Remove step definitions for removed scenarios
- [ ] 2.2 Remove any unit/integration tests specific to this feature
- [ ] 2.3 Update shared steps if affected

## 3. Update Related Artifacts
- [ ] 3.1 Update ADR status to superseded (if applicable)
- [ ] 3.2 Update any features that referenced removed behavior

## 4. Verification
- [ ] 4.1 Remaining feature files still pass
- [ ] 4.2 No dead code / unused imports left behind
- [ ] 4.3 No broken references in other features
```

### 5. Review
Present the full removal plan to the user:
- What's being removed (features, scenarios, decisions)
- What code will be deleted
- What remains untouched
- Migration path

Do NOT proceed without user approval. Removal is destructive.

## Important
- Removal is a first-class operation, not a hack. It gets the same rigor as adding a feature.
- The manifest MUST document WHY something is being removed and what the migration path is.
- Always check for dependencies before removing. Don't orphan related features or break shared steps.
- When removing scenarios from a feature (not the whole feature), the proposed `.feature` file represents the desired end state — the feature minus the removed scenarios.
- After removal, remaining features must still pass. This is verified in the apply stage.
- Archive preserves the removal rationale forever — future developers can understand why something was removed.
