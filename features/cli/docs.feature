Feature: Generate human-readable OVERVIEW.md
  As a stakeholder browsing the repository
  I want a single readable document summarising features, decisions, and area docs
  So that I can understand the project without opening many files

  Scenario: Docs aggregate features, decisions, area docs, and changes
    Given the project has features, decisions, area docs, and active changes
    When I run "grimoire docs"
    Then "OVERVIEW.md" should be generated at the project root
    And it should contain a section for each of: features, decisions, architecture, active changes

  Scenario: Docs include a data model section when schema.yml exists
    Given ".grimoire/docs/data/schema.yml" exists with table definitions
    When I run "grimoire docs"
    Then "OVERVIEW.md" should contain a "Data Model" section
    And each table should be listed with field count

  Scenario: Docs detect project name from package.json or pyproject
    Given the project has a "package.json" with a name field
    When I run "grimoire docs"
    Then the "OVERVIEW.md" title should use that name

  Scenario: Docs skip sections with no source content
    Given the project has no active changes
    When I run "grimoire docs"
    Then "OVERVIEW.md" should not contain an empty "Active Changes" section

  Scenario: Docs render external APIs from schema.yml
    Given ".grimoire/docs/data/schema.yml" includes an "external_api" entry
    When I run "grimoire docs"
    Then "OVERVIEW.md" should list the external API with its schema reference
