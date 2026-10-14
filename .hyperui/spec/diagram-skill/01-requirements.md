---
artifact_url: https://claude.ai/artifact/JkKytwXmepd1h7QrHPgNWc
---
# Requisitos: Especialista `diagram` — diagramas legibles por humanos y por agentes

Los requisitos usan notación **EARS** (Easy Approach to Requirements Syntax): cada uno es un par condición–comportamiento (WHEN pasa algo, THE SYSTEM SHALL hace algo observable).

**Date:** 2026-10-08
**Track:** full

## Summary
La especialista `diagram` convierte una descripción, un spec o lo que hyperui ya sabe del proyecto en un diagrama cuya fuente de verdad es un JSON tipado propio; un validador sin dependencias lo mide y devuelve reparaciones; un visor HTML autocontenido lo muestra con foco y alcance; se exporta a PNG/SVG/Mermaid; y las demás especialistas leen el JSON. Importa porque hoy la arquitectura solo vive en texto o en Mermaid que se lee mal, y nada queda reutilizable.

## Scope
**In scope:** lo listado en el PRD como v1 (cinco tipos, IR, validador, visor, export Mermaid, archivos en `.hyperui/diagrams/`, artifact, atribución MIT).
**Out of scope:** enrutamiento fino de aristas, evidencia verificada con git, generación automática desde código fuente, fuentes/iconos embebidos, delta antes/después, traducción por locale.
**Affected areas:** `skills/diagram/` **new** (SKILL.md, `schema.json`, `references/`, `LICENSE-archify`) · `scripts/diagram-check.mjs` **new** (validador + enrutador + render) · `templates/diagram/viewer.html` **new** · `SKILL.md` raíz (fila de enrutamiento, compuertas, línea de cuidado) · `skills/spec/SKILL.md` (fase de diseño usa `diagram`) · `skills/critique/SKILL.md`, `skills/patterns/SKILL.md` (leen el JSON) · `scripts/check.sh` (lint de la skill y tamaño del visor) · `templates/hyperui/design.md` (sección `## Diagrams`) · `NOTICE` · `README.md`, `docs/architecture.md`, `CHANGELOG.md`, manifests.

## Requirements

### REQ-001: Generar un diagrama desde una descripción o un spec
**User story:** Como quien construye con hyperui, quiero pedir "el diagrama de arquitectura de X" y obtenerlo validado, para ver y compartir la arquitectura sin dibujar a mano.

WHEN el usuario pide un diagrama (o `spec` lo necesita en la fase de diseño) y nombra o se infiere el tipo (arquitectura, flujo, secuencia, datos, ciclo de vida)
THE SYSTEM SHALL escribir la IR JSON en `.hyperui/diagrams/<nombre>.json`, validarla, renderizar `.hyperui/diagrams/<nombre>.html` y publicarla como artifact en el mismo turno.

**Acceptance:**
- [ ] Given un perfil con `product_languages: [es]` · When el usuario dice "hazme el diagrama de arquitectura de hyperui" · Then existen `<nombre>.json` y `<nombre>.html`, el validador reporta 0 errores, y la respuesta trae el enlace del artifact (o la ruta del HTML en headless).
- [ ] Given la fase de diseño de `spec` para un cambio multi-servicio · When `spec` propone el set de diagramas · Then al menos el de arquitectura se produce con `diagram` y su JSON queda referenciado en `02-design.md`.
- [ ] Given un tipo no reconocible en la petición · When se pide el diagrama · Then el sistema elige el tipo por señales (componentes → arquitectura; pasos → flujo; mensajes entre actores → secuencia; etapas de datos → datos; estados → ciclo de vida) y lo dice en una línea sin preguntar.
- [ ] Build passes: `bash scripts/check.sh`
- [ ] Tests pass: `node scripts/diagram-check.mjs --self-test`

### REQ-002: La IR JSON es la fuente de verdad
**User story:** Como agente de hyperui, quiero que el diagrama exista como datos tipados, para razonar sobre componentes y dependencias sin interpretar un dibujo.

