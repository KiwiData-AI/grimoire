@manual
Feature: Safely decommission a feature
  As a maintainer
  I want removal to show impact before anything is deleted
  So that I never delete something other work still depends on

  # @manual — the actor is an AI agent running /grimoire:remove.

  Scenario: Impact is shown and confirmed before deletion
    Given I ask to remove an existing feature
    When grimoire assesses the removal
    Then it shows me what depends on that feature
    And nothing is deleted until I confirm

  Scenario: Removal is blocked while other work depends on it
    Given other in-progress work still relies on the feature
    When I ask to remove it
    Then grimoire refuses
    And it names the work that still depends on the feature
