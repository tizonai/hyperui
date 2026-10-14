# PRD template — `00-prd.md`

A PRD is a **product** document: what and why. No tables, endpoints, packages or framework
names — that is `02-design.md`. Fill it in the user's language. Delete the guidance in brackets.

When the user already has a written brief, ticket or page, this file is a **summary of that
source**: 3–5 sentences in your own words, its acceptance criteria **quoted verbatim** (they are
a contract), the link, and a "What it doesn't answer" list. Never specify from what the user
remembers about the source — open it.

When the change is a small technical one, the whole file is `N/A — <one-line reason>`.

```markdown
# PRD: <Product or change name>
<!-- write only what is needed to execute without ambiguity; mark unknowns as OPEN:; link ids, do not repeat -->

**Source:** <brief written here | summary of <doc title / ticket id> — link, only if the user has one>
**Date:** <YYYY-MM-DD>
**Track:** full

## Glossary                      <!-- non-tech only: ≤ 6 terms actually used below, 3-word gloss each -->
- **<term>** — <gloss>

## Problem
<What hurts today, who it hurts, how often. With numbers if there are any.>

## Goal
<What changes when this exists — one sentence.>

## Success signal
<How we will know it worked. Each signal with where it is read: an analytics event, a table, a
dashboard, a sales number. If nothing can be measured, write that as an explicit risk below.>

## Users
<Who uses it and at what moment. One line per user type. For a solo product: the owner and the
visitor.>

## Scope
**In:** <list>
**Out:** <list — one line of why for each exclusion; "later" is a valid why>

## Use cases
### UC-01: <Title>
<What the user wants to do and what they get. Outcome, not implementation.>

### UC-02: <Title>
...

## Business rules
<Constraints the product imposes: limits, who may do what, valid states, prices, deadlines.>

## Risks and dependencies
<Things outside this work: a provider, a payment account, content that does not exist yet,
legal or privacy constraints in the seller's country.>

## Open questions
<Product decisions that block the requirements. Nothing technical here.>

## Revisions
<R1: <what changed and why> — appended at each gate round, one line each>
```

## Self-review before presenting
- [ ] Source recorded with its link, or the PRD fully written here
- [ ] Acceptance criteria from a source are quoted verbatim, not reinterpreted
- [ ] Scope says what stays out **and why**
- [ ] No technical design: no tables, routes, packages, framework names
- [ ] Every open question is a product decision that blocks requirements
- [ ] non-tech: glossary present, ≤ 6 terms, all of them used in the file
