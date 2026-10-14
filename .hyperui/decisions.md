# Decisions

<!-- ADR-lite, one per line, appended by any specialist: date · decision · why · source url -->
<!-- Example: 2026-10-03 · payments = Polar · Colombia seller, MoR, no monthly fee · https://polar.sh/docs -->
2026-10-08 · track = full · diagram specialist v1: IR JSON + validator + viewer + Mermaid export; v2 = fine routing, git evidence · spec/diagram-skill/
2026-10-08 · PRD approved · diagrams live in the user repo (.hyperui/diagrams/, json+html committed), never in the plugin; invoked via /hyperui and /hyperui:diagram · spec/diagram-skill/00-prd.md
2026-10-08 · Requirements approved · spec/diagram-skill/01-requirements.md
2026-10-08 · diagram: one zero-dep Node script (schema by hand, own/adapted geometry) · no ajv, no runtime install · research §6
2026-10-08 · diagram: grid-only placement in v1 (row/col + layout), `via` only for measured defects
2026-10-08 · diagram: viewer < 60 KB, system fonts, minimal JS (focus, reach, export)
2026-10-08 · diagram: Mermaid only as export (.mmd) and fast path ≤ 6 nodes; IR is the single source of truth
2026-10-08 · diagram: fine routing + git evidence deferred to v2
2026-10-08 · diagram: MIT attribution — NOTICE + skills/diagram/LICENSE-archify + per-function headers
2026-10-08 · Design approved · spec/diagram-skill/02-design.md
