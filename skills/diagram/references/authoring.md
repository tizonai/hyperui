# Authoring rules — how the agent places a diagram

The validator (`scripts/diagram-check.mjs`) measures; these rules are how you place so that it has
little to say. They are archify's layout discipline (MIT, `docs/research/archify-diagram-method.md`
§2) condensed to what hyperui's IR supports: a grid (`row`, `col`), groups, sides, `via`, `labelAt`.

## 0. The grid in pixels

| Quantity | Default | Meaning |
|---|---|---|
| `layout.cellW × cellH` | 140 × 64 | the box of every node unless `w`/`h` says otherwise |
| `layout.gapX` | 96 | clear gap between columns — the room a horizontal edge label has |
| `layout.gapY` | 56 | clear gap between rows — the room a vertical edge and a group title band share |
| `layout.origin` | [40, 80] | top-left of cell (0, 0) |
| `layout.cols` | 6 (max 12) | columns available; `col ≥ cols` is an error |
| group `pad` | 16 | frame around members, plus a 22 px title band above |

`x = 40 + col·(140 + gapX)`, `y = 80 + row·(64 + gapY)`. A node with `w: 300` spans into the next
column and will collide with whatever sits there: widen only when the neighbour cell is empty.

## 1. Classify every relationship first, then place

Before writing a single `row`/`col`, label each edge:

| Class | Placement rule | Why |
|---|---|---|
| **Main path** (the user journey, the happy path, the forward transitions) | neighbours adjacent in reading order on one row (architecture, flow, dataflow) or one column of states (lifecycle); the first actor at col 0 | one straight labelled segment per hop |
| **Branch or store** (cache, DB, queue, provider the main node calls) | directly above or below its owner, same `col`; all stores of a row on the same side | a straight vertical edge, no bend |
| **Return / feedback** (retry, response, "back to") | its source on the side of the main path that has no branches, so it runs through an empty row; pin `toSide` (`bottom`/`top`) when it must enter from below/above | avoids crossing the forward edges |
| **Second entrance** into a node | arrive from a different side than the first edge (usually top/bottom when the first is left/right) | ports stay readable |
| **Fan-out** (one node to k others on the same side) | a side holds `k` ports only if `32 + 14·(k − 1) ≤` its length (64 px high box → 3 ports; `h: 104` → 6); otherwise spread the targets over two sides or raise `h` | no overlapping ports |
| **Cross-boundary** (edge that leaves a group) | label names the mechanism (`HTTPS`, `event`, `VPN`) | boundaries mean something |

Then trace each non-main edge: its straight or one-bend corridor must not cross a node. If it does,
move the endpoint that is *off* the main path — never the main path.

## 2. Measured limits (what the validator checks)

| Rule | Formula | Code |
|---|---|---|
| node text fits | `0.6·font·units + 8 ≤ w` with font 13 → 11 px (CJK = 2 units) → 140 px holds 16 characters at 13 px, 20 at 11 px | `layout/text-fit` |
| sublabel fits | `5.4·units + 8 ≤ w` → 24 characters in 140 px | `layout/text-fit` |
| horizontal edge label fits its segment | `6.5·units + 21 ≤ segment` → `gapX 96` holds 11 characters; a two-column span holds 47 | `composition/label-gap` |
| vertical edge label | segment `≥ 24 px`; the label sits beside the line (6 px right) and slides along the segment to dodge nodes and group titles | `composition/label-overlap` |
| nodes apart | `≥ 8 px` between boxes; a group frame must not cover a node it does not wrap | `layout/node-overlap` |
| edge clearance | `> 2 px` from every node it does not touch | `clean-flow/edge-through-node` |
| sides | first/last segment perpendicular to the box, pointing outward/inward on the named side | `clean-flow/endpoint-side-direction` |
| readable at 1440 px | smallest text `≥ 6 px` once the canvas is fitted to 1440 px → canvas width `≤ 2400 px` with sublabels | `readability/projected-text` |
| budget | 8–12 primary nodes per view; above 12 a warning | `budget/too-many-nodes` |

Lanes (`kind: lane`) and stages put a 22 px title band *inside* the row gap above their members: use
`layout.gapY: 72` or more when a labelled vertical edge enters the lane from above.

## 3. Rules per type

