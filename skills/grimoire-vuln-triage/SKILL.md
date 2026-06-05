---
name: grimoire-vuln-triage
description: Triage vulnerability scans from any source — npm audit, pip-audit, osv-scanner, Trivy, Grype, Snyk, Dependabot, SARIF, or a report a teammate forwards — against our actual deployment model and recorded mitigating controls. Reconciles stale scans against the current tree, then decides the one thing that matters per finding — drop-everything hotfix vs next release cycle — and suppresses non-actionable noise with VEX verdicts. Use when a scanner produces a flood of CVEs and you need to know which actually matter here.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.2"
---

# grimoire-vuln-triage

Vulnerability scanners flag every CVE that *exists* in your tree or image, ranked by CVSS base score — which knows nothing about your deployment, and nothing about whether you already upgraded past it. Most findings are not exploitable as you actually run the code. This skill is **scanner-agnostic**: it normalizes whatever it's handed (npm audit, pip-audit, osv-scanner, Trivy, Grype, Snyk, Dependabot, SARIF, or a freeform CSV/markdown report) into one canonical model, reconciles it against the current tree, and triages each surviving advisory against **our** deployment and controls to answer the only question that drives action:

> **Drop everything and hotfix now, or let it ride the normal testing / release cycle?**

It produces VEX verdicts (`fixed` / `not_affected` / `affected` / `under_investigation`) so non-actionable findings are dismissed with an auditor-defensible justification, and an urgency (`hotfix-now` / `next-release` / `accept`) for the ones that survive. Covers application dependencies, OS packages from container scans, and runtime/build tooling alike.

This skill **classifies**. Filing the dev work (tickets in the configured bug reporting system) is the job of `grimoire-vuln-remediate`, which consumes this triage.

## Triggers
- A scanner produces a wall of findings: "npm audit found 40 vulnerabilities", "pip-audit is screaming", "trivy flagged 200 CVEs in the image", "triage these CVEs"
- "Is this CVE actually a problem for us?", "do we need to hotfix this or can it wait?"
- "which of these vulnerabilities actually matter", "filter out the noise from the scan"
- A teammate forwards a scan report (any tool, any format) and asks what's real
- Loose match: "vuln triage", "CVE triage", "security scan", "trivy/grype/snyk results", "audit results", "image scan"

## Routing
- A *reported* security bug (not a scanner finding) → `grimoire-bug-triage` (it has a security classification path)
- A dependency *add/upgrade* review (lockfile, floating ranges, supply chain) → review-time; see `../references/security-compliance.md` § Supply Chain Defense, enforced by `grimoire-review` / `grimoire-precommit-review`
- After this triage, to file dev work → `grimoire-vuln-remediate`
- Persistent IaC/container misconfig (root user, no limits, `:latest` base) → `grimoire-draft`/infra, not an app hotfix
- A control gap surfaced here (a mitigation assumed but never recorded) → `grimoire-draft` to write the MADR

## Prerequisites
- A scan to triage: output of `config.tools.dep_audit` / `config.tools.security`, a saved scan file (e.g. `reports/security/...`), or pasted text. Prefer machine-readable (`--json` / SARIF) over a human table.
- The repo's current lockfile/manifest (or deployed image tag) available for reconciliation.
- Network access for KEV + EPSS enrichment (degrades gracefully to CVSS-only if offline).
- Best results with `codebase-memory-mcp` for reachability; falls back to grep.

## Workflow

Read `../references/dependency-vuln-triage.md` now — it has the canonical model, the format adapters, the reconciliation rule, the enrichment feeds, the type-aware reachability rules, the VEX statuses, the urgency tree, and the record format. Follow it. The steps below are the spine.

### 1. Normalize the scan into the canonical model (any scanner)

Identify the source and map each finding to the canonical advisory (reference § Step 1): `id`, `aliases`, `cve`, `component`, `component_type` (`library`/`os-package`/`container`/`iac`/`runtime`), `installed_version`, `fixed_version`, `severity`/`cvss`, `target`, `scanner`. Use the format adapter for the tool you were handed — **never assume one tool's field names apply to another** (npm's `isDirect`/`via` ≠ pip-audit's `aliases`/`fix_versions` ≠ Trivy's `Results[].Vulnerabilities[]` with `Class`/`Type`/`Status`). For an unknown/freeform report, extract the minimum (`id`, `component`, version, fixed version) and mark the rest `unknown`. If you can't parse it, ask for `--json`/SARIF rather than guessing.

