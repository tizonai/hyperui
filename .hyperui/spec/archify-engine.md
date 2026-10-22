# diagram → Archify as the engine — spec (SDD-lite)
<!-- write only what is needed to execute without ambiguity; mark unknowns as OPEN:; link ids, do not repeat -->

**Date:** 2026-10-22 · **Track:** SDD-lite (plugin-internal change: scripts, skill text, docs; no UI) ·
**Design:** n/a · **Source:** `docs/research/archify-diagram-method.md` (snapshot `bb990b1`, 2026-10-08)

## 1. PRD
- **Problem:** hyperui's `diagram` skill is a hand-port of Archify's method frozen at commit `bb990b1`
  (2026-10-08). Archify flipped Live motion on by default the next day (`90f1821`, 2026-10-09), is now
  v3.2.0 (2026-10-18) with 11 diagram types, 26 keyframes, Spanish built in, measured repair hints.
  hyperui's port has 5 types, a static 36 KB viewer and its own IR (`nodes/row/col`); every Archify
  release widens the gap and re-porting by hand is maintenance we do not want.
- **The ONE job:** hyperui draws diagrams with the installed Archify toolchain, kept at the latest
  stable on every use, and keeps only what hyperui adds (profile, `.hyperui/` memory, spec integration,
  artifact publish, Mermaid export).
- **Audience:** every hyperui user who asks for a diagram; `spec` in its design phase.
- **Success signal:** `.hyperui/diagrams/hyperui-architecture.html` rendered by Archify (Live/Still
  toggle present, `data-animation="trace"` in the HTML), `scripts/check.sh` green, 0 lines of
  layout/router/viewer code left in hyperui.
- **In:** wrapper script, skill rewrite, IR migration of the dogfood diagram, gate/permit/setup/doctor,
  docs, version 0.14.0.
- **Out:** Archify's `explainer` type (hyperui has `doc`/spec pages for that); vendoring Archify into
  the plugin (17 MB, and it defeats "always latest"); porting any viewer CSS (the engine owns the viewer).

## 2. Requirements
- **REQ-001** — WHEN a diagram task starts THE SYSTEM SHALL locate Archify at
  `<project>/.claude/skills/archify` then `~/.claude/skills/archify`; IF missing THEN it SHALL install
  it with `npx -y skills add tt-a1i/archify -g -a claude-code -y --copy` after one line telling the user.
  · Given no Archify · When `archify.sh ensure` runs · Then `~/.claude/skills/archify/bin/archify.mjs` exists and `version` prints `3.x.y`.
- **REQ-002** — WHEN Archify is present THE SYSTEM SHALL run `npx -y skills update archify -g -y` on
  every diagram task (bounded: 90 s timeout); IF offline or timed out THEN it SHALL keep the installed
  version and say so in one line. · Given installed 3.2.0, network down · When `ensure` runs · Then exit 0, output names `3.2.0 (update skipped: offline)`.
- **REQ-003** — THE SYSTEM SHALL author diagrams in Archify's IR and validate/render them with
  Archify's CLI (`validate`, `deliver`; `finalize --browser-check` only when Chrome is available). No
  hyperui schema, router, validator or viewer remains. · Given the dogfood IR · When `archify.sh run deliver architecture <ir> <html> --json` · Then exit 0 and the HTML contains `data-animation="trace"` and `id="diagram` is NOT required (Archify owns markup).
- **REQ-004** — THE SYSTEM SHALL keep writing `.hyperui/diagrams/<name>.mmd` from the Archify IR for
  `architecture|workflow|sequence|dataflow|lifecycle`; other types print "no Mermaid export for <type>".
  · Given `hyperui-architecture.json` (Archify IR) · When `diagram-check.mjs mermaid <ir>` · Then a `flowchart LR` with one edge per connection and one `subgraph` per boundary.
- **REQ-005** — THE SYSTEM SHALL migrate a hyperui v1 `architecture` IR to Archify's IR
  (`migrate <old> <new>`): `row/col` → `pos` (x = 40 + col·230, y = 60 + row·140), `size [130,60]`,
  `actor` → `external`, `groups` → `boundaries` (`kind: "region"`), `edges` → `connections` with ids;
  other v1 types exit 2 with "re-author in Archify IR". · Given the committed dogfood v1 IR · When `migrate` · Then Archify `validate architecture` on the result exits 0 after ≤ 2 label fixes.
- **REQ-006** — THE SYSTEM SHALL pre-approve only `archify.sh` (`ensure|locate|version|run …`) and the
  reduced `diagram-check.mjs` in `permit.sh`, with no shell chaining. `setup.sh` installs Archify
  (`--skip-archify` to opt out); `doctor.sh` reports Archify installed/missing + version.
