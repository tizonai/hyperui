---
artifact_url: https://claude.ai/artifact/SwoBxNGxwL1MSRUs8E1p5g
---
# Tareas: Especialista `diagram` v1

**Date:** 2026-10-08
**Track:** full

Repo: `~/personal/hyperui` (rama `feature/diagram-skill` desde `main`, trabajo en worktree aislado; sin amend, sin force-push). Gate de cada tarea: `bash scripts/check.sh` · `node scripts/diagram-check.mjs --self-test` · `npm run version-check`. TDD: los casos de `--self-test` se escriben antes del código que los hace pasar. Presupuesto de verificación: gate + un smoke; sin evals.

## Implementation plan

### Wave 1 — Cimientos: esquema, ejemplos, geometría, licencia
Sin dependencias entre sí.

- [ ] **TASK-001**: Esquema de la IR y ejemplos de los cinco tipos
  - **What**: `skills/diagram/schema.json` con campos requeridos/permitidos por `diagram_type`, enums (`type`, `variant`, `kind`, lados), patrón de `id`, límites de `layout`; cinco IR de ejemplo válidas y pequeñas (6–10 nodos) que luego sirven de fixtures y de documentación.
  - **Files**: `skills/diagram/schema.json` (new), `skills/diagram/references/examples/{architecture,flow,sequence,dataflow,lifecycle}.json` (new)
  - **Tests first**: en `--self-test`: los cinco ejemplos pasan el chequeo de esquema; un documento con campo desconocido falla con `schema/unknown-property`; `id` inválido falla con `schema/id-pattern`; endpoint inexistente falla con `schema/unknown-endpoint`.
  - **Commands**: `node scripts/diagram-check.mjs --self-test` (falla hasta TASK-002) · `bash scripts/check.sh`
  - **Acceptance**: los cinco JSON parsean, cada uno declara `schema_version: 1`, `diagram_type`, `meta.title`, `meta.lang`; el esquema cubre todos sus campos; ningún campo fuera del esquema.
  - **Covers**: REQ-002 (IR fuente de verdad)
  - **Depends on**: none

- [ ] **TASK-002**: Núcleo del script: esquema, layout a píxeles, geometría, diagnósticos y `--self-test`
  - **What**: `scripts/diagram-check.mjs` con el CLI (`validate`, `--json`, `--self-test`), chequeo estructural a mano contra `schema.json`, conversión celda → px (`layout` por defecto 140×64, gaps 48/56, origen 40,80), helpers de geometría adaptados de archify con cabecera `// Adapted from archify <path>@bb990b1 (MIT)` (`rectsOverlap`, `segmentIntersectsRect`, `properSegmentIntersection`, `segmentRectClearance`, `textUnits` con CJK = 2, `fittedFontSize`/`minimumNodeTextWidth`), y la forma común de diagnóstico `{code, severity, message, subject, evidence, supportedFixes}`; exit 1 con cualquier error.
  - **Files**: `scripts/diagram-check.mjs` (new), `skills/diagram/references/diagnostics.md` (new, catálogo de códigos)
  - **Tests first**: fixtures de error inline en `--self-test`: `layout/cell-collision`, `layout/out-of-grid`, `layout/node-overlap`, `layout/text-fit` (mide `0.6·font·units + 8`), `layout/out-of-canvas`; cada uno comprueba `code`, `subject.id` y que `supportedFixes` no esté vacío; salida `--json` parsea línea a línea.
  - **Commands**: `node scripts/diagram-check.mjs --self-test` · `node scripts/diagram-check.mjs validate skills/diagram/references/examples/architecture.json --json` · `bash -n`/`node --check scripts/diagram-check.mjs`
  - **Acceptance**: `--self-test` verde para los casos de esquema y layout; `validate` de los cinco ejemplos → `0 errors`, exit 0, < 1 s; sin `import` de paquetes npm (solo `node:fs`, `node:path`, `node:process`).
  - **Covers**: REQ-002, REQ-003 (colocar y medir), REQ-004 (diagnósticos)
  - **Depends on**: TASK-001 (fixtures) — puede empezar en paralelo con un fixture mínimo

