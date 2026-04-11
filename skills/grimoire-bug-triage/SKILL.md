---
name: grimoire-bug-triage
description: Triage bug reports — classify the root cause, route to the right team (code, infra, config, data, third-party, docs), and communicate decisions back. Reads from local reports or external tickets via MCP. Use when picking up a bug report.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-bug-triage

Triage bug reports from any source. Investigate, classify the root cause, decide what to do, and route to the right owner. Not every bug is a code defect — triage must distinguish between code, infrastructure, configuration, data, third-party, and documentation issues so the right team acts on it.

## Triggers
- User wants to triage a bug report
- User says "triage this bug", "look at this bug report", "is this a real bug?"
- User provides a ticket URL or ID (e.g., "triage PROJ-123", "look at #456")
- Loose match: "triage", "investigate bug", "check this report", "validate bug", "reject bug", "route this"

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

Before making a triage decision, gather evidence:

1. **Check the referenced specs** — read the feature scenarios the report mentions. Does the spec clearly describe the expected behavior?
2. **Read the relevant code** — find the implementation for the reported area. Does the code match the spec?
3. **Try to reproduce** — if you can run the relevant tests, do so. If there's a test that covers this scenario, does it pass or fail? If testing tool MCPs are configured (e.g., Playwright), consider running the relevant test flow.
4. **Check recent changes** — `git log` the affected files. Was this area changed recently? Could it be a regression?
5. **Check environment context** — if the bug is reported on a specific environment, consider whether the issue is environment-specific (data, config, infra differences).
6. **Check external dependencies** — does the feature depend on a third-party API, service, or library? Could the issue be upstream?

### 3. Classify the Root Cause

Determine what category this issue falls into. This drives routing.

#### CODE — Application defect
The code doesn't match the spec, or the behavior is clearly wrong due to a bug in the application logic.

**Signals:**
- The bug reproduces in tests
- The code path has an obvious logic error, missing edge case, or regression
- `git log` shows a recent change that introduced the issue
- The spec is clear and the implementation diverges from it

#### INFRASTRUCTURE — Platform or deployment issue
The application code is correct, but the environment it runs in is broken or misconfigured.

**Signals:**
- Works locally or in other environments, fails in a specific one
- Related to resources (memory, CPU, disk, network timeouts)
- Deploy pipeline, container, or orchestration issue
- Database server, cache, or queue is degraded
- DNS, load balancer, or certificate problem

**Examples:** staging database overloaded, k8s pod OOM-killed, CDN serving stale assets, Redis connection pool exhausted.

#### CONFIGURATION — Environment or feature config issue
The code is correct and infrastructure is healthy, but the environment is configured wrong.

**Signals:**
- Feature flag is off when it should be on (or vice versa)
- Environment variable is missing, wrong, or pointing to the wrong resource
- Permissions or CORS settings differ between environments
- A migration ran in one environment but not another

**Examples:** `STRIPE_API_KEY` pointing to test mode in production, feature flag `enable-2fa` disabled on staging, missing database migration on QA.

#### DATA — Data integrity or content issue
The code and config are correct, but the data is bad, missing, or in an unexpected state.

**Signals:**
- Only affects specific records, accounts, or tenants
- Data doesn't match expected schema or constraints
- Related to a recent data migration, import, or manual edit
- Null/missing where a value is expected

**Examples:** user record has null email from a botched migration, product has negative price from a CSV import, orphaned foreign key from a deleted parent.

#### THIRD-PARTY — External service or dependency issue
The issue originates outside the application boundary — in a vendor API, library, or upstream service.

**Signals:**
- Third-party status page shows an incident
- API responses from the vendor changed format or started returning errors
- Library behavior changed after an update
- Issue only occurs when the external service is involved

**Examples:** Stripe webhook format changed, SendGrid rate-limiting, a library upgrade introduced a breaking change, OAuth provider returning new error codes.

#### SECURITY — Vulnerability or security defect
The issue has security implications — unauthorized access, data exposure, injection, privilege escalation, or other vulnerabilities. May overlap with CODE, CONFIGURATION, or INFRASTRUCTURE but the security dimension changes how it's handled.

