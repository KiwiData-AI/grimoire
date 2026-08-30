@manual
Feature: Build each task test-first
  As a developer
  I want each task implemented with a failing test before the code
  So that every behaviour is covered by a test that genuinely exercises it

  # @manual — the actor is an AI agent running /grimoire:apply.

  Scenario: A task is implemented only after its test fails first
    Given a planned task
    When I implement the task
    Then a test for it is written and seen to fail before any code is written
    And the code is written until that test passes

  Scenario: Repeated failure stops the work instead of looping
    Given a task whose tests keep failing
    When the same approach has failed several times
    Then grimoire stops and asks for guidance rather than trying again

  Scenario: A paired section reviews its structure before implementation
    Given an approved paired section uses a structure checkpoint
    When grimoire starts the section
    Then I review the intended production shape before tests or production code change

  Scenario: A paired section reviews one completed production increment once
    Given an approved paired section uses a pending slice-after checkpoint
    When one representative production increment has focused verification
    Then I review its production-only diff and verification result
    And tasks covered by the increment remain incomplete until I approve the slice
    And approval completes those tasks and prevents another slice-after checkpoint

  Scenario: A developer lets the current section finish autonomously
    Given an active paired section has pending checkpoints
    When I tell grimoire "Finish this section on your own"
    Then the section switches to autonomous execution at the next safe production boundary
    And its pending checkpoints remain pending

  Scenario: A developer waives the current section's pending checkpoints
    Given an active paired section has pending checkpoints
    When I tell grimoire "Finish without further review"
    Then the section switches to autonomous execution at the next safe production boundary
    And its pending checkpoints are waived

  Scenario: A developer resumes pairing for the current section
    Given an active section is executing autonomously
    When I tell grimoire "Pair with me from here"
    Then the section switches to paired execution at the next safe production boundary

  Scenario: A developer requests the next checkpoint
    Given an active paired section has a pending checkpoint
    When I tell grimoire "Show me the next slice"
    Then grimoire continues until the next pending checkpoint

  Scenario: A developer rejects an unapplied paired production patch
    Given a paired section proposes a production increment with a retained failing test
    When I reject the proposed patch
    Then the production files remain unchanged
    And the failing test remains in place
    And a fresh paired agent returns a revised unapplied production patch

  Scenario: A developer rejects a provisional slice after verification
    Given a paired section has applied and verified a provisional production slice
    And tasks covered by the slice remain incomplete
    When I reject the slice-after checkpoint
    Then the provisional production slice remains applied
    And its covered tasks remain incomplete
    And a fresh paired agent returns an unapplied corrective production patch
    And grimoire verifies and presents the corrected slice at the same checkpoint

  Scenario: A paired agent keeps production changes isolated
    Given a paired section needs production and support changes
    When the paired agent completes its work
    Then it may change support files only
    And it returns an exact unified production patch without applying it

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
