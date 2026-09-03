@manual
Feature: Investigate an engineering question with a spike
  As a developer
  I want uncertain engineering work separated from delivery
  So that evidence resolves the question before tests or production code encode an assumption

  # @manual — the actor is an AI agent running /grimoire:spike.

  Scenario: A spike answers one explicit question with evidence
    Given behavior, a contract, a root cause, or an implementation direction is unknown
    When I ask grimoire to run an engineering spike
    Then the spike names one question and the evidence required to answer it
    And its focused probes may use disposable code without test-first delivery
    And its result is answered, disproved, blocked, or inconclusive
    And I receive referenced findings with the observed evidence

  Scenario: A resolved spike informs active delivery
    Given an active change contains a referenced spike
    When observed evidence resolves the spike question
    Then the result is recorded as a spike lesson in the change learnings
    And only affected unchecked implementation mechanics may be refined
    And approved behavior, scope, and architecture remain unchanged
