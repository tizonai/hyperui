---
name: diagram
description: "Architecture, flow, sequence, data-flow and lifecycle diagrams that people explore and agents read: a typed JSON IR is the source of truth, a zero-dependency validator measures the layout and returns repairs, a self-contained HTML viewer shows it (focus, upstream/downstream reach, light/dark, PNG/SVG export) and a Mermaid export goes in READMEs. Use when the user asks for a diagram, an architecture picture, a flow, a sequence, a data flow, a lifecycle/state diagram or 'how does this connect' — any language (hazme el diagrama, dibuja la arquitectura, el flujo de pago, cómo se conecta) — and when spec needs the design-phase diagrams for a backend + UI, multi-service or new-platform change."
user-invocable: false
allowed-tools:
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/telemetry.sh *)
  - Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/diagram-check.mjs *)
  - Read(//${CLAUDE_PLUGIN_ROOT}/**)
  - Edit(.hyperui/**)
---

# hyperui:diagram — the agent places, the validator measures

You draw architecture the way a good engineer sketches it on a whiteboard: the main path first, stores and
branches beside their owner, returns through the free corridor — then a script measures the result and tells
you exactly what to move. The JSON is the only source of truth; the HTML viewer and the Mermaid block are
derived from it and never edited by hand. Nothing is drawn that is not in the JSON, and the viewer's focus and
reach follow only the authored edges.

## 0. Before anything

- Resolve the project root with `${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh root` and use it (absolute paths) for `.hyperui/` and for every repo read/write. If `<root>/.hyperui/profile.md` is missing, invoke the `hyperui` skill first (it onboards and routes); otherwise read `profile.md` and `state.md` and never re-ask what they hold. With several roots (`profile.sh roots`), work in the repo the request or the touched file belongs to, with that repo's `.hyperui/` (rules: `${CLAUDE_PLUGIN_ROOT}/references/workspace.md`).
  Profile fields used: `archetype` (tone, §7), `conversation_language` (reply), `product_languages[0]` (the language of every
  label; identifiers stay English), `design.palette.accent` / `design.fonts.body` (viewer tokens, §4).
- Read what already describes the system before inventing it: `brief.md`, `.hyperui/spec/<topic>/02-design.md`, `decisions.md`,
  existing `.hyperui/diagrams/*.json`, then the repo (README, entry points, services, queues, schema). Every node names something
  that exists or is marked new in the spec; never a component you cannot point at.
- Load `${CLAUDE_PLUGIN_ROOT}/skills/diagram/references/authoring.md` (placement rules and formulas) before writing an IR, and
  `references/diagnostics.md` when the validator reports; `schema.json` is the contract, `references/examples/<type>.json` are
  the models to copy from. Diagrams live in `<root>/.hyperui/diagrams/<name>.{json,html,mmd}` — the user's repo, never the plugin.
- The script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/diagram-check.mjs" <validate|render|mermaid|from-mermaid> <file> [--json] [--out <dir>]`.
  Run it with the absolute path of the IR; `render` and `mermaid` write next to the IR unless `--out` says otherwise.

## 1. Pick the type by signals — say it in one line, never ask

| Signal in the request or spec | `diagram_type` | Reads |
|---|---|---|
| components, services, stores, "what talks to what", a system overview | `architecture` | left → right along the main user journey |
| steps, approvals, decisions, retries, "the process" | `flow` | left → right, branches below, `mainPath` emphasised |
| calls and returns between actors, "what happens when", a request | `sequence` | top → bottom, participants in order of first touch |
| data moving through stages, pipelines, ETL, events, "where the data goes" | `dataflow` | stages as columns, labels name the data asset |
| states an entity passes through, status fields, "lifecycle" | `lifecycle` | forward on the middle row, waits above, failures below in a lane |

Two types asked at once (architecture + the happy-path sequence is the usual pair) → two files linked through `meta.related`.
`spec` in its design phase for a backend + UI, multi-service or new-platform change always asks for architecture + sequence.

## 2. Procedure — one pass, then at most two focused repairs

1. **Name and scope.** `<name>` = `<topic>-<type>` slug (`checkout-architecture`, `order-lifecycle`). 8–12 primary nodes per view;
   more → split into views linked by `meta.related` and say so in one line. Title in `product_languages[0]`, one line, no subtitle.
2. **Classify every relationship before placing anything** (authoring.md §1): main path · branch or store · return · second entrance ·
   fan-out. Then place: main path on one row (or column for lifecycle/sequence order), stores and branches directly above or below their
   owner, returns on the side with no branches, groups only for real boundaries (ownership, trust, runtime, persistence, stage, lane).
3. **Write the IR** to `<root>/.hyperui/diagrams/<name>.json` with `schema_version: 1`, `meta.lang`, `row`/`col` per node, short edge
   labels (≤ 24 characters, meaning not decoration), one emphasis per view. Copy the shape from the example of that type. No `via`,
   `labelAt` or pinned sides unless the validator asks for them.
4. **Validate**: `validate <name>.json --json`. `0 errors` → step 6. Warnings (`proper-crossing`, `too-many-nodes`) are reported, not
   repaired unless cheap.
5. **Repair, focused and bounded.** Each diagnostic names its `subject`, measures (`evidence.px`) and offers `supportedFixes`
   (`references/diagnostics.md`). Change only the named element and its direct neighbourhood — other nodes keep `row`/`col`. Re-run.
   Compare by `code + subject`, not by count. **Two repairs maximum**; still failing → go on to step 6 with the gap declared: the reply
   lists the remaining codes with their subjects, `design.md` records `gap: <codes>` on the diagram's line, and the care line omits
   `diagram validated`. Never a silently broken drawing, never a third loop.
6. **Render and export**: `render <name>.json` (writes `<name>.html`; refuses while errors remain) and `mermaid <name>.json` (writes
   `<name>.mmd`). The HTML embeds the IR in `<script type="application/json" id="diagram-ir">`.
7. **Show it.** Artifact tool present → publish `<name>.html` (title = `meta.title`, icon `diagram`, `description` = `meta.description`);
   a change to an existing diagram republishes to the **same url**. No Artifact tool (headless `-p`, evals, subagents) → the path of
   the `.html` and one line "open it in a browser". Browser tool present → one capture at 1280 (light) into
   `<root>/.hyperui/evidence/<date>/` per `skills/design/references/browser-verify.md`; otherwise say the static validator is the evidence.
8. **Memory.** `design.md` `## Diagrams`: `<name> · <type> · .hyperui/diagrams/<name>.json · <artifact url or html path> · validated <date>
   (<n> repairs)` — one line per diagram, updated in place. `state.md` `artifacts:` gets `diagrams/<name>.html: <url>` (one entry per
   diagram, replaced on republish), `iterations:` = repairs used. A spec in progress → the JSON path and the url go under `## Diagrams`
   in `02-design.md` too. Decisions that the diagram settled (a boundary, a queue) → one line in `decisions.md`.

## 3. Iterating — change what was named, keep the rest still

"Add the queue between API and worker", "move the cache", "rename the gateway": edit the existing `.json` — add, remove or move only the
named elements, keep every other node's `row`/`col`, re-validate (same two-repair budget), re-render, republish to the same url. A new view
of the same system is a new file linked by `meta.related`, not a rewrite. Never regenerate a diagram from scratch to apply a small change.

## 4. Tokens — the diagram looks like the product

The viewer takes colours and type from hyperui's tokens (graphite + emerald, light and dark, AA contrast) and the seven component types map
to tokens, never to hex in the SVG. When `design.md` or `profile.md` holds a palette or fonts, pass them: `meta.tokens.accent` =
`design.palette.accent` (6-digit hex), `meta.tokens.font` = the body font stack. No `design.md` → the defaults, nothing invented.

## 5. Mermaid — export and fast path, never the source

- The `.mmd` is always written (step 6) for READMEs, PRs and chat; it carries structure, not layout, and is not validated.
- **Fast path:** the destination is a README, PR body or chat answer, or the system has ≤ 6 nodes and no groups → give the fenced
  `mermaid` block inline in the reply, still write the IR + `.mmd` (the JSON remains the source other specialists read), skip render
  and artifact unless asked.
- **Pasted Mermaid** ("make this pretty"): `from-mermaid <file.mmd> [--type …]` gives an IR skeleton (ids, labels, edges, a first
  `row`/`col` by rank); complete types, sublabels and placement with the authoring rules, then the normal procedure. The user's Mermaid is
  never edited or "beautified".

## 6. Headless, subagents and other specialists

Headless and subagents have no Artifact and no browser: steps 6–8 still run, the reply gives paths. `spec` calls this skill in its design
phase and links the JSON in `02-design.md`; `critique`, `patterns` and `build` read `.hyperui/diagrams/*.json` to reason about
components and dependencies — write the IR so it reads well as data (ids that match the code's names, `sublabel` with the technology).

## 7. Tone per archetype (reply in `conversation_language`)

- **non-tech**: the artifact link first, then ONE line saying what the picture shows ("the app, its server and the two external services it
  depends on"), then the choice. No codes, no px, no file paths unless headless.
- **dev**: link or path, the type chosen and why in one line, the node count and the repairs made (`1 repair: moved cache off the API → DB corridor`), the exports.
- **senior**: link/path, counts, remaining warnings with their codes; nothing else unless asked.
- Every delivery ends with the root §9 **care line** — `diagram validated` **only when the last `validate` returned 0 errors**, plus
  `a11y` (keyboard focus, aria labels), `dark mode`, `sources cited` when the diagram cites the spec or repo files — then the §9 consent line
  when telemetry is `unasked`, then the **choice prompt** (root §9; numbered list as the LAST thing when headless):
  **add or change something in the diagram (Recommended)** · export PNG / Mermaid for the README · a second view (sequence of the main
  path, lifecycle of <entity>) · stop here.
- `state.md`: `phase` unchanged (a diagram serves the current phase), `next:` the chosen option, `last_updated:` today. With consent:
  `"${CLAUDE_PLUGIN_ROOT}/scripts/telemetry.sh" event unit_closed diagram outcome=<continue|fix|stop> iterations=<repairs>`.

## 8. Hard rules

- No auto-layout and no freehand coordinates: every node has `row`/`col`; `via` only for a measured defect.
- Labels mean something (protocol, action, data asset, mechanism); deleting a label is never a spacing fix — move it, then shorten it.
- A boundary around one node needs a stated isolation fact; external actors stay outside every boundary.
- No company-specific names in the skill or its references; the user's component names belong to the user's repo.
- Keep the viewer under 60 KB: no fonts, no libraries, no inline images in the IR.

## Sources

Cite only URLs that are listed in a skill/reference or that you opened this session; never construct or guess a URL.
- Method and measurements (agent-placed layout, validators, single-file viewer; MIT, commit `bb990b1`): `docs/research/archify-diagram-method.md` ·
  https://github.com/tt-a1i/archify · licence copy: `skills/diagram/LICENSE-archify`, attribution in `NOTICE`.
- Mermaid syntax (flowchart, sequenceDiagram, stateDiagram-v2): https://mermaid.js.org/intro/syntax-reference.html
- Browser evidence rule: `${CLAUDE_PLUGIN_ROOT}/skills/design/references/browser-verify.md` · WCAG 2.2 contrast and focus: https://www.w3.org/WAI/WCAG22/quickref/
