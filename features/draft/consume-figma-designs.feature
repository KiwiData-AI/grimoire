Feature: grimoire-draft consumes Figma designs as input
  As a developer or designer
  I want grimoire-draft to read Figma designs via MCP and propose Gherkin scenarios
  So that designs translate directly into testable behavior without manual transcription

  Background:
    Given the project has `project.design_tool.name: figma` with a configured MCP
    And the user is starting `grimoire-draft` for a UI-touching change

  Scenario: Draft asks for Figma reference
    When `grimoire-draft` starts on a UI change
    Then it asks "Figma file URL or node ID? (or skip if no design)"
    And accepts a Figma URL, file key, or specific node reference

  Scenario: MCP reads frame metadata
    Given a Figma URL is provided
    When grimoire-draft proceeds
    Then it queries the Figma MCP server for frame metadata
    And extracts: component instances, text content, variable references (tokens), interaction states
    And caches the extracted data at `.grimoire/changes/<id>/designs/figma-snapshot.json`

  Scenario: Scenarios proposed from extracted states
    Given Figma frames have been extracted
    When Gherkin scenario derivation runs
    Then grimoire-draft proposes one Scenario per (component × state)
    And presents the proposed scenarios for user review/edit/reject before writing to `.feature` files

  Scenario: Design from grimoire-design also consumed
    Given a previous `grimoire-design` session produced `.grimoire/changes/<id>/designs/` with HTML or variant-N.html
    When `grimoire-draft` runs
    Then it reads those design artifacts instead of (or in addition to) Figma
    And follows the same scenario-derivation pattern

  Scenario: No design tool — manual elicitation fallback
    Given no Figma MCP is configured
    And no design artifacts exist in the change folder
    When `grimoire-draft` runs on a UI change
    Then it falls back to standard interview elicitation (existing behavior)
    And does not block the workflow

  Scenario: Brand-tokens grounding
    Given Figma variables map to tokens that also appear in `.grimoire/brand/tokens.json`
    When scenarios are proposed
    Then Then-clauses referencing visual properties use token names (e.g., "uses `color.primary` for the submit button")
    And do not hardcode hex values that would drift if tokens change

  Scenario: Component-library awareness
    Given `.grimoire/docs/components.md` lists existing components
    When grimoire-draft proposes scenarios
    Then it prefers references to existing components by name
    And flags net-new components as "new component required — confirm before plan stage"

  @security
  Scenario: Figma access token never leaves shell environment
    When grimoire-draft queries Figma MCP
    Then the access token is read from environment (`FIGMA_ACCESS_TOKEN`) by the MCP server
    And is never logged, written to artifacts, or committed
