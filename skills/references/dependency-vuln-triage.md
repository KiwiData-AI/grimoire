# Vulnerability Triage Reference

Loaded by `grimoire-vuln-triage` (and later `grimoire-vuln-remediate`). Turns **any** vulnerability scan — `npm audit`, `pip-audit`, `osv-scanner`, Trivy, Grype, Snyk, Dependabot, a SARIF file, or a CSV/markdown report a teammate forwards — into per-advisory verdicts whose single most important output is one decision:

> **Drop everything and hotfix now, or let it ride the normal testing / release cycle?**

Everything below exists to answer that, honestly, for *our* deployment — not in the abstract. The skill is **scanner-agnostic**: it normalizes whatever it's handed into one canonical model, then triages that. Covers application dependencies (npm/PyPI/Go/Cargo/…), OS packages (Debian/Alpine/RPM from container scans), and container/IaC findings alike.

## Why raw scanner severity is not the answer

Scanners rank by **CVSS base score**, which describes the vulnerability in a vacuum. It knows nothing about whether our code reaches the vulnerable function, whether the package even runs in production, whether the service is internet-facing, what controls sit in front of it, or **whether we already upgraded past it**. CVSS alone over-escalates: most "high"/"critical" findings are not actionable in a given deployment. Commercial reachability tooling suppresses 70–90% of findings for exactly this reason. We get most of that signal for free from reconciliation + KEV + EPSS + reachability + our own context.

The triage rubric is **Threat × Exposure × Impact**:
- **Threat** — is it actually being exploited / likely to be? (KEV, EPSS)
- **Exposure** — can an attacker reach the vulnerable code in our deployment? (reachability + network exposure)
- **Impact** — what is the blast radius if they do? (data sensitivity, privilege)

## Step 1 — Normalize the scan into the canonical advisory model

**Do this before anything else, regardless of source.** Different scanners emit wildly different shapes; triage logic must never be coupled to one format. Map each finding to:

| Field | Meaning |
|---|---|
| `id` | Primary advisory id (CVE, GHSA, OSV, vendor id) |
| `aliases` | All other ids (so KEV/EPSS lookups can find the CVE) |
| `cve` | The CVE alias if any (KEV/EPSS key); may be absent |
| `component` | Package / module / OS-package / image name |
| `component_type` | `library` \| `os-package` \| `container` \| `iac` \| `runtime` — drives how reachability is judged |
| `installed_version` | What the scan saw |
| `fixed_version` | First fixed version, or `none` |
| `severity` / `cvss` | Scanner-reported, treated as a prior only |
| `target` | Where it was found (lockfile, image layer, Dockerfile, repo) |
| `scanner` | Which tool produced it |
| `advisory_url` / `description` | For reading what the bug actually is |

### Format adapters

Read the right fields per scanner — **do not** assume one tool's field names apply to another:

- **npm audit** (`--json`): `vulnerabilities{}` keyed by package → `severity`, `via[]` (string or advisory object with `title`/`url`), `isDirect`, `fixAvailable`, `nodes[]`. Dev deps appear via `effects`/dependency graph (no single `dev` flag on every entry).
- **pip-audit** (`-f json`): `dependencies[]` → `{name, version, vulns[]}`; each vuln has `id`, `aliases[]` (find the `CVE-` one), `fix_versions[]`, `description`. **No dev flag in the data** — infer dev/runtime from lockfile groups (`[tool.uv] dev-dependencies`, poetry `group.dev`, `requirements-dev.txt`).
- **osv-scanner** (`--format json`): `results[].packages[].vulnerabilities[]` with OSV ids + `aliases`; `results[].source.path` is the manifest.
- **Trivy** (`--format json`): `Results[]` each with a `Class` (`os-pkgs` \| `lang-pkgs` \| `config`) and `Type` (debian, alpine, gobinary, python-pkg, …); `Results[].Vulnerabilities[]` → `VulnerabilityID`, `PkgName`, `InstalledVersion`, `FixedVersion`, `Severity`, `CVSS{}`. **`Class: os-pkgs` → `component_type: os-package`** (base-image OS cruft — judged differently from app deps). `Results[].Class: config` → `component_type: iac` (Dockerfile/k8s misconfig, not a CVE — triage on exposure, no KEV/EPSS).
- **Grype** (`-o json`): `matches[].vulnerability` (`id`, `severity`, `fix.versions[]`) + `matches[].artifact` (`name`, `version`, `type`).
- **Snyk / Dependabot / SARIF**: pull `ruleId`/`cve`, the package coordinate, and fixed version from `results[]` / alerts / `runs[].results[]`. SARIF `level` maps to severity.
- **Unknown / freeform (CSV, markdown, pasted text):** extract the minimum — `id` (CVE/GHSA), `component`, `installed_version`, `fixed_version` if stated. Anything you can't fill is `unknown`, not a guess. Triage proceeds on what you have; record `scanner: <described>` and note reduced confidence.