THE SYSTEM SHALL guardar cada diagrama, en el repo o carpeta del usuario (`.hyperui/diagrams/`, nunca en el repo del plugin), como un documento JSON con `schema_version`, `diagram_type` (`architecture|flow|sequence|dataflow|lifecycle`), `meta{title, lang}`, `nodes[]`, `groups[]`, `edges[]` y, para secuencia, `participants[]`/`messages[]`, rechazando campos desconocidos; el HTML y el Mermaid se derivan de él.

**Acceptance:**
- [ ] Given un JSON con un campo no definido en el esquema · When se valida · Then el validador falla con código `schema/unknown-property`, el elemento exacto y el arreglo "remove unsupported property X".
- [ ] Given un `.html` generado · When se abre su código · Then contiene el JSON completo embebido en `<script type="application/json" id="diagram-ir">` idéntico al `.json`.
- [ ] Given el `.json` de un diagrama · When `critique` o `patterns` lo leen · Then pueden listar nodos, grupos y aristas con etiquetas sin abrir el HTML.

### REQ-003: El agente coloca, el validador mide
**User story:** Como usuario, quiero diagramas que se lean a primera vista, para no tener que descifrar un auto-layout.

WHEN el agente escribe la IR
THE SYSTEM SHALL exigir una posición en cuadrícula (`row`, `col`) por nodo y, al validar, comprobar: solapes o separación < 8 px entre nodos, texto que no cabe en su caja al tamaño mínimo legible, aristas que atraviesan un nodo ajeno (margen 2 px), aristas que no salen/entran por el lado indicado, etiquetas que pisan nodos u otras etiquetas, elementos fuera del lienzo, y texto proyectado < 6 px a 1440 px de ancho.

**Acceptance:**
- [ ] Given dos nodos en la misma celda · When se valida · Then error `layout/cell-collision` con los dos ids y la celda.
- [ ] Given un nodo con etiqueta más ancha que su caja · When se valida · Then error `layout/text-fit` con el ancho medido y el ancho requerido, y el arreglo "widen to N px or shorten label".
- [ ] Given una arista cuya ruta cruza un nodo ajeno · When se valida · Then error `clean-flow/edge-through-node` con el id del nodo y el segmento.
- [ ] Given un diagrama válido · When se valida · Then salida `0 errors` y código de salida 0 en < 1 s para ≤ 40 nodos.

### REQ-004: Cada error trae su arreglo y el bucle de reparación es acotado
**User story:** Como usuario, quiero que hyperui repare el diagrama solo, pero que no se quede dando vueltas.

IF el validador devuelve errores THEN THE SYSTEM SHALL emitir cada uno con `{code, severity, message, subject{collection,index,id,from,to}, evidence{px,points,bounds}, supportedFixes[]}`, aplicar como máximo dos reparaciones focalizadas (solo los elementos nombrados) y, si persisten errores, entregar el diagrama marcando la brecha en la respuesta y en `design.md`, nunca un dibujo roto en silencio.

**Acceptance:**
- [ ] Given una IR con 3 errores · When el agente repara · Then tras ≤ 2 pasadas la IR valida, o la respuesta lista los errores restantes con su código.
- [ ] Given una reparación · When se compara la IR antes y después · Then solo cambiaron los elementos nombrados en `subject` (los demás nodos conservan `row/col`).
- [ ] Given la salida del validador · When se parsea · Then es JSON válido por línea (`--json`) y texto legible por defecto.

### REQ-005: Visor autocontenido con foco, alcance y exportación
**User story:** Como usuario, quiero explorar el diagrama (enfocar un nodo, ver qué depende de qué) y exportarlo, sin instalar nada.

WHEN se renderiza un diagrama
THE SYSTEM SHALL producir un único archivo HTML con un SVG inline, colores solo por variables CSS (claro/oscuro según `prefers-color-scheme` y `data-theme`), foco por clic, alcance aguas arriba/abajo usando solo las aristas de la IR, enlace profundo `#focus=<id>`, exportación PNG y SVG, leyenda automática de los tipos presentes, y un tamaño < 60 KB sin fuentes embebidas.

