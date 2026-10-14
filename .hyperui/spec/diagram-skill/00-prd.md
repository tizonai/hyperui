---
artifact_url: https://claude.ai/artifact/7i819ENEiFAf9cSYzNkT9p
---
# PRD: Especialista `diagram` — diagramas de arquitectura legibles por humanos y por agentes

**Source:** brief escrito aquí (conversación 2026-10-08) + método destilado en `docs/research/archify-diagram-method.md`
**Date:** 2026-10-08
**Track:** full

## Problem
Cuando hyperui planea o explica una arquitectura, hoy solo tiene texto y Mermaid. El texto no se "ve" y Mermaid, con su auto-layout, produce diagramas que se leen mal en cuanto pasan de 6–8 nodos (el propio experimento de archify lo midió: el layout es el producto, no el CSS). Además nada de lo que se dibuja queda en una estructura que otro agente pueda leer después: el diagrama muere en la imagen. Quien usa hyperui para un producto con backend, integraciones o varios servicios necesita diagramas de arquitectura, flujo, secuencia, datos y ciclo de vida que sean bonitos, correctos y reutilizables, sin instalar una dependencia de terceros de 80k estrellas.

## Goal
Que hyperui genere, valide y entregue diagramas interactivos cuya fuente de verdad sea un JSON tipado propio, de modo que las personas los exploren y los agentes los lean.

## Success signal
- Un diagrama de la arquitectura de hyperui mismo (skills, scripts, hooks, memoria) generado y validado en una sola pasada, abierto como artifact y legible a 1440 px sin solapes — leído en el smoke de release.
- Tasa de validación: ≥ 90 % de los diagramas generados pasan el validador en ≤ 2 reparaciones — leído en el log del validador durante el smoke y, con consentimiento, en el evento `unit_closed skill=diagram iterations`.
- Al menos una especialista (`spec` en el diseño técnico) consume el JSON de un diagrama como entrada en vez del dibujo — verificado en el smoke de `spec`.
- Tamaño del visor HTML autocontenido < 60 KB sin fuentes embebidas — leído en el gate (`check.sh`).

## Users
- **Quien construye con hyperui** (dev/senior): pide "diagrama de la arquitectura", lo explora (foco, alcance), lo exporta a PNG o Mermaid para el README y lo itera.
- **Quien no es técnico**: ve el dibujo como artifact para entender qué se va a construir; no toca el JSON.
- **Las especialistas de hyperui** (`spec`, `critique`, `patterns`, `build`): leen el JSON para razonar sobre componentes, dependencias y flujos.

## Scope
**In (v1):**
- Cinco tipos: arquitectura, flujo (workflow), secuencia, flujo de datos, ciclo de vida.
- IR JSON tipada propia como fuente de verdad; el agente coloca los elementos (layout por criterio, no auto-layout).
- Validador sin dependencias: esquema, solapes, texto que cabe, aristas que no atraviesan nodos, legibilidad a 1440 px; cada error con código, elemento, medida y arreglos posibles; máximo dos reparaciones focalizadas antes de reportar la brecha.
- Visor HTML autocontenido con los tokens de hyperui: claro/oscuro, foco, alcance arriba/abajo, export PNG/SVG; el HTML embebe el JSON.
- Export Mermaid (estructura, sin layout) para READMEs de GitHub.
- Archivos en `.hyperui/diagrams/<nombre>.{json,html,mmd}` dentro del repo o carpeta del usuario (JSON y HTML se commitean ahí), publicación como artifact, y entrada "Diagrams" en la memoria del proyecto para que las demás especialistas lo usen.
- Atribución MIT a archify en `NOTICE` por los helpers de geometría y ajuste de texto que se adapten.