If you genuinely can't parse a format, say so and ask for `--json`/SARIF rather than guessing at a table.

### Deduplicate before triaging

Scanners — Trivy especially — emit the **same CVE once per affected package** (e.g. `CVE-2026-40393` listed against `libgbm1`, `libgl1-mesa-dri`, `libglx-mesa0`, `mesa-libgallium` = 4 findings, 1 vulnerability). Collapse to **unique `(id, component_type)`**, keeping the list of affected packages on the single entry. Triage and count the deduplicated set — a "200 CVE" image scan is often 30 real advisories. Report both numbers (raw findings → unique advisories) so the noise reduction is visible.

### Container scans also carry non-CVE results — don't drop them

Trivy/Grype image scans include result classes that are **not** package CVEs and need routing, not triage:
- **secret** (`Class: secret`) — a credential/key found in an image layer (e.g. an `.env` file baked in). Even zero-hit secret *targets* are a smell (why is an env file in the image?). Route to infra/`grimoire-draft`, treat any real hit as a confidential security issue.
- **config / misconfig** (`Class: config`, `component_type: iac`) — Dockerfile/k8s findings (root user, no resource limits, exposed port, `:latest` base). Triage on exposure; route persistent ones to infra/`grimoire-draft`. Not an app hotfix.

## Step 2 — Reconcile against the current tree FIRST  *(mandatory, highest-leverage)*

**Scan artifacts go stale.** A report from last week was taken against versions you may have already upgraded. Before spending any effort on enrichment or reachability, compare each advisory's `installed_version` against what the repo resolves **right now**:

- Read the live lockfile / manifest: `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`, `uv.lock` / `poetry.lock` / `requirements.txt`, `go.mod`/`go.sum`, `Cargo.lock`, `Gemfile.lock`. For container/OS findings, the equivalent is "is this image still deployed?" — check the current image tag / Dockerfile base.
- If the **currently resolved version ≥ `fixed_version`**, the advisory is **`fixed`** → drop it from the queue before enrichment. Record it in the "Already fixed" section as the audit trail.
- If a manifest comment or prior triage already dismisses the CVE (e.g. `urllib3>=2.7.0  # CVE-2026-44431`), treat as `fixed`/known and don't re-litigate.

This single pass routinely clears the majority of a stale scan and saves the expensive work for findings that are actually still present. **Never file remediation for an advisory without confirming it still exists in the current tree.**

## The enrichment signals (for advisories that survive reconciliation)

