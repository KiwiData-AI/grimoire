@manual
Feature: Verify an implementation against its spec
  As a developer finishing a change
  I want confirmation the implementation matches the spec
  So that I can hand it off knowing nothing was missed

  # @manual — the actor is an AI agent running /grimoire:verify.

  Scenario: Verification confirms the spec is fully met
    Given a change whose tasks are all done
    When I ask grimoire to verify it
    Then I am told whether every part of the spec is covered and the decisions were followed

  Scenario: A spec with no implementation is flagged
    Given a documented behaviour that the code no longer provides
    When I ask grimoire to verify it
    Then the unimplemented behaviour is flagged
