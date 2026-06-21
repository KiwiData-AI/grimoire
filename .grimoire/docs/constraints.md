# Constraints

> Invariants that must always hold. These are **not** behaviors (no external actor,
> not observable in a scenario) — they are guarantees. Anything that failed the
> feature-file admission test in `grimoire-draft` because it is a security control,
> NFR, or robustness guarantee lives here, **not** in a `.feature`.
>
> Each constraint is verified by a `unit-invariant` test, never by a Gherkin scenario.
> Keep this register narrow: assert, justify, point to the proof.

| Constraint (assertion) | Rationale | How verified | Links |
|------------------------|-----------|--------------|-------|
| User-supplied write paths never escape the project root | Prevents path-traversal writes outside the repo (e.g. `grimoire health --badges`) | `src/utils/paths.test.ts` — "throws for path that escapes root" | — |
| Change IDs never contain path separators or `..` | A change ID is used to build filesystem paths; it must not traverse | `src/utils/paths.test.ts` (`resolveChangePath`) | — |
| Config serialization refuses to persist literal secrets | A real token/key/password value must never be written to `.grimoire/config.yaml`; only `${ENV}` references are allowed | `src/core/init.test.ts` — "secret scan on serialized config" (`scanForSecrets` throws) | — |
| Subprocesses are invoked with an explicit argv, never a shell string | No `shell: true`; git/gh/linter args are passed as array elements so external/file input cannot inject shell syntax | `src/utils/spawn.test.ts` (args passed positionally); `execFile` usage in `check.ts`, `pr.ts`, `branch-check.ts` | — |
| Diffs and filenames sent to an LLM CLI are fenced/sanitized | Untrusted repo content piped to a configured LLM must not break out of its prompt context (prompt-injection hardening in `buildLlmPrompt`) | TODO: unit-invariant test for `buildLlmPrompt` fencing (`src/core/check.ts`) | — |
| `.grimoire/config.yaml` is trusted code | `grimoire check`/`health` execute config-defined shell commands by design — same trust model as npm scripts / Makefiles; documented as a user-facing warning, not sandboxed | README "Security" note in the Pre-Commit Pipeline section | — |
| Autonomous apply halts at a configured ceiling (sections-without-checkpoint, cost, wall-clock, consecutive-BLOCKED) before exhausting the token budget | Prevents loop death-spirals — unbounded retry and cost blowup — in autonomous mode | TODO: unit-invariant once the breaker is enforced in code; v1 is instruction-only in `grimoire-apply` | 0035 |
| During apply, a test is never weakened or deleted to make the red-green gate pass | The gate is the convergence signal; gaming it (reward-hacking) defeats verification | TODO: unit-invariant / guard check once enforced; v1 is instruction-only in `grimoire-apply` | 0035 |

<!--
Add one row per constraint. Guidance:
- Assertion: a flat "X always holds" statement. No Given/When/Then.
- Rationale: why it matters, in one line.
- How verified: the exact test id that proves it. If none yet, write "TODO: unit-invariant test".
- Links: the MADR that decided it (don't restate the decision here — DRY).
-->