**architecture** — a system overview led by the main user journey: actor at (row 1, col 0), then
frontend, backend, database left to right. Stores above/below the backend. Exactly one `boundary`
per real isolation fact (VPC, account, trust zone, runtime); external actors stay outside every
boundary and its padding. Types: `frontend | backend | database | cloud | security | messagebus |
external | actor`; the type drives colour and legend, pick by role, not by vendor.

**flow** — steps on one row in order, decisions as `security` or `backend` nodes with two outgoing
labelled edges (`approved` / `declined`), exception steps on the row below their trigger, the
retry/return pinned `toSide: "bottom"` into the step it returns to. `mainPath: [...]` emphasises
the happy path automatically; do not also set `variant: emphasis` on those edges.

**sequence** — participants in order of first contact (actor first, external providers last);
one message per line of the story, `return` for answers, `security` for auth/charge/PII, `dashed`
for async. Message labels must fit between the two lifelines: 170 px pitch → 19 characters between
neighbours, more across a gap. Self-messages are allowed (`from === to`) and drawn as a loop.
`note` is a muted second line under the message.

**dataflow** — one `stage` group per column (`Sources`, `Ingest`, `Process`, `Serve`), nodes in
their stage's column, edge labels name the **data asset** (`page views`, `sessions`), never the
transport. A second source in a stage goes on the row below and enters its consumer from `bottom`.

**lifecycle** — `states[]` with `type ∈ start | active | waiting | decision | success | failure`;
forward transitions on the middle row with `variant: emphasis`, waits on the row above, failures and
cancellations on the row below inside a `lane` named for them. `transitions[]` are edges. The viewer
numbers states `01…` in array order, so write them in story order.

## 4. Labels and emphasis

- Edge labels ≤ 24 characters, meaning first: action, protocol, data asset, sync vs async, the
  mechanism that crosses a boundary. A label may be left out only when both endpoints fully imply it.
- Deleting a label is never a spacing repair. Order: move it (`labelAt`), then adjust the route or
  the gap (`layout.gapX`), then shorten the wording.
- One accent per view: `emphasis` marks the main path only. `security` = auth/policy/PII,
  `dashed` = async/batch/events, `return` = quiet responses.
- Node labels ≤ 16 characters at the default width; put the technology in `sublabel`
  (`Postgres` / `orders, users`), never both in the label.
- Group labels are short nouns (`Cloud (VPC)`, `Exceptions`, `Serve`); a boundary around a single
  node needs an explicit isolation fact in its label.

## 5. When to split

More than 12 primary nodes, more than 5 rows, or a canvas wider than ~2400 px: make two or three
views linked through `meta.related` (paths of the sibling `.json` files) — a system overview plus
one view per subsystem, or an architecture plus the sequence of its main path. Say it in one line.
Never shrink text, never introduce a scroller, never drop below the readability floor.

## 6. Repair loop (bounded)

1. Write the full candidate, run `validate --json`.
2. On errors, edit only the connected neighbourhood the diagnostics name (`subject`) using
   `supportedFixes`; compare the next run by `code + subject`, not by count.
3. Two focused repairs. Still failing → render is refused; deliver the IR, name the remaining codes
   and subjects in the reply and in `design.md` (`gap: …`), and do not claim `diagram validated`.

## 7. A minimal valid IR

```json
{
  "schema_version": 1,
  "diagram_type": "architecture",
  "meta": { "title": "Web shop — system overview", "lang": "en" },
  "layout": { "cols": 3 },
  "nodes": [
    { "id": "visitor", "type": "actor", "label": "Visitor", "row": 0, "col": 0 },
    { "id": "web", "type": "frontend", "label": "Web app", "sublabel": "Next.js", "row": 0, "col": 1 },
    { "id": "api", "type": "backend", "label": "API", "row": 0, "col": 2 },
    { "id": "db", "type": "database", "label": "Postgres", "row": 1, "col": 2 }
  ],
  "edges": [
    { "from": "visitor", "to": "web", "label": "HTTPS", "variant": "emphasis" },
    { "from": "web", "to": "api", "label": "REST", "variant": "emphasis" },
    { "from": "api", "to": "db", "label": "SQL" }
  ]
}
```

Complete models for each type: `references/examples/{architecture,flow,sequence,dataflow,lifecycle}.json`
(all validate with 0 errors and render under 40 KB).
