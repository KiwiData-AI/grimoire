# Security & Compliance Reference

Loaded by skills when feature files have security tags or `project.compliance` is configured in `.grimoire/config.yaml`.

## Security Tags

Apply these Gherkin tags to scenarios with security implications. Downstream skills (plan, review, verify) use them to enforce stricter checks.

| Tag | When to apply |
|---|---|
| `@security` | Authentication, authorization, access control, cryptographic operations |
| `@auth` | Login, logout, session management, token handling, role-based access |
| `@pii` | Create, read, update, or delete personally identifiable information |
| `@input-validation` | User input that could be malicious (forms, APIs, file uploads) |
| `@secrets` | API keys, credentials, tokens, or secret management |

### Compliance-specific tags (only when `project.compliance` is configured)

| Tag | When to apply |
|---|---|
| `@pci-dss` | Payment card data, cardholder data environment, payment processing |
| `@hipaa` | Protected health information, patient data, healthcare records |
| `@gdpr` | EU personal data, consent management, data subject rights |
| `@soc2` | Audit logging, access controls, availability requirements |

Multiple tags can apply to one scenario.

## What Each Tag Requires

### In planning (grimoire-plan)
- `@security` / `@auth` — specify which auth library/framework; include a negative scenario task (assert 401/403)
- `@pii` — tasks for encryption at rest, access logging, data minimization; if GDPR in compliance, add consent + erasure tasks
- `@input-validation` — explicit validation/sanitization at boundary; negative test tasks for malicious input (SQLi, XSS, path traversal)
- `@secrets` — specify env vars or secret store, never hardcoded; add a task to verify no secrets in source
- `@pci-dss` — no card data in logs, TLS, tokenization, audit trail for cardholder data access
- `@hipaa` — access controls with audit logging, encryption at rest/transit, minimum necessary access
- `@gdpr` — lawful basis, consent mechanism if needed, data subject rights (access, rectify, erase, port), retention limits
- `@soc2` — audit logging for all access, change management documentation, availability monitoring

### In verification (grimoire-verify)
- `@security` / `@auth` — confirm auth checks exist in implementation, negative test covers unauthorized access (401/403)
- `@pii` — data encrypted at rest, access logged, no PII in log output
- `@input-validation` — validation at boundary, negative tests for malicious input exist
- `@secrets` — values from env/secret store, no hardcoded credentials in source
- `@pci-dss` — no card data in logs, TLS for transmission, audit trail present
- `@hipaa` — access controls + audit logging, encryption at rest/transit
- `@gdpr` — consent mechanism if applicable, erasure support, data retention limits
- `@soc2` — audit logging, access controls, availability monitoring

A security-tagged scenario with no corresponding security verification in the tests is a **CRITICAL** issue.

## STRIDE Threat Analysis

For each new endpoint, data flow, or trust boundary a change introduces:

| Threat | Question |
|---|---|
| **S**poofing | Can an attacker impersonate a user or service? Auth checks at every entry point? |
| **T**ampering | Can input or data in transit be modified? Integrity validated (checksums, signatures, CSRF)? |
| **R**epudiation | Are security-relevant actions logged? Could an attacker act without a trace? |
| **I**nfo Disclosure | Could errors, logs, or responses leak sensitive data (stack traces, PII, tokens)? |
| **D**enial of Service | Unbounded operations (large uploads, expensive queries, no rate limits)? |
| **E**levation of Privilege | Can a user escalate to admin? Role/permission checks at the right layer? |

Skip categories that don't apply. Don't manufacture threats.

## OWASP Top 10 Surface Scan

For changed files, do a lightweight scan:

| OWASP Category | What to check in the diff |
|---|---|
| A01: Broken Access Control | New endpoints missing auth decorators/middleware; direct object references without ownership checks |
| A02: Cryptographic Failures | Weak hashing, missing encryption for sensitive data, hardcoded keys |
| A03: Injection | String concatenation in SQL/commands/templates, `eval()`, `innerHTML` with user data |
| A04: Insecure Design | Missing rate limiting on auth endpoints, no account lockout |
| A05: Security Misconfiguration | Debug mode enabled, default credentials, overly permissive CORS |
| A06: Vulnerable Components | New dependencies without version pins, known-vulnerable packages |
| A07: Auth Failures | Weak password requirements, session tokens in URLs |
| A08: Data Integrity Failures | Insecure deserialization (`pickle`, `yaml.load`), missing integrity checks |
| A09: Logging Failures | Security events not logged, PII/secrets in log output |
| A10: SSRF | User-controlled URLs in server-side HTTP requests without allowlist |

Tag each finding with OWASP category and CWE ID.

## CWE Quick Reference

| Finding | OWASP / CWE |
|---|---|
| Missing auth checks | A01:2021 / CWE-862 |
| SQL injection | A03:2021 / CWE-89 |
| Command injection | A03:2021 / CWE-78 |
| XSS | A03:2021 / CWE-79 |
| Custom/weak crypto | A02:2021 / CWE-327, CWE-328 |
| Hardcoded secrets | A07:2021 / CWE-798 |
| SSRF | A10:2021 / CWE-918 |
| Insecure deserialization | A08:2021 / CWE-502 |

## Compliance Framework Verification

Only applies when `project.compliance` is configured.

- **`owasp`** — OWASP Top 10 risks addressed (see surface scan above)
- **`pci-dss`** — No card numbers in logs, TLS for transmission, tokenization, audit trail, access controls on cardholder data
- **`hipaa`** — Access controls + audit logging, encryption at rest/transit, minimum necessary access, BAA implications for third-party services
- **`gdpr`** — Lawful basis identified, consent mechanism if needed, data subject rights (access, rectify, erase, port), retention limits, privacy by design
- **`soc2`** — Audit logging for access and changes, availability monitoring, logical access controls, change management documentation
- **`iso27001`** — Risk assessment documented, information classification applied, access control policy followed, incident response considered

Missing compliance coverage on a tagged scenario is a **blocker**.
