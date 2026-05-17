Feature: Run discover skill
  As a developer onboarding grimoire onto an existing project
  I want one skill to produce a structural map of the codebase
  So that downstream skills can find utilities, follow patterns, and avoid duplicating code

  Scenario: Discover reads the existing snapshot
    Given ".grimoire/docs/.snapshot.json" exists from a recent "grimoire map"
    When I invoke "/grimoire:discover"
    Then the skill should use the snapshot as its directory roadmap
    And it should not re-scan the filesystem itself

  Scenario: Discover prompts for a refresh when snapshot is stale
    Given ".grimoire/docs/.snapshot.json" is older than the latest commit
    When I invoke "/grimoire:discover"
    Then the skill should ask the user to run "grimoire map --refresh" first

  Scenario: Discover generates one area doc per significant directory
    When discover completes a full scan
    Then ".grimoire/docs/" should contain a markdown file per documented area
    And every area doc should include a "Last updated" date
    And every area doc should list reusable code with file path references

  Scenario: Discover regenerates the master index
    When discover completes
    Then ".grimoire/docs/index.yml" should list every area doc
    And each entry should include "directory" and "last_updated"

  Scenario: Discover writes a data schema only when a data layer exists
    Given the codebase has no ORM, migrations, or schema declarations
    When discover runs
    Then ".grimoire/docs/data/schema.yml" should not be created

  Scenario: Discover skips component inventory when no UI library is present
    Given the codebase has no React, Vue, shadcn, or Storybook signals
    When discover runs
    Then ".grimoire/docs/components.md" should not be created
    And the skill should emit a one-line note explaining the skip

  Scenario: Discover prefers graph queries when codebase-memory-mcp is available
    Given the "codebase-memory-mcp" MCP server is registered
    When discover analyses an area
    Then it should use graph queries for symbol enumeration
    And it should not re-read every source file in that area
