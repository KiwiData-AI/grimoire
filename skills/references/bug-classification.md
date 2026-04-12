# Bug Classification Taxonomy

8-way root cause classification for bug triage. Used by bug-triage (full classification), bug (light classification).

## Categories

### CODE — Application defect

The code doesn't match the spec, or the behavior is clearly wrong due to a bug in the application logic.

**Signals:**
- The bug reproduces in tests
- The code path has an obvious logic error, missing edge case, or regression
- `git log` shows a recent change that introduced the issue
- The spec is clear and the implementation diverges from it

### INFRASTRUCTURE — Platform or deployment issue

The application code is correct, but the environment it runs in is broken or misconfigured.

**Signals:**
- Works locally or in other environments, fails in a specific one
- Related to resources (memory, CPU, disk, network timeouts)
- Deploy pipeline, container, or orchestration issue
- Database server, cache, or queue is degraded
- DNS, load balancer, or certificate problem

**Examples:** staging database overloaded, k8s pod OOM-killed, CDN serving stale assets, Redis connection pool exhausted.

### CONFIGURATION — Environment or feature config issue

The code is correct and infrastructure is healthy, but the environment is configured wrong.

**Signals:**
- Feature flag is off when it should be on (or vice versa)
- Environment variable is missing, wrong, or pointing to the wrong resource
- Permissions or CORS settings differ between environments
- A migration ran in one environment but not another

**Examples:** `STRIPE_API_KEY` pointing to test mode in production, feature flag `enable-2fa` disabled on staging, missing database migration on QA.

### DATA — Data integrity or content issue

The code and config are correct, but the data is bad, missing, or in an unexpected state.

**Signals:**
- Only affects specific records, accounts, or tenants
- Data doesn't match expected schema or constraints
- Related to a recent data migration, import, or manual edit
- Null/missing where a value is expected

**Examples:** user record has null email from a botched migration, product has negative price from a CSV import, orphaned foreign key from a deleted parent.

### THIRD-PARTY — External service or dependency issue

The issue originates outside the application boundary — in a vendor API, library, or upstream service.

**Signals:**
- Third-party status page shows an incident
- API responses from the vendor changed format or started returning errors
- Library behavior changed after an update
- Issue only occurs when the external service is involved

**Examples:** Stripe webhook format changed, SendGrid rate-limiting, a library upgrade introduced a breaking change, OAuth provider returning new error codes.

### SECURITY — Vulnerability or security defect

The issue has security implications — unauthorized access, data exposure, injection, privilege escalation, or other vulnerabilities. May overlap with CODE, CONFIGURATION, or INFRASTRUCTURE but the security dimension changes how it's handled.

Check the report's `security: true` flag — the bug-report skill auto-screens for security signals. But also evaluate during investigation even if the flag wasn't set.

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

### DOCUMENTATION — Correct behavior, wrong expectations

The application works as designed, but the user's expectation doesn't match reality because documentation, training, or UX is misleading.

**Signals:**
- Feature spec clearly describes the reported behavior as correct
- The reporter's expectation is reasonable but doesn't match the design
- Help text, tooltips, or docs describe different behavior than what's implemented
- Onboarding or training missed this workflow

**Examples:** user expects instant unlock but spec says 30-minute cooldown, docs say "click Save" but the button is labeled "Apply", reported "bug" is actually an undocumented limitation.

### NOT A BUG — Cannot reproduce or invalid

After thorough investigation, the reported issue is not reproducible or the report is invalid.

**This still requires evidence.** Never dismiss with "works for me." Document:
- Exactly what you tried
- In what environment, with what data
- Why you believe the issue is not valid
- What follow-up questions might clarify

## Triage Decision Outcomes

After classification, one of four outcomes:

### VALIDATE + ROUTE

The issue is real. Classify it AND route it:

| Classification | Route to | Next action |
|---|---|---|
| **Code** | Developer (this team) | → `grimoire-bug` for repro test + fix |
| **Infrastructure** | Infra/DevOps/SRE | Create or update ticket for the infra team with evidence |
| **Configuration** | DevOps or config owner for the affected environment | Describe the specific misconfiguration and expected correct value |
| **Data** | Developer or DBA depending on scope | Describe affected records and whether a migration/script is needed |
| **Third-party** | Developer (workaround) + vendor (upstream fix) | Document the vendor issue, check for workarounds, file upstream if possible |
| **Security** | Security lead + developer (see special handling below) | Confidential fix, may trigger incident response |

### REJECT — Not a bug

The reported behavior is correct and the expectations are wrong, or the issue cannot be reproduced.

Rejection **requires evidence**. Provide one of:

- **By design** — cite the specific feature scenario or decision record. Quote the spec.
- **Cannot reproduce** — document exactly what you tried, in what environment, with what data.
- **Duplicate** — reference the existing bug report or fix.

### REDIRECT — Documentation/training issue

The behavior is correct but the user's confusion is valid. The fix is better docs, UX copy, or training — not a code change.

1. Update status to `redirected`
2. Explain why the behavior is correct (cite specs)
3. Recommend specific documentation or UX improvements
4. Offer to file a separate improvement ticket for the docs/UX fix

### NEEDS INFO — Can't decide yet

The report is incomplete or ambiguous. Generate specific follow-up questions — not "can you provide more details?" but:
- "Does this happen with all user roles or just admin?"
- "Which environment — dev, staging, or production?"
- "Can you share the exact error message or a screenshot?"
- "Is this specific to certain records/accounts, or does it affect everyone?"