**Dedup + non-CVE results.** Collapse the same CVE listed across multiple packages (Trivy does this constantly) to unique `(id, component_type)`, keeping the package list — report `raw_findings → unique_advisories` so the noise reduction is visible. Don't discard `Class: secret` / `Class: config` results — they aren't package CVEs; route them (secrets-in-image, Dockerfile/k8s misconfig) to infra/`grimoire-draft`, not triage.

### 2. Reconcile against the current tree FIRST (mandatory)

Before any enrichment, compare each advisory's `installed_version` against what the repo resolves **right now** (reference § Step 2): read the live lockfile/manifest (`uv.lock`/`poetry.lock`/`package-lock.json`/`go.sum`/`Cargo.lock`/`Gemfile.lock`), or for container/OS findings check the currently deployed image tag / Dockerfile base. If the current version ≥ `fixed_version`, mark **`fixed`** and drop it before enrichment — record it under "Already fixed" as the audit trail. Honor manifest comments / prior triage that already dismiss a CVE. **Never file remediation for an advisory you haven't confirmed still exists.** On a stale scan this pass clears most of the queue.

**Honor the risk-acceptance register.** Read `.grimoire/security/accepted-risks.yml` (written by `grimoire-vuln-remediate`). An **unexpired** entry for a CVE means it was already triaged and consciously accepted → carry it as known-accepted, don't re-escalate (cite the register entry). An **expired** entry → re-triage it fresh (the acceptance lapsed). This is what stops accepted findings from re-flooding the queue every scan.

### 3. Enrich the survivors — KEV then EPSS

Per the reference: fetch the **CISA KEV** catalog once and match every `cve`/`aliases` (known-exploited = strongest hotfix signal); fetch **EPSS** for all CVE ids (batch, comma-separated) for exploit probability. Cache both in the run dir. If offline, record `kev-feed: offline` / `epss-fetched: false` and proceed on CVSS + reachability + exposure — say so. IaC/config findings skip threat-intel (no CVE).

### 4. Reachability — type-aware, the cheapest big filter

Judge reachability by `component_type` (reference § Reachability):
- **library** — dev/test-only (infer from lockfile groups, not a flag) → `not_affected` in prod; imported at all? (`search_graph`/`search_code`); vulnerable function actually called? (`trace_path`).
- **os-package** (container scan) — judge **two separate axes**: *reachability* (is the vulnerable code called by untrusted input? grep the consumer, not the C package name) and *removability* (how installed — explicit/transitive/base-image/builder-only — and what breaks). **Unreachable ≠ removable.** Never recommend removing a package (or "slim the base image") without tracing the install path and naming the post-change test; many base-OS/transitive libs aren't removable. No-fix / `will_not_fix` → accept or base bump, never an "upgrade X" ticket. Full discipline + maps + anti-patterns in `../references/container-scan-triage.md`.
- **runtime** (interpreter/build tool, e.g. pip) — invoked at runtime or only at build time? Build-only, not in the running container → `not_affected` at runtime (check entrypoint/CMD).
- **container/iac** — not a CVE; triage on whether the misconfig is reachable in our deployment; route persistent ones to infra.

Also check **advisory preconditions** against real config — many CVEs are conditional (a setting, ASGI-vs-WSGI, a middleware). Precondition met → raises urgency; absent → clean `not_affected`. Record reachability provenance (`graph-verified`/`grep-asserted`/`image-layer`/`unknown`).

**Resolve unknowns in the moment — don't default to `under_investigation`.** When reachability isn't settled by grep: trace deeper (`trace_path` from routes to the vulnerable binding), then **ask the human the one decisive question** (e.g. "does any endpoint parse user-supplied XML?") — a single yes/no usually collapses several findings to `not_affected` or `affected` on the spot, sparing both a register entry and a follow-up task. Reserve `under_investigation` for questions nobody in the session can answer (needs a runtime check / a teammate / an external dependency); time-box those and name what must be checked.

### 5. Exposure & controls — read, don't invent

