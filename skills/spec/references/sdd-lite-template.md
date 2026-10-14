# SDD-lite template — `.hyperui/spec/<topic>.md`

One file, four sections, **each ≤ 20 lines**, one approval at the end. For landings, static
and marketing sites, portfolios, single-screen apps — anything with no backend, no login, no
payments. The same discipline as the full track (EARS, Given-When-Then, real paths, binary
acceptance) at a tenth of the weight. Written in the user's language; code in English.

```markdown
# <Product name> — spec (SDD-lite)
<!-- write only what is needed to execute without ambiguity; mark unknowns as OPEN:; link ids, do not repeat -->

**Date:** <YYYY-MM-DD> · **Track:** SDD-lite (<one-line reason: landing, no backend>) ·
**Design:** `.hyperui/design.md` (<direction name>) · **Source:** <link, only if the user has one>

## Glossary                      <!-- non-tech only: ≤ 6 terms used below, 3-word gloss each -->
- **<term>** — <gloss>

## 1. PRD
- **Problem:** <what hurts, for whom>
- **The ONE job of this page/app:** <sign up · order · call · download · understand>
- **Audience:** <who lands here and from where>
- **Success signal:** <one measurable thing and where it is read>
- **In:** <sections / screens>
- **Out:** <with a one-line why each>

## 2. Requirements
EARS: WHEN <trigger> THE SYSTEM SHALL <observable outcome>. Acceptance as Given · When · Then.

- **REQ-001** — WHEN a visitor opens the page THE SYSTEM SHALL show <hero with the one job> above
  the fold on a 360 px phone. · Given a 360 px viewport · When the page loads · Then the headline
  and the primary action are visible without scrolling.
- **REQ-002** — WHEN the visitor taps <primary action> THE SYSTEM SHALL <outcome>. · Given … ·
  When … · Then …
- **REQ-003** — THE SYSTEM SHALL ship in <product_languages from the profile>; IF the browser
  language is not one of them THEN THE SYSTEM SHALL use <default locale>.
- **REQ-00N** — THE SYSTEM SHALL meet contrast AA, visible focus, no horizontal scroll, ≥ 90 in
  all four Lighthouse categories.

## 3. Design
- **Stack:** <language + framework + styling> — <one line why: profile purpose/budget/platform,
  `skills/ship/references/providers.md` row>. <non-tech: chosen for them, not a menu.>
- **Hosting intent:** <provider, from the same matrix; nothing is bought or deployed here>
- **Pages / sections:** <list in order, each with its copy source — real copy, never lorem ipsum>
- **Tokens:** from `design.md` — <display/body fonts, palette roles, accent, motion>
- **Languages / i18n:** <locales, default, how strings are stored>
- **Files:** `<real/path>` (new) … — every path verified in the repo or marked new
- **Not needed:** <auth, database, payments — say so explicitly>

## 4. Tasks
Ordered; each: files · command · binary acceptance. Tests/QA first where there is logic.

- [ ] **TASK-001** — <Title> · `<files>` · `<build/test command>` · done when <binary check>
- [ ] **TASK-002** — …
- [ ] **TASK-00N** — QA gate: 360/768/1280/1920, AA, focus, Lighthouse ≥ 90, both locales

## Revisions
<R1: … — one line per gate round>
```

## Self-review before presenting
- [ ] Each section ≤ 20 lines; nothing a landing does not need (no auth, no DB sections)
- [ ] Every REQ has a WHEN/WHILE/IF trigger and a Given-When-Then line
- [ ] Stack has a one-line why with a source; non-tech: one option, glossary ≤ 6 terms
- [ ] Product languages taken from the profile, not from the conversation language
- [ ] Every file path verified or marked new; real build/test commands
- [ ] Tasks ≤ 8, ordered, binary acceptance, QA gate last

## Gate
"Does this match what you want? Anything to add or drop before I build TASK-001?" — then
write `.hyperui/state.md` (`phase: spec`, `next: TASK-001`) and one `decisions.md` line.
