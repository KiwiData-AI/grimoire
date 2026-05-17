Feature: Remove a feature or deprecate a decision
  As a maintainer decommissioning functionality
  I want grimoire to track the removal through the normal change pipeline
  So that the deletion has a manifest, impact assessment, and archive entry

  Scenario: Removal creates a tracked change
    When I invoke "/grimoire:remove" naming a feature to remove
    Then ".grimoire/changes/remove-<name>/" should be created
    And the manifest should list the target as "REMOVED"

  Scenario: Removal performs impact assessment
    When the remove skill runs against a feature
    Then the skill should report callers, dependent features, and tests that reference the removed surface
    And the user should confirm before files are deleted

  Scenario: Removing a decision supersedes rather than deletes
    When I invoke "/grimoire:remove" on an accepted ADR
    Then the original ADR should be marked "superseded"
    And a new ADR should be drafted explaining the deprecation rationale

  Scenario: Removal pipeline ends with archive
    Given a removal change has been applied
    When I run "grimoire archive remove-<name>"
    Then the targeted feature file should be deleted from "features/"
    And the manifest should be moved into ".grimoire/archive/"

  Scenario: Refuses to remove a feature with active dependent changes
    Given another active change modifies the feature targeted for removal
    When the remove skill runs
    Then it should refuse to proceed
    And the message should name the conflicting active change
