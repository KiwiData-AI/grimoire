# Learnings — add-mkdocs-spec-site

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
  attempt does not repeat it. Pruned per task: delete a task's entries the
  moment that task goes green. Never promoted anywhere.
-->

Format: `- <task-id> · tried <approach> · failed: <observed error / why>`

## Discovered facts

<!--
  Durable facts about the project learned while implementing. Staged here only
  until reconciled into the one home that owns that fact at finalize, then
  cleared.
-->

Format: `- fact: <what was learned> → home: <area doc | decision | constraint | schema | feature>`

- fact: repo-root `logo.png` is ~1.3 MB and now ships twice in the npm package (root + `templates/site/`) → home: decision 0038 (consequences) or README, if package size matters