**Out (v1):**
- Enrutamiento fino de aristas (corredores, ritmo de rutas, cruces mínimos) — v2, cuando la v1 demuestre valor; el validador v1 solo exige que las aristas no atraviesen nodos.
- Evidencia verificada con git (`blob/<sha>/archivo#L10`) — v2; implica estado del repo y commits.
- Generar el diagrama leyendo código fuente automáticamente ("desde el repo") — v2; en v1 el agente parte de la descripción, el spec o lo que ya sabe del repo, y lo escribe a mano en la IR.
- Fuentes embebidas, iconos de marcas y el validador de 530 KB de archify — no se toman (licencias y tamaño).
- Comparación antes/después (delta) y traducción de etiquetas por locale — después.

## Use cases
### UC-01: Diagrama desde una descripción o un spec
El usuario dice "hazme el diagrama de arquitectura de X" o `spec` lo necesita para el diseño técnico; obtiene un diagrama validado, abierto como artifact, y el JSON guardado.

### UC-02: Explorar e iterar
El usuario abre el visor, enfoca un nodo, ve qué depende de qué (alcance arriba/abajo) y pide un cambio ("agrega la cola y mueve el worker"); el diagrama se actualiza sin que lo no tocado se mueva.

### UC-03: Exportar para documentación
El usuario pide el PNG o el Mermaid para el README o una presentación y lo obtiene con los mismos nombres y colores.

### UC-04: Un agente lee el diagrama
`spec`, `critique` o `patterns` abren el JSON y razonan sobre componentes, dependencias y flujos sin interpretar un dibujo.

### UC-05: Diagrama que no pasa validación
El validador devuelve errores con arreglo sugerido; hyperui repara hasta dos veces; si sigue fallando, entrega lo que hay marcando la brecha, nunca un dibujo roto en silencio.

## Business rules
- El JSON es la única fuente de verdad; el HTML y el Mermaid se derivan de él y nunca se editan a mano.
- Nada se dibuja que no esté en el JSON; la interacción (foco, alcance) usa solo las aristas autoradas, nunca infiere topología del dibujo.
- Los diagramas (JSON y HTML) se guardan y commitean en el repo o carpeta del usuario, en `.hyperui/diagrams/`; nunca en el repo de hyperui, porque hyperui se distribuye como plugin.
- La especialista se invoca de las dos formas, como el resto: pidiendo "diagrama" a secas (enrutado por `/hyperui`) y directamente con `/hyperui:diagram` para expertos.
- Un diagrama no se entrega sin pasar el validador, salvo con la brecha declarada explícitamente.
- Por vista, el objetivo son 8–12 nodos primarios; más que eso se divide en varios diagramas enlazados.
- Colores y tipografía vienen de los tokens de hyperui (y del `design.md` del proyecto si existe), no de una paleta propia por diagrama.
- Las etiquetas van en `product_languages[0]` del perfil; los identificadores en inglés.
- El código adaptado de archify (MIT) conserva su aviso en `NOTICE` y una copia de su licencia dentro de la skill.

## Risks and dependencies
- La calidad del layout depende de la disciplina del agente al colocar (sin auto-layout); se mitiga con reglas de autoría explícitas y el validador.
- Chrome headless para el chequeo visual final no siempre está disponible (CI, otras máquinas); el validador estático debe bastar para aprobar.
- Mantener el visor < 60 KB limita funciones (sin fuentes embebidas, sin librerías).
- Cumplimiento de licencia MIT al adaptar helpers; se audita en el gate.

## Open questions
1. ¿Qué se muestra primero al usuario no técnico: el artifact del diagrama directamente o un resumen de una línea más el enlace? (propuesta en requisitos: el artifact directo con una línea de contexto)

## Revisions
- 2026-10-08: Resuelta la pregunta sobre dónde viven los diagramas: JSON y HTML se commitean en el repo o carpeta del usuario (`.hyperui/diagrams/`), nunca en el repo de hyperui, que se distribuye como plugin. Pasa a regla de negocio y se refleja en Scope. (comentario en el artifact)
- 2026-10-08: Resuelta la pregunta del nombre: ambos, "diagrama" vía `/hyperui` y `/hyperui:diagram` para expertos, como las demás especialistas. Pasa a regla de negocio. (comentario en el artifact)
- 2026-10-08: PRD aprobado en la compuerta.
