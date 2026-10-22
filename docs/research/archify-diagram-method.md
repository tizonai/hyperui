# Archify: how it makes architecture diagrams (research for a hyperui `diagram` skill)

> **Superseded 2026-10-22:** Archify is now the engine. hyperui 0.14.0 installs it as a Claude Code skill (`scripts/archify.sh ensure`, `npx skills add tt-a1i/archify`), updates it on every use and calls its CLI; the hand-ported IR, validator and viewer this study fed (0.13.x) were deleted. This is the historical method study, kept for context; authoring rules come from Archify's own `SKILL.md` at the installed path.

Snapshot 2026-10-08. Source: <https://github.com/tt-a1i/archify> (MIT), pinned at commit `bb990b17b886e83d633e273221615eb259a92c78`. All files were read raw at that SHA (see §7). This is a study of the method; we do not install archify. "(unverified)" marks what I did not open or test myself.

**What it is.** A skill (`archify/SKILL.md`) where the agent writes **typed JSON IR**. Zero-dep Node renderers (`archify/bin/archify.mjs`, ~267 KB) validate it, lay it out with fixed grid math and an obstacle-aware orthogonal router, write **one self-contained HTML** with **inline SVG**, then check that HTML statically and in headless Chrome. Their own A/B test (`experiments/v3-mermaid-validation/RESULT.md`) found that stock Mermaid and Mermaid with archify CSS both looked bad next to agent-placed layouts: *"layout is the product, not CSS"*. They dropped the planned Mermaid→dagre parser. Mermaid input is now only read as topology and then laid out fresh. This affects our Mermaid fast path (§6).

---

## 1. The IR

Every document has `schema_version`, `diagram_type`, and `meta` (required `title` and `output`, a portable relative `.html` path). Every level sets `additionalProperties:false`, so unknown fields are rejected. The schemas are JSON Schema draft 2020-12, compiled with ajv's standalone generator into a committed `generated-validators.mjs` (530 KB), so nothing is installed at runtime.

**Shared `$defs`** (`common.schema.json`):
- `id`: pattern `^[a-zA-Z][a-zA-Z0-9_-]*$`.
- `point`: `[x,y]`.
- `side`: `left|right|top|bottom`.
- `componentType`: `frontend|backend|database|cloud|security|messagebus|external`. This drives colour and the legend.
- `variant`: `default|emphasis|security|dashed`. Sequence diagrams also allow `return`.
- `nodeIcon`: technical types plus everyday icons (`calendar`, `person`, …) and `none`.
- `cards[]`: `{dot: cyan|emerald|violet|amber|rose|orange|slate, title, items[]}`, i.e. summary cards shown under the SVG.
- `repository`: `{url, revision: 40-hex, provider?: github|gitee, link_mode?: web|local-only}`.
- `sourceReferences[]`: `{path ≤240, line?, end_line?, label ≤48}`.
- Optional `meta` fields: `locale`, `translations`, `animation: trace|none`, `visual_preset: classic|signal-flow|blueprint|editorial`, `quality_profile: standard|showcase`, `legend {mode: auto|all|hidden, entries{kind:{label,visible}}}`, `viewBox [w,h]`.
- Every relationship can take an optional `id`, which makes a stable `#relation=<id>` link.