Per reference § Exposure & Controls: `.grimoire/docs/context.yml` (internet-facing vs internal vs lambda/batch, infra, services) and MADR decisions (`Security (CIA)` rows, WAF/network-isolation/auth/tenancy decisions). A documented control that breaks the attack path is a legitimate damper / VEX `inline_mitigations_already_exist`. **Do not create a controls config file** — controls live in MADR + context.yml. A verdict-changing control that's recorded nowhere → log under "Control gaps", don't credit it silently.

### 6. Assign VEX verdict + urgency

Apply the decision tree (reference § VEX + § Urgency): `fixed` (Step 2) → `not_affected` (reachability/precondition) → `affected` with **hotfix-now** / **next-release** / **accept** (with expiry) → `under_investigation` (time-boxed). Fail safe on unknowns (KEV + public + unknown reachability → hotfix-now); don't manufacture emergencies (no KEV + low EPSS + unknown → under_investigation + next-release).

### 7. Contrarian pass — calibrate before you escalate

Run the **Contrarian calibration pass** (`../references/review-personas.md` §4.8) over every `hotfix-now` and `affected` verdict: steel-man "we are not affected", name the assumption, run the inversion test (does a rushed hotfix / base-image swap ship *new* risk?), check severity clears all three bars (reachable + exploitable-as-deployed + real blast radius). Emit `[hotfix upheld]` / `[hotfix → next-release]` / `[finding dropped]` per escalation with one line of evidence. Summary counts are **post-Contrarian**. Calibration, not veto.

### 8. Write the triage record

Write `.grimoire/security/vulns/<run-date>/triage.md` in the reference format: frontmatter totals, then sections — Hotfix now / Next release / Risk-accepted / **Already fixed** (the stale-scan audit trail) / Not affected / Under investigation / Control gaps. Cache the KEV snapshot and EPSS responses alongside for reproducibility.

### 9. Report and hand off

Headline: how many findings, how many already **fixed** (stale scan), how many **not_affected** (noise) with the dominant reason, how many real (`affected`), how many **hotfix-now** — and *why* the hotfixes are hotfixes (one line each).
- **Any hotfix-now** → flag immediately, notify the security owner, recommend expedited fix.
- **affected (any urgency)** → "Run `grimoire-vuln-remediate` to file these into the bug tracker."
- **Control gaps** → "Assumed but unrecorded — `grimoire-draft` to capture them."

## Important
- **Reconcile before you triage.** A scan is a snapshot; the tree moves. Confirm each finding still exists in the current lockfile/image before spending any effort on it — it's the single highest-leverage step and stops you filing dead tickets.
- **Scanner-agnostic by design.** Normalize any tool into the canonical model, then triage that. The verdict logic must never depend on npm's or pip's or Trivy's field names. New tool? Add an adapter, not a new triage path.
- **CVSS ranks the world; we triage our deployment.** A "critical" in a dev-only, unreachable, or base-OS-cruft component is noise; a "medium" KEV hit on a public endpoint is a hotfix.
- **Reachability is type-aware.** App import ≠ OS package ≠ build-time tool ≠ IaC misconfig. Judge each on its own terms; a flagged base-image lib the app never calls is not a prod emergency.
- **Check the precondition.** Conditional CVEs are common — read the actual setting. Met → escalate; absent → `not_affected`.
- **`not_affected` requires a justification code.** The code is what makes the dismissal defensible to an auditor.
- **Controls must be recorded to count.** Flag undocumented ones, don't assume them.
- **Fail safe, don't fearmonger.** Escalate on KEV + public + unknown reachability; don't turn a low-EPSS, non-KEV, internal-only finding into a fire drill.
- **The Contrarian is the noise filter, not a silencer.**
- **`accept` carries an expiry.** Re-triaged when the fix ships; never silently permanent.
- **This skill does not fix or file.** It classifies. Code changes, ticket filing, image rebuilds are downstream (`grimoire-vuln-remediate`, `grimoire-bug`/`grimoire-draft` for non-trivial fixes).

## Done
When `.grimoire/security/vulns/<run-date>/triage.md` exists with every finding normalized, reconciled, and assigned a VEX verdict (and for `affected`, an urgency), the Contrarian pass applied to escalations, and the headline reported, triage is complete. Hand off to `grimoire-vuln-remediate` to file the dev work.
