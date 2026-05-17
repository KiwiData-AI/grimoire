Feature: Single-change status
  As a developer working on a grimoire change
  I want a quick summary of a single change's stage and task progress
  So that I know what is left to do

  Scenario: Status reports stage and task counts
    Given a change "my-feature" with manifest status "applying"
    And the change has a "tasks.md" with 5 tasks, 2 completed
    When I run "grimoire status my-feature"
    Then output should show the stage "applying"
    And output should show task progress as "2/5"

  Scenario: Status handles missing tasks.md
    Given a change "my-feature" with no "tasks.md"
    When I run "grimoire status my-feature"
    Then the stage should still be reported
    And the JSON output's "artifacts.tasks" should be null

  Scenario: Status fails when the change does not exist
    When I run "grimoire status nonexistent"
    Then the command should exit non-zero
    And the error message should name the missing change ID

  Scenario: Status in JSON mode emits the documented shape
    When I run "grimoire status my-feature --json"
    Then output should be valid JSON
    And it should include top-level keys "stage" and "status"
    And it should include "artifacts.tasks" with shape "{ total, completed }" (or null)
