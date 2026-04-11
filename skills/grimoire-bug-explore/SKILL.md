---
name: grimoire-bug-explore
description: AI-guided exploratory testing that finds gaps in feature coverage, generates edge case scenarios, and identifies untested paths. Use when you want to proactively find bugs before users do.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-bug-explore

AI-guided exploratory testing. Systematically analyze feature specs and code to find untested edge cases, missing negative scenarios, and potential failure modes — before they become bug reports.

## Triggers
- User wants to find gaps in test coverage
- User says "what are we missing?", "explore for bugs", "what could break?"
- Loose match: "exploratory testing", "edge cases", "negative scenarios", "what's untested", "find gaps"

## Prerequisites
- A grimoire project with feature files in `features/`
- Code exists to analyze (not just specs)

## Workflow

### 1. Choose Scope

Ask the user what to explore:

- **Specific feature area** — e.g., "explore auth" → focus on `features/auth/` and its implementation
- **Recent changes** — explore areas touched by recent commits (use `git log --since` to find them)
- **Full sweep** — analyze all feature areas (warn that this takes longer)

If the user doesn't specify, default to recent changes — that's where bugs most likely live.

### 2. Analyze Feature Specs

For each feature file in scope:

**Gap analysis:**
- Read every scenario. What behaviors are specified?
- What behaviors are conspicuously absent?
  - **Error cases** — what happens when input is invalid, empty, too long, wrong type?
  - **Boundary conditions** — what about zero, one, max, max+1? Empty lists? Unicode? Special characters?
  - **State transitions** — what about concurrent access? Partial failures? Interrupted operations?
  - **Permissions** — what about unauthorized users? Wrong role? Expired session?
  - **Timing** — what about timeouts? Retries? Race conditions? Clock skew?

**Negative scenario generation:**
For each scenario that describes a happy path, generate the corresponding negative scenarios:
```
Happy: "User logs in with valid credentials"
Missing negatives:
  - Login with wrong password
  - Login with nonexistent email
  - Login with empty fields
  - Login with account locked
  - Login with expired password
  - Login after too many failed attempts
```

### 3. Analyze Implementation

Read the code that implements the features in scope:

**Code-level gap detection:**
- Find error handling paths — are they tested by any scenario?
- Find conditional branches — is every branch exercised by a scenario?
- Find input validation — is each validation rule covered by both a passing and failing test?
- Find external calls (APIs, databases, file I/O) — are failure modes covered?
- Find configuration-dependent behavior — are different config values tested?

**Anti-pattern detection:**
- Catch blocks that swallow errors silently
- Default values that mask missing data
- Type coercion that could hide mismatches
- Fallback behavior that's never tested

### 4. Cross-Feature Interaction

Look for interactions between features that might not be tested:

- Feature A changes state that Feature B depends on — is that handoff tested?
- Shared data models modified by multiple features — are conflicts possible?
- Ordering dependencies — does Feature B assume Feature A ran first?

### 5. Generate Findings Report

Present findings organized by risk, not by area:

```markdown
# Exploratory Testing: <scope>
Date: <YYYY-MM-DD>

## Critical Gaps (likely bugs or high-impact missing coverage)
- **<area>**: <description of what's missing and why it matters>
  - Missing scenario: `<suggested Given/When/Then>`
  - Risk: <what could go wrong>

## Edge Cases (boundary conditions not covered)
- **<area>**: <description>
  - Missing scenario: `<suggested Given/When/Then>`

## Negative Scenarios (error paths not tested)
- **<area>**: <description>
  - Missing scenario: `<suggested Given/When/Then>`

## Cross-Feature Risks (interaction effects)
- **<area A> × <area B>**: <description of potential interaction issue>

## Summary
- <N> critical gaps found
- <N> edge cases identified
- <N> negative scenarios missing
- <N> cross-feature risks noted
```

### 6. Act on Findings

For each finding, offer the user a choice:

- **Write the scenario now** — add a `.feature` scenario covering the gap. This can be done directly (gap fill, like `grimoire-bug` does for spec gaps) without a full grimoire change.
- **File a bug report** — if the finding looks like it might already be broken, use `grimoire-bug-report` to file it.
- **Add to backlog** — note it for later. Don't force action on everything.
- **Dismiss** — the user decides this isn't worth covering.

Batch similar findings — "these 5 missing negative scenarios can all go in one new scenario outline" is better than creating 5 separate items.

### 7. Browser-Based Exploration (Optional)

If a Playwright MCP server or browser automation tool is available:

1. Read the feature scenarios to understand expected flows
2. Execute the flows in an actual browser
3. Try variations: wrong inputs, fast clicking, back button, expired sessions
4. Capture any unexpected behavior as findings

This is optional and only available if the project has browser testing infrastructure configured. Don't suggest it if there's no way to run it.

## Important
- **This is exploration, not audit.** The goal is to find what's missing, not to grade coverage. Frame findings as opportunities, not failures.
- **Prioritize by risk.** A missing error scenario on a payment flow matters more than a missing edge case on a settings page. Lead with what could hurt users.
- **Suggest scenarios, don't just flag gaps.** "Missing negative scenario for login" is less useful than a concrete Given/When/Then that the team can evaluate.
- **Respect existing coverage.** If an area is well-covered, say so. Don't manufacture findings for completeness.
- **Don't duplicate test-quality.** `grimoire verify` already checks assertion strength and test anti-patterns. This skill focuses on missing coverage, not weak tests.
- **Scope matters.** A full-sweep exploration of a large codebase will produce a lot of findings. Help the user prioritize rather than dumping everything on them.
