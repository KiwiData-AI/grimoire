# Testing Lifecycle

This is the authoritative testing lifecycle policy for engineering spikes, understood delivery, section confirmation, and final verification.

## Select the mode

Use an engineering spike when behavior, an external contract, a root cause, a reliable reproduction, or the implementation direction is unknown. Use delivery only when the expected behavior and implementation direction are understood.

Spike probes may use disposable code without test-first delivery. Delivery code must follow the planned or bug-fix cadence below. All modes retain existing permission, credential, security, destructive-action, and production-access boundaries.

## Engineering spikes

Each spike contains:

- one explicit question.
- Required evidence that can answer or disprove the question.
- A Probe boundary listing permitted local or external actions.
- One named exit: answered, disproved, blocked, or inconclusive.
- The affected unchecked tasks, when an active plan exists.

Allocate stable references as `S<n>`. Within the owning change or bug, `n` is the next unused positive integer. Standalone responses start at `S1`.

A spike is answered only by observed evidence. Compilation, a speculative fixture, or a plausible assumption is insufficient. Disposable probe code cannot enter delivery unchanged; write the known delivery tests before retaining production code.

Record spike lessons by destination:

- Active change: `learnings.md`.
- Reported bug: `triage.md`.
- Standalone: the response, unless the user names another durable destination.

An answered spike may refine only affected unchecked implementation mechanics. It cannot silently change approved behavior, scope, architecture, or permission boundaries.

## Spike exits

- **Answered:** Evidence resolves the question and identifies the next delivery direction.
- **Disproved:** Evidence rules out the investigated direction.
- **Blocked:** Required access, authority, data, environment, or human input is unavailable.
- **Inconclusive:** Permitted probes did not produce enough evidence.

After three failed delivery attempts, stop delivery. Create a findings-only spike that records what changed, what remained constant, and the unresolved question. Present the findings and require human direction before attempt four. The findings-only spike cannot authorize more delivery work.

## Planned-change delivery

For every substantial section:

1. Write all known section tests before production code.
2. Do not run tests only to observe red.
3. Implement all covered activities.
4. Run at most one cheap post-section confirmation.
5. Mark all covered task checkboxes together after confirmation passes or is deferred.

Defer section confirmation when it requires database or container startup. A section confirmation proves that the section loads or its primary path works. It is not a full suite, lint bundle, coverage run, or comprehensive feature test.

## Bug-fix delivery

Use a spike first when the expected behavior, root cause, reliable reproduction, or implementation direction is unknown.

Once the reproduction and direction are understood:

1. Write the permanent reproduction test.
2. Run the permanent reproduction once to observe the expected failure before production changes.
3. Implement the smallest fix.
4. Run the same reproduction once after the fix.

An understood bug fix therefore retains one observed failing reproduction and one passing reproduction afterward.

## Boundary suites and correction reruns

Run every configured suite once at baseline and once during final verification. Run final verification once after all delivery sections.

After pre-commit review corrections, run only the affected section confirmation when needed. Focused reruns after final-suite failure diagnose only the observed failure. Do not add speculative or duplicate suite runs.

Final verification owns deterministic quality checks, the consolidated pre-commit review, final configured suites, and baseline comparison.

## Provider contracts

Provider response contracts require evidence from an authoritative observed source or system. Repository-owned orchestration may stub its repository-owned adapter-result type. See `testing-contracts.md` for provider-test mechanics.