| Type | Structural arrays | Node fields | Edge fields | Placement model |
|---|---|---|---|---|
| **architecture** (v1) | `components`, `boundaries`, `connections`, `cards` | `id`, `type`, `label`, `sublabel`, `tag`, `icon`, `brand`, `sources`, and either `row/col` (grid) or `pos [x,y]` + `size [w,h]` | `from`, `to`, `label`, `variant`, `fromSide/toSide`, `route: auto\|straight\|orthogonal-h\|orthogonal-v`, `via[]`, `labelAt`, `labelDx/Dy`, `labelSegment`, `width` | optional `layout{mode:grid, origin, cols≤12, gapX, gapY, cellW≥40, cellH≥24}` (defaults: origin [40,80], 4 cols, gaps 30/40, cell 130×64); `pos` overrides `row/col`. Boundaries: `{kind: region\|security-group, label, wraps:[ids], pad}` |
| **workflow** (v1/v2) | `lanes{id,label,variant:normal\|exception}`, `phases{fromCol,toCol}`, `groups{lane,fromCol,toCol}`, `mainPath[ids]`, `nodes`, `edges`, `semanticChecks` | `lane`, `col 0..5`, `type`, `width/height`, `yOffset` | adds `role: main\|branch\|async\|return\|error`; `route: auto\|straight\|drop\|outside-right\|return-left\|bottom-channel\|up-channel`; `channelX/Y`, `bias 0..1` | lanes × logical columns. v2 "readable" compiler solves pixel positions (120px rank baseline) |
| **sequence** (v1) | `participants (≥2)`, `segments{from,to,label}` (y bands), `messages (≥1)`, `activations{participant,from,to}` | participants: `type`, `label`, `sublabel` | `from`, `to`, `y ≥160` (author-owned vertical order), `label`, `variant` incl. `return`, `note` | fixed columns (x = 62 + i·108, 86×54 boxes) or `column_fit: spread`; messages ≥28px apart; arrow span ≥60px |
| **dataflow** (v1) | `stages (2–5){label}`, `nodes`, `flows` | `stage`, `row 0–4`, 112×58 default | `label` (required: names the data asset), `classification` (e.g. "PII touch"), `route: auto\|straight\|vertical-channel\|bottom-channel\|top-channel` | stage x = 100 + s·215; row y = 128 + r·114 |
| **lifecycle** (v1/v2) | `lanes (≤4)`, `states`, `transitions` | `type: start\|active\|waiting\|decision\|success\|failure\|neutral\|external`, `step` ("01"), `lane`, `col 0..4` | `route` incl. `right-/left-channel`, `cornerRadius`, `note` | v2: one row per lane (`main` first, `terminal` last); `col` is a shared x grid; 140×64 states; col gap 64→44; row gap ≥120 |

Workflow `semanticChecks` (`allowedRoots`, `allowedTerminals`, `requiredEdges`, `requiredPaths`) are graph assertions checked before layout. They are a cheap way to catch topology mistakes.

An opt-in engineering profile `deployment-ownership` (architecture only) adds fail-closed rules:
- every non-external component has an owner in `tag` and sits in exactly one `region`;
- databases sit inside a security-group;
- a security group's members share one region;
- any edge that crosses a region or security group must name its crossing mechanism in `label`.

## 2. Authoring rules the agent follows

These come from `SKILL.md`, `references/authoring-defaults.md`, `authoring-contract.md`, `architecture-layout-repair.md`, the per-renderer READMEs and `docs/authoring-cookbook.md`.

**Choosing the type and scope.**
- Pick the type from the question being asked: components → architecture, process/approvals → workflow, calls/returns → sequence, custody/transforms → dataflow, states → lifecycle.
- Mermaid maps by kind: `flowchart` → workflow (or architecture), `sequenceDiagram` → sequence, `stateDiagram` → lifecycle. Mermaid styling is never rendered as-is.
- The default architecture view is a **system overview led by the main user journey**.
- Group roles into subsystems unless grouping would hide control ownership, a trust or persistence boundary, or lifecycle behaviour.
- Secondary capabilities go in concise notes or cards.
- Name a narrower scope in the title.

**Node budget.** The cookbook says *"roughly 8–12 primary nodes, one main path, and only the branches that help explain the question."* The later SKILL wording says that no node, edge or boundary count is a target or ceiling.

**When to split.** When the browser gate finds the SVG alone taller than the viewport at the minimum reader width, the fix text says *"split the diagram into two"* (`bin/visual-check.mjs`). Otherwise:
- reflow the layout before shrinking text;
- never introduce an internal scroller;
- never drop text below the floor (6px projected text fails; aim for about 7.5px at 1440px).

