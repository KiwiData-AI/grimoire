Feature: Branch-guard skill
  As a developer about to start a new feature
  I want grimoire to verify my branch is appropriate before any drafting happens
  So that new work doesn't piggy-back on unrelated in-progress changes

  Note: Detection of new-feature intent and the dirty-branch / active-change-mismatch block paths are specified in `features/cli/branch-check.feature` (the CLI hook implementation). This skill feature covers the workflow-level behaviors that sit on top of those primitives.

  Scenario: Skill creates the new branch when user accepts the suggestion
    Given the skill has proposed a branch name "csv-export"
    When the user accepts the suggestion
    Then a new branch "csv-export" should be created from the configured base branch
    And the working tree should be switched to the new branch before any draft work begins

  Scenario: Skill sanitises the new branch name before passing it to git
    Given the user prompt contains shell metacharacters such as ";", "&", "`", "$()"
    When the skill creates the branch
    Then the branch name passed to "git checkout -b" should contain only characters from the set [a-z0-9/-]
    And no shell metacharacters should reach the git invocation

  Scenario: Skill hands off to /grimoire:draft after the branch switch
    Given a new branch was successfully created for the proposed feature
    When the branch switch is complete
    Then the user should be prompted to invoke "/grimoire:draft" next
    And the draft workflow should resume on the new branch

  Scenario: Skill declines to create a branch when the user rejects the suggestion
    Given the skill has proposed a branch name
    When the user rejects the suggestion
    Then no branch should be created
    And the original branch state should be preserved
    And the skill should ask whether the user wants to supply an alternate branch name or abort