**Check the report's `security: true` flag** — the bug-report skill auto-screens for security signals. But also evaluate during investigation even if the flag wasn't set.

**Signals:**
- Authentication or authorization bypass — accessing resources without proper credentials or acting as another user
- Data exposure — PII, credentials, or internal data visible to unauthorized parties (in responses, logs, error messages, URLs)
- Injection — SQL, XSS, command injection, template injection, SSRF
- Privilege escalation — performing actions above the user's role
- Credential/secret leakage — API keys, tokens, or passwords in source code, logs, client-side bundles, or error responses
- Broken access control — IDOR (insecure direct object references), missing ownership checks, horizontal privilege escalation
- Cryptographic issues — weak hashing, plaintext storage, broken TLS configuration
- Denial of service — unbounded queries, resource exhaustion, regex DoS

**Severity uses a security-specific scale:**
- **critical** — active exploitation possible, data breach risk, auth bypass on production
- **high** — exploitable vulnerability but requires specific conditions or authenticated access
- **medium** — security weakness that increases risk but isn't directly exploitable (e.g., missing rate limiting, verbose error messages leaking internals)
- **low** — defense-in-depth improvement, hardening recommendation (e.g., missing security headers, overly permissive CORS in dev)

**Examples:** user can view other users' invoices by changing the ID in the URL (IDOR), admin API endpoint has no auth check, SQL injection in search query, JWT secret is hardcoded in source, error pages expose stack traces and DB connection strings.

#### DOCUMENTATION — Correct behavior, wrong expectations
The application works as designed, but the user's expectation doesn't match reality because documentation, training, or UX is misleading.

**Signals:**
- Feature spec clearly describes the reported behavior as correct
- The reporter's expectation is reasonable but doesn't match the design
- Help text, tooltips, or docs describe different behavior than what's implemented
- Onboarding or training missed this workflow

**Examples:** user expects instant unlock but spec says 30-minute cooldown, docs say "click Save" but the button is labeled "Apply", reported "bug" is actually an undocumented limitation.

#### NOT A BUG — Cannot reproduce or invalid
After thorough investigation, the reported issue is not reproducible or the report is invalid.

**This still requires evidence.** Never dismiss with "works for me." Document:
- Exactly what you tried
- In what environment, with what data
- Why you believe the issue is not valid
- What follow-up questions might clarify

### 4. Make a Triage Decision

Based on the classification, one of four outcomes:

#### VALIDATE + ROUTE
The issue is real. Classify it AND route it:

| Classification | Route to | Next action |
|---|---|---|
| **Code** | Developer (this team) | → `grimoire-bug` for repro test + fix |
| **Infrastructure** | Infra/DevOps/SRE | Create or update ticket for the infra team with evidence |
| **Configuration** | DevOps or config owner for the affected environment | Describe the specific misconfiguration and expected correct value |
| **Data** | Developer or DBA depending on scope | Describe affected records and whether a migration/script is needed |
| **Third-party** | Developer (workaround) + vendor (upstream fix) | Document the vendor issue, check for workarounds, file upstream if possible |
| **Security** | Security lead + developer (see special handling below) | Confidential fix, may trigger incident response |

1. Update the bug report status to `validated`
2. Adjust severity if the investigation reveals it's more or less serious than reported
3. Write the triage response with classification, routing, and evidence

**Security issues get special handling — see section 7.**

#### REJECT — Not a bug
The reported behavior is correct and the expectations are wrong, or the issue cannot be reproduced.

Rejection **requires evidence**. Provide one of:

- **By design** — cite the specific feature scenario or decision record. Quote the spec.
- **Cannot reproduce** — document exactly what you tried, in what environment, with what data.
- **Duplicate** — reference the existing bug report or fix.

#### REDIRECT — Documentation/training issue
The behavior is correct but the user's confusion is valid. The fix is better docs, UX copy, or training — not a code change.

1. Update status to `redirected`
2. Explain why the behavior is correct (cite specs)
3. Recommend specific documentation or UX improvements
4. Offer to file a separate improvement ticket for the docs/UX fix