**Placement before coordinates** (the "layout judgment" core). Classify each relationship first, then place nodes:
- **Main path**: neighbours sit adjacent in reading order. A medium-length path may step through rows instead of becoming a shallow strip. The main actor and its first step start near the origin.
- **Branch or store**: directly above or below its owner, centred, so the edge is one straight segment. Keep all stores of one row on the same side.
- **Return**: put its source on the side of the main path that has no branches, so it runs through an empty corridor. Arrange feedback cycles around an open rectangle in real edge order.
- **Second entrance** into a node: arrive from a different side, usually from below or above.
- **Fan-out**: a side with k edges needs `32 + 14·(k−1)` px. Spread a hub over two or three sides or make it larger. Centre a parent on its children.
- Before writing positions, trace each non-main edge. Its straight or one-bend corridor must not cross a node or another edge. If it does, move the endpoint that is off the main path.

**Spacing grid** (clear gap, not centre distance). A labelled main-path edge needs a gap of at least `6.5px × ASCII units + 21px` (CJK characters count 2). The label mask is about `6.5·units + 13`, and the gap must exceed the mask by 8px. Sublabel width is `5.4·units + 8` at 9px. Node text fits at a width factor of 0.6·font·units plus 8px padding. Nodes must be at least 8px apart. An edge must be at least 24px long.

**Routing conventions.**
- Use automatic routes first.
- Pin `fromSide/toSide` only for a necessary branch or return.
- Keep `via`, `channelX/Y` and `labelAt` for **measured** defects only.
- A side is a direction contract: the first and last segments must be perpendicular to the box and point outward (or inward) on the named side.
- Ports start at side midpoints. Automatic **Port Spread** spaces shared endpoints symmetrically (16px corner gutter, about 14px pitch).
- Route rhythm: every segment ≥8px, interior segments ≥16px. Nearly-parallel spread ports get a 24px stub plus a 16px outside bridge.

**Emphasis.**
- `emphasis` marks the main path (lifecycle v2 emphasises forward `main` transitions automatically).
- `security` marks auth/policy/PII, `dashed` marks async/batch/events, and `return` marks quiet responses in sequences.
- Workflow `lane.variant: exception` holds wait, deny, retry and failure paths, keeping them off the happy path.

**Labels.**
- Labels carry meaning (action, protocol, direction, sync vs async, cross-boundary mechanism).
- Deleting a label is never a spacing repair. A label may be left out only when both endpoints fully imply it.
- Repair order for a label: move it, then adjust route or spacing, then shorten the wording.
- Dataflow labels name the data asset (`clickstream`), not the transport.

**Boundaries** represent real isolation, ownership, runtime or persistence facts. A boundary around a single node needs an explicit isolation fact. External actors stay outside the boundary rectangle, including its padding.

**Header and presentation.** One concise title, no subtitle unless asked, no visual preset unless asked, legend `auto` (shows only the kinds present), and output is static unless trace motion is requested.

**Repair loop.** The agent writes the full candidate with no prose coordinate planning, then runs `finalize` once. On failure it edits only the connected neighbourhood named by the diagnostics and reruns. Diagnostics are compared by code, subject and evidence, not by total error count. There are at most two focused repairs, then one evidence-based retry; after that it reports the gap instead of looping.

## 3. Validation checklist

The pipeline is `finalize` = schema → renderer layout gates → `deliver` (atomic write plus SHA receipt) → strict artifact `check` → real-browser `browser-check`. It stops at the first failure.

**Diagnostic shape** (`renderers/shared/diagnostics.mjs`):

```json
{code, severity: error|warning, message, subject{diagramType, collection, index, id, from, to},
 evidence{measured px, points, bounds}, supportedFixes[]}
```

Messages read `[code] <type> <collection>[i] id "x" "a" -> "b" <what> at [x,y] — <fix hint>.`

