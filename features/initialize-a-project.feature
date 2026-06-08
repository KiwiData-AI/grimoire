Feature: Initialize a project for spec-driven development
  As a developer adopting grimoire
  I want to set grimoire up in my project
  So that I can start capturing specs and running checks

  Scenario: Setting up grimoire makes the project ready to use
    Given a fresh project directory
    When I set up grimoire in it
    Then the project is ready for spec-driven development
    And it tells me what to do next
