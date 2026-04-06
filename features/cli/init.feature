Feature: Project initialization
  As a developer
  I want to initialize grimoire in my project
  So that my AI coding assistant follows a structured workflow

  Background:
    Given I have a project directory

  Scenario: Initialize a new project with auto-detection
    When I run "grimoire init"
    Then a ".grimoire/config.yaml" should be created
    And an "AGENTS.md" should be created with grimoire markers
    And a "features/" directory should exist
    And a ".grimoire/decisions/" directory should exist
    And the config should contain auto-detected tools

  Scenario: Initialize detects language and package manager
    Given the project has a "package.json" with dependencies
    When I run "grimoire init"
    Then the config "project.language" should be "typescript" or "javascript"
    And the config "project.package_manager" should match the lock file

  Scenario: Initialize detects linter and formatter
    Given the project has an ".eslintrc" or "eslint.config" file
    And the project has a ".prettierrc" or "prettier" in package.json
    When I run "grimoire init"
    Then the config should include a "lint" tool entry
    And the config should include a "format" tool entry

  Scenario: Initialize installs Claude Code skills
    When I run "grimoire init"
    Then ".claude/skills/" should contain grimoire skill files
    And each skill should have a "SKILL.md"

  Scenario: Initialize sets up enforcement hooks
    Given the project is a git repository
    When I run "grimoire init"
    Then ".claude/hooks.json" should exist with pre-commit config
    And ".git/hooks/pre-commit" should contain "grimoire check"

  Scenario: Initialize does not overwrite existing AGENTS.md content
    Given the project has an existing "AGENTS.md" with custom instructions
    When I run "grimoire init"
    Then the custom instructions should be preserved
    And grimoire content should be inside managed block markers

  Scenario: Re-running init is safe
    Given the project was previously initialized with grimoire
    When I run "grimoire init" again
    Then existing config should not be overwritten
    And skills should be updated to latest version