**Schema stage** (`validator.mjs`): ajv errors become `schema/<keyword>`. The path is annotated with the nearest `id`/`label` (for example `/nodes/3 (id/label: "router")`). Each keyword gets a fix template, such as `additionalProperties` → "remove unsupported property X" and `enum` → "choose one of [...]".

**Cross-collection** checks: duplicate ids, duplicate relationship ids, and focus ids that point at nothing.

**Renderer layout gates** (architecture, from `render-architecture.mjs`; the other modes have equivalents):

| Check | Fails when |
|---|---|
| unique ids / unknown endpoints | duplicate component id; a connection or `wraps` references a missing id |
| placement | no `pos` and no `row/col`; `col ≥ layout.cols`; two components share a grid cell; non-finite or ≤0 size; component outside the viewBox |
| text fit | a label, sublabel or tag needs more width than the box at the legible minimum font |
| node overlap | components less than 8px apart (the fix suggests a separation) |
| boundaries | title wider than the frame, outside the frame or viewBox, overlapping a component or another title; frames partially overlap; frame containment contradicts `wraps` membership; `layout/boundary-out-of-bounds` (left/top overflow needs moves, right/bottom overflow can grow the viewBox) |
| `layout/route-out-of-bounds`, `layout/self-loop-ports` | route points outside the canvas (showcase); self-loop ports less than 24px apart |
| short edge | endpoint distance under 24px |
| `clean-flow/endpoint-side-direction` | first or last segment does not leave or enter along the pinned side |
| `clean-flow/edge-through-node` | a segment passes within 2px of an unrelated opaque node. Always an error, whatever the profile |
| `composition/proper-crossing` | two unrelated edges form an X (error in showcase, warning in standard). An automatic crossing drawn with a mask "halo" underlay counts as a *resolved crossover* and is only reported as advice |
| `composition/ambiguous-corridor` | unrelated edges overlap collinearly for 8px or more |
| `composition/arrowhead-collision` | arrowheads into the same node too close together |
| `composition/container-border-run` | an edge runs along a boundary border (crossing a border is fine) |
| `composition/micro-segment`, `short-interior-segment` | segment <8px, interior segment <16px |
| `composition/excessive-route-detour` | route ≥2.5× an obstacle-aware shortest legal route, AND ≥200px longer, AND ≥96px outside the content envelope |
| label vs node / label vs label / `composition/label-gap` | label overlaps a component (fix gives exact `labelAt`/`labelDx`); a short horizontal gap is smaller than label width + 16 |
| `composition/label-route-clearance` | label mask within 4px (showcase) or 2px of another route |
| `composition/label-canvas-containment` | label outside the canvas |
| `legend/*`, `composition/desktop-readability` | legend overflows or overlaps content; projected node text below 6px at 1440px |

**Static HTML check** (`scripts/check-render-output.mjs`, 9 named checks):
- `single_svg`: exactly one `<svg>`.
- `finite_svg`: no `NaN`, `undefined` or `Infinity` in numeric attributes.
- `orthogonal_arrows`: no diagonal segments unless the route was authored `straight`.
- `relationship_crossings`, `relationship_corridors`, `container_border_runs`, `route_rhythm`.
- `label_route_clearance`, `legend_clearance`.

It re-parses routes from the `data-composition-points` attributes, so it can check an artifact it did not produce. It also reports metrics: max bends (suggested ≤2), stretch (≤1.35), and minimum segment length.

**Browser gate** (`bin/visual-check.mjs`):
- Drives Chrome over the DevTools pipe at 1440×900, 1600×1000, 1920×1080 and 2048×1320, in both themes.
- `viewer/viewport-overflow`: `scrollWidth > innerWidth`, or a too-tall page without the declared readable-scroll exception. The fix is a pixel budget ("reduce viewBox height to N", or "split the diagram into two").
- Also checks `viewer/diagram-clipped`, `viewer/projected-text-readability`, `viewer/theme-state` and chrome/legend clearance.
- The receipt says plainly that this measures runtime behaviour and does **not** approve visual quality. Visual review is a separate, optional step, reported as `not_requested|passed|skipped|failed`.

