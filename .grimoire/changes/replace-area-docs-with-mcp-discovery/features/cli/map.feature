Feature: Codebase mapping
  As a developer
  I want to detect drift between my project conventions and the current codebase
  So that conventions files stay accurate as the project evolves

  Background:
    Given a grimoire project with source code
    And "codebase-memory-mcp" is registered as an MCP server

  Scenario: Detect conventions drift
    Given ".grimoire/docs/conventions/" contains one or more conventions files
    When I run "grimoire map"
    Then it should check path references in each conventions file against the project filesystem
    And it should print a drift report listing placement rules whose referenced paths no longer exist
    And it should not modify any conventions files
    And it should suggest running "/grimoire:discover" in an agent session for semantic drift detection

  Scenario: Drift report shows specific mismatches
    Given "conventions/api.md" states "new views go in `src/api/views/`"
    And the path "src/api/views/" does not exist in the project
    When I run "grimoire map"
    Then the drift report should flag the placement rule as stale
    And it should show the conventions file and the path that was not found

  Scenario: Clean project reports no drift
    Given all conventions files accurately reflect the current codebase
    When I run "grimoire map"
    Then the output should indicate no drift was detected
    And the exit code should be 0

  Scenario: Detect duplicate code
    When I run "grimoire map --duplicates"
    Then jscpd should scan the codebase
    And a duplicate report should be printed

  Scenario: Drift report does not leak absolute paths
    When I run "grimoire map"
    Then the drift report should not contain the developer's home directory path

  Scenario: Map refuses to run when MCP not configured
    Given "codebase-memory-mcp" is not registered as an MCP server
    When I run "grimoire map"
    Then it should exit with a clear error message explaining MCP is required
