Feature: Timeboxed exploratory testing session
  As a tester
  I want grimoire to run a structured exploratory session with charter, notes, and debrief
  So that the session produces something usable, not just clicks

  Scenario: Skill opens with a charter
    When I invoke "/grimoire:bug-session"
    Then the skill should ask for: scope, mission, timebox, areas of concern
    And no exploration should start until the charter is captured

  Scenario: Skill tracks progress against the charter while the session is open
    Given a session is open with a charter
    When the user reports an area they have just explored
    Then the skill should append it to the "areas explored" list
    And the "areas remaining" list should be reduced accordingly
    And findings and blockers should be tracked in their own running lists

  Scenario: Skill enforces the timebox
    Given the timebox is 45 minutes
    When the elapsed time reaches the timebox
    Then the skill should prompt the user to end the session

  Scenario: Skill debriefs at the end
    When the session ends
    Then the skill should produce a debrief: what was tested, findings, follow-up bugs to file, gaps to test next time

  Scenario: Skill writes session artifacts under .grimoire/sessions/
    When the session starts and the charter is captured
    Then a charter file should be written to ".grimoire/sessions/<session-id>/charter.md"

  Scenario: Skill writes session notes and debrief under the same session directory
    When the debrief completes
    Then ".grimoire/sessions/<session-id>/notes.md" should contain the captured session notes
    And ".grimoire/sessions/<session-id>/debrief.md" should contain the debrief
    And "<session-id>" should encode the session date and a short charter slug