## 4. Renderer anatomy

**Assembly.** `scripts/generate-viewer.mjs` splices 14 source fragments from `viewer/` into `viewer/template.source.html` at `/* ARCHIFY:* */` markers. It produces the committed `archify/assets/template.html` (728 KB), which all five renderers fill.

A rendered example (`examples/web-app-rendered.html`, 762 KB) contains:
- `<html lang data-theme data-preset>`.
- Two `<style>` blocks: about 96 KB of base64 JetBrains Mono WOFF2 subsets (fonts are embedded, with no network or `local()` source), and about 190 KB of viewer CSS.
- Three `<script>` blocks: about 1 KB of boot code, a 21 KB `type="application/json"` `#archify-i18n-data` catalog, and about 404 KB of viewer JS (classic scripts, no modules).
- **One inline SVG** (about 25 KB for 9 nodes). It has `role="img"`, `<title>` and `<desc>`, and `<defs>` with one arrowhead marker per variant plus a 40px grid pattern.
- Drawing order: boundary `<rect data-graph-role="structural-frame">`, then edges, then nodes, then the legend.
- Each edge is a `<path data-edge-from data-edge-to data-edge-label data-edge-id data-composition-points="x,y;x,y" class="a-<variant>" marker-end>`. Corners are rounded with `Q` segments. A crossing gets a `--mask`-coloured underlay path, which is the "halo".
- Each node is a `<g id="node-x" data-node-id data-node-kind tabindex=0 role=button aria-label>` holding a `c-mask` rect (an opaque backing so edges behind it are hidden), a `c-<type>` rect, an icon `<g>` and `<text class="t-primary|t-muted">`.
- All colours are CSS variables (`--<type>-fill/-stroke`, `--arrow`, `--mask`), switched by `[data-theme]`. There are no literal colours in the SVG.

**Interactivity.** All of it reads the `data-*` facts in the DOM and never infers topology from the geometry.
- **Focus** (`focus.js`): click or keyboard on a node highlights incident edges and neighbours and opens a "Semantic Passport" (label, kind, sublabel, tag, sources, in/out relationship rows). Deep link: `#focus=<id>`.
- **Reach**: upstream or downstream transitive closure over authored edges (`#focus=x&reach=downstream`). It is called "authored reachability", never "impact".
- **Route Probe** (`route-probe.js`, key `R`): pick a source and a target, run a BFS over the directed edges in DOM order, highlight the first path found, then play a step-by-step "Journey". Link: `#route=a~b`. Unreachable pairs report an error and nothing is inferred.
- **Other tools:**
  - Node Finder (`/`, searches labels and ids).
  - Semantic Lens (`L`, filters by kind; `#lens=a~b`).
  - Radar minimap (`M`).
  - Camera zoom and pan (`+`/`-`/`0`).
  - Presentation (`F`).
  - Preset cycle (`S`), theme toggle (`T`), export (`E`), guide (`?`).
  - Intent Trace (hover preview after 90ms).
  - Reading depth MAP/READ/FULL by zoom level.
- **Motion**: `meta.animation:"trace"` adds a finite Live/Still trace. It respects `prefers-reduced-motion` and is excluded from exports.

**Locale.** `meta.locale` localises only viewer chrome, default legend labels, aria text, `<html lang>` and the title suffix. Built-in locales are `en` and `zh-CN`. Others need a `meta.translations` key→string map with matching `{placeholder}`s (a Spanish catalog is in `examples/locales/es.json`). Missing keys fall back to English, and that fallback is reported. Authored strings are never translated.

