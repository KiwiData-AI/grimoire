---
name: grimoire-bug-session
description: Guided exploratory testing sessions with charter, progress tracking, session notes, and debrief. Use when a tester wants to spend focused time exploring an area of the application.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-bug-session

Guided exploratory testing sessions. Create a charter, track coverage as you work, take notes, file bugs inline, and produce a session debrief when the timebox expires. This is the difference between "I poked around for an hour" and "I systematically explored auth for 45 minutes and here's what I found."

## Triggers
- User wants to do a focused exploratory testing session
- User says "start a testing session", "explore [area] for [time]", "session-based testing"
- Loose match: "testing session", "session charter", "timebox testing", "exploratory session", "let's explore"

## Routing
- Want AI analysis of specs/code without interactive testing → `grimoire-bug-explore`
- Want to file a specific bug → `grimoire-bug-report`
- Want to fix a bug → `grimoire-bug`

## Prerequisites
- A grimoire project with feature files in `features/`
- Ideally, a previous `grimoire-bug-explore` run or knowledge of what areas are risky (but not required)

## Workflow

### 1. Create the Charter

A session charter defines the mission before the tester starts clicking. Ask the tester:

**Mission** — What are you trying to learn or find?
- "Find edge cases in the checkout flow"
- "Explore what happens with large datasets in reporting"
- "Test the new auth changes for regressions"

If the tester isn't sure, help them pick a mission based on:
- Areas flagged by `grimoire-bug-explore` (if a findings report exists)
- Recent changes (`git log --since="1 week ago"`)
- Open bugs in `.grimoire/bugs/` that might indicate broader issues
- Areas with sparse automation coverage (feature files with few or no step definitions)

**Scope** — What's in bounds and what's out?
- In: specific feature areas, pages, workflows, API endpoints
- Out: explicitly exclude areas that aren't the focus (reduces scope creep)

**Timebox** — How long?
- Suggest 30-60 minutes for focused sessions. Shorter than 20 minutes is too shallow; longer than 90 minutes leads to fatigue.
- The timebox is a guide, not a hard stop. But the skill will prompt a wrap-up when time is close.

**Risk areas** — What are you especially watching for?
- Performance under load, data integrity, permission bypasses, error handling, cross-browser issues
- Pull from `grimoire-bug-explore` findings if available

Create the session directory and charter:

```
.grimoire/sessions/<session-id>/charter.md
```

```markdown
---
id: <session-id>
status: active
tester: <name or role>
started: <YYYY-MM-DD HH:MM>
timebox: <N> minutes
area: <feature area>
---

# Session: <mission summary>

## Mission
<What are we trying to learn or find?>

## Scope
- **In**: <what's included>
- **Out**: <what's excluded>

## Risk Areas
- <specific risks to watch for>

## Test Ideas
<!-- Seeded from explore findings, specs, and risk areas -->
- [ ] <test idea 1>
- [ ] <test idea 2>
- [ ] <test idea 3>
- [ ] <test idea 4>
- [ ] <test idea 5>
```

**Session ID format:** `session-<area>-<YYYYMMDD>` (e.g., `session-auth-20260411`, `session-checkout-20260411`)

### 2. Seed Test Ideas

Before the tester starts, generate a list of things to try based on:

1. **Feature specs** — read scenarios in the scoped area. For each happy path, suggest the corresponding negative/edge cases (same analysis as `grimoire-bug-explore` step 2, but targeted to the session scope).

2. **Automation coverage** — check which scenarios have step definitions and which don't. Prioritize manually testing what isn't automated.

3. **Explore findings** — if a `grimoire-bug-explore` report exists for this area, pull in the flagged gaps as test ideas.

4. **Recent changes** — `git log` the area's implementation files. Recent changes → specific things to test.

5. **Open bugs** — check `.grimoire/bugs/` for reports in this area. Related bugs suggest patterns to probe.

Add these as checkable items in the charter. The tester can add their own as they go.

### 3. Track Progress During the Session

As the tester works, they'll report what they're doing and finding. Track this in real time:

**When the tester reports trying something:**
- Check off the test idea if it matches one in the charter
- Update the coverage map: "you've covered 4 of 7 test ideas in this area"
- Suggest what's left: "you haven't tried the error cases yet — want to explore those next?"

