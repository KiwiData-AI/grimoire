Feature: List grimoire artifacts
  As a developer
  I want to see active changes, baseline features, and decisions at a glance
  So that I can pick up work or check what already exists

  Scenario: List shows active changes with status
    Given ".grimoire/changes/" contains two active changes
    When I run "grimoire list"
    Then the output should list each change ID
    And each entry should show its status (draft, planned, applying, verifying)

  Scenario: List shows baseline features grouped by area
    When I run "grimoire list --features"
    Then output should group "*.feature" files under their area directory
    And each feature should appear exactly once

  Scenario: List shows decisions with status
    When I run "grimoire list --decisions"
    Then each ADR file under ".grimoire/decisions/" should appear
    And the status (proposed, accepted, superseded) should be shown

  Scenario: List detects conflicting active changes
    Given two active changes both modify the same baseline feature file
    When I run "grimoire list"
    Then output should flag the conflict
    And both conflicting change IDs should be named

  Scenario: List in JSON mode emits structured data
    When I run "grimoire list --json"
    Then output should be valid JSON
    And it should contain "changes", "features", and "decisions" keys