#### NEEDS INFO — Can't decide yet
The report is incomplete or ambiguous. Generate specific follow-up questions — not "can you provide more details?" but:
- "Does this happen with all user roles or just admin?"
- "Which environment — dev, staging, or production?"
- "Can you share the exact error message or a screenshot?"
- "Is this specific to certain records/accounts, or does it affect everyone?"

### 5. Write the Triage Response

Create or update `.grimoire/bugs/<bug-id>/triage.md`:

```markdown
---
decision: <validated|rejected|redirected|needs-info>
classification: <code|infrastructure|configuration|data|third-party|security|documentation|not-a-bug>
route-to: <team or role responsible for the fix>
triaged-by: <name or role>
date: <YYYY-MM-DD>
severity: <original or reclassified>
ticket: <external ticket URL or ID, if applicable>
---

# Triage: <bug-id>

## Decision: <VALIDATED|REJECTED|REDIRECTED|NEEDS INFO>

## Classification: <type>
<!-- Why this classification? What evidence points to this root cause category? -->
<reasoning>

## Routing
<!-- Who should own the fix? Why them? -->
- **Owner**: <team or role>
- **Why**: <brief justification — e.g., "infrastructure: staging DB is under-provisioned">
- **Action needed**: <specific action — e.g., "increase staging RDS instance size" or "fix null check in parseEmail()">

## Investigation Evidence
<!-- What you found. Be specific — cite files, specs, commits, environment state. -->
<evidence>

## Severity Assessment
- Reporter: <severity>
- Triage: <severity> — <reason if changed>

## Environment Assessment
- Reported on: <environment>
- Reproduced on: <environment(s) where confirmed, or "not reproduced">
- Environment-specific: <yes/no — does this only affect certain environments?>

## Next Steps
<!-- Depends on classification and decision -->
<!-- Code: "Proceeding to grimoire-bug for fix" -->
<!-- Infrastructure: "Ticket created for infra team: <link>" -->
<!-- Configuration: "Config change needed: set X=Y on staging" -->
<!-- Data: "Data fix script needed for affected records" -->
<!-- Third-party: "Vendor issue — workaround in progress, upstream ticket filed" -->
<!-- Security: "Security fix in progress — confidential until patched" -->
<!-- Documentation: "Docs update needed — filing improvement ticket" -->
<!-- Rejected: explanation for the reporter -->
<!-- Needs info: specific questions for the reporter -->
```

### 6. Communicate Back

Check `.grimoire/config.yaml` for configured `bug_trackers` with MCP servers.

**If the bug came from an external ticket:**
- Update the original ticket with the triage decision using the appropriate MCP
- **Validated (code)**: comment with root cause summary, note that a fix is in progress
- **Validated (non-code)**: comment with classification and routing. If the tracker supports it, reassign to the responsible team or add the appropriate label/component. If the issue needs a different tracker (e.g., infra uses a separate Jira project), offer to create a ticket there and link it.
- **Validated (security)**: see section 7 — do NOT post vulnerability details in public tickets
- **Rejected**: comment with the full reasoning and evidence. Transition status if supported.
- **Redirected**: comment explaining the behavior is correct plus the docs/UX improvement needed. Offer to reclassify the ticket as an improvement rather than closing it.
- **Needs info**: comment with specific follow-up questions. Assign back to the reporter if possible.

**If the bug is local-only but trackers are configured:**
- Offer to create an external ticket for validated bugs
- For non-code issues routed elsewhere, offer to create the ticket in the right project/board
- Update the local report's `ticket:` field with the new ticket reference

**If no MCP tools are configured:**
- Tell the user where the triage response is and let them communicate it manually

### 7. Security Issue Handling

Security-classified issues follow a restricted workflow. The goal is to fix the vulnerability before details become widely known.

**Confidentiality:**
- Do NOT post exploit details, reproduction steps, or root cause analysis in public trackers, Slack channels, or anywhere outside the security fix workflow
- If the source ticket is in a public tracker (e.g., public GitHub repo), comment only with: "Confirmed. Fix in progress. Details shared privately with the security team."
- Use private channels: GitHub security advisories, private Jira projects, direct messages, or whatever the team's private security reporting channel is
- The local `.grimoire/bugs/<bug-id>/` directory is the detailed record — it stays local