- [ ] **TASK-003**: Licencia y atribución
  - **What**: copiar la licencia MIT de archify a `skills/diagram/LICENSE-archify`; añadir a `NOTICE` la línea de atribución (commit `bb990b1`, Copyright tt-a1i / Cocoon AI); lint en `check.sh` que exige ambos.
  - **Files**: `skills/diagram/LICENSE-archify` (new), `NOTICE` (modified), `scripts/check.sh` (modified)
  - **Tests first**: `check.sh` falla si falta `LICENSE-archify` o la línea "Archify" en `NOTICE` (probar quitándolos en un temp copy).
  - **Commands**: `bash scripts/check.sh`
  - **Acceptance**: `grep -n Archify NOTICE` encuentra la línea; el archivo de licencia contiene el texto MIT completo; gate verde.
  - **Covers**: REQ-011 (atribución)
  - **Depends on**: none

### Wave 2 — Enrutador, chequeos de flujo, visor y Mermaid
Depende de la ola 1.

- [ ] **TASK-004**: Enrutador ortogonal y chequeos de flujo
  - **What**: en `diagram-check.mjs`: puertos en el punto medio del lado con *port spread* (gutter 16 px, paso 14 px); escalera de rutas recto → L → Z → Dijkstra en malla ortogonal dispersa (bordes de obstáculos + stubs de puerto); chequeos `clean-flow/edge-through-node` (≤ 2 px), `clean-flow/endpoint-side-direction`, `composition/proper-crossing` (warning), `composition/label-overlap`, `composition/label-gap` (`6.5·units + 21`), `readability/projected-text` (< 6 px a 1440), `budget/too-many-nodes` (> 12, warning); etiquetas de arista colocadas en el segmento más largo con `labelAt` opcional.
  - **Files**: `scripts/diagram-check.mjs` (modified)
  - **Tests first**: fixture con una arista que atraviesa un nodo → `edge-through-node` con el id; fixture con `fromSide: top` y ruta que sale por la derecha → `endpoint-side-direction`; fixture con etiqueta larga en hueco corto → `label-gap` con la medida; fixture de 14 nodos → warning `too-many-nodes`; ruta Dijkstra evita obstáculo y termina con segmentos ≥ 8 px; determinismo (misma IR → mismos puntos).
  - **Commands**: `node scripts/diagram-check.mjs --self-test`
  - **Acceptance**: todos los casos verdes; los cinco ejemplos siguen en `0 errors`; cada ruta de los ejemplos tiene ≤ 2 codos.
  - **Covers**: REQ-003, REQ-004, REQ-009 (reglas medibles)
  - **Depends on**: TASK-002

- [ ] **TASK-005**: Visor autocontenido y subcomando `render`
  - **What**: `templates/diagram/viewer.html` con marcadores `/* HYPERUI:TITLE|TOKENS|SVG|IR|LEGEND */`, tokens CSS con los tres bloques de tema, `<svg role="img">` con `<title>/<desc>`, `<defs>` (markers por variante, rejilla), orden grupos → aristas → nodos → leyenda, `rect.c-mask`, halo en cruces, `data-node-*`/`data-edge-*`, `<script type="application/json" id="diagram-ir">`; JS: foco (clic/teclado), vecinos, alcance arriba/abajo (BFS sobre `data-edge-*`), `#focus=<id>` y `#reach=up|down`, export PNG 2× y SVG, toggle de tema, leyenda automática. `render` escribe `<name>.html` (y `--svg` opcional) solo si `validate` da 0 errores; escapa `<>&"` en todo texto.
  - **Files**: `templates/diagram/viewer.html` (new), `scripts/diagram-check.mjs` (modified)
  - **Tests first**: `--self-test`: render de los cinco ejemplos produce HTML con exactamente un `<svg>`, sin `NaN|undefined|Infinity` en atributos numéricos, JSON embebido idéntico a la IR (`JSON.stringify` canónico), tamaño < 61 440 bytes, sin colores hex literales dentro del SVG (`grep -c '#[0-9a-f]\{6\}'` = 0 fuera del bloque de tokens); render de una IR inválida no escribe archivo.
  - **Commands**: `node scripts/diagram-check.mjs render skills/diagram/references/examples/architecture.json --out /tmp/x` · headless Chrome screenshot del HTML a 1280 (evidencia) · `bash scripts/check.sh` (lint de tamaño)
  - **Acceptance**: HTML abre en Chrome claro y oscuro, foco y alcance funcionan con teclado y ratón (verificado con una captura por tema), PNG se descarga a 2×; `check.sh` falla si el visor renderizado supera 60 KB.
  - **Covers**: REQ-005 (visor), REQ-006 (tokens), REQ-002 (JSON embebido)
  - **Depends on**: TASK-004