Gather what you can. Degrade gracefully — a missing signal is "unknown", not "safe". OS-package and library findings both get KEV/EPSS (they're CVEs); IaC/config findings skip threat-intel and triage on exposure.

### KEV — CISA Known Exploited Vulnerabilities  *(Threat, binary)*

Fetch once per run and match every advisory's `cve`/`aliases`:
`https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`

KEV membership is binary, evidence-grounded, auditor-defensible. **A reachable KEV vulnerability is a hotfix candidate regardless of CVSS.**

### EPSS — Exploit Prediction Scoring System  *(Threat, probability)*

Fetch per CVE (batchable, comma-separated):
`https://api.first.org/data/v1/epss?cve=CVE-2024-XXXX,CVE-2024-YYYY`

Daily-refreshed probability (0–1) of exploitation in the next 30 days. Ranks the long tail KEV is silent on. Rough bands: `≥0.5` high, `0.1–0.5` elevated, `<0.1` low. A prior, not a verdict.

### Reachability — is the vulnerable code in our execute path?  *(Exposure)* — judge by `component_type`

The strongest noise filter. **How you judge reachability depends on what kind of component it is:**

- **`library` (app dependency):**
  - *Dev/test only?* Not shipped or run in prod → **not_affected** in prod (`vulnerable_code_not_in_execute_path`). Infer dev/runtime from lockfile groups — there is usually no single flag.
  - *Imported at all?* `search_graph(name_pattern=<pkg>)` / `search_code(<pkg>)`. Unused transitive → low exposure.
  - *Vulnerable function reached?* When the advisory names the affected API, `trace_path` / `search_code` to confirm our code calls *that* surface. Not present / not on a reachable path → **not_affected**.
- **`os-package` (Debian/Alpine/RPM from a container scan):** judge **two separate axes** — *reachability* (is the vulnerable code path called by untrusted input?) drives urgency; *removability* (can we delete it, and what breaks?) drives remediation. **They are not the same — unreachable ≠ removable.** A headless API can't reach Mesa's OpenGL code *and* can't remove Mesa if it arrived transitively behind a package it needs. A C library is only reachable if something in the running app binds to it, so grep the **consumer**, not the C package name (the app never `import`s `libexpat1`). Honor the scanner's fix-state: `will_not_fix`/`end_of_life`/no-`FixedVersion` means **no fix exists** → the lever is accept-with-expiry or a base-image bump/rebuild, **never** an "upgrade X" ticket. **Before recommending any removal or "slim the base image," trace how the package is installed (explicit / transitive / base-image / builder-only) and name the post-change test** — see `./container-scan-triage.md` for the full discipline, the transitive-source and consumer maps, and the anti-patterns. Route image-structure changes to infra/`grimoire-draft`, not app remediation.
- **`runtime` (the interpreter/build tool itself — e.g. `pip`, `node`, `setuptools`):** is it invoked **at runtime** or only at **build time**? A build-time tool not present/called in the running container → **not_affected** at runtime (`vulnerable_code_not_in_execute_path`); note it as build-image hygiene at most. Check the container entrypoint/CMD.
- **`container` / `iac` (Dockerfile, k8s, compose misconfig):** not a CVE — no KEV/EPSS. Triage on exposure + control: does the misconfig (root user, no resource limits, exposed port, `:latest` base) actually create reachable risk in our deployment? Route persistent ones to `grimoire-draft`/infra, not an app hotfix.

**Grep can lie — verify the binding.** A bare symbol/name match is not proof: `Price.fromstring()` (the `price-parser` library) is not XML `etree.fromstring()`; a package named in a comment isn't a call. Confirm the match is the actual vulnerable binding (right import, right call site) before asserting `not_affected` **or** `affected`.

**Resolve unknowns now — `under_investigation` is a last resort, not a default.** When grep doesn't settle reachability, work the question before deferring it:
1. **Trace deeper** — `codebase-memory-mcp` `trace_path` from the entry points (routes/handlers) to the vulnerable binding; read the actual call site, not just its name.
2. **Ask the decisive question.** Most reachability unknowns collapse to one yes/no the human can answer instantly — ask it inline rather than filing a task. The pattern: *"Does <surface> ever receive attacker-controlled <input>?"* e.g. "Does any endpoint parse user-supplied XML (SAML/SSO metadata, uploads, external responses)?" → "no" makes expat/libxml2 `not_affected` on the spot; "yes" makes them `affected`. One question can clear several findings **and** spare a register entry and a follow-up task.
3. Only when the answer genuinely needs work nobody in the session can do — a runtime check, a teammate's knowledge, an external dependency — mark **`under_investigation`**, time-box it, and name exactly what must be checked. Don't force a verdict to look decisive; but don't punt one you could resolve with a trace or a question, either.

Record reachability provenance: `graph-verified` (codebase-memory-mcp), `grep-asserted` (fallback), `image-layer` (container scan), or `unknown`.

### Exposure & Controls — our deployment, our mitigations  *(Exposure + Impact damping)*

Read these — do **not** invent a controls config file; the truth already lives here:

- **`.grimoire/docs/context.yml`** — `deployment` (internet-facing vs internal vs lambda/batch), `infrastructure`, `services`. An internal-only service behind an auth gateway has far less exposure than a public endpoint.
- **MADR decisions** (`.grimoire/decisions/*.md`) — `Security (CIA)` quality-attribute rows and security-relevant decisions (WAF, network isolation, input validation, auth model, tenancy). A documented control that breaks the attack path is a legitimate VEX `inline_mitigations_already_exist` / severity damper.
- **App config that satisfies (or fails) an advisory's precondition** — many CVEs are conditional ("only when `SESSION_SAVE_EVERY_REQUEST=True`", "only on ASGI", "only if middleware X enabled"). Read the actual setting. A precondition that is **met** raises urgency; one that is **absent** is a clean `not_affected` (`vulnerable_code_cannot_be_controlled_by_adversary` / not in execute path).

If a control that *would* change the verdict is assumed but **not recorded anywhere**, do not credit it silently. Flag the gap and recommend recording it as a MADR via `grimoire-draft` — an undocumented control is not defensible in an audit.

## VEX verdict — the per-advisory status

Assign each surviving advisory a [VEX](https://www.cisa.gov/sites/default/files/2023-04/minimum-requirements-for-vex-508c.pdf) status. This is the noise-suppression layer: only `affected` items become dev work.

| Status | Meaning | Justification codes (for `not_affected`) |
|---|---|---|
| `fixed` | Already remediated — current tree resolves ≥ the fixed version (from Step 2). | — |
| `not_affected` | We are not exploitable. **No dev work.** | `component_not_present`, `vulnerable_code_not_present`, `vulnerable_code_not_in_execute_path`, `vulnerable_code_cannot_be_controlled_by_adversary`, `inline_mitigations_already_exist` |
| `affected` | Exploitable in our deployment. **Needs a remediation action.** | — (carries an urgency, see below) |
| `under_investigation` | Can't determine yet (no graph, ambiguous advisory). Time-box it. | — |

Every verdict records *why*. A `not_affected` with a justification code is the auditor-defensible way to dismiss noise; a bare "looks fine" is not.

## Urgency — the decision that matters (for `affected` items only)

| Urgency | Trigger | Action |
|---|---|---|
| **hotfix-now** | In **KEV** AND reachable AND exposed; **or** EPSS high + reachable + internet-exposed + no mitigating control; **or** active exploitation against a high-impact surface (auth, PII, RCE on a public endpoint). | Drop everything. Expedited fix branch, out-of-band release. Notify security owner. |
| **next-release** | Reachable but exposure is damped (internal-only / behind a control), **or** no KEV and low/elevated EPSS, **or** fix requires a non-trivial upgrade / image rebuild with no active-exploitation pressure. | File remediation for the normal testing / release cycle. |
| **accept (risk-accepted)** | `affected` but low real risk and **no fix available** (no patched version / no newer base image yet). | Record justification + an **expiry / revisit date**. Re-triage on expiry or when a fix ships. Don't let it become permanent. |

Decision tree, in order:

1. Already `fixed` (Step 2)? → done, drop. No enrichment needed.
2. `not_affected` (reachability / precondition absent)? → done, it's noise. No urgency.
3. Reachable + (KEV **or** high EPSS) + internet-exposed + no breaking control? → **hotfix-now**.
4. `affected` but damped (not exposed / control breaks the path / low EPSS / dev-or-build-time only) → **next-release**.
5. `affected`, no fix exists, low risk → **accept** with expiry.

Default bias: unknown reachability + internet-facing + KEV → **hotfix-now** (fail safe). Unknown reachability + no KEV + low EPSS → **under_investigation** + next-release — don't manufacture an emergency.

## The Contrarian pass — calibrate before you escalate

Before finalizing **any** `hotfix-now` or `affected` verdict, run the **Contrarian calibration pass** (`./review-personas.md` §4.8) over the escalated findings. The Contrarian adds no findings; it challenges the ones we're about to act on. For each escalation ask:

1. **Steel-man "we are not affected."** Strongest case this doesn't matter here — dev/build-only, function never called, base-OS cruft, behind auth + network isolation, precondition absent, input never attacker-controlled. If it holds, drop the urgency (often to `not_affected`).
2. **Name the assumption.** "Assumes the parser is fed untrusted input." "Assumes this endpoint is public." If it contradicts `context.yml`/a MADR/the actual config, the finding is mis-calibrated.
3. **Inversion.** If we hotfixed this, what *new* risk ships — a rushed major bump, an untested base-image swap, a breaking transitive change? Is the cure riskier than the disease before the next release window?
4. **Is doing-nothing-until-release right?** Symptom vs root cause; will it actually trigger; cost of "fix now" vs "fix when it hurts".
5. **Is severity calibrated?** A `hotfix-now` must clear all of: reachable, exploitable-as-deployed, real blast radius.

Emit per escalation: `[hotfix upheld]` / `[hotfix → next-release]` / `[finding dropped]` with one line of evidence. Summary counts are **post-Contrarian**. Calibration, not veto — a surviving harm path tied to `context.yml`/KEV stands.

## Triage record format

Write `.grimoire/security/vulns/<run-date>/triage.md`:

```markdown
---
scanners: [<npm-audit|pip-audit|osv-scanner|trivy|grype|snyk|sarif|other>]
scan_dates: [<YYYY-MM-DD per source>]
triaged_date: <YYYY-MM-DD>
reconciled_against: <lockfile/manifest/image checked>
kev-feed: <date fetched, or "offline">
epss-fetched: <true|false>
reachability: <graph-verified|grep-asserted|image-layer|unknown>
totals: { raw_findings: N, unique_advisories: N, fixed: N, not_affected: N, affected: N, hotfix_now: N, accepted: N, under_investigation: N }
---

# Vulnerability Triage — <run-date>

## Hotfix now (drop everything)
<!-- omit section if empty -->
### <id> — <component> <version> (<component_type>)
- **VEX**: affected · **Urgency**: hotfix-now
- **KEV**: yes/no · **EPSS**: 0.NN · **CVSS**: N.N (<severity>) · **Scanner**: <tool>
- **Reachable**: <yes — calls X / image-layer / no / unknown> (<provenance>)
- **Exposure**: <internet-facing endpoint / internal-only / dev/build-only / base-OS>
- **Controls**: <none that break the path / WAF per ADR-00NN / behind auth gateway>
- **Precondition**: <CVE condition — met / absent, with the setting checked>
- **Blast radius**: <RCE / PII read / DoS / info disclosure>
- **Contrarian**: [hotfix upheld] <one line>
- **Fix**: upgrade <component> <from> → <to> / rebuild on <base> (or: no fix — mitigation: <...>)

## Next release cycle
### <id> — <component> (<component_type>)
- (same fields) · **Contrarian**: [hotfix → next-release] <why damped>

## Risk-accepted (revisit by <date>)
### <id> — <component>
- **VEX**: affected · no fix available · **Expiry**: <YYYY-MM-DD> · **Justification**: <...>

## Already fixed (reconciled out — scan was stale)
<!-- audit trail: dropped before enrichment because current tree is past the fix -->
- <id> — <component>: current tree resolves <ver> ≥ fixed <ver>
- <id> — <component>: dismissed in manifest (<comment/prior triage>)

## Not affected (suppressed noise)
- <id> — <component>: not_affected (`vulnerable_code_not_in_execute_path` — dev-only / build-time / base-OS not invoked)
- <id> — <component>: not_affected (`vulnerable_code_cannot_be_controlled_by_adversary` — precondition absent: <setting>)

## Under investigation (time-boxed to <date>)
- <id> — <component>: <what's blocking the call>

## Control gaps surfaced
- <control> assumed for <id> but not in any decision record → suggest `grimoire-draft`.

## Infra follow-ups (root-cause, not per-CVE)
<!-- container/IaC hygiene — route to infra/grimoire-draft, not app remediation. Each must state how-installed + post-change test, per container-scan-triage.md. -->
- <package> (CVE <id>): installed via <explicit line N / transitive via PARENT / base image / builder-only>; depends: <evidence>; removable: <yes-safe / yes-after-removing-PARENT / no-base-OS / no-required-by-Y>; recommendation: <Dockerfile edit / bump-base / accept+document> — test: <build / import / DB connect>.
- Secret/config result: <e.g. `.env` baked into image layer> → remove from image, route to infra.
```

## Supply-chain note (separate from CVE triage)

A *known CVE* in a component is what this reference triages. A **dependency add/upgrade** (new package, version bump, floating range, missing lockfile/integrity hashes) is a different risk class — covered by `security-compliance.md` § Supply Chain Defense, a review-time blocker, not a CVE-triage output. Keep them distinct: triage answers "is this known CVE a hotfix?"; supply-chain defense answers "should this change merge at all?".

## Principles

- **Reconcile first.** A stale scan is mostly already-fixed findings. Confirm each advisory still exists in the current tree before any other work — it's the cheapest, highest-leverage pass.
- **Scanner-agnostic by construction.** Normalize any tool's output into the canonical model, then triage that. Never couple the verdict logic to npm's or pip's field names.
- **CVSS ranks the world; we triage our deployment.** The whole job is that gap. A "critical" in a dev-only, unreachable, or base-OS-cruft component is noise; a "medium" KEV hit on a public endpoint is a hotfix.
- **Reachability is type-aware.** Library imports, OS-package usage, runtime-vs-build, and IaC misconfig are judged differently. A flagged base-image OS lib the app never calls is not a prod emergency.
- **`not_affected` needs a justification code, not a vibe.** That line is the audit trail.
- **Controls must be recorded to count.** Undocumented WAF/auth/isolation can't damp a verdict — flag the gap.
- **Fail safe on unknowns, but don't manufacture emergencies.**
- **The Contrarian calibrates escalations; it does not suppress real signal.**
- **`accept` is not `ignore`.** It carries an expiry and gets re-triaged.
