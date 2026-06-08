@manual
Feature: Capture an intent as the right kind of spec
  As a developer
  I want to describe what I want in plain language
  So that it is captured in the form the team can review and build against

  # @manual — the actor is an AI agent running /grimoire:draft; the outcome is
  # the agent's routing judgement, not a deterministic CLI result. Verified by
  # using the skill, not by an automated step definition.

  Scenario: A desired behaviour becomes a testable behaviour spec
    Given I describe a behaviour a user should be able to perform
    When I ask grimoire to capture it
    Then it is recorded as a reviewable, testable behaviour specification

  Scenario: A technical choice becomes a recorded decision
    Given I describe a choice between technical options
    When I ask grimoire to capture it
    Then it is recorded as a decision with its context and the alternatives considered

  Scenario: An invariant is recorded as a constraint, not a behaviour
    Given I describe a guarantee that must always hold
    When I ask grimoire to capture it
    Then it is recorded as a constraint rather than a behaviour specification

  Scenario: A defect is redirected to the bug workflow
    Given I describe something that is broken
    When I ask grimoire to capture it
    Then it is treated as a bug to reproduce, not as new desired behaviour
