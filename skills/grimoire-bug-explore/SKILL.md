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
- User says "onboard", "where do I start testing?", "what's risky?" → onboard mode

## Routing
- Want a focused, timeboxed testing session with live tracking → `grimoire-bug-session`
- Found a specific bug during exploration → `grimoire-bug-report` to file it
- Want to fix a known bug → `grimoire-bug`
- Analyzing a filed bug report → `grimoire-bug-triage`

## Prerequisites
- A grimoire project with feature files in `features/`
- For developer mode: code exists to analyze (not just specs)
- For tester/onboard mode: feature files are sufficient

## Modes

This skill operates in three modes:

- **Tester mode** (default) — Spec-only analysis. Gap analysis, negative scenarios, cross-feature risks, and existing automation coverage. No code reading required. Suitable for testers who don't read source code.
- **Developer mode** — activated by `--deep`, or when the user is a developer. Adds code-level analysis (Step 3) on top of everything in tester mode.
- **Onboard mode** — activated by `--onboard` or when a tester is new to the project. Generates a tester's guide: feature areas ranked by risk, what's automated vs manual, recent changes, and open bugs.

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

### 2b. Map Automation Coverage

Help the tester understand what's already automated and what requires manual testing.

For each feature file in scope:
1. **Find step definitions** — grep the test directory for step text patterns from each scenario (e.g., `grep -rn 'valid credentials' tests/` for a step `Given I have entered valid credentials`)
2. **Classify each scenario:**
   - **Automated** — has step definitions with real assertions (not `pass` or `assert True`)
   - **Partially automated** — has step definitions but some steps are stubs or have weak assertions
   - **Not automated** — no step definitions found, or all steps are stubs
3. **Identify automation gaps** — scenarios that exist in specs but have no test automation. These are the things that must be tested manually today.
4. **Identify manual-only areas** — behaviors that are hard to automate (visual layout, UX feel, accessibility, real-device behavior). Flag these as intentionally manual.

Present this as a coverage map:
```markdown
## Automation Coverage: <area>

### Automated (N scenarios)
- ✅ "Scenario name" — `test_file.py:42` (strong assertions)

### Partially Automated (N scenarios)
- ⚠️ "Scenario name" — `test_file.py:58` (weak: only checks `is not None`)
  - Manual check needed: verify the actual values match expected behavior

### Not Automated (N scenarios)
- ❌ "Scenario name" — needs manual testing
  - Suggested manual test: <brief description of what to check>

### Intentionally Manual
- 🖐 Visual/UX checks, accessibility, cross-device behavior
```

This map tells the tester: "Here's what the robots check for you. Here's what only you can catch."

### 3. Analyze Implementation (Developer Mode Only)

> **Skip this step in tester mode.** This requires reading source code.

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

### 8. Onboard Mode (--onboard)

When a tester is new to the project, generate a tester's orientation guide instead of a gap analysis.

1. **Inventory feature areas** — read all feature files and group by area/directory. For each area, summarize what it covers in one sentence.

2. **Rank by risk** — assign a risk level to each area based on:
   - **Recent changes** — `git log --since="2 weeks ago"` the feature area's implementation files. Recently changed = higher risk.
   - **Open bugs** — check `.grimoire/bugs/` for unresolved reports in each area.
   - **Sparse coverage** — areas with few scenarios relative to their complexity (e.g., 2 scenarios covering an entire payment flow).
   - **No automation** — areas where scenarios have no step definitions (from step 2b).

3. **Map automation coverage** — for each area, run step 2b and summarize: "Auth: 12 scenarios, 10 automated, 2 manual. Payments: 8 scenarios, 3 automated, 5 manual."

4. **Highlight recent changes** — list files changed in the last 2 weeks with their feature area. These are where regressions most likely live.

5. **Generate the guide:**
```markdown
# Tester's Guide: <project name>
Generated: <YYYY-MM-DD>

## Feature Areas (ranked by risk)

### 🔴 High Risk
- **<area>** — <summary>. <N> scenarios (<N> automated, <N> manual). <reason for high risk>.

### 🟡 Medium Risk
- **<area>** — <summary>. <N> scenarios (<N> automated, <N> manual). <reason>.

### 🟢 Low Risk
- **<area>** — <summary>. <N> scenarios (<N> automated, <N> manual).

## Recent Changes (last 2 weeks)
- <area>: <what changed> (<commit date>)

## Open Bugs
- <bug-id>: <title> (<area>, <severity>)

## Where to Start
<Recommend the tester start with the highest-risk area that has the least automation — that's where manual testing adds the most value.>
```

## Important
- **This is exploration, not audit.** The goal is to find what's missing, not to grade coverage. Frame findings as opportunities, not failures.
- **Prioritize by risk.** A missing error scenario on a payment flow matters more than a missing edge case on a settings page. Lead with what could hurt users.
- **Suggest scenarios, don't just flag gaps.** "Missing negative scenario for login" is less useful than a concrete Given/When/Then that the team can evaluate.
- **Respect existing coverage.** If an area is well-covered, say so. Don't manufacture findings for completeness.
- **Don't duplicate test-quality.** `grimoire verify` already checks assertion strength and test anti-patterns. This skill focuses on missing coverage, not weak tests.
- **Scope matters.** A full-sweep exploration of a large codebase will produce a lot of findings. Help the user prioritize rather than dumping everything on them.

## Done
When the findings report is presented and the user has acted on findings (write scenarios, file bugs, defer, or dismiss), the workflow is complete. Suggest follow-up actions based on findings.
