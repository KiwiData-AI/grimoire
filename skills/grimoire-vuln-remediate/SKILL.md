---
name: grimoire-vuln-remediate
description: File the dev work from a vulnerability triage — turn affected findings into tickets in the configured bug tracker, record risk-accepted items with expiry, and stub grimoire changes for non-trivial fixes. Consumes a grimoire-vuln-triage record. Use after triage, when you're ready to action the findings that actually matter.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-vuln-remediate

`grimoire-vuln-triage` decides *what matters*. This skill **files the work** for the findings that survived: it turns `affected` advisories into tickets in the team's configured bug reporting system, records `accept` items in a risk-acceptance register with an expiry, and stubs a grimoire change for fixes too big to be a one-line bump. It never invents urgency — it acts on the triage's verdicts.

The split is deliberate: triage classifies (read-only, repeatable), remediate commits to action (writes tickets, branches, registers). Run triage first.

## Triggers
- After triage: "file these", "create the tickets", "remediate the CVEs", "action the vuln triage"
- "open tickets for the affected vulnerabilities", "track the risk-accepted ones"
- User points at a triage record and asks to take it forward
- Loose match: "vuln remediate", "file vulnerabilities", "security tickets", "remediation plan"

## Routing
- No triage record yet → `grimoire-vuln-triage` first. Do not file tickets off a raw scanner dump — file only what triage marked `affected`.
- A fix that's a real code change (new abstraction, behavior change, schema) → stub a change and hand to `grimoire-draft` / `grimoire-plan` / `grimoire-apply`.
- A confirmed-exploitable code defect a developer will fix immediately → `grimoire-bug` (reproduction-first).
- Infra follow-ups (base-image bump, secrets-in-image, IaC misconfig from the triage's "Infra follow-ups") → infra board / `grimoire-draft`, not app remediation.

## Prerequisites
- A triage record at `.grimoire/security/vulns/<run-date>/triage.md` (from `grimoire-vuln-triage`). If the user points at a different path, use it.
- `.grimoire/config.yaml` — read `bug_trackers` (MCP) for where to file. If `none`, fall back to a local remediation doc.

## Workflow

### 1. Read the triage record

Load the triage. Pull the actionable buckets — **ignore `fixed` and `not_affected`** (triage already dismissed them; they are the audit trail, not work):
- **hotfix-now** — expedited, confidential handling.
- **next-release** — normal release-cycle work.
- **accept** — no fix available / low risk → goes to the risk-acceptance register, not a fix ticket.
- **under_investigation** — file a time-boxed investigation task, not a fix. **Does not enter the risk register** — it isn't a decision yet. When the investigation resolves, re-run remediate so it routes to close / ticket / register.
- **Infra follow-ups** — route separately (Step 5).

Cross-check the record's totals against what you're about to file so nothing is dropped or invented.

### 2. Decide the fix type per affected item

For each `affected` advisory, classify the remediation so it routes correctly:
- **Trivial bump** — a patch/minor version with a fix exists (`upgrade X 1.2.3 → 1.2.4`), no API break. Can be a direct PR or a simple ticket.
- **Non-trivial fix** — major-version bump, code changes, base-image rebuild, or a transitive dep that needs a constraint/override. Needs design → stub a grimoire change (Step 4).
- **No fix available** — `will_not_fix` / no fixed version. Not a fix ticket → risk-acceptance register with an expiry (Step 3). Never file an "upgrade X" ticket when no fixed version exists.

### 3. File the work into the configured bug reporting system

Read `bug_trackers` in `.grimoire/config.yaml`.

**If a tracker MCP is configured (Jira / Linear / GitHub):**
- **Idempotency first** — search the tracker for the CVE/GHSA id before creating anything. If a ticket exists, update it (link the triage, refresh urgency); don't duplicate. Mirror both directions like `grimoire-bug-triage`.
- **One ticket per advisory** (or per package-upgrade when several CVEs share one bump — group by the fix, not the CVE). Include: id(s), component + version, fixed version / action, urgency, reachability + exposure summary, and a link back to `.grimoire/security/vulns/<run-date>/triage.md`. Set priority from urgency (hotfix-now → highest).
- **hotfix-now is confidential** — mirror `grimoire-bug-triage` §7. Do **not** post exploit details, reachability specifics, or a step-by-step in a public tracker. If the tracker is public, the ticket states impact + "fix in progress, details held privately"; the detail stays in the local triage record. Notify the security owner out of band. Recommend an expedited branch (non-descriptive name) + out-of-band release.
- **under_investigation** → a time-boxed task ("confirm reachability of <CVE> in <path> by <date>"), assigned, with the open question from triage.

**If `bug_trackers: none`:**
- Write `.grimoire/security/vulns/<run-date>/remediation.md` — a checklist: one entry per actionable item with `[ ]` checkbox, id(s), action (exact upgrade or change-stub link or accept-ref), urgency, suggested owner, and the triage link. This is the deliverable the team works from until a tracker exists. Tell the user where it is.

### 4. Stub a grimoire change for non-trivial fixes

For each non-trivial fix, create `.grimoire/changes/<change-id>/manifest.md` so the normal build workflow takes over:
- Frontmatter `status: proposed`, plus `source: vuln-triage`, the CVE id(s), and the triage path.
- **Why**: the vulnerability + why a one-line bump isn't enough (major break, code path affected, transitive constraint).
- **Scope**: the upgrade/change needed and the blast radius from triage (which code paths touch the vulnerable surface).
- Point the user at `grimoire-draft` / `grimoire-plan` to continue. Reference the change-id from the ticket so the trail is intact.

### 5. Record risk-accepted items (with expiry)

**Register invariant: only a settled `accept` verdict enters the register.** The register means "we triaged this, decided, and consciously accepted the residual risk." Two states must stay out of it:
- **`under_investigation`** — not decided yet. It gets an investigation task (Step 3), nothing in the register. The register's `vex_justification` must be a real VEX code, not "pending"; a finding you can't yet justify hasn't been accepted. When the investigation resolves, *then* it routes — to `not_affected` (close), `affected` (ticket/change), or `accept` (register).
- **`not_affected`** — already dismissed by triage, deterministically, every scan. It needs no register entry; adding one would bloat the register with the unreachable os-package noise the reachability verdict already suppresses.

For every settled `accept` item, append to `.grimoire/security/accepted-risks.yml` (create from the template if absent). Each entry: `cve`, `component`, `vex_justification` (a real code), `reason` (why it's acceptable — reachability/exposure/no-fix), `owner`, `accepted` date, and an **`expires`** date (when to re-triage — sooner for higher residual risk, default ~90 days). An accepted risk is not closed — it's scheduled for re-evaluation.

**This register is read back by `grimoire-vuln-triage` during reconciliation** — an unexpired entry auto-suppresses that CVE as a known-accepted, so the same finding doesn't re-flood the queue next scan. An **expired** entry is re-surfaced for re-triage. Don't accept the same CVE twice; update the existing entry.

A no-fix os-package finding that is genuinely **`affected` and accepted** (reachable, no patched base yet) belongs here — with `component_type: os-package` and the trace summary from `container-scan-triage.md`. One that is **`not_affected`** (unreachable, like a headless API's GPU/terminal libs) does **not**.

### 6. Optionally execute trivial bumps (skippable)

Offer — don't assume — to apply trivial bumps directly: edit the manifest pin, run the lockfile update (`uv lock` / `npm install` / etc.), and run the configured `dep_audit` to confirm the advisory clears. Keep it on a branch. This step is **opt-in**; if the user just wants tickets, file and stop. If you do apply, the supply-chain rules in `security-compliance.md` still hold (committed lockfile + integrity hashes).

### 7. Report and update the record

Update the triage record (or a sibling `remediation.md`) with what was filed: ticket refs, change-ids, register entries. Report the headline:
- N tickets filed (M hotfix-now expedited), K risk-accepted (next review dates), J change stubs, I investigations.
- Any hotfix-now: restate it's flagged for the security owner and expedited.
- Where the artifacts are (tracker links / local docs / register).

## Important
- **Act only on triage verdicts.** This skill files what triage marked `affected` / `accept` / `under_investigation`. It does not re-triage, re-rank, or escalate on its own. If a verdict looks wrong, send it back to `grimoire-vuln-triage`, don't override it here.
- **No fixed version → no upgrade ticket.** A `will_not_fix` / no-fix finding goes to the risk register with an expiry, or to infra for a base bump. Filing "upgrade X" when X has no fix wastes a developer's time.
- **Group by the fix, not the CVE.** One upgrade often clears several advisories — one ticket, listing all the CVEs it resolves.
- **hotfix-now is confidential.** No exploit detail in public trackers; impact-only, details local, security owner notified out of band, expedited branch.
- **Idempotent.** Search before filing; update existing tickets and register entries instead of duplicating. Sync local ↔ tracker both ways.
- **`accept` carries an expiry and feeds back into triage.** The register is the loop that stops accepted noise from re-flooding every scan — and re-surfaces it when the expiry passes.
- **The register holds only settled `accept` verdicts.** `under_investigation` gets an investigation task, never a register entry (it isn't decided); `not_affected` is already suppressed by triage's reachability verdict each run. Keep the invariant clean: register = decided + accepted, with a real VEX justification.
- **Steps are skippable.** Filing, change-stubbing, and direct bumps are independent — do what the user asked for and stop.

## Done
When every actionable triage finding has a home — a ticket (or remediation.md entry), a change stub, or a risk-register entry with an expiry — and the triage record reflects what was filed, remediation is complete. Hotfix-now items are flagged and confidential; accepted items are scheduled for re-triage.
