@manual
Feature: Isolate new feature work on its own branch
  As a developer
  I want new feature work to start on a dedicated branch
  So that unrelated changes never get entangled

  # @manual — driven by an AI agent reacting to feature-start intent.

  Scenario: Starting a feature on a shared branch is interrupted
    Given I am on a branch that already carries unrelated in-progress work
    When I start describing a new feature
    Then grimoire stops me before any work begins
    And it explains the new feature needs its own branch

  Scenario: Accepting the suggestion moves work onto a fresh branch
    Given grimoire has offered to start the feature on a new branch
    When I accept
    Then my work continues on a branch dedicated to that feature
    And the previous branch is left untouched
