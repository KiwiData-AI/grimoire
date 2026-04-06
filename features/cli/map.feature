Feature: Codebase mapping
  As a developer
  I want to generate a structural map of my codebase
  So that AI assistants can navigate without reading every file

  Background:
    Given a grimoire project with source code

  Scenario: Generate structural snapshot
    When I run "grimoire map"
    Then ".grimoire/docs/.snapshot.json" should be created
    And it should contain the directory tree
    And it should contain key files (entry points, configs, routes)
    And it should not include directories in ".grimoire/mapignore"

  Scenario: Extract symbols
    When I run "grimoire map --symbols"
    Then the snapshot should contain function signatures
    And the snapshot should contain class definitions
    And the snapshot should contain exports and constants

  Scenario: Generate compressed symbol map
    When I run "grimoire map --compress"
    Then a ".symbols.md" file should be generated
    And it should be compact enough for an LLM context window

  Scenario: Detect duplicate code
    When I run "grimoire map --duplicates"
    Then jscpd should scan the codebase
    And clone data should be included in the snapshot

  Scenario: Detect undocumented areas
    Given area docs exist in ".grimoire/docs/"
    When I run "grimoire map --refresh"
    Then it should diff against existing docs
    And report any undocumented or removed areas

  Scenario: Snapshot does not leak absolute paths
    When I run "grimoire map"
    Then the snapshot should not contain the developer's home directory path
