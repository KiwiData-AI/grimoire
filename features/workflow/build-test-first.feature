@manual
Feature: Build understood work test-first
  As a developer
  I want tests written before understood delivery work without repeated broad test runs
  So that implementation remains protected without mechanical checks dominating delivery time

  # @manual — the actor is an AI agent running /grimoire:apply.

  Scenario: Existing failures are baselined once
    Given an approved change is ready for implementation
    When grimoire starts the change
    Then it runs every configured test suite once
    And it records accepted pre-existing failures before code changes
    And it does not run the full suites again during implementation

  Scenario: A substantial section uses one simple confirmation
    Given a planned section whose behavior and implementation direction are understood
    When I implement the section
    Then I write its known tests before its production code
    And I do not need to run those tests before implementation to observe red
    And I run at most one simple confirmation after the substantial section
    And I defer that confirmation when it requires database or container startup
    And no broad suite or quality-check bundle runs for section completion

  Scenario: Repeated failure stops the work instead of looping
    Given delivery has failed through three different implementation attempts
    When grimoire reaches the attempt limit
    Then grimoire stops delivery before a fourth attempt
    And a referenced spike presents the failure evidence and unresolved question
    And grimoire waits for my direction before changing implementation direction

  Scenario: A structural activity is reviewed before implementation
    Given planning assigns structure-before review to an activity
    When grimoire starts the activity
    Then I review the intended production shape before tests or production code change
    And approval lets the agent implement the substantial section autonomously

  Scenario: Verification invokes one pre-commit review
    Given planning assigns slice-after review to implementation activities
    When grimoire verifies their completed section work
    Then grimoire runs configured non-test quality checks
    And it invokes pre-commit review once over the complete diff
    And pre-commit review uses only applicable best-practice reviewers
    And it does not run a second LLM-backed best-practices check
    And it does not run one review per activity or file

  Scenario: User steering becomes an implementation lesson
    Given an active section follows an approved plan
    When I direct a different implementation approach
    Then grimoire applies the correction without re-planning the change
    And it records one terse lesson when remaining work is affected
    And it updates only affected unchecked tasks
    And it preserves the section's single confirmation boundary
    And it does not add a checkpoint, report, approval, or persona rerun

  Scenario: Verified task completion is recorded immediately
    Given an active section has multiple tasks
    When the section's confirmation passes or is explicitly deferred by policy
    Then grimoire marks every covered task complete immediately

  Scenario: An agent does not create implementation drift
    Given an active section follows an approved plan
    When the agent suspects an implementation detail is wrong
    Then it asks me for direction before changing the plan
    And only my direction can create active-section drift

  Scenario: Full verification runs once after pre-commit review
    Given implementation and pre-commit review corrections are complete
    When grimoire verifies the change
    Then it runs every configured unit and BDD suite once
    And it compares every failure with the accepted baseline
    And it blocks finalization for any new failure

  Scenario: A failed test is diagnosed before another test runs
    Given a test has failed during a grimoire workflow
    When grimoire investigates the failure
    Then it inspects the assertion, complete observed result, expected contract, and relevant code path
    And any diagnostic rerun must resolve at least one explicit unknown about the root cause
    And it selects the narrowest deterministic test that can resolve that unknown

  Scenario: Partial evidence remains a hypothesis
    Given an investigation has evidence supporting a possible root cause
    But material alternative causes remain untested
    When grimoire reports the diagnosis
    Then it separates observations, hypotheses, and proven conclusions
    And it does not present the possible cause as proven

  Scenario: An unknown cause produces a useful diagnostic plan
    Given the available evidence does not establish why a test failed
    When grimoire reports the diagnosis
    Then it states that the cause is unknown
    And it presents the observations already established
    And each proposed diagnostic action identifies the root-cause unknown it would resolve

  Scenario: An unavailable prerequisite stops dependent verification
    Given test output proves a required service or prerequisite is unavailable
    When grimoire diagnoses the failure
    Then it reports the unavailable prerequisite as the observed blocker
    And it does not run another dependent test or broader suite
    And it waits for restoration or my direction before continuing dependent verification

  Scenario: Finalization preserves deferred tasks
    Given a completed change has deferred tasks
    When grimoire finalizes the change
    Then it records the deferred tasks in the debt register before removing the change folder

  Scenario: An ordinary implementation commit records its change
    Given an active change has verified work worth committing before finalization
    When grimoire creates an ordinary mid-process commit
    Then the commit requires the "Change" trailer
    And it does not require the "Final-production-review" trailer

  Scenario: Finalization establishes durable change identity before cleanup
    Given a completed change has durable verified work and ephemeral scaffolding
    When grimoire prepares to remove the ephemeral change folder
    Then branch history contains an ordinary commit with the current "Change" identity
    And that commit contains durable verified work only
    And it does not contain ephemeral change scaffolding

  Scenario: Finalization stages one complete durable index
    Given a completed change is ready for finalization
    When grimoire finalizes the change
    Then it records durable state before removing the ephemeral change folder
    And it regenerates project documentation after removing the change folder
    And it stages every durable change together in the ordinary Git index
    And it creates no review snapshot, digest, or synthetic ref

  Scenario: Finalization reviews and immediately commits the complete index
    Given finalization has staged one complete durable index
    When I prepare its final commit or pull request
    Then grimoire presents every staged path grouped as production or support
    And I review the full diff from the target branch merge base to the index
    And no production or support path is excluded from approval
    When I approve the complete staged index
    Then grimoire immediately creates one final commit with the "Change" and "Final-production-review" trailers
    And it does not create a cleanup-only commit

  Scenario: Finalization resumes from ordinary Git state after cleanup
    Given finalization stopped after change-folder cleanup and before final approval
    When I resume finalization
    Then grimoire reconstructs the durable index from Git history and live artifacts
    And it continues with one complete staged-index review and one final commit
