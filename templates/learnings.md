# Learnings — <change-id>

<!--
  Ephemeral working memory for this change. Lives only in
  `.grimoire/changes/<change-id>/` and is **removed at finalize** with the rest
  of the scaffolding — nothing here persists to the repo. Re-read it at the start
  of every task section and before every retry.

  Two sections, two lifecycles. Keep them separate; never write either into
  `AGENTS.md`.
-->

## Failure-mode notes

<!--
  Transient. One line per dead end: what was tried and why it failed, so the next
  attempt does not repeat it. This is the antidote to thrashing — a stuck retry
  MUST read this section first. Pruned per task: delete a task's entries the
  moment that task goes green. Never promoted anywhere.
-->

Format: `- <task-id> · tried <approach> · failed: <observed error / why>`

- 2.2 · tried mocking the client wrapper · failed: mock satisfied an assertion prod code never reaches — mock at the HTTP boundary instead

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