**Assessment:**
Include in the triage response:
- **Attack vector** — how could this be exploited? (network, local, physical, requires auth?)
- **Impact** — what's the worst case? (data breach, account takeover, service disruption, information disclosure)
- **Exploitability** — how easy is it to exploit? (trivial, requires specific conditions, theoretical)
- **Affected environments** — is this exploitable in production right now?
- **Data at risk** — what data could be exposed or modified? Is it PII, financial, credentials?

**Routing:**
1. Notify the security lead or security team immediately — don't wait for the normal triage queue
2. If severity is critical or high AND the vulnerability is exploitable on production:
   - Flag for emergency fix (hotfix branch, expedited review)
   - Consider whether the vulnerability needs to be mitigated immediately (e.g., disable the affected endpoint, enable a WAF rule, rotate exposed credentials)
3. The code fix goes through `grimoire-bug` but with restricted visibility:
   - Fix branch should use a non-descriptive name (e.g., `fix/auth-edge-case` not `fix/idor-user-data-exposed`)
   - PR description should be minimal until the fix is deployed
   - After deployment, the full details can be added to the commit history and the ticket

**After the fix:**
1. Verify the fix on all affected environments
2. If credentials or secrets were exposed, rotate them
3. If user data was at risk, assess whether disclosure or notification is required (legal/compliance team decision)
4. Update the bug report with the full timeline: reported → triaged → fixed → deployed → disclosed
5. Consider whether a post-mortem is needed (usually yes for critical/high)
6. Update documentation or add security test scenarios to prevent recurrence

### 8. Hand Off (Non-Security)

Depends on classification:

**Code defect** → `grimoire-bug` takes over:
1. The triage response becomes context for the fix
2. The developer already has root cause understanding from investigation
3. `grimoire-bug` runs: write repro test → fix → verify
4. When complete, update bug report status to `fixed` and reference the fix commit
5. If an external ticket exists, update it (add fix commit, transition to resolved)

**Infrastructure / Configuration / Data** → the fix happens outside grimoire:
1. Ensure a ticket exists for the responsible team with all the triage evidence
2. Set the local bug report status to `routed`
3. Optionally: if a config change or data fix can be done from this repo (e.g., Terraform, Helm values, migration scripts), offer to help — but flag that this isn't a code bug and should be reviewed by the responsible team

**Third-party** → two tracks:
1. Short-term: can a workaround be implemented in our code? If yes, treat like a code fix via `grimoire-bug`
2. Long-term: file upstream (vendor support ticket, GitHub issue on the library). Document the workaround and the upstream reference.

**Documentation** → outside grimoire's core workflow:
1. Note the docs/UX improvement needed
2. Offer to create a ticket for it
3. Mark the bug report as `redirected`

## Important
- **Classify before routing.** The whole point of triage is figuring out who should own this. Dumping every issue on developers wastes their time and delays real fixes.
- **Non-code issues are still real issues.** "It's not a code bug" is not the same as "it's not a problem." Infrastructure, config, and data issues need owners and fixes too.
- **Security issues are confidential by default.** Don't share exploit details publicly until the fix is deployed. When in doubt, treat it as security.
- **Rejection is not dismissal.** A well-reasoned rejection with evidence is respectful. A lazy rejection breeds distrust.
- **Don't skip investigation.** Reading the report and immediately saying "this is infra" without checking is not triage. Look at the code, the config, the environment.
- **Severity can change.** The reporter sees symptoms. Triage sees root cause. A "minor" report might reveal a critical data integrity issue. A "critical" report might be a cosmetic rendering glitch.
- **Environment context drives classification.** "Works in dev, broken in prod" is almost certainly config or infra, not code. "Broken everywhere" is almost certainly code.
- **Keep the audit trail.** Every triage decision is written down with classification, routing, and reasoning. This prevents the same issue from being triaged three times by three people.
- **One triage per bug.** If new information arrives after a "needs info" response, update the existing triage — don't create a new one.
- **Sync both directions.** If you update the local triage, update the external ticket. If the external ticket gets new comments, incorporate them.