- [ ] **TASK-006**: Export Mermaid y re-autoría de Mermaid pegado
  - **What**: subcomando `mermaid` (`flowchart LR` con `subgraph` por grupo y `-->|label|`; `sequenceDiagram`; `stateDiagram-v2`); parser mínimo de Mermaid pegado (flowchart/sequence) → IR esqueleto con `row/col` por orden de aparición, para que el agente lo termine.
  - **Files**: `scripts/diagram-check.mjs` (modified)
  - **Tests first**: cada ejemplo exporta un `.mmd` cuyo conteo de nodos/aristas coincide con la IR; `sequence` conserva el orden de mensajes; un `flowchart` pegado con 4 nodos → IR con 4 nodos y las aristas correctas.
  - **Commands**: `node scripts/diagram-check.mjs mermaid skills/diagram/references/examples/sequence.json --out /tmp/x` · `--self-test`
  - **Acceptance**: `.mmd` renderiza en GitHub (verificado pegándolo en un gist o en el README del smoke); casos verdes.
  - **Covers**: REQ-007 (Mermaid)
  - **Depends on**: TASK-002

### Wave 3 — La skill y su cableado
Depende de la ola 2.

- [ ] **TASK-007**: `skills/diagram/SKILL.md` y referencias de autoría
  - **What**: SKILL.md (≤ 180 líneas): frontmatter estándar (`user-invocable: false`, preámbulo exacto, `allowed-tools` con `Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/diagram-check.mjs *)` y `profile.sh`), elección del tipo por señales, reglas de autoría (camino principal, ramas/almacenes junto al dueño, retornos por corredor libre, 8–12 nodos, etiquetas ≤ 24 chars, un énfasis por vista), procedimiento (IR → validate → ≤ 2 reparaciones focalizadas → render → mermaid → artifact → `design.md ## Diagrams` → `state.md`), iteración sin mover lo no tocado (misma URL), tono por arquetipo (no-tech: artifact + 1 línea), camino rápido Mermaid, línea de cuidado `diagram validated`, telemetría `unit_closed`, `## Sources`. `references/authoring.md` con las fórmulas medidas; `references/diagnostics.md` ya existe (TASK-002).
  - **Files**: `skills/diagram/SKILL.md` (new), `skills/diagram/references/authoring.md` (new)
  - **Tests first**: `check.sh` (lints de especialista) verde; un smoke headless genera el diagrama de arquitectura de un fixture pequeño y produce json+html+mmd con 0 errores.
  - **Commands**: `bash scripts/check.sh` · `claude --plugin-dir . -p "hazme el diagrama de arquitectura de este proyecto" --permission-mode acceptEdits` en un fixture
  - **Acceptance**: la skill pasa todos los lints; el smoke deja `.hyperui/diagrams/<name>.{json,html,mmd}`, `design.md ## Diagrams` y responde con ruta/enlace, línea de cuidado y opciones.
  - **Covers**: REQ-001, REQ-004, REQ-008, REQ-009, REQ-010 (parcial)
  - **Depends on**: TASK-005, TASK-006

