@manual
Feature: Build each task test-first
  As a developer
  I want each task implemented with a failing test before the code
  So that every behaviour is covered by a test that genuinely exercises it

  # @manual — the actor is an AI agent running /grimoire:apply.

  Scenario: Existing failures are baselined once
    Given an approved change is ready for implementation
    When grimoire starts the change
    Then it runs every configured test suite once
    And it records accepted pre-existing failures before code changes
    And it does not run the full suites again during implementation

  Scenario: A feature task uses one tactical red-green command
    Given a planned feature task with an exact test command
    When I implement the task
    Then its new or changed test is seen to fail for the missing behavior
    And collection or infrastructure errors do not count as red
    And the production code is written until the same command passes
    And no broader suite runs for task completion

  Scenario: Repeated failure stops the work instead of looping
    Given a task whose tests keep failing
    When the same approach has failed several times
    Then grimoire stops and asks for guidance rather than trying again

  Scenario: A structural activity is reviewed before implementation
    Given planning assigns structure-before review to an activity
    When grimoire starts the activity
    Then I review the intended production shape before tests or production code change
    And approval lets the agent implement it autonomously with tactical red-green tests

  Scenario: Verification invokes one pre-commit review
    Given planning assigns slice-after review to implementation activities
    When grimoire verifies their completed tactical red-green work
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
    And it reruns only affected tactical tests before continuing
    And it does not add a checkpoint, report, approval, or persona rerun

  Scenario: Verified task completion is recorded immediately
    Given an active section has multiple tasks
    When a task's exact tactical test passes
    Then grimoire marks that task complete immediately

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
