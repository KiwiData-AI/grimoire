Feature: Symbol extraction
  As a developer
  I want to extract function signatures and class definitions
  So that AI assistants know the API surface without reading every file

  Scenario: Extract Python symbols
    Given a Python file with functions, classes, and methods
    When symbol extraction runs
    Then it should capture function names and parameters
    And it should capture class names and their methods
    And it should include the source file path and line number

  Scenario: Extract TypeScript symbols
    Given a TypeScript file with exported functions and interfaces
    When symbol extraction runs
    Then it should capture exported function signatures
    And it should capture class definitions
    And it should capture type annotations

  Scenario: Extract Go symbols
    Given a Go file with exported functions and structs
    When symbol extraction runs
    Then it should capture exported function signatures
    And it should capture struct definitions

  Scenario: Extract Rust symbols
    Given a Rust file with pub functions and structs
    When symbol extraction runs
    Then it should capture public function signatures
    And it should capture struct and enum definitions

  Scenario: Skip files over size limit
    Given a file that is very large
    When symbol extraction runs
    Then it should skip files that would cause memory pressure
