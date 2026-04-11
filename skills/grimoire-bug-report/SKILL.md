---
name: grimoire-bug-report
description: Structured bug reporting for testers. Guides creation of reproducible, context-rich bug reports that link to existing feature specs. Accepts output from testing tools (Playwright, Cypress, etc.) via MCP or directly. Use when a tester or non-developer needs to file a bug.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-bug-report

Guided bug reporting workflow for testers. Produces structured, reproducible bug reports that developers can act on without back-and-forth. Can ingest test tool output (Playwright traces, Cypress screenshots, API responses, performance reports) to auto-populate reports.

## Triggers
- A tester or non-developer wants to report a bug
- User says "report a bug", "file a bug", "I found a bug"
- User pastes test output, a failing test trace, or a screenshot from a testing tool
- Loose match: "bug report", "report issue", "found a problem", "something's wrong", "test failed"

## Prerequisites
- A grimoire project (`.grimoire/config.yaml` exists)
- Ideally, feature files exist in `features/` so the report can reference violated specs

## Workflow

### 1. Check for Test Tool Input

Before starting the interview, check if the reporter is providing output from a testing tool:

**MCP-connected testing tools** — read `.grimoire/config.yaml` for `testing_tools` with MCP servers configured. If a Playwright MCP, Cypress, or other testing tool is available:
- Offer to pull the latest test results, screenshots, traces, or failure logs directly
- Use the MCP tools to get structured failure data (failed assertions, screenshots, network logs, console errors)
- Auto-extract: what failed, reproduction steps (from the test), environment details, and evidence

**Direct test output** — if the reporter pastes or provides:
- Playwright/Cypress test output → extract the failing test name, assertion, screenshot paths, and trace URL
- API test output (Postman, Bruno, curl) → extract endpoint, status code, request/response bodies
- Performance test output (k6, Artillery, Lighthouse) → extract metrics, thresholds breached, and resource URLs
- Any structured test report (JUnit XML, JSON) → extract failing test cases and error messages

**If test tool input is available**, pre-fill as much of the report as possible and confirm with the reporter rather than asking them to re-describe what the tool already captured. Skip to step 1b for any gaps.

### 1b. Gather Bug Details (Interview)

Walk the reporter through a structured interview for anything not already captured from test tools. Ask these one section at a time — don't dump a template and ask them to fill it out.

**What happened?**
- What did you observe? (actual behavior)
- What did you expect instead? (expected behavior)

**How do you trigger it?**
- Step-by-step reproduction: what actions, in what order?
- Is it consistent or intermittent?

**Where does it happen?**
- Which page, endpoint, feature area, or workflow?
- What environment? (see Environment section below)

**How bad is it?**
- **critical** — blocks a core workflow, data loss, security issue
- **major** — significant feature broken, no workaround
- **minor** — feature works but behaves incorrectly in an edge case
- **cosmetic** — visual or text issue, no functional impact

**How often does it happen?**
- **always** — reproduces every time
- **intermittent** — reproduces sometimes (ask: roughly what percentage? any pattern?)
- **rare** — happened once or twice, hard to reproduce
- Intermittent and rare bugs need different investigation strategies — capturing frequency early saves time later.

**Is this a regression?**
- **yes** — "this used to work" (ask: when did it last work? what changed?)
- **no** — never worked, or new feature
- **unknown** — not sure

If yes, this changes priority — regressions mean something broke that was previously working, which usually points to a specific change.

**Is there a workaround?**
- If the reporter has found a way to accomplish their goal despite the bug, capture it explicitly — this unblocks the team while the fix is pending.
- Example: "I can export as PDF instead of CSV" or "clearing the cache fixes it temporarily."

**How many users are affected?**
- **one user** — specific account or configuration
- **some users** — a subset (ask: what do affected users have in common?)
- **all users** — everyone hitting this flow
- This is a severity multiplier — a minor bug affecting all users may outrank a major bug affecting one.

If the reporter provides screenshots, logs, error messages, or network traces — capture those references. Don't require them, but note what's available.

### 1c. Security Screening

After gathering details, check whether this might be a security issue. Look for signals in what the reporter described:

- **Authentication/authorization bypass** — accessing something they shouldn't, or acting as another user
- **Data exposure** — seeing other users' data, PII in logs, sensitive info in error messages
- **Injection** — unusual characters causing unexpected behavior (SQL, XSS, command injection)
- **Credential/secret exposure** — API keys, tokens, or passwords visible in UI, URLs, or logs
- **Privilege escalation** — performing actions above their role (e.g., normal user accessing admin functions)
- **Denial of service** — actions that crash or freeze the system for other users

**If any security signals are detected:**

1. **Warn the reporter** — "This looks like it might be a security issue. Security bugs need special handling to avoid exposing the vulnerability before it's fixed."
2. **Set `security: true`** in the report frontmatter
3. **Don't include exploit details in public trackers** — if the team's bug tracker is public (e.g., public GitHub repo), note that the full reproduction steps are in the local report only. The external ticket should describe the impact without providing a step-by-step exploit guide.
4. **Flag for priority triage** — security issues should skip the queue

