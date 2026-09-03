# Learnings — <change-id>

<!--
  Ephemeral working memory for this change. Lives only in
  `.grimoire/changes/<change-id>/` and is **removed at finalize** with the rest
  of the scaffolding — nothing here persists to the repo. Re-read it at the start
  of every task section and before every retry.

  Four sections, separate lifecycles. Keep them separate; never write them into
  `AGENTS.md`.
-->

## Failure-mode notes

<!--
  Transient. One line per dead end: what was tried and why it failed, so the next
  attempt does not repeat it. This is the antidote to thrashing — a stuck retry
  MUST read this section first. Pruned per section: delete the section's entries
  when its section confirmation passes. Never promoted anywhere.
-->

Format: `- <task-id> · tried <approach> · failed: <observed error / why>`

- 2.2 · tried mocking the client wrapper · failed: mock satisfied an assertion prod code never reaches — mock at the HTTP boundary instead

## Implementation lessons

<!--
  Short-lived. Record one terse user correction only when it changes remaining
  work. Update only affected unchecked tasks and preserve the section confirmation boundary.
  Ordinary corrections need no checkpoint, report, approval, persona rerun, or
  plan-wide reconciliation.
-->

Format: `- <task-id> · learned <correction> · affects <unchecked task IDs>`

## Spike lessons

<!--
  Evidence from question-driven engineering spikes. Allocate S<n> as the next
  unused positive integer in this change. A lesson may refine only affected
  unchecked implementation mechanics.
-->

### S<n> — <question>
- Trigger: <why delivery could not proceed>
- Probes: <what was tried>
- Evidence: <observed facts>
- Answer: <answered | disproved | blocked | inconclusive, with conclusion>
- Impact: <affected unchecked tasks or durable destination>

## Discovered facts

<!--
  Durable facts about the project learned while implementing — a build flag, a
  convention, an undocumented contract, an architectural constraint. Staged here
  only until reconciled into the one home that owns that fact at finalize, then
  cleared. Recording the destination home makes reconciliation mechanical and
  lets the user correct the routing — that reconciliation is what keeps the fact
  from going stale, because it then lives where the project's own changes keep it
  honest.
-->

Format: `- fact: <what was learned> → home: <area doc | decision | constraint | schema | feature>`

- fact: the bdd suite needs `TZ=UTC` or time-based scenarios flake → home: `.grimoire/docs/<area>.md`
