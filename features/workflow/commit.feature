Feature: Generate contextual commit message
  As a developer wrapping up work on a grimoire change
  I want a commit message that summarises the diff and links the change
  So that git history maps cleanly back to grimoire artifacts

  Background:
    Given an active change "my-feature"
    And staged changes ready to commit

  Scenario: Commit message subject summarises the diff
    When I invoke "/grimoire:commit"
    Then the proposed subject line should be under 72 characters
    And it should describe the actual change, not the file list

  Scenario: Commit refuses when no change context is available
    Given there is no active grimoire change and the diff has no Change trailer hint
    When I invoke "/grimoire:commit"
    Then the skill should ask the user whether to commit without a Change trailer
    And it should not silently emit a message lacking the trailer

  Scenario: Commit message includes a Change trailer
    When commit produces a message for change "my-feature"
    Then the message body should end with "Change: my-feature"

  Scenario: Commit uses conventional-commit prefix when project config requests it
    Given ".grimoire/config.yaml" sets "project.commit_style" to "conventional"
    When commit runs
    Then the subject should begin with a conventional type ("feat:", "fix:", "chore:", etc.)

  Scenario: Commit reads the manifest "Why" to inform the body
    Given the change manifest has a "## Why" section
    When commit drafts the body
    Then the body should reflect the "Why" rather than restating the diff
