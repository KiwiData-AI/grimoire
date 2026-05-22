Feature: Run discover skill
  As a developer onboarding grimoire onto an existing project
  I want one skill to produce per-area conventions files and a data schema
  So that downstream skills have stable project conventions without consulting stale docs

  Background:
    Given a grimoire project with source code
    And "codebase-memory-mcp" is registered as an MCP server

  Scenario: Discover refuses to run when MCP not configured
    Given "codebase-memory-mcp" is not registered as an MCP server
    When I invoke "/grimoire:discover"
    Then the skill should stop with a clear error message
    And the message should explain that codebase-memory-mcp is required
    And the message should include installation instructions

  Scenario: Discover generates one conventions file per area
    When discover completes a full scan
    Then ".grimoire/docs/conventions/" should contain one markdown file per documented area
    And each conventions file should include file placement rules
    And each conventions file should include naming conventions
    And each conventions file should include pattern guidance with exemplar file references
    And each conventions file should include a "Last updated" date

  Scenario: Discover uses MCP for all symbol and structure intelligence
    When discover analyses an area
    Then it should use "search_graph" to enumerate symbols in that area
    And it should use "get_architecture" for module-level structure
    And it should not read every source file directly

  Scenario: Discover archives existing area docs on first run
    Given ".grimoire/docs/" contains legacy area doc files (e.g. "api.md", "models.md")
    When I invoke "/grimoire:discover"
    Then those files should be moved to ".grimoire/archive/docs/YYYY-MM-DD/"
    And a note should be printed listing each archived file
    And ".grimoire/docs/conventions/" should be created with the new format

  Scenario: Discover writes a data schema only when a data layer exists
    Given the codebase has no ORM, migrations, or schema declarations
    When discover runs
    Then ".grimoire/docs/data/schema.yml" should not be created

  Scenario: Discover skips component inventory when no UI library is present
    Given the codebase has no React, Vue, shadcn, or Storybook signals
    When discover runs
    Then ".grimoire/docs/components.md" should not be created
    And the skill should emit a one-line note explaining the skip
