Feature: Diff a proposed change against baseline
  As a reviewer of a grimoire change
  I want to see which scenarios are added, modified, or removed by a proposed change
  So that I can review the intent independent of the implementation

  Scenario: Diff lists added scenarios
    Given an active change "my-feature" adds two scenarios to "features/cli/init.feature"
    When I run "grimoire diff my-feature"
    Then output should list each added scenario by name
    And each line should be prefixed with "+" and labelled "added"

  Scenario: Diff lists removed scenarios
    Given an active change "my-feature" removes a scenario from a baseline feature
    When I run "grimoire diff my-feature"
    Then output should list the removed scenario
    And the entry should be prefixed with "-" and labelled "removed"

  Scenario: Diff lists modified scenarios
    Given an active change "my-feature" alters the steps of an existing scenario
    When I run "grimoire diff my-feature"
    Then output should list the scenario as modified
    And the entry should be prefixed with "~" and labelled "modified"

  Scenario: Diff reports a brand-new feature file
    Given an active change "my-feature" adds a feature file that has no baseline counterpart
    When I run "grimoire diff my-feature"
    Then output should label the file as a new feature
    And every scenario in the file should be listed as added

  Scenario: Diff errors when the change does not exist
    When I run "grimoire diff nonexistent"
    Then the command should exit non-zero
    And the error message should name the missing change ID

  Scenario: Diff in JSON mode emits structured data
    When I run "grimoire diff my-feature --json"
    Then output should be valid JSON
    And each file entry should contain "scenariosAdded", "scenariosRemoved", and "scenariosUnchanged" arrays
