# State

<!-- "Keep the thread": the entry skill reads this first and updates it at the end of every turn. -->
<!-- phase: brief | design | spec | build | review | ship | infra | done · next: one line · open: bullets · last_updated: YYYY-MM-DD -->
<!-- next: the option the user chose at the last choice prompt · open: includes `pending choice: <options>` while one is unanswered -->
<!-- iterations: fix rounds the current unit of work has taken (reset to 0 when a new unit starts); reported anonymously only with telemetry consent -->

phase: ship
next: release 0.14.0 (Archify as the diagram engine, spec/archify-engine.md): review the branch feature/archify-engine, merge, tag hyperui--v0.14.0 (publish.yml needs the npm trusted publisher)
open: register trusted publisher on npmjs.com (Settings → Publishing access → GitHub tizonai/hyperui, publish.yml) so the next tag publishes alone
iterations: 0
last_updated: 2026-10-27

<!-- artifacts: one line per spec file → the Claude artifact url that shows it (or the fallback .html path). -->
<!-- Keys are paths relative to .hyperui/; the same key is updated in place on every republish. -->
artifacts:
  spec/diagram-skill/consolidated: https://claude.ai/artifact/Ca95xF2U2FTBbuZsjn9vkW
  diagrams/hyperui-architecture.html: https://claude.ai/artifact/Up2ogL94vna1WwHxZ6AVcK
  spec/diagram-skill/03-tasks.md: https://claude.ai/artifact/SwoBxNGxwL1MSRUs8E1p5g
  spec/diagram-skill/02-design.md: https://claude.ai/artifact/2RvzNfKXm83613zAoxWveT
  spec/diagram-skill/01-requirements.md: https://claude.ai/artifact/JkKytwXmepd1h7QrHPgNWc
  spec/diagram-skill/00-prd.md: https://claude.ai/artifact/7i819ENEiFAf9cSYzNkT9p

## 2026-10-27
- 0.14.1: review §4 lifecycle and chained-work pass (+ references/lifecycle-checklist.md), spec lifecycle questions (Phase 2, requirements NFR, design template). Tag hyperui--v0.14.1; marketplace update on the user's machine pending.