**Acceptance:**
- [ ] Given el HTML generado · When se mide · Then `wc -c` < 61 440 y `check.sh` falla si lo supera.
- [ ] Given el visor abierto · When se hace clic en un nodo · Then se resaltan ese nodo, sus vecinos directos y, con "aguas abajo", todo lo alcanzable por aristas autoradas; nada que no esté en la IR se resalta.
- [ ] Given el visor · When se pulsa "PNG" · Then se descarga una imagen a 2× con el mismo tema visible.
- [ ] Given `prefers-color-scheme: dark` · When se abre · Then fondo, texto y aristas usan los tokens oscuros; contraste AA en etiquetas.
- [ ] Given una sesión interactiva con navegador · When se publica · Then la captura de evidencia del visor a 1280 queda en `design.md` (flujo browser-verify existente).

### REQ-006: Tokens de hyperui y del proyecto
**User story:** Como dueño de la marca, quiero que los diagramas usen mis colores y tipografía, para que parezcan parte del producto.

THE SYSTEM SHALL tomar colores y tipografía de los tokens de hyperui y, si `.hyperui/design.md` define paleta/fuentes, de ahí; nunca de una paleta propia por diagrama; los siete tipos de componente (`frontend|backend|database|cloud|security|messagebus|external`) mapean a tokens, no a hex sueltos.

**Acceptance:**
- [ ] Given un proyecto con `design.palette.accent` definido · When se renderiza · Then el acento del visor es ese valor (variable CSS), sin hex literal en el SVG.
- [ ] Given un proyecto sin `design.md` · When se renderiza · Then se usan los tokens por defecto de hyperui (graphite + emerald).

### REQ-007: Exportación Mermaid y camino rápido
**User story:** Como usuario, quiero pegar el diagrama en el README de GitHub.

WHEN el usuario pide Mermaid, o el destino es README/PR/chat, o el diagrama tiene ≤ 6 nodos sin grupos
THE SYSTEM SHALL exportar la estructura de la IR a `.hyperui/diagrams/<nombre>.mmd` (sin layout, sin validar) y, en el camino rápido, ofrecer el bloque Mermaid inline además de la IR; Mermaid pegado por el usuario se re-autora a la IR, nunca se valida ni se "embellece".

**Acceptance:**
- [ ] Given una IR de arquitectura · When se exporta · Then el `.mmd` es `flowchart` válido con un nodo por `nodes[]`, un `subgraph` por grupo y una arista por `edges[]` con su etiqueta.
- [ ] Given una IR de secuencia · When se exporta · Then el `.mmd` es `sequenceDiagram` con participantes y mensajes en orden.
- [ ] Given un bloque Mermaid pegado por el usuario · When pide "hazlo bonito" · Then se convierte a IR y pasa por el validador; el Mermaid original no se modifica.

### REQ-008: Iterar sin mover lo que no se tocó
**User story:** Como usuario, quiero pedir cambios puntuales sin que el diagrama entero se reacomode.

WHEN el usuario pide un cambio sobre un diagrama existente
THE SYSTEM SHALL editar la IR existente (añadir, quitar o mover solo lo nombrado), revalidar y republicar el artifact en la **misma URL**, conservando `row/col` de los nodos no mencionados.

**Acceptance:**
- [ ] Given un diagrama publicado · When el usuario dice "agrega la cola entre API y worker" · Then el JSON gana un nodo y dos aristas, los demás nodos conservan `row/col`, y el artifact se republica en la misma URL.
- [ ] Given `state.md` · When se republica · Then `artifacts:` tiene una sola entrada para ese diagrama.

### REQ-009: Reglas de autoría del agente
**User story:** Como hyperui, quiero reglas explícitas de colocación, para que el layout sea bueno sin auto-layout.

THE SYSTEM SHALL seguir, al escribir la IR, estas reglas: camino principal primero (izquierda → derecha o arriba → abajo según el tipo), ramas y almacenes directamente arriba o abajo de su dueño, retornos por un corredor libre, 8–12 nodos primarios por vista (más → dividir en diagramas enlazados), etiquetas de arista cortas (≤ 24 caracteres) y un solo acento de énfasis por vista.

