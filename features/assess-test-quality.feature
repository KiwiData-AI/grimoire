Feature: Assess the quality of tests
  As a developer
  I want weak or meaningless tests flagged
  So that my test suite gives real confidence

  Scenario: A weak test is flagged
    Given a grimoire project with a test that asserts nothing meaningful
    When I assess test quality
    Then I am warned that the test is weak
    And the assessment does not pass

  Scenario: Strong tests pass the assessment
    Given a grimoire project with a test that makes a real assertion
    When I assess test quality
    Then I am told the tests look sound