**When the tester finds something interesting:**
- Capture it as a session note in `.grimoire/sessions/<session-id>/notes.md`:
  ```markdown
  ## Notes

  ### <HH:MM> — <short description>
  <what the tester observed>
  <why it's interesting>
  ```

**When the tester finds a bug:**
- Offer to file it immediately via `grimoire-bug-report` (the session context pre-fills the report: area, environment, what they were doing)
- Track it in the session: "Bug filed: `bug-<id>` — <title>"
- Don't interrupt the session flow — file quickly and keep exploring

**When the tester goes off-charter:**
- This is fine — exploratory testing should follow interesting threads. Note the detour but don't block it.
- If they've strayed far from the mission, gently note it: "You've moved into the reporting area — that's outside the session scope. Want to add it to scope or note it for a separate session?"

### 4. Timebox Management

LLMs cannot track wall-clock time. Use interaction counting as a proxy:

- **Set a checkpoint interval** at charter creation: every N interactions (suggest 8-10), pause and summarize progress.
- **At each checkpoint**: report test ideas covered vs remaining, suggest what to prioritize next.
- **After 3 checkpoints** (or when the user signals): prompt wrap-up and debrief.
- **The user controls pacing.** They can say "keep going", "wrap up", or "extend". The skill tracks coverage, not the clock.

### 5. Generate Session Debrief

When the session ends (timebox or tester decides to stop), produce a structured debrief:

Create `.grimoire/sessions/<session-id>/debrief.md`:

```markdown
---
id: <session-id>
status: completed
tester: <name or role>
started: <YYYY-MM-DD HH:MM>
ended: <YYYY-MM-DD HH:MM>
duration: <actual minutes>
area: <feature area>
bugs-filed: <count>
---

# Session Debrief: <mission summary>

## Coverage
- Test ideas completed: <N> of <total>
- Test ideas skipped: <list with reasons>
- Areas explored outside charter: <list>

## Bugs Filed
- `<bug-id>`: <title> (<severity>)
- `<bug-id>`: <title> (<severity>)

## Observations
<!-- Interesting things that aren't bugs but are worth noting -->
- <observation>

## Risks Identified
<!-- Things that need more investigation or a separate session -->
- <risk>

## Automation Gaps Discovered
<!-- Scenarios or behaviors that should be automated but aren't -->
- <gap> — suggested scenario: `<Given/When/Then>`

## Recommendations
- <what to explore next>
- <what to automate>
- <what to escalate>

## Session Quality
- **Charter adherence**: <stayed focused / moderate detours / significant scope change>
- **Time usage**: <efficient / some idle time / ran long>
```

Update the charter status to `completed`.

### 6. Follow-Up

After the debrief:

- **Bugs filed during the session** are already in `.grimoire/bugs/` — they'll flow through normal triage.
- **Automation gaps** — offer to create the missing scenarios now (via `grimoire-bug-explore` step 6 workflow) or add them to a backlog.
- **Follow-up sessions** — if significant areas were skipped, suggest a follow-up session with a new charter.
- **Link to explore** — if this session revealed patterns (e.g., "error handling is weak across the board"), suggest a broader `grimoire-bug-explore` run.

## Important
- **The tester drives the session.** The skill guides and tracks, but doesn't dictate what to test next. Suggest, don't command.
- **Notes are lightweight.** Don't ask the tester to write essays. A timestamp and a sentence is enough. The skill fills in structure.
- **File bugs fast.** When the tester finds something, capture it in 30 seconds and get back to exploring. Don't let bug reporting break the flow.
- **The charter is a guide, not a contract.** Good exploratory testing follows interesting threads. Track detours but don't prevent them.
- **Sessions are not test plans.** A test plan is comprehensive and repeatable. A session is focused and adaptive. Don't try to cover everything in one session.
- **Debrief is mandatory.** The value of a session is in the debrief — what was found, what wasn't covered, what to do next. Without it, the session is just unstructured clicking.
- **Respect the timebox.** Sessions without time limits become aimless. The timebox creates focus and urgency. Extend if productive, but always be conscious of time.
- **Build on previous sessions.** Check `.grimoire/sessions/` for past sessions in the same area. What was covered before? What was flagged for follow-up?

## Done
When the session debrief is generated and follow-up actions are identified, the workflow is complete. The debrief is saved to `.grimoire/sessions/`. Bugs filed during the session flow through normal triage.
