<p align="center"><img src="docs/assets/logo.svg" width="420" alt="hyperui"></p>

<p align="center"><b>One door from idea to shipped product. For Claude Code.</b></p>
<p align="center">Made by <a href="https://tizonai.com/en/apps/hyperui">TizonAI</a>, the product studio of Javier Stevenson.</p>

<p align="center">
  <a href="#quick-start">Quick start</a> · <a href="#how-it-works">How it works</a> · <a href="#examples">Examples</a> · <a href="#specialists">Specialists</a> · <a href="#requirements">Requirements</a> · <a href="#docs">Docs</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tizonai/hyperui"><img src="https://img.shields.io/npm/v/%40tizonai%2Fhyperui" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@tizonai/hyperui"><img src="https://img.shields.io/npm/dm/%40tizonai%2Fhyperui" alt="npm downloads"></a>
  <a href=".claude-plugin/plugin.json"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftizonai%2Fhyperui%2Fmain%2F.claude-plugin%2Fplugin.json&query=%24.version&label=plugin" alt="plugin version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue" alt="Apache 2.0"></a>
  <img src="https://img.shields.io/badge/Claude%20Code-%E2%89%A5%202.1.221-black" alt="Claude Code >= 2.1.221">
  <img src="https://img.shields.io/badge/node-%E2%89%A5%2020-brightgreen" alt="node >= 20">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20(WSL2)-lightgrey" alt="macOS | Linux (WSL2)">
</p>

<p align="center"><img src="docs/assets/demo.webp" width="880" alt="hyperui demo: staggered hero, 3D card, parallax, spring interactions"></p>
<p align="center"><i>A landing built with <code>/hyperui:design</code> + <code>/hyperui:motion</code> — recorded from the real page in <a href="docs/assets/demo/">docs/assets/demo/</a> (open it to feel the interactions live).</i></p>