- **REQ-007** — THE SYSTEM SHALL pass `scripts/check.sh`: the viewer-size lint (i) and the adapted-code
  attribution lint (h) are replaced by (h') NOTICE names Archify as an external MIT dependency and (j) a
  smoke that, when Archify is installed, validates + delivers the dogfood IR; when not installed, (j) is
  reported as skipped, not failed.
- **REQ-008** — THE SYSTEM SHALL route the agent to Archify's own `SKILL.md`, schemas and examples at the
  located path for authoring rules; hyperui's skill text never restates them. Profile `product_languages[0]`
  maps to `meta.locale` when Archify ships that locale (`en es ar ko zh-CN zh-TW`), else `en`.
- **REQ-009** — THE SYSTEM SHALL bump to 0.14.0 (`package.json`, `.claude-plugin/plugin.json`,
  CHANGELOG entry), record the decision reversal in `.hyperui/decisions.md`, and regenerate the dogfood
  diagram (`.json` migrated, `.html` by Archify, `.mmd`, README screenshot).

## 3. Design
- **New `scripts/archify.sh`** (bash, same style as `profile.sh`): `locate` → prints root or exit 1 ·
  `version` → `version` from `<root>/skill-release.json` · `ensure` → locate → install if missing →
  update (90 s `timeout`-less portable bound: run `npx … update` in background with `wait` + kill after
  90 s, or `perl -e alarm`) → prints `archify <version> at <root>[ (update skipped: <reason>)]` ·
  `run <args…>` → `exec node "<root>/bin/archify.mjs" "$@"` (cwd unchanged; paths absolute).
  Stdout one line per step; exit 0 unless Archify is missing and the install failed.
- **`scripts/diagram-check.mjs`** shrinks to: `mermaid <archify-ir.json> [--out <dir>]`,
  `migrate <v1.json> <out.json>`, `--self-test` (≈ 10 cases: mermaid for the 5 types from Archify's own
  `examples/*.json` when installed, else inline fixtures; migrate round-trip). Delete every layout,
  router, schema, render and diagnostics function; no `// Adapted from archify` headers remain.
- **Delete:** `skills/diagram/schema.json`, `skills/diagram/references/{authoring,diagnostics}.md`,
  `skills/diagram/references/examples/`, `skills/diagram/LICENSE-archify`. Keep
  `docs/research/archify-diagram-method.md` with a top note "superseded 2026-10-22: Archify is now the
  engine; this is the historical method study".
- **`skills/diagram/SKILL.md` rewrite** (≤ 120 lines): §0 `archify.sh ensure` + read Archify `SKILL.md`
  and the type router at `<root>`; §1 type by signals (map hyperui words → Archify types; `flow` →
  `workflow`); §2 procedure: name/scope → author Archify IR in `<root>/.hyperui/diagrams/<name>.json`
  (`meta.output: "<name>.html"`, `meta.locale` per REQ-008) → `run validate <type> <ir> --json` → ≤ 2
  focused repairs using Archify's suggested fixes → `run deliver <type> <ir> <html> --json` (browser
  finalize only with Chrome) → `diagram-check.mjs mermaid` → artifact publish (same url on iteration) →
  memory lines in `design.md`/`state.md`/`decisions.md` unchanged in shape; §3 iterating (edit the IR,
  keep positions) ; §4 Mermaid fast path ≤ 6 nodes (unchanged) and pasted Mermaid → Archify accepts it
  natively; §5 headless/subagents; §6 tone per archetype + care line `diagram validated` only when
  `deliver` exited 0; §7 hard rules: labels mean something, boundaries need a fact, no company names,
  no `explainer` type here, HTML is ~800 KB (say so once per project and suggest ignoring `*.html` in
  git if the repo is public). Sources: Archify repo + installed `SKILL.md` path.
- **Touch-ups:** root `SKILL.md` (row 105, gate line 159, care line 180), `skills/spec/SKILL.md` +
  `references/design-template.md` + `spec-artifacts.md` (Archify IR, types `architecture` + `sequence`),
  `skills/critique|patterns|viz/SKILL.md` (read `components`/`connections`), `scripts/permit.sh` +
  `hooks/hooks.json` description, `scripts/setup.sh` (Archify step), `scripts/doctor.sh` (row),
  `scripts/check.sh` (g shrinks, h→h', i removed, j added), `NOTICE`, `README.md` Diagrams section +
  `docs/assets/` screenshot, `docs/architecture.md` (Mermaid block regenerated), `CHANGELOG.md`,
  `.hyperui/{decisions,design,state}.md`, `.hyperui/diagrams/hyperui-architecture.{json,html,mmd}`.
- **Files verified:** all paths above exist today except `scripts/archify.sh` (new) and
  `.hyperui/spec/archify-engine.md` (this file).
- **Not needed:** evals suite run (policy: one smoke per skill only pre-release); vendoring; new agents.

## 4. Tasks
- [x] **TASK-001** — `scripts/archify.sh` · `bash scripts/archify.sh ensure && bash scripts/archify.sh version` · done when it prints `archify 3.2.0 at /Users/…/.claude/skills/archify` and `run doctor` exits 0.
- [x] **TASK-002** — shrink `scripts/diagram-check.mjs` (mermaid + migrate + self-test) · `node scripts/diagram-check.mjs --self-test` · done when `self-test: N passed, 0 failed` and `wc -c` < 25 000.
- [x] **TASK-003** — migrate dogfood: `migrate .hyperui/diagrams/hyperui-architecture.json` → same path (v1 kept as `hyperui-architecture.v1.json` only until validate passes, then deleted) · `archify.sh run deliver architecture … --json` · done when exit 0, `.html` has `data-animation="trace"`, `.mmd` regenerated.
- [x] **TASK-004** — delete v1 schema/references/LICENSE-archify; rewrite `skills/diagram/SKILL.md`; touch-ups in root/spec/critique/patterns/viz skills · `grep -rn "row/col\|diagram-check.mjs validate\|61440\|LICENSE-archify" --exclude-dir=.git .` → only CHANGELOG/research hits.
- [x] **TASK-005** — `permit.sh`, `hooks.json`, `setup.sh`, `doctor.sh`, `check.sh` (g/h'/i/j), `NOTICE` · `bash scripts/check.sh` · done when green incl. (j) ok.
- [x] **TASK-006** — docs + release: README Diagrams section + new screenshot (Chrome headless 1280 of the Archify HTML), `docs/architecture.md`, research note, CHANGELOG 0.14.0, version bump in both manifests, `decisions.md` reversal line, `state.md`/`design.md` · `grep -c 0.14.0 package.json .claude-plugin/plugin.json CHANGELOG.md` → 1 each.

## Revisions
R0: written 2026-10-22 from the archify-vs-hyperui comparison (both rendered, screenshots in session).
