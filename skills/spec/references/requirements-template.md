# Requirements template — `01-requirements.md`

Requirements **break the approved PRD into observable behavior**; they do not reinvent it.
Every use case in `00-prd.md` traces to at least one REQ. Written in the user's language.

**EARS** (Easy Approach to Requirements Syntax, Alistair Mavin) — explain it in one line the
first time it appears in a file. Patterns:

| Pattern | Shape | Use for |
|---|---|---|
| Event-driven | `WHEN <trigger> THE SYSTEM SHALL <response>` | the default — most behavior |
| State-driven | `WHILE <state> THE SYSTEM SHALL <response>` | modes: offline, logged out, trial expired |
| Unwanted behavior | `IF <failure or bad input> THEN THE SYSTEM SHALL <response>` | errors and edge cases |
| Optional feature | `WHERE <feature is included> THE SYSTEM SHALL <response>` | plan-dependent or flag-dependent behavior |
| Ubiquitous | `THE SYSTEM SHALL <response>` | always-true properties (accessibility, languages) |

Acceptance criteria are **Given / When / Then** scenarios (Gherkin): Given = the state before,
When = the action, Then = the observable result. Binary — pass or fail — never "works well".

```markdown
# Requirements: <Product or change name>
<!-- write only what is needed to execute without ambiguity; mark unknowns as OPEN:; link ids, do not repeat -->

Requirements use **EARS** notation: each one is a condition–behavior pair (WHEN something
happens, THE SYSTEM SHALL do something observable).

## Glossary                      <!-- non-tech only: ≤ 6 terms used below -->

## Summary
<2–3 sentences: what the change does and why it matters.>

## Scope
**In scope:** <list>
**Out of scope:** <list>
**Affected areas:** <real paths or screens read in the repo; new ones marked **new**>

## Requirements

### REQ-001: <Short title>
**User story:** As a <role>, I want <capability>, so that <benefit>.

WHEN <specific event or trigger>
THE SYSTEM SHALL <observable outcome>

**Acceptance:**
- [ ] Given <state> · When <action> · Then <result>
- [ ] Given <edge or error state> · When <action> · Then <result>
- [ ] Build passes: `<exact command from the repo>`
- [ ] Tests pass: `<exact command from the repo>`

### REQ-002: <Short title>
...

## Non-functional requirements
<Only if they apply: performance budget, accessibility level, product languages / i18n,
personal-data handling, uptime, device support. One EARS line each.
Mandatory when the change adds state that outlives a request (buffer, timer, cache, queue) or
periodic work (cron, sweep, pipeline step) — each answer becomes a REQ with a test:
- Deploy / shutdown: WHEN the process receives SIGTERM on <every entrypoint that runs it>
  THE SYSTEM SHALL <flush / release the state, or count what is lost>.
- Time budget: WHILE <job> runs THE SYSTEM SHALL finish <step> within <N> s, the whole chain within
  <interval>, and SHALL still run <the steps after it> IF <step> fails.>

## Open questions
<Only decisions that block the design.>

## Traceability to the PRD
| Use case | Requirements that cover it |
|---|---|
| UC-01 (<title>) | REQ-001 (<title>), REQ-003 (<title>) |

<If a use case has no REQ, say so here: it is scope being cut, not an oversight.>

## Revisions
<R1: ... >
```

## Self-review before presenting
- [ ] Every UC in `00-prd.md` traces to ≥ 1 REQ and the table is written
- [ ] Nothing contradicts acceptance criteria quoted from the user's source
- [ ] Each REQ is one cohesive behavior with a specific WHEN (an event, not "when needed")
- [ ] SHALL clauses describe outcomes, not implementation ("shows a confirmation", not "calls the API")
- [ ] Every acceptance line is binary; build and test commands are the repo's real ones
- [ ] Listed paths exist in the repo or are marked **new**
- [ ] No filler; EARS explained the first time; ids cited with their gloss
- [ ] Open questions contain only decisions that block the design

## Gate question
End with a size signal so the user can correct scope while it is cheap: "It looks like a
[single-screen / multi-page / backend + UI / multi-service] change touching <areas>. Does it
capture what you want? Anything to adjust before design?"
