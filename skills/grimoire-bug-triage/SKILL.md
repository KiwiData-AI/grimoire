---
name: grimoire-bug-triage
description: Developer triage of bug reports — validate, reject with context, or request more info. Reads from local reports or external tickets (Jira, Linear, GitHub Issues) via MCP. Bridges bug reports to the fix workflow. Use when a developer picks up a bug report.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-bug-triage

Developer-side triage of bug reports. Read a bug report from any source — local `.grimoire/bugs/`, Jira, Linear, GitHub Issues, or pasted text — investigate, and respond with a clear decision: validate (and start fixing), reject (with evidence), or ask for more information.

## Triggers
- Developer wants to triage a bug report
- User says "triage this bug", "look at this bug report", "is this a real bug?"
- User provides a ticket URL or ID (e.g., "triage PROJ-123", "look at #456")
- Loose match: "triage", "investigate bug", "check this report", "validate bug", "reject bug"

## Prerequisites
- A bug report exists in one of these forms:
  - `.grimoire/bugs/<bug-id>/report.md` (created by `grimoire-bug-report`)
  - An external ticket (Jira, Linear, GitHub Issue) — referenced by URL, ID, or key
  - Pasted text, screenshot, or description from the user

## Workflow

### 1. Read the Report

**From local report:** Read `.grimoire/bugs/<bug-id>/report.md` directly.

**From external ticket:** Check `.grimoire/config.yaml` for configured `bug_trackers` with MCP servers:
- **Jira**: use the Jira MCP to fetch the issue by key (e.g., `PROJ-123`). Pull: summary, description, reporter, priority, environment, attachments, comments.
- **Linear**: use the Linear MCP to fetch the issue. Pull: title, description, assignee, priority, labels, comments.
- **GitHub Issues**: use the GitHub MCP to fetch the issue by number. Pull: title, body, labels, comments, linked PRs.
- If multiple trackers are configured, match based on what the user provided (URL domain, key format like `PROJ-`, or `#` prefix for GitHub).

Create a local report in `.grimoire/bugs/<bug-id>/report.md` from the external ticket data. Include the `ticket:` field in frontmatter linking back to the source. Don't require the full template — work with what the ticket provides.

**From pasted text:** Create a local report from whatever the user provided. Fill in what you can, mark gaps.

Understand:
- What behavior is reported
- What behavior is expected
- How to reproduce it
- What severity the reporter assigned
- What environment (dev/qa/staging/production)
- Which feature specs are referenced (if any)

### 2. Investigate

Before making a triage decision, actually look at the code:

1. **Check the referenced specs** — read the feature scenarios the report mentions. Does the spec clearly describe the expected behavior?
2. **Read the relevant code** — find the implementation for the reported area. Does the code match the spec?
3. **Try to reproduce** — if you can run the relevant tests, do so. If there's a test that covers this scenario, does it pass or fail? If testing tool MCPs are configured (e.g., Playwright), consider running the relevant test flow.
4. **Check recent changes** — `git log` the affected files. Was this area changed recently? Could it be a regression?
5. **Check environment context** — if the bug is reported on a specific environment, consider whether the issue is environment-specific (data differences, config differences, infra issues).

### 3. Make a Triage Decision

One of three outcomes:

#### VALIDATE — It's a real bug
The report describes a genuine defect. The code doesn't match the spec, or the behavior is clearly wrong.