**hyperui** is a [Claude Code](https://code.claude.com) plugin: one visible command, `/hyperui`, takes a product with a UI — web, mobile, macOS, Windows — from idea to shipped. It profiles you in at most three questions, shows design directions before writing any code, plans with gated specs, builds with per-language rules and TDD, reviews security and complexity, and guides shipping (domain, hosting, payments by seller country) and infra.
It remembers everything per project in a `.hyperui/` folder, so you never answer twice — and it works from any directory with `--repo`, including several repos at once.

## Quick start

One command (needs Claude Code installed and signed in):

```
npx @tizonai/hyperui install
```

Or the two plugin lines it runs for you:

```
claude plugin marketplace add tizonai/hyperui
claude plugin install hyperui@tizonai
```

Then restart Claude Code, open your project, run `/hyperui:setup` once, and describe what you want:

```
/hyperui:setup                       # install the stack (HyperFrames, Motion, Motion AI Kit, UI UX Pro Max, Impeccable…) into this project
/hyperui quiero una app para mi gimnasio
```

```
> /hyperui quiero una app para mi gimnasio
Listo. Ya anoté lo que sé: una app para tu propio gimnasio, uso de negocio, en español. Solo me faltan dos cosas:
1. ¿Quién la va a usar? Tú y tu equipo (socios, clases, cobros) o tus socios (reservar clases, ver su plan, hacer check-in)… ¿o ambas?
2. ¿Hay algo ya decidido? Web o móvil, tecnología, marca o colores, fecha límite. Si no, yo propongo.
Siguiente paso: en cuanto respondas la 1, te muestro 2–3 propuestas visuales de la pantalla principal como páginas HTML
para que elijas una, y a partir de ahí planificamos y construimos.
```

`/hyperui` greets once, asks at most three things, then designs, plans, builds, reviews and ships with you, in your language. `/hyperui:doctor` reports what is installed and where (read-only). Say `/hyperui --private` if `.hyperui/` must not be committed.

<details>
<summary>Setup options</summary>

```
/hyperui:setup                       # project scope: skills → ./.claude/skills, motion → package.json, motion MCP → local scope
/hyperui:setup --global              # skills → ~/.claude/skills, motion MCP → user scope (once per machine)
/hyperui:setup --21st-key <key>      # also register the 21st.dev MCP (user scope, key never committed)
/hyperui:setup --motion-plus         # also register the motion-plus MCP (Motion+ subscribers; sign in from the MCP settings)
/hyperui:setup --playwright-mcp      # also register the Playwright MCP (headless): browser fallback for visual checks when Claude in Chrome is off
/hyperui:setup --skip-motion-kit     # no Motion AI Kit (/motion skill, motion-reviewer agent, motion MCP)
/hyperui:setup --skip-motion         # any of: --skip-hyperframes --skip-uipro --skip-motion --skip-motion-kit --skip-21st --skip-frontend-design --skip-impeccable
/hyperui:setup --dry-run             # print the commands, install nothing
```

The 21st.dev key is free at https://21st.dev/mcp. You can also `export TWENTY_FIRST_API_KEY=...` before running setup. The `motion` MCP is registered at project (local) scope by setup — stored in your `~/.claude.json` for this project, never committed — and at user scope with `--global`.

| Component | What it is | Source |
|---|---|---|
| **HyperFrames** | Write HTML/CSS, render deterministic MP4s. Promo clips from your real components. | https://github.com/heygen-com/hyperframes |
| **Motion** | Framer Motion's current package (`motion`), animations for React and vanilla JS. | https://motion.dev |
| **Motion AI Kit** | Official `/motion` skill + hosted `motion` MCP (docs & examples; Motion+ unlocks springs/audits/editor) | https://motion.dev/docs/ai-kit |
| **UI UX Pro Max** | Searchable design intelligence: styles, palettes, font pairings, UX rules. | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill |
| **21st.dev MCP** | 10k+ React/Tailwind components, searchable and generated from the editor. | https://21st.dev/mcp |
| **frontend-design** | Anthropic's official design-direction skill. | `frontend-design@claude-plugins-official` |
| **Impeccable** | Design vocabulary for agents: `/impeccable audit`, `polish`, `typeset`, `critique`… anti-pattern detection. | https://impeccable.style · `pbakaus/impeccable` |

After setup the installed third-party skills are available too: `/motion`, `/hyperframes`, `/ui-ux-pro-max`, `/frontend-design`, `/impeccable <command>`.
</details>

## How it works

<p align="center"><img src="docs/assets/journey.svg" width="960" alt="/hyperui → Design · Spec · Build · Review · Ship · Infra, with .hyperui/ memory underneath"></p>

- **Profile and tone by archetype.** Non-tech, developer or senior: detected from your words and your repo, confirmed in at most three questions, never asked twice.
- **Show before build.** 2–3 visual directions as HTML artifacts come before any code; UI is never called done without the Impeccable `audit` → `polish` gate (or one line saying Impeccable is not installed).
- **Critiques before it builds.** Every design direction and every finished UI goes through a heuristic evaluation grounded in the theory below (Norman, Nielsen, ISO 9241-110, Shneiderman, the conversation/repair model, cognitive load, a conversion lens by goal); severities 3–4 are fixed before you see the page. Ask "is this page good?" about any live site, mock or Figma export and you get the same critique as a report and an artifact: top 3 by impact on your goal, what is done well, a verdict.
- **Sees what it built.** Opens the result in Chrome (Claude in Chrome, `claude --chrome`) or a headless browser at 360/768/1280, light and dark, and keeps the screenshots as evidence in `.hyperui/design.md` — it never says "looks right" without one, and says plainly when no browser tool was available. It shows before it asks: the dev server stays running and you get the local URL, the screenshots and "what to look at" before any approve/commit/merge question. TDD for everything, UI included: the component test is written before the component.
- **Gated spec, read as artifacts.** PRD → requirements → design → tasks with approval between phases, or a one-file SDD-lite for small changes, in `.hyperui/spec/`. Every spec file is also published as a Claude artifact (a readable page with table of contents and rendered diagrams) the moment it is written, and the full track ends with one consolidated `Spec: <Topic>` artifact; without the Artifact tool the same page is written next to the markdown.
- **Draws the architecture so people and agents can read it.** Ask for "the architecture diagram", a flow, a sequence, a data flow or a lifecycle and hyperui writes a typed JSON (the source of truth, in `.hyperui/diagrams/` of your repo), places every box itself — no auto-layout — and measures the result with a zero-dependency validator (overlaps, text that fits, edges through nodes, label room, readability at 1440 px; at most two focused repairs, then it says what is left). You get a self-contained viewer (click a node for its neighbours, upstream/downstream reach, light/dark, PNG/SVG export) and a Mermaid export for the README. `spec` uses it in the design phase; `critique` and `patterns` read the JSON instead of a drawing. See [Diagrams](#diagrams).
- **Every step ends with a choice** (continue, do all, fix something, stop) — you never have to guess what to say next.
- **Does the heavy lifting itself.** When a job is big — "do all the remaining tasks", three features at once, a docs or pricing lookup, a first look at your repo — hyperui decides alone whether to run it inline or in subagents, in parallel, and on which model. No new questions, no menus; experts see one discreet line ("3 tasks in parallel · reviewer after each"), everyone else just the result.
- **Tells you what it took care of.** Every delivered piece ends with one line of what was handled unasked — responsive · a11y · SEO · i18n · security · tests · performance · dark mode · cost · sources — and any item expands on request.
- **Review before done.** Security (OWASP Top 10:2025, ASVS), complexity and safety pass after every build task; blocking findings are fixed first.
- **Asks before it measures.** Anonymous usage data (which steps closed, how many fix rounds, a thumbs up/down once a week) is sent only after you say yes once; nothing from your code, prompts or paths ever leaves the machine. Details and how to turn it off: [Telemetry](#telemetry-opt-in-anonymous).
- **Keeps your version honest.** Every change bumps SemVer (patch by default, minor for a feature) and adds a changelog line in the same commit; your app shows `v1.4.2 · ab12cd3` in the footer or About and exposes `/version.json` + `<meta name="app-version">`; after a deploy hyperui checks the live version itself (`scripts/verify-deploy.sh`) before saying it is live. Say "no versioning for this project" to turn it off.
- **Ship never buys or deploys for you.** Domain, DNS, hosting, payments by seller country, store/desktop distribution: it prepares configs and the exact command or clicks; you run every purchase and deploy — then it verifies what went live.

Three languages, kept apart: skill content and everything in `.hyperui/` in English; replies in the language you write in; the product's language(s) and i18n asked explicitly at the brief, never inferred from the conversation.

## Examples

The three clips below are recordings of the plugin's own test runs — nothing staged, nothing retouched.

<p align="center"><img src="docs/assets/examples/directions.webp" width="100%" alt="Ledger, Monolith and Atelier: three design directions for the same brief, each loading with its entrance motion, a hover on the primary button and a scroll"></p>
<p align="center"><b>Three directions, one brief.</b> Generated before any code — real copy, distinct type and palette, light/dark, entrance motion. You pick one, then it builds.</p>

<table>
<tr>
<td width="50%" valign="top">
<img src="docs/assets/examples/dashboard.webp" alt="Sales dashboard: the what–why–how table first, then KPIs, bar charts and live tooltips">
<p><b>Data: the table first, then the chart.</b> <code>viz</code> writes Munzner's what–why–how table before drawing; bars, not pie; sources cited.</p>
</td>
<td width="50%" valign="top">
<img src="docs/assets/examples/ship.webp" alt="Terminal: /hyperui asked how to charge by card from Colombia; ship recommends Polar, offers Mercado Pago and warns about Lemon Squeezy">
<p><b>Ship: payments for a seller in Colombia.</b> Stripe isn't available there; <code>ship</code> recommends Polar with a source and flags Lemon Squeezy — unedited test run.</p>
</td>
</tr>
</table>

<details>
<summary>Stills and sources</summary>

- **Directions** — the pages themselves, interactive (theme and language toggles work): [Ledger](docs/assets/examples/directions/ledger.html) · [Monolith](docs/assets/examples/directions/monolith.html) · [Atelier](docs/assets/examples/directions/atelier.html). Stills: [strip](docs/assets/examples/directions-strip.png); desktop [Ledger](docs/assets/examples/ledger-1280.png) · [Monolith](docs/assets/examples/monolith-1280.png) · [Atelier](docs/assets/examples/atelier-1280.png); mobile [Ledger](docs/assets/examples/ledger-390.png) · [Monolith](docs/assets/examples/monolith-390.png) · [Atelier](docs/assets/examples/atelier-390.png).
- **Dashboard** — [HTML](docs/assets/examples/dashboard-ventas.html) · [data](docs/assets/examples/ventas.csv) · [still](docs/assets/examples/dashboard-ventas.png). The UI is in Spanish because that was the user's language in the run; the what–why–how card in the clip is in English.
- **Ship** — the answer as text (a test run, unedited), and the [terminal page](docs/assets/examples/ship-terminal.html) the clip was rendered from:

```
Respuesta corta: con Polar. Como vendes desde Colombia,
Stripe no está disponible aquí. Polar cobra por ti, se
encarga de los impuestos de cada país y te paga a tu cuenta.

Recomendado: Polar · 5% + 50¢ por venta, sin cuota mensual,
Colombia aceptada para pagos (verificado hoy)
· https://polar.sh/resources/pricing

Alternativa: Mercado Pago · si tus alumnos están casi todos
en Colombia y pagan con PSE o tarjeta local. …

Evita Lemon Squeezy: se está integrando en un producto de
Stripe que excluye Latinoamérica.
```

How the clips were made: [`docs/assets/README.md`](docs/assets/README.md).

</details>

## What the critique is grounded in

hyperui does not judge a UI by taste. When it critiques a page or checks its own directions before showing them, it applies the theory below — the same body of work a trained UX evaluator uses — and every finding names the principle, the evidence and the source. The research snapshot it works from is public: [`docs/research/hci-ux-foundations.md`](docs/research/hci-ux-foundations.md) (heuristics, repair, cognitive load, conversion) and [`docs/research/munzner-vad.md`](docs/research/munzner-vad.md) (data views); each claim links the page that was opened, and what could not be verified is marked.

- **Don Norman**, *The Design of Everyday Things* — affordances, signifiers, natural mapping, feedback, constraints, conceptual models, the gulfs of execution and evaluation, slips vs mistakes.
- **Jakob Nielsen** — the 10 usability heuristics, heuristic evaluation and its 0–4 severity scale, the response-time limits (0.1 s · 1 s · 10 s).
- **ISO 9241-110:2020** — the interaction principles: suitability for the task, self-descriptiveness, conformity with expectations, learnability, controllability, use-error robustness, user engagement.
- **Ben Shneiderman** — the 8 golden rules (consistency, universal usability, informative feedback, closure, error prevention, easy reversal, user control, low memory load).
- **Clark & Brennan** (grounding) and **Schegloff, Jefferson & Sacks** (conversational repair), with **Grice**'s cooperative principle and **Reeves & Nass**'s *Media Equation* — the model that a UI is a conversation which must repair misunderstandings instead of dropping them: acknowledge, point at the trouble, let the user fix it with their input preserved, undo, closure.
- **Miller and Cowan** (working memory, ~4 chunks), **Sweller** (cognitive load), **Hick–Hyman** (choice time), **Gestalt** grouping, NN/g visual hierarchy and scan patterns, **Fitts's law** — the cognitive-load and hierarchy pass.
- **Tamara Munzner**, *Visualization Analysis and Design* — what–why–how, idiom choice by channel effectiveness, for every chart, table and KPI.
- **The conversion lens** — the Fogg Behavior Model (B = MAP), the LIFT model, Baymard's checkout and form research, Core Web Vitals, WCAG 2.2 AA, and the deceptive-patterns taxonomy (deceptive.design, EU DSA Art. 25, FTC 2022): a dark pattern is always a blocking finding, even when it would "help" the goal.

Popular misreadings are deliberately not applied: "7±2 items per screen", the 3-click rule, Fitts as "make everything big", the F-pattern as a layout goal, "always confirm destructive actions".

## Diagrams

<p align="center"><a href=".hyperui/diagrams/hyperui-architecture.html"><img src="docs/assets/examples/hyperui-architecture.png" width="100%" alt="hyperui architecture drawn by its own diagram specialist: You → /hyperui → Design, Plan, Build, Ship → Claude artifacts and the .hyperui/ memory inside your repo"></a></p>
<p align="center"><b>hyperui, drawn by hyperui.</b> The plugin's own architecture, authored as a typed JSON, validated in one repair and rendered to the self-contained viewer (<a href=".hyperui/diagrams/hyperui-architecture.html">open it</a>: click a node, try <i>Downstream</i>, switch the theme, export a PNG). Source: <a href=".hyperui/diagrams/hyperui-architecture.json"><code>.hyperui/diagrams/hyperui-architecture.json</code></a>.</p>

The idea is borrowed from [Archify](https://github.com/tt-a1i/archify) (MIT; method notes in [`docs/research/archify-diagram-method.md`](docs/research/archify-diagram-method.md)): **the agent places, the validator measures.** Mermaid's auto-layout stops reading well past 6–8 nodes, and a drawing is dead data for the next agent. So:

1. **A typed JSON is the diagram** (`skills/diagram/schema.json`): five types — `architecture`, `flow`, `sequence`, `dataflow`, `lifecycle` — with nodes on a grid (`row`, `col`), groups for real boundaries, labelled edges. Unknown fields are rejected.
2. **`scripts/diagram-check.mjs` validates it** (Node ≥ 20, no dependencies): schema → cells → overlaps → text fit → edges through nodes → side direction → crossings → labels → canvas → readability → node budget. Every finding has a code, the element, the measurement and the fixes (`skills/diagram/references/diagnostics.md`); the skill repairs at most twice, then reports the gap instead of looping.
3. **`render` writes one HTML file under 60 KB** (`templates/diagram/viewer.html`): inline SVG, colours only through CSS tokens (light/dark, your `design.md` accent when it exists), focus and upstream/downstream reach over the authored edges only, `#focus=<id>` deep links, PNG 2× and SVG export, keyboard and screen-reader friendly nodes. The JSON travels inside the HTML.
4. **`mermaid` exports the structure** for GitHub READMEs — this is the diagram above, as Mermaid:

```mermaid
flowchart LR
  subgraph your_repo ["Your repo"]
    memory[(".hyperui/")]
    repo["Your code"]
  end
  hooks["Hooks"]
  user(["You"])
  scripts["Scripts"]
  entry["/hyperui"]
  agents["Agents"]
  design["Design"]
  plan["Plan"]
  build["Build"]
  ship["Ship"]
  artifacts>"Claude artifacts"]
  user ==>|"request"| entry
  hooks -.->|"context"| entry
  entry -->|"profile.sh root"| scripts
  entry -.->|"dispatches"| agents
  entry --> design
  entry ==>|"routes"| plan
  entry --> build
  entry --> ship
  design -->|"publishes"| artifacts
  plan -->|"spec pages"| artifacts
  plan -->|"writes"| memory
  build -->|"code+tests"| repo
  ship -->|"configs"| repo
```

Say "hazme el diagrama de arquitectura" and `/hyperui` routes it; experts call `/hyperui:diagram` directly. Diagrams are committed with the rest of `.hyperui/` in your repo, never in the plugin.

## Specialists

Every specialist is hidden from the slash menu (`user-invocable: false`) and routed to automatically by `/hyperui`; call one by name if you want:

| Skill | Use |
|---|---|
| `/hyperui:design` | Brief → 2–3 visual directions as artifacts → tokens → components → QA. |
| `/hyperui:critique` | Diagnose any UI (live URL, screenshots, mock, Figma, a direction) against HCI/UX theory and your goal: 22 checks, repair model, conversion lens; severity 0–4, evidence, fixes, verdict; report + artifact. |
| `/hyperui:motion` | Motion language: easing, durations, choreography, `motion` recipes. |
| `/hyperui:video` | Promo/demo clip with HyperFrames from the project's real tokens and assets. |
| `/hyperui:spec` | Gated PRD → requirements → design → tasks, or a one-file SDD-lite; every spec file shown as an artifact, plus a consolidated spec artifact at the end. |
| `/hyperui:diagram` | Architecture, flow, sequence, data-flow and lifecycle diagrams: typed JSON IR → zero-dependency validator with repairs → interactive viewer (focus, reach, light/dark, PNG/SVG) + Mermaid export. The JSON is what the other specialists read. |
| `/hyperui:build` | One task at a time: test first, per-language rules, official docs over memory. |
| `/hyperui:review` | Security, complexity and safety pass before anything is called done. |
| `/hyperui:patterns` | DDD, CQRS, hexagonal, GoF, resilience — only when the spec needs one. |
| `/hyperui:ship` | Domain, DNS, hosting, payments by country, store/desktop distribution. |
| `/hyperui:infra` | Terraform/Terragrunt, ECS Fargate vs EKS, GitHub Actions OIDC, state and IAM first. |
| `/hyperui:viz` | Munzner what–why–how analysis before any chart. |
| `/hyperui:git` | Conventional Commits, PRs, releases, hotfixes. |

### For power users

Everything above is the default path; nothing here is required.

- **Call a specialist by name**: `/hyperui:design`, `/hyperui:spec`, `/hyperui:build`, … (table above).
- **Agents** (what the automatic dispatch runs; also callable by name or `@agent-hyperui:<name>`): `hyperui:builder` (one spec task with TDD, the session's model), `hyperui:reviewer` (security + complexity on given files, `sonnet`), `hyperui:researcher` (docs, prices, MCPs with URLs, `haiku`), `hyperui:scout` (repo inspection for the profile, `haiku`).
- **Override in words**: "hazlo con sonnet", "use opus for this", "no uses subagentes", "back to automatic". hyperui obeys and stores it in `.hyperui/profile.md` as `dispatch: auto | inline | sonnet | opus | haiku` (`auto` is the default; edit the file to change it by hand). Rules and mechanics: [`references/dispatch.md`](references/dispatch.md).
- **Live browser checks**: start Claude Code with `claude --chrome` (or `/chrome` → "Enabled by default") so hyperui verifies UI in your real Chrome — screenshots at 360/768/1280, light/dark, one interaction, a short GIF. Interactive sessions only (one per machine); `-p`, evals and subagents use the headless path. Procedure: [`skills/design/references/browser-verify.md`](skills/design/references/browser-verify.md).

## Working from any directory

```
/hyperui --repo ~/path/to/project …  # work on a repo from any directory: that path becomes the project root
                                     # (.hyperui/, specs, code, ship files); remembered per directory, so say it once
/hyperui --repo .                    # forget it and work on the current directory again
```

- You can also just say it ("el repo está en ~/x") — the path in words works like `--repo`.
- The mapping is remembered per directory, in the per-machine file `~/.claude/plugins/data/hyperui/user.md` (`roots:`).
- Several repos (`--repo ~/web --repo ~/mobile`, or "the web is in ../web and the api in ../api") form one workspace: each repo keeps its own `.hyperui/`, and the first one holds `.hyperui/workspace.md` (the repos, one role each, the cross-repo next step).

hyperui reads that repo and writes its `.hyperui/` without prompts; to let it run shell commands there (tests, builds) start Claude in the repo or run `/add-dir <path>` once (Claude Code's own rule).

### How it remembers

Project memory lives in `<root>/.hyperui/` (profile, brief, design, spec, decisions, state, ship) and is committed by default, so the next session — or a teammate — picks up the thread. `/hyperui --private` adds `.hyperui/` to `.gitignore` instead. The root is the current directory unless you said `--repo <path>` (or named the path in words): that mapping is stored per directory in `~/.claude/plugins/data/hyperui/user.md` (`roots:`), which also keeps a small profile (level, language, country) so you are not profiled again in a new project.

### Grounding

Advice comes from sources opened at the time (each skill lists them; snapshots in [`docs/research/`](docs/research/README.md)). When an official MCP would help, hyperui shows the exact `claude mcp add` line and asks — it never adds one. `scripts/check.sh` keeps the plugin company-agnostic.

## Requirements

### You need before installing

hyperui does not install these. Each line ends with how to check.

| | Why | Check |
|---|---|---|
| **Claude Code CLI**, signed in to a Claude account (hyperui runs on your own Claude; no hyperui account; usage data only if you opt in — see [Telemetry](#telemetry-opt-in-anonymous)). No documented minimum for the `"skills": ["./"]` manifest form hyperui uses (only the `"."` spelling needs v2.1.221+); **tested on 2.1.288** — stay current. | runs everything | `claude --version` |
| **macOS** (tested: 15+, Apple Silicon and Intel). Linux should work (bash + python3; untested). Windows only via WSL2 — the hooks and scripts are bash (untested). | hooks, scripts | `uname -s` |
| **git** | `git` specialist, plugin updates | `git --version` |
| **Node 24 LTS recommended, ≥ 20 required** (+ npm; `nvm` is the easiest way to manage versions) | `npx @tizonai/hyperui`, `/hyperui:setup` components, `motion` | `node --version` |
| **python3** (macOS ships it) | `scripts/profile.sh` and `scripts/permit.sh`; without it profile.sh falls back to awk but permit.sh stays silent, so permission prompts appear; UI UX Pro Max search needs it too | `python3 --version` |

Node or python3 missing (or Node < 20)? `/hyperui:setup` prints the install line for your OS (Node 24 via `brew install node@24` / `nvm install 24` / NodeSource 24.x) and offers to run it (`--install-prereqs`, Homebrew on macOS; on Linux/WSL2 you run the printed line).

### hyperui installs for you when missing (nothing to do)

- **Via `/hyperui:setup`:** HyperFrames skills, Motion AI Kit (`/motion` skill, `motion-reviewer` agent, `motion` MCP), UI UX Pro Max skill, Anthropic `frontend-design` plugin, Impeccable plugin, the `motion` npm package in the project.
- **Via `infra`, on first use:** Terraform — asks once, then `brew install hashicorp/tap/terraform` on macOS; on Linux it prints the official install line for you to run.
- **Optional, only if you want them:** the 21st.dev components MCP (free key you create at https://21st.dev/mcp; hyperui registers it when you pass `--21st-key`), provider MCPs (Vercel, Supabase, Stripe, Terraform MCP…: hyperui shows the exact `claude mcp add` line and asks before adding).
- **Optional, for visual verification:** [Claude in Chrome](https://code.claude.com/docs/en/chrome.md) — the Chrome extension (≥ 1.0.36) plus a direct Anthropic plan (Pro/Max/Team/Enterprise) and `/login`; start with `claude --chrome`. Without it, `/hyperui:setup --playwright-mcp` registers the Playwright MCP (headless) as the fallback, and a local Google Chrome binary is used for plain headless screenshots; with none of them hyperui says the UI was not visually verified.

### Network and permissions

Outbound HTTPS to the official docs and provider pages the skills cite (`WebFetch` prompts for permission in default mode — expected), one daily `GET` of the plugin manifest on GitHub for the update check, and — only after you opt in — one daily `POST` to `tizonai.com/api/telemetry` (below). The plugin pre-approves only its own skills, its reference reads, its own scripts (`profile.sh`, `update-check.sh`, `verify-deploy.sh`, `telemetry.sh`, `node diagram-check.mjs`) and writes under `<root>/.hyperui/`; everything else follows your normal Claude Code permissions.

## Telemetry (opt-in, anonymous)

**Default: off.** Nothing is recorded or sent until you answer **yes** once. After the first finished piece of work on a machine, hyperui asks one line — "Anonymous usage data helps improve hyperui (no code, prompts, names or paths — just which steps worked). Send it? yes / no" — and never asks again; **no answer counts as no**. `/hyperui:setup --telemetry` or `--no-telemetry` answers without the prompt.

**What is sent, exactly** (one JSON `POST` a day, at most 50 events, to `https://tizonai.com/api/telemetry`, which forwards to a PostHog project owned by tizonai; the body is the whole payload):

```
{"install_id": "<random uuid4, minted on your first yes; not derived from anything>",
 "plugin_version": "0.13.0", "os": "darwin|linux", "claude_version": "2.1.288",
 "events": [{"ts": "<ISO 8601>", "name": "unit_closed|feedback|gate_failed|critique|update_offer",
             "skill": "design|build|spec|ship|critique|viz|…", "props": {…}}]}
```

`props` can only hold: `outcome` (`continue|do_all|fix|stop` — what you chose after a step), `iterations` (how many fix rounds a step took), `severity_max` (0–4, worst finding of a critique), `rating` (`up|down`) and `comment` (≤ 280 characters, **only the text you type when asked "How did hyperui do?"**, at most once a week; anything that looks like a path, URL or email is stripped before it is stored), `archetype` (`non-tech|dev|senior`), `accepted` (did you take an update offer). The script drops any other key or event name.

**Never sent:** your prompts, code, diffs, file or repo names, URLs, paths, emails, the project profile, anything under `.hyperui/`, your account. The endpoint sees your IP like any HTTPS request; it is not stored with the events.

**See, disable, erase** — everything lives in `~/.claude/plugins/data/hyperui/` (`user.md` keys `telemetry`, `install_id`, `telemetry_last_flush`; queue `telemetry.jsonl`, plain text you can read before it goes out):

```
~/.claude/plugins/marketplaces/tizonai/scripts/telemetry.sh status      # consent, install_id, queued events, last send
~/.claude/plugins/marketplaces/tizonai/scripts/telemetry.sh consent no  # stop sending (queue kept on disk)
~/.claude/plugins/marketplaces/tizonai/scripts/telemetry.sh purge       # delete the queue and the install_id, consent no
/hyperui:setup --no-telemetry                                           # same as consent no, from inside Claude Code
```

(`/hyperui:doctor` shows the same in its `Telemetry` row; the script path is wherever your marketplace clone lives — `claude plugin list` prints it.) Sending happens at session start in the background with a 3-second timeout; offline or a non-2xx answer keeps the queue for the next day, never blocks a session. `HYPERUI_TELEMETRY_URL` and `HYPERUI_DATA` point the script at a local endpoint and directory for tests.

## Docs

- [`docs/architecture.md`](docs/architecture.md) — how it fits together: component tree, flow, hooks, memory, the company-agnostic gate, evals, how to add a specialist. The spec lives in the author's workshop; its Addendum of as-built findings is summarized here.
- [`docs/research/`](docs/research/README.md) — the source snapshots the skills are grounded in (providers and MCPs, engineering sources, HCI/UX foundations, Munzner, the Archify diagram method).
- [`CHANGELOG.md`](CHANGELOG.md) — Keep a Changelog, SemVer.
- [`docs/assets/README.md`](docs/assets/README.md) — how the logo, diagram, demo and example clips were produced.

## Local development

```
git clone git@github.com:tizonai/hyperui.git
cd hyperui
bash scripts/check.sh           # validate + lint + company-agnostic grep (strict gate)
claude --plugin-dir .           # load this checkout for one session
claude plugin eval . --case <name> --runs 1 --ablation none --scaffold --allow-tools Bash Write Edit --no-publish --trust-plugin   # iterate on one case, cheap
claude plugin eval . --scaffold --allow-tools Bash Write Edit --no-publish --trust-plugin   # full suite: 3 runs + no-plugin baseline — only before a release
```

`scripts/check.sh` runs `claude plugin validate .` (manifests + skills), `bash -n` on every script, the frontmatter and preamble lints, `node --check` and the diagram toolchain's `--self-test` (`node scripts/diagram-check.mjs --self-test`, 38 cases), the viewer-size (< 60 KB) and Archify-attribution lints, and the grep that fails on company-specific strings.

Evals burn tokens: iterate with `--runs 1 --ablation none` (one with-plugin run, no baseline arm; add `--max-cost-usd 4` as a ceiling); the full suite (3 runs per case + the baseline arm) runs only before a release.

## Updating

hyperui checks once a day (at session start, 3-second timeout, silent offline) whether a newer version is on GitHub `main`; when there is one, the first reply offers it in one line — "yes" prints the two commands below, "later" silences the offer for that version (cache: `~/.claude/plugins/data/hyperui/update-check.json`).

To release: bump `version` in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` **and** `package.json` (`npm run version-check` compares the first and the last), push to `main`, then on each machine:

```
npx @tizonai/hyperui install              # re-running it updates the marketplace and the plugin
claude plugin update hyperui@tizonai
```

## License

Apache License 2.0 — see [`LICENSE`](LICENSE); keep [`NOTICE`](NOTICE) (author attribution) in any redistribution. Third-party components keep their own licenses: [HyperFrames](https://github.com/heygen-com/hyperframes) (Apache-2.0), [Impeccable](https://github.com/pbakaus/impeccable), [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), [21st.dev](https://21st.dev), [frontend-design](https://github.com/anthropics/claude-plugins-official). The geometry, text-fit and port-spread helpers of the diagram validator are adapted from [Archify](https://github.com/tt-a1i/archify) (MIT, commit `bb990b1`; licence copy in [`skills/diagram/LICENSE-archify`](skills/diagram/LICENSE-archify)).
