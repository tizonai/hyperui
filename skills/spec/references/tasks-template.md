# Tasks template — `03-tasks.md`

Atomic units of work an agent (`build`) or a person can pick up, grouped into **waves** by
dependency. The waves tell a parallel executor what can run at the same time.

```markdown
# Tasks: <Product or change name>
<!-- write only what is needed to execute without ambiguity; mark unknowns as OPEN:; link ids, do not repeat -->

## Glossary                      <!-- non-tech only: ≤ 6 terms used below -->

## Implementation plan

### Wave 1 — <Theme, e.g. "Foundation: tokens, layout, data model">
Tasks with no dependencies — they can run in parallel.

- [ ] **TASK-001**: <Title>
  - **Files**: `<real/path>` (new / modified)
  - **Inputs → outputs**: <what it takes · what exists when it is done; specific enough to act on without asking>
  - **Acceptance check**: <tests written first — happy, error, edge — · `<exact test command>` (from the repo, never invented) · green>
  - **Covers**: REQ-001 (<title>) · design decision ids
  - **Depends on**: none

### Wave 2 — <Theme>
Depends on Wave 1.

- [ ] **TASK-002**: <Title>
  - ...
  - **Depends on**: TASK-001

## Summary
| Task | Title | Wave | Covers | Status |
|---|---|---|---|---|
| TASK-001 | ... | 1 | REQ-001 | pending |

## Revisions
```

## Rules
- Each task produces something concrete and verifiable; no "set up things".
- Real paths and the repo's real commands in every task.
- **Tests first**: every task with logic names the tests it writes before the code, and a
  wave is not done on the happy path alone — one scenario per realistic failure.
- Dedicated tasks wherever the design requires them (the most common omissions):
  - data migration — create it, apply it locally, verify the schema, confirm the app starts;
  - **wiring / registration** — the new route, provider, component export, DI entry;
  - **i18n strings** for every product language in the profile;
  - **docs** — in the same change as the code, never afterwards;
  - **tests** per layer with new logic (happy, validation error, not found, edge);
  - UI tasks end with the quality gate the `build` specialist runs (audit → polish, responsive, AA).
- No task bigger than one day of work — split it.
- No task in a wave depends on a task in the same or a later wave.
- If waves ship as separate pull requests, a wave must not span two deployables.

## Self-review before presenting
- [ ] Every design component maps to ≥ 1 task; no orphan task that traces to nothing
- [ ] Every task has files, inputs → outputs, acceptance check (tests + command), covers, depends-on — and nothing else; unknowns as `OPEN:`
- [ ] Wave dependencies are correct
- [ ] Migration / wiring / i18n / docs / tests tasks exist wherever the design needs them
- [ ] No task over one day

## Gate and hand-off
"This is the plan. Does the breakdown look right? Anything to add, split or reorder?"
After approval: write `phase: build`, `next: wave 1 (TASK-001, TASK-002)` or `next: TASK-001 (<title>)` to
`.hyperui/state.md` and propose, in one line, wave 1 in parallel (≥ 2 independent tasks) or the first task.
