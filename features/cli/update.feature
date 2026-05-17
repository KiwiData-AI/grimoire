Feature: Project update
  As a developer with grimoire already installed
  I want to refresh AGENTS.md, skills, templates, and config
  So that the project benefits from new grimoire releases without losing local customisations

  Background:
    Given the project has been initialized with grimoire

  Scenario: Update refreshes skill files
    When I run "grimoire update"
    Then ".claude/skills/grimoire-*/SKILL.md" should match the installed grimoire version
    And new skills added since init should appear in ".claude/skills/"

  Scenario: Update refreshes the AGENTS.md managed block
    Given "AGENTS.md" contains user content alongside a grimoire managed block
    When I run "grimoire update"
    Then content between the grimoire markers should match the latest template
    And user content outside the markers should be preserved

  Scenario: Update migrates legacy config fields
    Given ".grimoire/config.yaml" uses the legacy flat format
    When I run "grimoire update"
    Then the config should be migrated to the nested format
    And no existing values should be lost

  Scenario: Update reports when a newer version is on npm
    Given the installed grimoire version is older than the latest published version
    When I run "grimoire update"
    Then the output should show an upgrade banner referencing the newer version

  Scenario: Update refreshes templates non-destructively
    Given the project has customised ".grimoire/mapignore"
    When I run "grimoire update"
    Then the customised "mapignore" should not be overwritten
    And missing templates should be added

  Scenario: Update ensures new checks are in config
    Given ".grimoire/config.yaml" predates a new built-in check step
    When I run "grimoire update"
    Then the new check step should be added to the checks list

  Scenario: Update fails clearly when the project was never initialized
    Given the project has no ".grimoire/" directory
    When I run "grimoire update"
    Then the command should exit non-zero
    And the message should suggest running "grimoire init" first

  Scenario: Update fails clearly when config.yaml is corrupt
    Given ".grimoire/config.yaml" exists but is not valid YAML
    When I run "grimoire update"
    Then the command should exit non-zero
    And the error should name the config file and the parse error
