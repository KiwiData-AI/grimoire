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

## Diagnose failures before rerunning

After any test or deterministic-check failure, apply this diagnosis gate before another test execution:

1. Inspect the failing assertion, the complete observed result, the expected contract, the relevant code path, and the earliest concrete prerequisite error.
2. Establish the expected outcome from an authoritative artifact. Current implementation behavior does not establish intent.
3. When no authoritative artifact establishes the expected outcome, ask the user before changing code or tests.
4. Separate observations, hypotheses, and proven conclusions. State that the cause is unknown when the evidence does not prove it.
5. Before another test execution, name at least one explicit root-cause unknown that the existing evidence cannot resolve.
6. The diagnostic test must resolve that unknown. Select the narrowest deterministic test that can resolve that unknown.

Broaden diagnostic scope only for a named plausible interaction or an explicitly justified integration boundary. Mandatory baseline and final configured-suite runs remain boundary exceptions. Apply this diagnosis gate to every failure they produce.

Partial or incomparable evidence supports a hypothesis only until sufficient comparable evidence eliminates material alternatives. A proven conclusion requires comparable evidence that eliminates those alternatives.

An unknown cause is a successful diagnosis outcome when it includes established observations and targeted diagnostic actions. Each proposed diagnostic action must identify at least one root-cause unknown it would resolve.

Treat a proven unavailable service or prerequisite as a blocker. Do not run another dependent test or broader suite until the prerequisite is restored or the user gives explicit direction.

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

Generated editor and commit hooks may run only cheap writing checks such as lint, format, and doc style. They must not run configured unit or BDD suites.

## Provider contracts

Provider response contracts require evidence from an authoritative observed source or system. Repository-owned orchestration may stub its repository-owned adapter-result type. See `testing-contracts.md` for provider-test mechanics.
