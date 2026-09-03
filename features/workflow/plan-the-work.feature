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

  Scenario: Planning groups work into substantial feature sections
    Given an approved change with related implementation activities
    When I ask grimoire to plan the work
    Then the plan defaults to one substantial implementation section
    And it uses a second section only for a distinct outcome or context boundary
    And every section beyond two includes a specific justification
    And final verification is a lifecycle gate instead of a task section

  Scenario: Planning assigns review timing by activity
    Given an approved change with activities that need different review attention
    When I ask grimoire to plan the work
    Then high-leverage structural activities use structure-before review
    And autonomously implemented activities use slice-after review
    And each activity records its review timing beside its task checkbox
    And slice-after activities join one consolidated pre-commit review
    And I review the complete timing strategy before I approve the plan

  Scenario: Planning creates section-level delivery tasks
    Given an approved change with testable behavior
    When I ask grimoire to plan the work
    Then each substantial section contains its known tests and production implementation
    And each section names at most one simple confirmation command after implementation
    And planning defers the confirmation when it requires database or container startup
    And comprehensive testing remains a final verification gate

  Scenario: Planning preserves an unresolved implementation question
    Given an approved change with an unresolved implementation assumption
    When I ask grimoire to plan the work
    Then the plan records a referenced spike with one question and required evidence
    And it does not invent downstream tasks, schemas, fixtures, endpoints, or assertions
    And evidence from the spike may refine only affected unchecked task mechanics

  Scenario: Planning does not manufacture Gherkin for internal work
    Given an approved optimization or implementation change with no actor-visible behavior
    When I ask grimoire to project and plan the work
    Then no Gherkin feature file is created or modified
    And the work uses the matching internal test or decision record
    And planning continues without treating missing Gherkin as a gap

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

  Scenario: Slice-after implementation has no intermediate human gate
    Given an approved activity uses slice-after review
    When grimoire implements the activity
    Then its tasks use deterministic commands or agent-executable tools
    And its implementation runs without a human gate
    And review waits for the consolidated pre-commit pass

  Scenario: Unavoidable external acceptance occurs after verification
    Given an approved change requires external acceptance that an agent cannot execute
    When I ask grimoire to plan the work
    Then all external acceptance is consolidated into one terminal section
    And the terminal section follows implementation and verification
    And plan approval records that execution is not autonomous end-to-end