- [ ] **TASK-008**: Cableado en el resto del plugin
  - **What**: skill raíz (fila de enrutamiento `diagram`, gate "sin `0 errors` no se entrega", vocabulario `diagram validated`; ≤ 220 líneas), `spec` (fase de diseño: shapes backend+UI/multi-servicio/nueva plataforma producen contenedores + secuencia con `diagram`; `design-template.md` lo refleja), `critique` y `patterns` (leer `.hyperui/diagrams/*.json` si existe), `permit.sh` (pre-aprobar `node <root>/scripts/diagram-check.mjs`), `templates/hyperui/design.md` (`## Diagrams`), `check.sh` (`--self-test` dentro del gate).
  - **Files**: `SKILL.md`, `skills/spec/SKILL.md`, `skills/spec/references/design-template.md`, `skills/critique/SKILL.md`, `skills/patterns/SKILL.md`, `scripts/permit.sh`, `templates/hyperui/design.md`, `scripts/check.sh` (modified)
  - **Tests first**: `check.sh` verde con `--self-test` incluido; `permit.sh` devuelve allow para el comando del script y nada para `rm -rf /`; caps de líneas respetados.
  - **Commands**: `bash scripts/check.sh` · prueba unitaria de `permit.sh` con un JSON de entrada
  - **Acceptance**: `grep -n diagram SKILL.md skills/spec/SKILL.md skills/critique/SKILL.md skills/patterns/SKILL.md` muestra el cableado; gate verde.
  - **Covers**: REQ-010 (integración), REQ-005 (lint de tamaño en el gate)
  - **Depends on**: TASK-007

### Wave 4 — Docs, release y smoke real
Depende de la ola 3.

- [ ] **TASK-009**: Documentación y versión 0.13.0
  - **What**: README (bullet en How it works, fila en especialistas, sección "Diagrams" con una captura del visor y el bloque Mermaid exportado), `docs/architecture.md` (árbol, gate, memoria `diagrams/`), `docs/research/README.md` (fila del método archify), CHANGELOG `## 0.13.0`, manifests y `package.json` a 0.13.0.
  - **Files**: `README.md`, `docs/architecture.md`, `docs/research/README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json` (modified)
  - **Tests first**: `npm run version-check`; `check.sh`.
  - **Commands**: `npm run version-check` · `bash scripts/check.sh`
  - **Acceptance**: versiones iguales en los tres archivos; README sin referencias a empresas; gate verde.
  - **Covers**: REQ-010, REQ-011
  - **Depends on**: TASK-008

- [ ] **TASK-010**: Smoke real: el diagrama de arquitectura de hyperui
  - **What**: con la skill ya cableada, generar `.hyperui/diagrams/hyperui-architecture.{json,html,mmd}` del propio plugin (entrada, especialistas, scripts, hooks, memoria `.hyperui/`, artifacts), publicarlo como artifact, pegar el `.mmd` en `docs/architecture.md` y usar la captura en el README (TASK-009 lo deja preparado).
  - **Files**: `.hyperui/diagrams/hyperui-architecture.*` (new, en este repo porque hyperui es a la vez plugin y proyecto), `docs/architecture.md`, `README.md` (modified)
  - **Tests first**: `validate` → 0 errors en ≤ 2 reparaciones; captura a 1280 claro y oscuro sin solapes.
  - **Commands**: `claude --plugin-dir . -p "hazme el diagrama de arquitectura de hyperui"` · `node scripts/diagram-check.mjs validate .hyperui/diagrams/hyperui-architecture.json`
  - **Acceptance**: artifact publicado y enlazado en `design.md ## Diagrams`; iteraciones registradas; el Mermaid renderiza en GitHub.
  - **Covers**: REQ-001, REQ-005, REQ-007, señal de éxito 1 del PRD
  - **Depends on**: TASK-009

## Summary
| Task | Title | Wave | Covers | Status |
|---|---|---|---|---|
| TASK-001 | Esquema de la IR y ejemplos | 1 | REQ-002 | pending |
| TASK-002 | Núcleo del script: esquema, layout, geometría, diagnósticos, self-test | 1 | REQ-002, 003, 004 | pending |
| TASK-003 | Licencia y atribución | 1 | REQ-011 | pending |
| TASK-004 | Enrutador y chequeos de flujo | 2 | REQ-003, 004, 009 | pending |
| TASK-005 | Visor autocontenido y `render` | 2 | REQ-005, 006, 002 | pending |
| TASK-006 | Export Mermaid y re-autoría | 2 | REQ-007 | pending |
| TASK-007 | SKILL.md y referencias de autoría | 3 | REQ-001, 004, 008, 009, 010 | pending |
| TASK-008 | Cableado en el plugin | 3 | REQ-010, 005 | pending |
| TASK-009 | Docs y 0.13.0 | 4 | REQ-010, 011 | pending |
| TASK-010 | Smoke real: arquitectura de hyperui | 4 | REQ-001, 005, 007 | pending |

## Revisions