The reporter doesn't need to make the security determination themselves. This screening happens automatically based on the described behavior. If in doubt, flag it — it's better to over-flag and have triage clear it than to miss a real vulnerability.

### 2. Match to Feature Specs

Search `features/` for scenarios that describe the expected behavior:

1. Read feature files in the area the bug relates to
2. Identify which scenario(s) the bug violates — quote the specific scenario name(s)
3. If no scenario covers this behavior, note it as a **spec gap** — this is valuable information for triage

This step is what makes grimoire bug reports better than plain text. Linking a bug to its spec removes ambiguity about what "correct" means.

### 3. Check for Duplicates

Before writing the report:
1. Check `.grimoire/bugs/` for existing reports in the same area
2. Check `.grimoire/changes/` for any active bug fixes that might address this
3. If bug trackers are configured in `.grimoire/config.yaml` (`bug_trackers` with MCP), search the external tracker for similar issues
4. Search git log for recent commits mentioning the same area
5. If a potential duplicate exists, flag it to the reporter and ask if it's the same issue

### 4. Write the Bug Report

Create `.grimoire/bugs/<bug-id>/report.md`:

```markdown
---
id: <bug-id>
status: reported
severity: <critical|major|minor|cosmetic>
frequency: <always|intermittent|rare>
regression: <yes|no|unknown>
security: <true|false>
environment: <dev|qa|staging|production>
affected-users: <one|some|all>
reported-by: <name or role>
date: <YYYY-MM-DD>
area: <feature area>
source: <manual|playwright|cypress|postman|k6|other>
ticket: <external ticket URL or ID, if created>
---

# Bug: <short descriptive title>

## What Happens
<Actual behavior — what the reporter observed>

## What Should Happen
<Expected behavior — ideally referencing a feature spec>

## Reproduction Steps
1. <step>
2. <step>
3. <step>

## Environment
- **Target**: <dev|qa|staging|production>
- **Browser/Client**: <browser, OS, API client, mobile device>
- **Config**: <relevant feature flags, user role, tenant, data conditions>
- **Version/Build**: <commit SHA, release tag, deploy timestamp — whatever identifies the build>

## Violated Specs
<!-- Which feature scenarios describe the expected behavior? -->
- `features/<area>/<file>.feature`: "Scenario name"
<!-- Or: No existing scenario covers this behavior (spec gap) -->

## Evidence
<!-- Screenshots, logs, error messages, network traces — whatever the reporter provided -->
<!-- For test tool output: include trace URLs, screenshot paths, assertion details -->
- <evidence description and location>

## Test Tool Output
<!-- Omit this section if the bug was reported manually -->
- **Tool**: <playwright|cypress|postman|k6|other>
- **Test**: <test name or ID that failed>
- **Assertion**: <what the test expected vs what it got>
- **Artifacts**: <paths to screenshots, traces, HAR files, recordings>

## Workaround
<!-- Omit if none. Capture any way the reporter can accomplish their goal despite the bug. -->
<workaround or "None known">

## Reporter Notes
<!-- Anything else the reporter mentioned — related issues, context -->
<notes>
```

**Bug ID format:** `bug-<short-description>` (kebab-case, e.g., `bug-login-timeout-on-2fa`, `bug-csv-export-missing-headers`)

### 5. Confirm with Reporter

Show the completed report to the reporter and ask:
- Does this accurately describe what you saw?
- Anything to add or correct?

Make edits if needed. The goal is that a developer can pick this up without needing to ask the reporter any questions.

### 6. Notify

Check `.grimoire/config.yaml` for configured `bug_trackers` with MCP servers. If available:
- Create a ticket/issue in the configured tracker from the report
- Link the local bug report to the external ticket (update the `ticket:` field in frontmatter)
- Post a notification to the relevant channel if a communication MCP is available

If multiple bug trackers are configured, ask which one to use for this report.

**Security reports get special handling:**
- If the bug tracker is public (e.g., public GitHub repo), do NOT create a public ticket. Use GitHub's private security advisory feature, or create the ticket in a private tracker only.
- The external ticket should describe the **impact** ("users can access other users' data") without the **exploit** ("by changing the user_id parameter in the URL to another user's ID").
- Full reproduction steps stay in the local `.grimoire/bugs/` report only.
- If a private security channel exists (e.g., `#security` Slack channel, private Jira project), notify there instead of the general channel.

If no MCP tools are configured, tell the reporter the report is at `.grimoire/bugs/<bug-id>/report.md` and they can share it however they normally would.

## Important
- **The reporter is not a developer.** Don't ask for stack traces, code references, or technical root causes. Ask for what they saw and how to see it again.
- **Don't diagnose during reporting.** This skill captures the bug. Diagnosis happens in `grimoire-bug-triage`.
- **Severity is the reporter's assessment.** The developer may reclassify during triage, and that's fine.
- **Environment matters.** A bug on production is different from a bug on dev. Always capture which environment.
- **Link to specs, not code.** Feature files are readable by testers. Source code references are not helpful here.
- **One bug per report.** If the reporter describes multiple issues, create separate reports.
- **Test tool output is evidence, not the report.** Even with rich test output, the report should be human-readable. The test output goes in the Evidence/Test Tool Output sections.
