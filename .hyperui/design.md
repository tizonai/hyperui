# Design

<!-- The picked direction. Written by the design specialist. -->

## Direction

<!-- Name of the picked direction and its signature element. -->

## Tokens

<!-- Color, spacing, radius, shadow tokens (or a link to the tokens file). -->

## Type pairing

<!-- Display + body fonts with weights. -->

## Palette

<!-- bg, surface, text, accent… with hex values. -->

## Signature element

<!-- The one thing that makes this design recognizable. -->

## Artifacts

<!-- One URL per direction artifact shown to the user. -->

## Rejected directions

<!-- One line: names of the directions not picked and why. -->

## Diagrams

- hyperui-architecture · architecture · .hyperui/diagrams/hyperui-architecture.json · .hyperui/diagrams/hyperui-architecture.html (artifact url pending — interactive session) · validated 2026-10-14 (1 repair: row-1 heights aligned; first pass 2 findings)

## Browser evidence

<!-- Appended by design/build/motion/viz per skills/design/references/browser-verify.md: date · tool (Claude in Chrome | Playwright MCP | headless Chrome) · url/file · 360/768/1280 light+dark pass/fail · interaction (gif) · checks. Absent = not visually verified. -->

- 2026-10-14 · tool: headless Chrome · file: .hyperui/diagrams/hyperui-architecture.html · 1280 light (docs/assets/examples/hyperui-architecture.png) + dark (evidence/2026-10-14/hyperui-architecture-1280-dark.png) pass · checks: fan-out from /hyperui without crossings, labels clear of nodes and the "Your repo" title, legend complete.
- 2026-10-14 · tool: headless Chrome · file: templates/diagram/viewer.html rendered from skills/diagram/references/examples/architecture.json · 1280 light + dark pass (evidence/2026-10-14/diagram-viewer-architecture-1280-{light,dark}.png) · interaction: `#focus=api&reach=down` marks api + 6 downstream nodes, passport opens, `?theme=` override honoured (DOM dump) · checks: no horizontal scroll, labels clear of nodes and group titles, contrast tokens, keyboard focus ring on nodes.