1. Update the bug report status to `validated`
2. Adjust severity if the investigation reveals it's more or less serious than reported
3. Write a triage response explaining:
   - **Root cause** (brief — what's actually wrong in the code)
   - **Severity assessment** (agree or reclassify with reasoning)
   - **Scope** (is this isolated or does it affect other areas?)
4. Hand off to `grimoire-bug` for the actual fix (repro test → fix)

#### REJECT — Not a bug
The reported behavior is correct, or the issue is not reproducible.

Rejection **requires evidence**. Never reject with just "works for me" or "by design." Provide one of:

- **By design** — cite the specific feature scenario or decision record that defines this behavior. Quote the spec.
  ```
  Rejected: by design per features/auth/login.feature, scenario "Login rate limiting":
  "Then the account should be locked for 30 minutes"
  The reporter expected immediate unlock, but the spec requires a 30-minute lockout.
  ```

- **Cannot reproduce** — document exactly what you tried, in what environment, with what data. Ask the reporter for more details.
  ```
  Rejected: cannot reproduce.
  Tested: Chrome 125 on macOS, staging environment, user role: admin.
  Steps followed exactly as reported. Login completed successfully with 2FA.
  Request: Can you confirm the user role and whether this happens on every attempt?
  ```

- **Environment issue** — the bug is real but caused by configuration, infrastructure, or external dependencies, not by the application code.
  ```
  Rejected: environment issue.
  The CSV export timeout is caused by the staging database having 10x production data
  due to the recent data migration test. Production is not affected.
  ```

- **Duplicate** — reference the existing bug report or fix.
  ```
  Rejected: duplicate of bug-csv-encoding-utf8 (fixed in commit abc1234, pending release).
  ```

#### NEEDS INFO — Can't decide yet
The report is incomplete or ambiguous. Generate specific follow-up questions — not "can you provide more details?" but:
- "Does this happen with all user roles or just admin?"
- "What CSV file were you exporting? Can you share it or describe the data?"
- "Is the error message exactly 'timeout' or is there a more specific message?"
- "Which environment — dev, staging, or production?"

### 4. Write the Triage Response

Create or update `.grimoire/bugs/<bug-id>/triage.md`:

```markdown
---
decision: <validated|rejected|needs-info>
triaged-by: <name or role>
date: <YYYY-MM-DD>
severity: <original or reclassified>
ticket: <external ticket URL or ID, if applicable>
---

# Triage: <bug-id>

## Decision: <VALIDATED|REJECTED|NEEDS INFO>

## Reasoning
<What you found during investigation. Be specific — cite files, specs, commits.>

## Evidence
<!-- For validated: root cause and scope -->
<!-- For rejected: the spec/test/evidence that shows this isn't a bug -->
<!-- For needs-info: what you tried and what's still unclear -->

## Severity Assessment
- Reporter: <severity>
- Triage: <severity> — <reason if changed>

## Environment Assessment
- Reported on: <environment>
- Reproduced on: <environment(s) where you confirmed it, or "not reproduced">
- Environment-specific: <yes/no — does this only affect certain environments?>

## Next Steps
<!-- For validated: "Proceeding to grimoire-bug for fix" -->
<!-- For rejected: explanation for the reporter -->
<!-- For needs-info: specific questions for the reporter -->
```

### 5. Communicate Back

Check `.grimoire/config.yaml` for configured `bug_trackers` with MCP servers.

**If the bug came from an external ticket:**
- Update the original ticket with the triage decision using the appropriate MCP
- **Validated**: add a comment with the root cause summary and that a fix is in progress
- **Rejected**: add a comment with the full reasoning and evidence. Transition the ticket status if the tracker supports it.
- **Needs info**: add a comment with the specific follow-up questions. Assign back to the reporter if possible.

**If the bug is local-only but trackers are configured:**
- Offer to create an external ticket for validated bugs (developers often want tracking beyond the local file)
- Update the local report's `ticket:` field with the new ticket reference

**If no MCP tools are configured:**
- Tell the developer where the triage response is and let them communicate it manually

### 6. Hand Off (Validated Only)

When a bug is validated, transition to the fix workflow:

1. The triage response becomes context for `grimoire-bug`
2. The developer already has root cause understanding from investigation
3. `grimoire-bug` takes over: write repro test → fix → verify
4. When the fix is complete:
   - Update the local bug report status to `fixed` and reference the fix commit
   - If an external ticket exists, update it (add fix commit reference, transition to resolved/done)

## Important
- **Rejection is not dismissal.** A well-reasoned rejection with evidence is respectful and saves everyone time. A lazy rejection breeds distrust.
- **Don't skip investigation.** Reading the report and immediately saying "I think this is by design" without checking is not triage. Look at the code.
- **Severity can change.** The reporter sees symptoms. The developer sees root cause. A "minor" report might reveal a critical data integrity issue. A "critical" report might be a cosmetic rendering glitch.
- **Environment context matters.** A bug on production needs urgent attention. A bug on dev might be a config issue. Always consider the environment.
- **Keep the audit trail.** Every triage decision is written down with reasoning. Six months from now, someone can see why this was validated or rejected — locally and in the external ticket.
- **One triage per bug.** If new information arrives after a "needs info" response, update the existing triage — don't create a new one.
- **Sync both directions.** If you update the local triage, update the external ticket. If the external ticket gets new comments, incorporate them into your investigation.
