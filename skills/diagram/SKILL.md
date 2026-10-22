---
name: diagram
description: "Architecture, workflow, sequence, data-flow, lifecycle, ERD, class, tree, timeline and waterfall diagrams that people explore and agents read, drawn with Archify (installed as a Claude Code skill and updated on every use): Archify's typed JSON IR is the source of truth, Archify validates and renders the explorable HTML (Live/Still motion, light/dark, focus and reach, image/SVG export), hyperui adds the profile, the .hyperui/ memory, the spec integration, the artifact publish and a Mermaid export for READMEs. Use when the user asks for a diagram, an architecture picture, a flow, a sequence, a data flow, a lifecycle/state diagram or 'how does this connect' — any language (hazme el diagrama, dibuja la arquitectura, el flujo de pago, cómo se conecta) — and when spec needs the design-phase diagrams for a backend + UI, multi-service or new-platform change."
user-invocable: false
allowed-tools:
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/telemetry.sh *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/archify.sh *)
  - Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/diagram-check.mjs *)
  - Read(//${CLAUDE_PLUGIN_ROOT}/**)
  - Read(~/.claude/skills/archify/**)
  - Edit(.hyperui/**)
---

# hyperui:diagram — Archify draws, hyperui remembers

Archify (MIT) is the engine: its IR, validator, renderer and viewer. This skill picks the type, keeps the diagram in the user's repo,
links it to the spec, publishes it and exports Mermaid. Layout and markup are never restated here: Archify's own skill text is the manual.

## 0. Before anything

- Resolve the project root with `${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh root` and use it (absolute paths) for `.hyperui/` and for every repo read/write. If `<root>/.hyperui/profile.md` is missing, invoke the `hyperui` skill first (it onboards and routes); otherwise read `profile.md` and `state.md` and never re-ask what they hold. With several roots (`profile.sh roots`), work in the repo the request or the touched file belongs to, with that repo's `.hyperui/` (rules: `${CLAUDE_PLUGIN_ROOT}/references/workspace.md`).
  Profile fields used: `archetype` (tone, §6), `conversation_language` (reply), `product_languages[0]` (label language and
  `meta.locale`: `en es ar ko zh-CN zh-TW` when Archify ships it, else `en`; identifiers stay English).
- **Engine:** `"${CLAUDE_PLUGIN_ROOT}/scripts/archify.sh" ensure` locates Archify (`<project>/.claude/skills/archify`, then
  `~/.claude/skills/archify`), installs it when missing (tell the user in one line first) and updates it (bounded; offline keeps the
  installed version and says so). It prints `archify <version> at <ARCHIFY>`: keep that root, read `<ARCHIFY>/SKILL.md` (Type router,
  Native diagram authoring, Delivery) and the schema + example it names for the type. Every Archify command below is `archify.sh run <args>`.
- Read what already describes the system before inventing it: `brief.md`, `.hyperui/spec/<topic>/02-design.md`, `decisions.md`,
  existing `.hyperui/diagrams/*.json`, then the repo (README, entry points, services, queues, schema). Every component names
  something that exists or is marked new in the spec. Diagrams live in `<root>/.hyperui/diagrams/<name>.{json,html,mmd}`.

## 1. Pick the type by signals — say it in one line, never ask

| Signal in the request or spec | Archify `diagram_type` |
|---|---|
| components, services, stores, "what talks to what", a system overview | `architecture` |
| steps, approvals, decisions, retries, "the process", a flow (hyperui's old `flow`) | `workflow` |
| calls and returns between actors, "what happens when", a request | `sequence` |
| data moving through stages, pipelines, ETL, events, "where the data goes" | `dataflow` |
| states an entity passes through, status fields, "lifecycle" | `lifecycle` |
| tables and keys · classes and relations · single-parent breakdown · when things happened · where the time went | `erd` · `class` · `tree` · `timeline` · `waterfall` |

Ambiguous → `run guide "<scenario>" --json`. Two types at once (architecture + happy-path sequence is the usual pair) → two files.
`spec`'s design phase for a backend + UI, multi-service or new-platform change always asks for `architecture` + `sequence`.

## 2. Procedure — one pass, then at most two focused repairs

1. **Name and scope.** `<name>` = `<topic>-<type>` slug (`checkout-architecture`, `order-lifecycle`); title in `product_languages[0]`,
   one line; a system that does not read in one view → two files, said in one line.
2. **Author the Archify IR** at `<root>/.hyperui/diagrams/<name>.json` per `<ARCHIFY>/SKILL.md` and the type's schema + example:
   `meta.output: "<name>.html"`, `meta.locale` (§0), `meta.quality_profile: "showcase"`, fresh ids, labels that mean something, no
   `meta.animation` (Live motion is Archify's default), automatic routes first — explicit geometry only for a repair.
3. **Validate:** `run validate <type> <ir> --json`. Exit 0 → step 5.
4. **Repair, focused and bounded.** Archify's diagnostics name the element and print measured fixes (`Suggested fix: set labelAt
   [x, y] or set labelDy 24 (below)`, `widen component "x" so the sublabel keeps …`): apply exactly the suggested value to the named
   element and its direct neighbourhood, nothing else moves. Re-run. **Two repairs maximum**; still failing → step 5 with the gap
   declared: the reply lists the remaining diagnostics, `design.md` records `gap: <diagnostics>` on the diagram's line, and the care
   line omits `diagram validated`. Never a silent gap, never a third loop.
5. **Deliver:** `run deliver <type> <ir> <root>/.hyperui/diagrams/<name>.html --json` (refuses while errors remain; relay its
   `update.noticeText` once per task when `update.noticeRequired` is true). Chrome available and visual review asked for →
   `run finalize <type> <ir> <html> --browser-check --json` instead. Then `node "${CLAUDE_PLUGIN_ROOT}/scripts/diagram-check.mjs"
   mermaid <ir>` writes `<name>.mmd` (architecture, workflow, sequence, dataflow, lifecycle; other types print "no Mermaid export").
6. **Show it.** Artifact tool present → publish `<name>.html` (title = `meta.title`, icon `diagram`); a change to an existing diagram
   republishes to the **same url**. No Artifact tool (headless `-p`, evals, subagents) → the `.html` path and one line "open it in a
   browser". Browser tool present → one 1280 light capture into `<root>/.hyperui/evidence/<date>/` per `skills/design/references/browser-verify.md`; otherwise Archify's automated checks are the evidence.
7. **Memory.** `design.md` `## Diagrams`: `<name> · <type> · .hyperui/diagrams/<name>.json · <artifact url or html path> · validated
   <date> (<n> repairs)`, one line per diagram, updated in place. `state.md` `artifacts:` gets `diagrams/<name>.html: <url>` (replaced on
   republish), `iterations:` = repairs. A spec in progress → JSON path + url under `## Diagrams` in `02-design.md` too. Settled decisions (a boundary, a queue) → `decisions.md`.

## 3. Iterating — change what was named, keep the rest still

"Add the queue between API and worker", "move the cache", "rename the gateway": edit the existing `.json` — add, remove or move only
the named elements, keep every other position, re-validate (same two-repair budget), re-deliver, republish to the same url. A new
view is a new file, not a rewrite; never regenerate from scratch for a small change. A `.json` in hyperui's pre-0.14 shape (`nodes`
with `row`/`col`, `groups`, `edges`): `architecture` → `node "${CLAUDE_PLUGIN_ROOT}/scripts/diagram-check.mjs" migrate <old.json>
<new.json>`, then step 3 onwards; other old types are re-authored in Archify IR (the script says so).

## 4. Mermaid — export and fast path, never the source

- The `.mmd` (structure, not layout; not validated) serves READMEs, PRs and chat. **Fast path:** destination is a README, PR body or
  chat answer, or the system has ≤ 6 nodes and no boundaries → fenced `mermaid` block inline, IR + `.mmd` still written, no deliver
  or artifact unless asked.
- **Pasted Mermaid** ("make this pretty"): Archify reads Mermaid natively — follow the "Mermaid input" section of `<ARCHIFY>/SKILL.md`
  (topology and meaning in, fresh Archify IR out), then the normal procedure. The user's Mermaid is never edited.

## 5. Headless, subagents and other specialists

Headless and subagents have no Artifact and no browser: steps 5–7 still run, the reply gives paths. `spec` calls this skill in its
design phase and links the JSON in `02-design.md`; `critique`, `patterns` and `build` read `.hyperui/diagrams/*.json` as Archify IR
(`components`/`boundaries`/`connections`, `participants`/`messages`, `states`/`transitions`): ids that match the code, `sublabel` = technology.

## 6. Tone per archetype (reply in `conversation_language`)

- **non-tech**: the artifact link first, then ONE line saying what the picture shows, then the choice. No diagnostics, no px, no
  file paths unless headless. **dev**: link or path, the type chosen and why in one line, the component count and the repairs made,
  the exports. **senior**: link/path, counts, remaining diagnostics verbatim; nothing else unless asked.
- Every delivery ends with the root §9 **care line** — `diagram validated` **only when `deliver` (or `finalize`) exited 0**, plus
  `a11y` and `dark mode` (Archify's viewer), `sources cited` when the diagram cites the spec or repo files — then the §9 consent line
  when telemetry is `unasked`, then the **choice prompt** (root §9; numbered list as the LAST thing when headless): **add or change
  something in the diagram (Recommended)** · export PNG / Mermaid for the README · a second view (sequence of the main path,
  lifecycle of <entity>) · stop here.
- `state.md`: `phase` unchanged, `next:` the chosen option, `last_updated:` today. With consent: `"${CLAUDE_PLUGIN_ROOT}/scripts/telemetry.sh" event unit_closed diagram outcome=<continue|fix|stop> iterations=<repairs>`.

## 7. Hard rules

- Archify's IR is the only source of truth; the HTML and the `.mmd` are derived and never edited by hand. Labels mean something
  (protocol, action, data asset, mechanism); deleting a label is never a spacing fix — move it, then shorten it.
- A boundary around one component needs a stated isolation fact; external actors stay outside every boundary. No company-specific
  names in the skill (the user's component names belong to the user's repo). No `explainer` type from here (`spec`/`doc` pages cover it).
- The delivered HTML is ~800 KB (Archify's viewer and runtime travel inside it): say so once per project and, when the repo is
  public, suggest ignoring `.hyperui/diagrams/*.html` in git while keeping the `.json` and `.mmd`.

## Sources

Cite only URLs that are listed in a skill/reference or that you opened this session; never construct or guess a URL.
- Archify (MIT), the engine: https://github.com/tt-a1i/archify · installed skill text, schemas and examples at `<ARCHIFY>` (from
  `archify.sh ensure`), usually `~/.claude/skills/archify/` · attribution in `NOTICE` · superseded method study: `docs/research/archify-diagram-method.md`.
- Mermaid syntax (flowchart, sequenceDiagram, stateDiagram-v2): https://mermaid.js.org/intro/syntax-reference.html · browser evidence
  rule: `${CLAUDE_PLUGIN_ROOT}/skills/design/references/browser-verify.md` · WCAG 2.2 contrast and focus: https://www.w3.org/WAI/WCAG22/quickref/
