---
name: grimoire-spike
description: Investigate one unresolved engineering question with bounded probes and evidence-based exits before delivery.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-spike

Investigate one unresolved engineering question. A spike produces referenced findings, not shippable production code.

Follow the mode, allocation, exit, recording, and permission rules in `../references/testing-lifecycle.md`.

## Triggers

- Behavior, an external contract, a root cause, a reliable reproduction, or the implementation direction is unknown.
- Planning cannot describe downstream mechanics without guessing.
- Delivery reached three failed attempts.
- The user directly asks for an engineering spike.

## Routing

- Expected behavior and direction are understood for a planned change → `grimoire-apply`.
- A bug has an understood reliable reproduction and fix direction → `grimoire-bug`.
- Approved behavior, scope, or architecture must change → `grimoire-draft`.
- Tester-oriented product exploration → `grimoire-bug-explore` or `grimoire-bug-session`.

## Workflow

### 1. Establish the spike

Allocate `S<n>` using the lifecycle policy. State one explicit question, Required evidence, the Probe boundary, and affected unchecked tasks.

Use this format:

```markdown
- [ ] S<n> (mode: spike) Determine <one explicit question>.
      - Trigger: <planned unknown | runtime unknown | three failed delivery attempts>.
      - Required evidence: <specific observations needed>.
      - Probe boundary: <permitted local or external actions>.
      - Exit: answered | disproved | blocked | inconclusive.
      - Feeds: <affected unchecked tasks or none>.
```

### 2. Run bounded probes

Use only actions inside the Probe boundary. Prefer read-only inspection, authoritative documentation, observed provider responses, isolated experiments, and disposable code.

Do not invent fixtures, schemas, endpoints, responses, or assertions. Do not expand access, credentials, remote calls, destructive actions, or production use. Request permission through the existing boundary when a probe needs it.

### 3. Select one exit

End as answered, disproved, blocked, or inconclusive. Cite the evidence supporting the exit. A plausible assumption or compiling probe cannot produce an answered exit.

### 4. Record the lesson

Record the result at the destination selected by the lifecycle policy:

```markdown
### S<n> — <question>
- Trigger: <why delivery could not proceed>
- Probes: <what was tried>
- Evidence: <observed facts>
- Answer: <resolved conclusion or still unknown>
- Impact: <affected task mechanics or durable destination>
```

An answered planned or runtime spike may update only affected unchecked task mechanics. Ask before changing approved behavior, scope, architecture, or implementation direction.

### 5. Handle the delivery breaker

After three failed delivery attempts, create a findings-only spike. Record each approach, the persistent failure, what remained constant, and the unresolved question. Present the lesson and require human direction before attempt four. Do not update delivery mechanics or resume implementation from this result alone.

## Important

- A spike answers one question. Split unrelated unknowns into later spikes.
- Evidence-based exit criteria replace time estimates.
- Disposable code is not delivery output.
- Existing security and operation permission gates remain in force.
- Provider-test details remain in `../references/testing-contracts.md`.

## Done

The spike ends when one exit is recorded with evidence at the correct destination. If answered, route to the applicable delivery skill. Otherwise, present the findings and stop.
