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

  Scenario: Planning proposes a section execution strategy
    Given an approved change with work that has different review needs
    When I ask grimoire to plan the work
    Then each implementation section declares its execution
    And only paired sections may declare ordered checkpoints
    And autonomous sections declare no checkpoints
    And I review the complete section strategy before I approve the plan

  Scenario: Planning separates a new pattern from its repetition
    Given an approved change establishes a pattern used by later work
    When I ask grimoire to plan the work
    Then the first pattern implementation is separated from mechanical repetition
    And the repeated work can use autonomous execution after the pattern is approved

  Scenario: Planning defines paired production isolation
    Given an approved change needs a paired pattern-establishing section
    When I ask grimoire to plan the work
    Then the section declares paired execution and its ordered checkpoints
    And the paired agent is limited to support edits and an unapplied production patch

  Scenario: Planning orders actual section dependencies
    Given an approved change whose sections reference code and artifacts from other sections
    When I ask grimoire to plan the work
    Then every implementation section declares its earlier dependencies
    And the sections are topologically ordered before the technical spine breaks ties
    And no task depends on a later task in its section

  Scenario: Planning rejects an invalid section dependency graph
    Given a plan has unknown dependencies, forward dependencies, or a dependency cycle
    When I review the plan for approval
    Then grimoire reports all dependency errors together
    And grimoire blocks plan approval

  Scenario: Autonomous implementation has no intermediate human gate
    Given an approved change can be implemented and verified by an agent
    When I ask grimoire to plan autonomous sections
    Then every autonomous task uses deterministic commands or agent-executable tools
    And no autonomous task asks for human approval, inspection, or waiting
    And implementation runs without a human gate

  Scenario: Unavoidable external acceptance occurs after verification
    Given an approved change requires external acceptance that an agent cannot execute
    When I ask grimoire to plan the work
    Then all external acceptance is consolidated into one terminal section
    And the terminal section follows implementation and verification
    And plan approval records that execution is not autonomous end-to-end