**Export** (`export.js`):
- The SVG is cloned and stripped of viewer state (`export-cleanup.js`), and the current theme's variables are locked in.
- `XMLSerializer` → `Image` → `<canvas>` `drawImage` → `toBlob`. Scale is the largest of 4/3/2/1 that fits a pixel cap.
- Formats: PNG (copy through `ClipboardItem`, or download), JPEG, WebP, a dual-theme SVG, and WebM through `canvas.captureStream` + `MediaRecorder`.
- 1200×630 Route and Reach "share cards".
- `?openExport=1` waits for fonts and two animation frames before exporting.

**Essential vs nice-to-have for us.**

| Essential | Nice-to-have (skip in v1) |
|---|---|
| inline SVG + token CSS vars + light/dark | Radar, Lens, Intent Trace, reading depth, presets |
| `data-node-*`/`data-edge-*` facts + focus/neighbour highlight | Route Journey playback, share cards, WebM |
| `c-mask` backing rect + crossing halo | Presentation stage, camera transactions |
| `<title>/<desc>`, `tabindex`, `aria-label`, keyboard focus | embedded fonts (use system stack, or reuse hyperui's font) |
| PNG export (serialize → canvas → toBlob) + SVG download | i18n catalog machinery (we author in one language; chrome is ~10 strings) |
| Reach (up/downstream BFS) + `#focus=` deep link | live preview server, atomic delivery receipts |

## 5. The evidence feature

Opt-in. `meta.repository{url, revision: 40-hex}` plus per-node `sources[{path, line, end_line, label}]` (1–3 per node), checked with `--repo-root` (`renderers/shared/repository-evidence.mjs`). Verification is local only and makes no network calls. All git calls run with `git --no-replace-objects -C <root>`.

1. `rev-parse --show-toplevel`.
2. `remote get-url origin` must match the declared URL. Credentials are stripped. GitHub and Gitee normalise `.git` and treat SSH and HTTPS as equal; other hosts must match exactly.
3. `cat-file -e <rev>^{commit}`.
4. For each source: the path must be bounded (repo-relative POSIX, no escape), and `cat-file -t <rev>:<path>` must be `blob`.
5. If `line` is given, `git show <rev>:<path>` and check the line range fits the line count.

Failures are `repository-evidence/{file-missing, line-out-of-range, line-required, line-range-invalid, source-required, …}`, each with a fix. Evidence is read from committed bytes at the pinned SHA, never from the working tree (the authoring guide records `git status --short` so dirty paths are not cited).

Output: verified payload keyed by node id, embedded **outside** the canonical SVG and therefore never in exports. Nodes show an `SRC n` badge, and the Passport lists links.
- Link format: `${url}/blob/${rev}/${encodedPath}#L${line}-L${end}`. Gitee uses `-${end}` without the `L`.
- Repo link: `${url}/tree/${rev}`.
- `link_mode: local-only` is for SSH or internal forges: identity is still verified but no links are emitted.

Authoring rule (`references/repository-authoring.md`):
- Freeze HEAD, origin and status first.
- Trace call sites to the actual reader or writer before drawing an edge.
- Each citation proves only what is visible at that location; a startup citation does not prove a protocol.
- Write unknowns next to the claim they affect.

## 6. Recommendation for hyperui `diagram`

**Principle to copy.** The agent makes the layout decisions (main path first, then branches, stores and returns placed beside their owners). A deterministic script measures the result and returns precise repair diagnostics. Do not hand placement to dagre/ELK and do not style Mermaid; archify measured that it loses.

**Minimum viable design (v1, about 1.5k LOC total; this size is my estimate).**
1. **Our own small IR**, `skills/diagram/schema.json`. One `diagram_type` with a `kind` of `architecture | flow | sequence | state`; dataflow folds into flow with `stages` as columns.
   - Nodes: `{id, type (archify's 7 kinds), label, sublabel?, row, col, w?, h?, sources?}`.
   - Groups: `{id, label, kind: boundary|lane, wraps[]}`.
   - Edges: `{id?, from, to, label?, variant: default|emphasis|security|dashed|return, fromSide?, toSide?, via?}`.
   - Meta: `{title, theme?, repository?}`.
   - Grid-only placement (the `row/col` → px cell math), no free `pos` in v1. Sequence keeps author-ordered `y`-less messages; the index becomes y.
2. **Validator**, `scripts/diagram-check.mjs`. Node ≥18, zero dependencies, about 600 LOC.
   - Do not use ajv. Use a hand-written structural check: required fields, enums, id pattern, unknown keys rejected, endpoints resolve.
   - Then a geometry pass on the resolved layout, in archify's repair order:
     1. overlap or gap below 8px, and cell collisions;
     2. text fit (0.6·font·units + 8, CJK = 2);
     3. edge-through-node (2px);
     4. side direction;
     5. proper crossings and collinear corridors (8px or more);
     6. segment rhythm (8/16);
     7. label vs node, label vs label, and label-route clearance (4px);
     8. canvas containment;
     9. label gap (`6.5·units+21`).
   - Output: archify's diagnostic shape (`code`, `subject`, `evidence`, `supportedFixes`). Exit 1 on any error.
   - Optional `--repo-root` evidence check (§5, about 80 LOC with `child_process.spawnSync`).
3. **Router**, inside the same script. Archify's ladder, simplified:
   - straight if aligned;
   - else a one-bend L, then a two-bend Z dogleg;
   - else Dijkstra on a sparse orthogonal grid built from obstacle edges plus port stubs;
   - then port spread (16px gutter, 14px pitch) and rounded `Q` corners.
4. **Renderer template**, `templates/diagram/viewer.html` (target under 60 KB).
   - Inline SVG built in the same script. Colours come only from CSS vars mapped to the project's hyperui tokens (from `.hyperui/design.md`; I assumed this mapping), with a `prefers-color-scheme` and `[data-theme]` toggle.
   - `data-node-*`/`data-edge-*` facts.
   - Focus, neighbours and up/downstream reach.
   - `#focus=` link.
   - PNG and SVG export.
   - `role/tabindex/aria`.
   - Legend `auto` for the kinds present.
   - The `c-mask` rect and crossing halo.
5. **Mermaid fast path.** Use it only when the reader just needs topology inline: a README, a PR body, a chat answer, or ≤6 nodes with no boundaries or labels to defend. Emit a fenced `mermaid` code block and do not validate it. For anything shown to stakeholders, go through the IR. Pasted Mermaid input is re-authored into the IR (archify's rule).
6. **SKILL.md** carries §2 nearly verbatim, condensed:
   - type router;
   - the 8–12 node guidance;
   - placement classes (main/branch/store/return/second entrance/fan-out);
   - spacing formulas;
   - label rules;
   - the repair loop (≤2 focused repairs, then report).
   - Skip the browser gate in v1. Use the static check plus one optional screenshot review through the existing browser-evidence flow (this integration is unverified).

**Reimplement vs borrow.**

| Reimplement (our code) | Borrow verbatim/adapted under MIT, with attribution |
|---|---|
| IR schema (smaller, one file) | Spacing/label formulas and the repair-order list (facts, not code; cite anyway) |
| Validator structure, CLI, diagnostics plumbing | `segmentIntersectsRect`, `properSegmentIntersection`, `rectsOverlap`, `segmentRectClearance` (`renderers/shared/geometry.mjs`), small pure functions |
| Router ladder + grid search (adapt `shortestOrthogonalGridRoute` ideas from `route-quality.mjs`; theirs is 23 KB) | `fittedNodeFontSize`/`minimumNodeTextWidth` + `textUnits` CJK counting (`text-fit.mjs`, `utils.mjs`) |
| Viewer JS (focus/reach/export, about 300 LOC vs their 400 KB) | `automaticPortSpread` logic (`geometry.mjs`) |
| Theming via hyperui tokens | `repositorySourceHref` + the git verification sequence (`repository-location.mjs`, `repository-evidence.mjs`) |
| SKILL.md wording in our voice | Arrowhead `<marker>` defs and the mask/halo SVG pattern from the template |

Do **not** borrow the JetBrains Mono font bytes (OFL, which would need its own notice), the brand
marks (Simple Icons/CC0 plus per-mark licences, some CC-BY-NC-SA), or the 530 KB ajv output.

**NOTICE.** hyperui is Apache-2.0. MIT code inside it must keep the MIT copyright line and
permission notice. Add to `NOTICE`:

```
Portions of skills/diagram (geometry, text-fit and repository-evidence helpers) are adapted from
Archify (https://github.com/tt-a1i/archify, commit bb990b1), MIT License,
Copyright (c) 2026 tt-a1i (Archify), Copyright (c) 2025 Cocoon AI.
```

Also put a copy of archify's `LICENSE` text in `skills/diagram/LICENSE-archify` (MIT requires
the full permission notice, not just the copyright line). Add a one-line `// Adapted from
archify <path>@bb990b1 (MIT)` header to each borrowed function.

## 7. Sources (all opened at SHA `bb990b17…`, via `raw.githubusercontent.com/tt-a1i/archify/<sha>/<path>` unless noted)

- `https://api.github.com/repos/tt-a1i/archify/git/trees/HEAD?recursive=1` (file tree)
- `https://api.github.com/repos/tt-a1i/archify/commits?per_page=1` (HEAD SHA)
- Top-level files: `README_EN.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`,
  `docs/authoring-cookbook.md`, `experiments/v3-mermaid-validation/RESULT.md`.
  `DESIGN.md` and `PRODUCT.md` were downloaded and grepped only.
- Skill docs: `archify/SKILL.md`; `archify/references/` → `authoring-defaults.md`,
  `authoring-contract.md`, `architecture-layout-repair.md`, `viewer-runtime.md`,
  `repository-authoring.md`, and `delivery-contract.md` (sections 1–13 and 528–577 only).
- Schemas: `archify/schemas/` → `README.md`, `common.schema.json`, `architecture.schema.json`,
  `workflow.schema.json`, `sequence.schema.json`, `dataflow.schema.json`,
  `lifecycle.schema.json`.
- `archify/renderers/shared/`: `validator.mjs`, `diagnostics.mjs`, `text-fit.mjs`,
  `desktop-readability.mjs`, `repository-location.mjs`. Read in part: `geometry.mjs`,
  `route-quality.mjs`, `repository-evidence.mjs`.
- `archify/renderers/architecture/`: `grid.mjs`. Read in part: `routing.mjs`,
  `render-architecture.mjs`.
- `archify/renderers/{sequence,dataflow,lifecycle,workflow}/README.md`
- Scripts: `archify/scripts/check-render-output.mjs` (in part), `archify/bin/visual-check.mjs`
  (in part), `scripts/generate-viewer.mjs`.
- Viewer: `viewer/README.md` (sections Export, Focus, Route Probe); `viewer/export.js` and
  `viewer/focus.js` grepped only.
- `archify/examples/web-app-rendered.html` (structure parsed); the JSON examples in
  `archify/examples/` (web-app, cache-miss, agent-run, product-analytics, agent-tool-call).
- Downloaded but not read in depth (unverified detail): `workflow-compiler.mjs`,
  `render-sequence.mjs`, `render-dataflow.mjs`, `render-lifecycle.mjs`, `i18n.mjs`,
  `labels.mjs`, `viewer/template.source.html`, `route-probe.js`, `semantic-lens.js`,
  `reader-layout.js`.
- Not opened: `.agents/skills/archify-review/SKILL.md`, `benchmarks/*`, `journal/*`, `ROADMAP.md`.

I did not run archify's CLI. All behaviour above comes from reading the source, so runtime
claims such as the Chrome gate output are as described in the code, not observed.