**Acceptance:**
- [ ] Given una descripción con 20 componentes · When se genera · Then el resultado son ≥ 2 diagramas enlazados (`meta.related[]`) con ≤ 12 nodos cada uno, y la respuesta lo explica en una línea.
- [ ] Given la skill · When se lee · Then las reglas están en `skills/diagram/references/authoring.md` con las fórmulas de espaciado medidas (separación ≥ 8 px, etiqueta ≥ 6,5 px × caracteres + 21).

### REQ-010: Integración con el resto de hyperui
**User story:** Como usuario, quiero que el diagrama aparezca donde hace falta sin pedirlo dos veces.

WHEN `spec` llega a la fase de diseño de un cambio multi-página, backend+UI o multi-servicio
THE SYSTEM SHALL producir el diagrama de arquitectura con `diagram` (y secuencia para el camino feliz cuando hay backend), enlazar los JSON en `02-design.md` y registrar los diagramas en `design.md` bajo `## Diagrams`; `critique` y `patterns` leen esos JSON cuando existen.

**Acceptance:**
- [ ] Given un spec multi-servicio · When se escribe `02-design.md` · Then contiene la ruta de ≥ 1 `.hyperui/diagrams/*.json` y el artifact del diagrama está enlazado.
- [ ] Given `/hyperui` · When el usuario escribe "diagrama", "arquitectura", "flujo", "secuencia" o "ciclo de vida" en cualquier idioma · Then la fila de enrutamiento manda a `diagram`.
- [ ] Given la línea de cuidado · When se entrega un diagrama · Then incluye `diagram validated` solo si el validador pasó.

### REQ-011: Atribución y licencia
THE SYSTEM SHALL incluir en `NOTICE` la línea de atribución a Archify (MIT, commit `bb990b1`) y una copia de su licencia en `skills/diagram/LICENSE-archify`, y cada función adaptada lleva una cabecera `// Adapted from archify <path>@bb990b1 (MIT)`; no se incluyen la fuente embebida, los logos de marcas ni el validador generado de archify.

**Acceptance:**
- [ ] Given el repo · When se corre `grep -n "Archify" NOTICE` · Then aparece la línea; y `skills/diagram/LICENSE-archify` existe.
- [ ] Given `scripts/diagram-check.mjs` · When se buscan funciones adaptadas · Then cada una tiene la cabecera de origen.

## Non-functional requirements
- THE SYSTEM SHALL correr el validador con Node ≥ 20 sin dependencias de npm (`scripts/diagram-check.mjs` solo usa módulos nativos).
- THE SYSTEM SHALL mantener accesible el visor: `role`/`aria-label` en nodos, navegación por teclado del foco, contraste AA en ambos temas.
- THE SYSTEM SHALL escribir las etiquetas en `product_languages[0]` y los identificadores en inglés.
- THE SYSTEM SHALL funcionar en headless (`-p`, evals): sin Artifact tool, el `.html` queda en `.hyperui/diagrams/` y se da la ruta.
- THE SYSTEM SHALL pasar `scripts/check.sh` (lints de especialista) y añadir dos lints: tamaño del visor < 60 KB y presencia de `LICENSE-archify`.

## Open questions
Ninguna que bloquee el diseño; las tres del PRD quedan resueltas con las propuestas: los diagramas se commitean (JSON + HTML) con el resto de `.hyperui/`; el no-tech ve el artifact directo con una línea de contexto; existe `/hyperui:diagram` para expertos además del enrutado por `/hyperui`.

## Traceability to the PRD
| Use case | Requirements that cover it |
|---|---|
| UC-01 (diagrama desde descripción o spec) | REQ-001 (generar), REQ-002 (IR fuente de verdad), REQ-003 (colocar y medir), REQ-006 (tokens), REQ-009 (autoría), REQ-010 (integración) |
| UC-02 (explorar e iterar) | REQ-005 (visor), REQ-008 (iterar sin mover) |
| UC-03 (exportar) | REQ-005 (PNG/SVG), REQ-007 (Mermaid) |
| UC-04 (un agente lee el diagrama) | REQ-002 (IR), REQ-010 (integración) |
| UC-05 (no pasa validación) | REQ-004 (arreglos y bucle acotado) |

## Revisions
