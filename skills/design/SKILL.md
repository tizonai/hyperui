---
name: design
description: "Build standout, production-grade frontends end to end: brief → visual direction → design tokens → components → motion → QA. Use when asked to design or build a landing page, marketing site, dashboard, app UI, component or redesign, or to make an existing UI look premium. Orchestrates ui-ux-pro-max, frontend-design, 21st.dev, motion and Impeccable when they are installed."
user-invocable: false
allowed-tools:
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/telemetry.sh *)
  - Read(//${CLAUDE_PLUGIN_ROOT}/**)
  - Edit(.hyperui/**)
---

# hyperui:design — standout frontends, end to end

Work as the design lead who owns the result, not as a template filler. Every page gets a point
of view, a typographic identity and one thing people remember.

## 0. Before anything

- Resolve the project root with `${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh root` and use it (absolute paths) for `.hyperui/` and for every repo read/write. If `<root>/.hyperui/profile.md` is missing, invoke the `hyperui` skill first (it onboards and routes); otherwise read `profile.md` and `state.md` and never re-ask what they hold. With several roots (`profile.sh roots`), work in the repo the request or the touched file belongs to, with that repo's `.hyperui/` (rules: `${CLAUDE_PLUGIN_ROOT}/references/workspace.md`).
  Profile fields used: archetype, `conversation_language`, `product_languages`, `i18n`, `platform`,
  `design.*`; also `.hyperui/brief.md` / `design.md` if present — build on the picked direction.
- Reply in the conversation language; keep internal reasoning, code and files in English.
- Tone per archetype: non-tech → one or two plain sentences per step, one question with a recommended answer; dev → the fact + one line of why; senior → the fact, ~12 lines max.
- **Called from `spec`** (a UI change asked as a spec/SDD, or no picked direction in `design.md`): steps 1–2 only — brief and
  argued directions — stop at the pick and return; tokens, components and motion come with the build. `spec` continues from `design.md`.

## 1. Preflight

Check which helpers exist and adapt — never block on a missing one: `ui-ux-pro-max` (`.claude/skills/ui-ux-pro-max/` or `~/.claude/skills/…`: styles, palettes, font pairings, UX rules);
`frontend-design` (Anthropic plugin skill) for aesthetic direction; 21st.dev MCP tools (`mcp__21st__*`) for component candidates; `motion` in `package.json`;
a browser tool (`references/browser-verify.md` §1). Key ones missing → suggest `/hyperui:setup` once, then proceed with what is available.

## 2. Process

1. **Brief (5 lines, write it to `.hyperui/brief.md` before any code).** Product and what it does · audience · the ONE job of this
   page (sign up, download, understand, decide) · 3 tone words · constraints (stack, brand assets, existing tokens). If the brief lacks
   the product, infer it from the repo and confirm. **Product language(s) / i18n:** if `product_languages` is empty, ask once which
   language(s) the product ships in and whether it needs i18n (several locales, default locale, RTL); store `product_languages` + `i18n`
   in the profile. Never infer it from the conversation language; never ask again once stored.
2. **Direction (the only mandatory checkpoint — show before build).** Use `frontend-design` for
   the point of view and `ui-ux-pro-max` to search styles, palettes and font pairings for the
   product category. Produce 2–3 directions, each distinct in type pairing, palette (3 colors +
   accent) and signature move (the one memorable element).
   **Artifact contract:** each direction is ONE HTML page — the real copy in the product
   language, the direction's tokens and display type, a visible entrance animation, light and
   dark. Publish each with the Artifact tool (load the `artifact-design` skill first when it is
   available); when the session offers `/design` (Claude Design artboards), use it instead.
   No Artifact tool in the session → write `.hyperui/directions/<name>.html` and give the paths.
   Record every URL/path in `.hyperui/design.md`. **A browser tool in the session** (`references/browser-verify.md` §1) → open each
   direction page and take one 1280 screenshot before presenting it (catches a broken page or a missing font). **Critique each direction
   against the brief's ONE job before presenting** (`${CLAUDE_PLUGIN_ROOT}/skills/critique/references/checklist.md` quick pass — cognitive load
   C11–C12, match and consistency C3–C6, feedback C1–C2, recovery C13–C16, platform C6 — plus the goal's row of
   `skills/critique/references/conversion-lens.md`; data views: the Munzner pass): fix severity ≥ 3 before the user sees it and keep each
   direction's **max severity vs the goal**. **Argued directions:** present one line per direction — name · type pairing · palette ·
   signature · link · **why it works**: the author/principle it leans on, from the checklist's source column (Norman signifiers/mapping,
   Nielsen #n, ISO 9241-110, Shneiderman, Clark & Brennan grounding, Munzner for data views, Fogg/LIFT for the conversion goal; cite
   `skills/critique/references/sources.md`, never re-explain the theory). **Recommend the direction with the lowest max severity** and say why in
   one sentence ("B: the only one with a single primary action above the fold — Nielsen #8, Fogg Ability"). Non-tech: same author
   names, plain words (critique §6). No preamble. Then the pick as the entry skill's choice prompt
   (root §9: `AskUserQuestion`, else a numbered list as the LAST thing in the reply; user's language):
   the 2–3 direction names, the recommended one first with "(Recommended)" · "Mix / adjust a
   direction" (free text) · "Show me 2 more". With 3 directions in `AskUserQuestion` (4 options max),
   "Show me 2 more" goes through "Other". `state.md` `open:` holds `pending choice: direction pick`
   until answered. The user picks before any build. `design.md` records, per direction, the why line and the max severity.
3. **Tokens before components.** Write CSS custom properties on `:root`: color *roles*
   (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--border`), type scale, spacing, radius,
   elevation, motion durations and easings. Dark mode under `@media (prefers-color-scheme: dark)`
   guarded by `:root:not([data-theme="light"])`, plus an explicit `:root[data-theme="dark"]`
   override. Fonts via the framework loader (`next/font`) or one preconnected stylesheet; set
   `font-display: swap` and size-adjusted fallbacks so there is no layout shift.
4. **Components.** Compose from the stack's primitives. When 21st.dev is installed, pull 2–3
   candidates per component and *adapt* them to the tokens — never paste a component with its own
   palette, radius or shadow system. One visual signature element per page (a type treatment, a
   live demo, a material, an animation), everything else quiet. **Test first, UI included:** the
   component's render test (project runner — Vitest + Testing Library typical: `getByRole` + accessible
   name, an `axe` assertion when available) is written and red BEFORE the component exists (build §3).
   **No version stamp in the project yet → add one in this first UI change** (`references/version-stamp.md`: version +
   short commit injected at build, footer or About `v1.4.2 · ab12cd3`, `<meta name="app-version">`, `/version.json`,
   a render test that it shows the manifest's version); one line saying so.
5. **Motion.** Hand off to the `motion` skill. Defaults: entrance stagger on the hero, hover and tap
   micro-feedback on interactive elements, scroll reveal only where it aids reading. Always honor
   `prefers-reduced-motion`.
6. **QA in the browser, with evidence** — `references/browser-verify.md`: detect the tool (Claude in Chrome →
   Playwright MCP → headless Chrome), capture 360 / 768 / 1280 (+1920 marketing) light AND dark, one interaction,
   run the checks (no horizontal scroll, no clipped text, contrast AA, visible focus, hero in the first 360 viewport,
   fonts loaded, images sized; 16px phone gutters; full keyboard navigation; the version stamp visible and equal to the
   version file), record `## Browser evidence` in `design.md`. Then the **critique quick pass** on each page (same checks as step 2,
   from the captures): severity ≥ 3 fixed and recaptured before "done"; the care line says `heuristics checked`.
   No browser tool → say so, static checks only, never a visual claim. Lighthouse ≥ 90 ×4 when a build is available.
7. **Impeccable gate (before declaring any UI done) — with evidence.** Check `claude plugin list`.
   If Impeccable is installed: ACTUALLY invoke `/impeccable audit` (Skill tool), fix the findings,
   then invoke `/impeccable polish`; record the evidence in `design.md` under `## Quality gate`
   (audit: N findings, what was fixed; polish: run/not) and mention it in the care line. A gate
   without recorded evidence is NOT done — never say "audited" or "polished" if the skill did not
   run; say "not run" and why. If not installed: say once and suggest `/hyperui:setup` (note it in
   `state.md`). 21st.dev likewise: use it only if `mcp__21st__*` tools exist in THIS session; a
   just-registered MCP appears after Claude Code restarts — say so and state components were built
   by hand.

## 3. Rules of taste

- Typography carries the identity: one display face with character + ONE body face. Pick them
  deliberately for this product, not the family you reach for everywhere.
- Real hierarchy: display size ≥ 3× body; weights jump (e.g. 800 display, 400 body), not 500→600.
- Banned generic tells: purple-to-blue gradient hero, three-icon feature grid with identical
  cards, "Welcome to …" headings, glassmorphism on everything, everything centered, emoji as
  icons, drop shadows on every card, a big number + small label as the default hero.
- One accent color, used sparingly, always meaning "action" or "live"; depth from layering and tonal steps (bg → surface → raised), not borders on everything.
- Whitespace is generous and rhythmic: 8pt grid, sections breathe, density only where data lives.
- Real copy and real data in the deliverable. Never lorem ipsum, never placeholder avatars. Images with intent: the product, its output, its materials; no stock people pointing at laptops.
- The hero opens with the most characteristic thing in the product's world: a live demo, a real screenshot, a single bold statement. Decide which, on purpose.
- Dark mode is designed, not inverted: lift surfaces, lower saturation, re-check contrast.
- Icons from one set, one stroke width, one optical size. Max 80ch line length for body text; serif bodies get slightly more line-height.
- Empty, loading and error states are designed up front, with the same care as the happy path. Forms: labels always visible, inline validation, hit targets ≥ 44px.
- Motion is choreography, not decoration: one entrance sequence per view.

## 4. Stack defaults

React + Next.js App Router unless the project says otherwise. Styling follows the project (CSS Modules or Tailwind); tokens always live in CSS
variables so either works. `next/image`, `next/font`, Motion (`motion/react`). No component-library lock-in: shadcn and 21st.dev pieces are source you own and restyle to the tokens.

## 5. Deliverable

**Show before you ask (root §7).** After any UI change the dev server STAYS RUNNING (never kill it after tests) and the reply
carries, BEFORE the choice prompt: the local URL + how to restart the server · the 360/768/1280 screenshots (an artifact when the
Artifact tool exists, else file paths) · one line "what to look at" · browser evidence or the one line that no browser tool was
available · Lighthouse numbers if measured · open decisions. Headless `-p` (no server for the user) → the start command and the paths.

## 6. Redesigns and existing UIs

- Audit first, the live site and the repo: tokens present or absent, the fonts actually loaded,
  the count of distinct grays / radii / shadows in use. The count is the diagnosis; the fix is
  consolidation. Put the numbers in the reply in one line.
- Directions keep the information architecture unless the brief asks otherwise and are visibly a step up: new skin,
  type and rhythm. Users forgive a new look, not a lost page. Same artifact contract (step 2) before any code changes.
- Migrate incrementally: tokens → global type → shared primitives (button, card, input) → pages.
  Each step ships and keeps Lighthouse ≥ 90. Delete dead CSS as you go; the redesign is not done while two systems coexist.

## 7. i18n and content

- Ship every locale in `product_languages`; with `i18n: true`, route per locale and set `lang`.
- Design with the longest language first (Spanish and German run ~25–30% longer than English);
  no fixed-width labels, no truncation of CTAs.
- Dates, numbers and currencies through `Intl.*`, never hand-formatted. Every string in the dictionaries, including alt text and aria labels; no copy in components.

## 8. Tokens starter

```css
:root {
  --bg: #0b0d12; --surface: #141822; --raised: #1c2130;
  --text: #f2f4f8; --muted: #9aa3b5; --border: #2a3042;
  --accent: #3ecf8e; --accent-ink: #062b1c;
  --font-display: var(--font-sora), system-ui, sans-serif;
  --font-body: var(--font-inter), system-ui, sans-serif;
  --fs-display: clamp(2.5rem, 6vw, 4.5rem); --fs-h2: clamp(1.75rem, 3vw, 2.5rem);
  --fs-body: 1.0625rem; --fs-small: 0.875rem;
  --space-1: 0.5rem; --space-2: 1rem; --space-3: 1.5rem; --space-4: 2.5rem; --space-5: 4rem;
  --radius-s: 8px; --radius-m: 14px; --radius-l: 24px;
  --shadow-1: 0 1px 2px rgb(0 0 0 / .25); --shadow-2: 0 12px 32px -12px rgb(0 0 0 / .45);
  --dur-fast: 150ms; --dur-base: 250ms; --dur-slow: 450ms;
  --ease-out: cubic-bezier(.16, 1, .3, 1); --ease-in-out: cubic-bezier(.65, 0, .35, 1);
  color-scheme: dark;
}
:root[data-theme="light"] {
  --bg: #fbfbfd; --surface: #ffffff; --raised: #f2f3f7;
  --text: #0e1220; --muted: #5c6578; --border: #e3e6ee;
  --accent: #17b877; --accent-ink: #ffffff; color-scheme: light;
}
body { background: var(--bg); color: var(--text); font: var(--fs-body)/1.6 var(--font-body); }
```

## 9. Close the turn

Write what you decided: picked direction, tokens, fonts, palette, signature element, artifact
URLs and rejected directions (one line) → `.hyperui/design.md`; the next step → `state.md`;
one ADR-lite line per settled decision → `decisions.md` (`date · decision · why · source`).
When the next step is theirs (pick made, UI done), close with the root §9 care line (what the directions
or the UI already handle unasked: responsive · a11y · dark mode · performance · i18n · tests · verified in Chrome (360/768/1280) · heuristics checked · version vX.Y.Z — only what verifiably ran),
the root §9 telemetry consent line when `profile.sh user-get telemetry` is empty or `unasked` (once per machine), and then the §9 choice prompt.

## Sources

Cite only URLs that are listed in a skill/reference or that you opened this session; never construct or guess a URL.

Open the source before stating. Canonical references: [`references/sources.md`](references/sources.md).
