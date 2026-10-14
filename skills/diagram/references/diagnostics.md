# Diagnostics catalogue — `scripts/diagram-check.mjs`

Every finding has the same shape, so an agent can repair from the data instead of the prose:

```json
{"code": "layout/text-fit", "severity": "error",
 "message": "[layout/text-fit] nodes[3] id \"worker\": label \"Background worker\" needs 120.2 px, box is 112 px — fix: widen to 121 px or shorten label",
 "subject": {"collection": "nodes", "index": 3, "id": "worker", "from": null, "to": null},
 "evidence": {"px": {"required": 120.2, "available": 112}, "points": null, "bounds": {"x": 512, "y": 200, "w": 112, "h": 64}},
 "supportedFixes": ["widen to 121 px or shorten label"]}
```

- `subject` names the element: `collection` (`nodes | states | groups | edges | transitions | participants | messages | mainPath`, `null` for the whole document), its `index`, its `id` when it has one, `from`/`to` for relationships.
- `evidence` carries the measurement: `px` (a number or `{required, available}` / `{projected, canvas}`), `points` (the segment or crossing point), `bounds` (the rect involved).
- `supportedFixes` are the fixes the validator can vouch for, most focused first. The message ends with the first one.
- Text output (default): one line per finding (`✗` error, `!` warning) and a last line `N errors, M warnings`. `--json`: one JSON object per line, then `{"summary": {"errors": N, "warnings": M}}`. Exit code 1 when any error remains.

Schema findings stop the run before geometry (a document that does not parse cannot be measured). Everything else is reported together, in the repair order below: fix from the top, re-run, and later findings often disappear.

## Codes, in repair order

| # | Code | Severity | Fails when | Fix the validator suggests |
|---|---|---|---|---|
| 1 | `schema/unknown-property` | error | a property not in `schema.json` at any level | remove unsupported property "X" |
| 1 | `schema/missing-property` | error | a required property is absent (`label`, `row`, `from`…) | add "X" |
| 1 | `schema/type` · `schema/range` · `schema/pattern` | error | wrong JSON type; number/length/items outside the limits; string pattern | set / shorten / split |
| 1 | `schema/enum` | error | a value outside its enum (`type`, `variant`, `kind`, sides, `diagram_type`) | choose one of […] |
| 1 | `schema/id-pattern` | error | an id not matching `^[a-zA-Z][a-zA-Z0-9_-]*$` | use a valid id |
| 1 | `schema/duplicate-id` | error | the same id in nodes/states/groups/participants, or the same relationship id | rename |
| 1 | `schema/unknown-endpoint` | error | `from`/`to`, `wraps[]` or `mainPath[]` names an id that does not exist | point at an existing id or add the element |
| 1 | `schema/self-loop` | error | `from === to` outside a sequence diagram (v1) | remove it or fold it into a label |
| 1 | `schema/diagram-type` | error | an array that does not belong to the type (`nodes` in a sequence, `states` in an architecture) or a required one missing | remove / rename / add |
| 2 | `layout/cell-collision` | error | two nodes share `row`/`col` | move "<id>" to a free cell |
| 2 | `layout/out-of-grid` | error | `col >= layout.cols` | move or raise `layout.cols` |
| 3 | `layout/node-overlap` | error | two boxes closer than 8 px, or a group frame covering a node it does not wrap | separate by N px; move the node out or add it to `wraps` |
| 4 | `layout/text-fit` | error | label needs more than the box at 11 px (`0.6·font·units + 8`), sublabel wider than the box (`5.4·units + 8`), group title wider than the frame | widen to N px or shorten |
| 5 | `clean-flow/edge-through-node` | error | a route segment within 2 px of a node that is not its endpoint | move the node, pin a side, or add `via` |
| 6 | `clean-flow/endpoint-side-direction` | error | the first/last segment does not leave/enter through `fromSide`/`toSide` | change the side or the via point |
| 7 | `composition/proper-crossing` | **warning** | two unrelated edges form an X (a halo is drawn under the crossing) | reorder rows or swap cols |
| 8 | `composition/label-overlap` | error | an edge label covers a node, another label or a group title | `labelAt` (0..1), move the node, shorten |
| 8 | `composition/label-gap` | error | a horizontal segment shorter than `6.5·units + 21` for its label (vertical: shorter than 24 px); in a sequence, lifelines closer than the message label needs | widen `layout.gapX`, shorten, reorder participants |
| 9 | `layout/out-of-canvas` | error | a node, group, route point or label outside the computed viewBox | move it inside / raise `layout.origin` |
| 10 | `readability/projected-text` | error | the smallest text would render below 6 px when the diagram is fitted to 1440 px | split the diagram (`meta.related`) or use fewer columns |
| 11 | `budget/too-many-nodes` | **warning** | more than 12 primary nodes in one view | split into related diagrams |

## Measurements the validator uses

| Quantity | Formula | Where |
|---|---|---|
| Cell → px | `x = origin[0] + col·(cellW + gapX)` · `y = origin[1] + row·(cellH + gapY)` · defaults `cellW 140 · cellH 64 · gapX 96 · gapY 56 · origin [40, 80]` | `schema.json` `x-defaults` |
| Node label | fits when `0.6·font·units + 8 ≤ w`, font from 13 down to 11 px; CJK characters count 2 units | `fittedFontSize` |
| Sublabel | `5.4·units + 8 ≤ w` at 10 px | `sublabelWidth` |
| Edge label mask | `6.5·units + 13` × 16 px at 11 px | `labelMaskWidth` |
| Edge label gap | horizontal segment `≥ 6.5·units + 21`; vertical segment `≥ 24` | `labelGapRequired` |
| Node clearance | boxes `≥ 8 px` apart | `rectsGap` |
| Edge clearance | `> 2 px` from any node it does not touch | `segmentRectClearance` |
| Ports | side midpoint; shared sides spread at 14 px pitch inside a 16 px corner gutter; an edge aligned with its partner keeps the midpoint | `assignPorts` |
| Routes | straight → L (one bend) → Z / U (two bends) → shortest orthogonal path on a sparse grid (bend penalty 40 px) | `routeEdge` |
| Group frame | union of members + `pad` (16) on every side + a 22 px title band above | `buildModel` |
| Sequence | participants 120×44 at 170 px pitch; one message per 40 px row | `buildSequenceModel` |

## Reading a diagnostic as an agent

1. Take `subject`: that element (and only its neighbourhood) is what you may change in this repair.
2. Take `evidence.px`: the number tells you how much (`required − available` is the px to find).
3. Apply the first fix in `supportedFixes` unless a later one is clearly cheaper for the whole view.
4. Re-run `validate --json`. Compare by `code + subject`, not by the error count: two different errors on the same edge after a fix are progress; the same code on the same subject is not.
5. Two focused repairs, then stop and report the remaining codes with their subjects (the skill's rule).
