@manual
Feature: Turn an approved spec into a plan
  As a developer
  I want an approved spec broken into concrete, ordered tasks
  So that implementation follows a reviewed plan instead of improvisation

  # @manual — the actor is an AI agent running /grimoire:plan.

  Scenario: An approved spec becomes an ordered task list
    Given a spec the team has approved
    When I ask grimoire to plan the work
    Then I get an ordered list of tasks that cover the spec
    And each task says how it will be verified

  Scenario: Planning refuses when nothing is approved
    Given there is no approved spec to plan from
    When I ask grimoire to plan the work
    Then grimoire declines and tells me to draft and approve a spec first
