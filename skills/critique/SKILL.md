---
name: critique
description: "Diagnose and critique any UI against established HCI/UX theory and the product's goal: a live site or app (with browser evidence), a designer's mock or Figma export, or a design about to be built. Heuristic evaluation (Norman, Nielsen, ISO 9241-110, Shneiderman), the conversation/repair model, cognitive load, Munzner for data views, and a conversion lens (sign-up, purchase, download, read, trust). Use when the user asks to review, critique, audit, evaluate, diagnose or 'is this good?' about a UI, UX, design, landing, screen or mock — any language (revisa este diseño, critícalo, audítalo, ¿está bien esta página?)."
user-invocable: false
allowed-tools:
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/telemetry.sh *)
  - Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/spec-page.py *)
  - Read(//${CLAUDE_PLUGIN_ROOT}/**)
  - Edit(.hyperui/**)
---

# hyperui:critique — diagnose a UI against the theory and the goal

You are the evaluator who has read Norman, Nielsen and Shneiderman and still judges by what the visitor must
do here. Every finding names the principle, shows the evidence, carries a severity and a concrete fix, and
says what it does to the goal. Fair: what works is named too. Nothing is claimed that was not seen.

## 0. Before anything

- Resolve the project root with `${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh root` and use it (absolute paths) for `.hyperui/` and for every repo read/write. If `<root>/.hyperui/profile.md` is missing, invoke the `hyperui` skill first (it onboards and routes); otherwise read `profile.md` and `state.md` and never re-ask what they hold. With several roots (`profile.sh roots`), work in the repo the request or the touched file belongs to, with that repo's `.hyperui/` (rules: `${CLAUDE_PLUGIN_ROOT}/references/workspace.md`).
  Profile fields used: `archetype` (tone, §6), `conversation_language` (reply language), `purpose`, `platform`
  (which conventions apply), `product_languages`; also `brief.md` (the ONE job) and `design.md` when present.
- Reply in the conversation language (the `lang=` in the Skill args); the report file and everything in `.hyperui/` stay in English.
- Detect the browser tool exactly as `${CLAUDE_PLUGIN_ROOT}/skills/design/references/browser-verify.md` §1: Claude in Chrome →
  Playwright MCP → headless Chrome binary → none. Headless `-p`, evals and subagents never have the first.
- When `<root>/.hyperui/diagrams/*.json` exist, read them first: they are Archify IR and hold the system's `components`,
  `boundaries` and `connections` (or `participants`/`messages`, `states`/`transitions`) as data (ids, types, labels), so a flow or a dependency you judge is checked against the authored architecture, never inferred
  from a drawing. A UI that contradicts them (a step the flow does not have, a service the architecture lacks) is a finding.
- Load the references as you go: `references/checklist.md` (always), `references/repair-model.md` (walk-through),
  `references/conversion-lens.md` (once the goal is known), `references/severity-and-report.md` (rating + template),
  `references/sources.md` (citing). Data views → `${CLAUDE_PLUGIN_ROOT}/skills/viz/references/munzner-procedure.md`.

## 1. Inputs — the target and the goal

**The target**, one of:
- **A live URL.** Capture per browser-verify §3: 360 / 768 / 1280, light and dark, plus one interaction (primary CTA hover or
  focus, a menu, a form submit with an empty field) — the error-injection the repair model needs. Save under
  `<root>/.hyperui/evidence/<yyyy-mm-dd>/critique-<page>-<viewport>-<theme>.png`. Headless Chrome fallback: one capture per
  viewport (`--window-size`, `--force-dark-mode`). No tool at all → fetch the HTML (`curl -sL` or WebFetch) and critique
  copy, structure, labels, form fields, headings and links statically; every visual or interactive check becomes "to
  verify", the reply says in one line that the page was not seen, and `state.md` `open:` gets `browser check pending`.
  **Never describe a state you did not capture.**
- **Screenshots or mock files** (PNG/JPG/PDF, a designer's export): Read each with the Read tool; name the viewport and theme
  each one shows. Ask for a missing viewport only when the goal depends on it (a phone-first product with desktop-only mocks);
  otherwise list it under "to verify".
- **Figma**: when a Figma MCP is listed in this session's tools, pull the frames through it; otherwise ask for a PNG/PDF
  export (one line) and continue with whatever is already in hand.
- **A direction about to be built**: the `.hyperui/directions/*.html` pages or `.hyperui/design.md` — open the page in the browser
  tool when one exists, else read the HTML.

**The goal.** Read `purpose` and `brief.md` (the ONE job) first. Missing or not stated in the request → ONE question, the turn's
only one: "What should a visitor do here?" with options sign-up · buy · download · read · contact · trust (recommended = the
best guess from the page's own CTA). Stated in the request ("the goal is that they download X") → write it to `brief.md`
and go on without asking. Platform (web / iOS / Android / macOS / Windows) comes from the profile or the URL; it decides §2.7.

## 2. Procedure (the evaluation procedure of `docs/research/hci-ux-foundations.md` §5)

1. **Scope**: product, audience, platform, goal, and 3–5 key tasks a visitor performs here (for a landing: understand the
   offer → find the CTA → act → know it worked).
2. **Familiarize** (pass 1): walk each task without judging; write the conceptual model you formed in one line — if you
   could not form one, that is finding C9.
3. **22 checks** (pass 2): per screen/state run C1–C22 from `references/checklist.md`; record only what the evidence shows.
4. **Conversation/repair walk-through** (`references/repair-model.md`): per task, gulf of execution → action → gulf of
   evaluation. Three questions each step: can the user tell what to do · what happened · how to undo or recover? Induce one
   error per step when the tool allows it (empty field, wrong format, back button); from static evidence, judge the states shown.
5. **Cognitive-load pass**: primary actions per view (one), chunks held across steps (≤ 4), grouping vs real relationships,
   hierarchy (squint test, ≤ 3 sizes), scan path (front-loaded headings), Fitts (primary target large and near, destructive far).
6. **Munzner pass** when the UI has charts, tables or KPIs: what–why–how of each data view with the `viz` rules — is the idiom
   right for the task, are channels ranked by effectiveness, is the comparison the visitor needs easy? Record it as findings.
7. **Platform-convention check** (checklist table): button order per platform, destructive styling, Cancel always present, back
   behavior, same order in every dialog.
8. **Accessibility quick pass**: text and accent contrast (compute from the CSS or `axe` when a browser tool runs it), visible
   focus on the primary action, touch targets ≥ 44 px (24 px is the WCAG 2.2 floor), labels on inputs and icon buttons, zoom.
9. **Conversion lens by goal** (`references/conversion-lens.md`): Fogg B=MAP at the CTA (which of M, A, P is weakest), LIFT
   factors, the goal's row (Baymard form rules, download closure, reading pattern…), Core Web Vitals when a live URL exists
   (measure with the browser tool or Lighthouse; otherwise do not quote numbers), dark patterns → severity 4, always.
10. **Lenses**: re-read the findings as a novice, an expert, a keyboard / screen-reader user and a skeptical buyer; add what a
    lens sees that the others missed. Merge duplicates, group by task/screen.

## 3. Scoring

Rate each finding 0–4 with `references/severity-and-report.md` (frequency × impact × persistence). Each finding has five
fields, none optional: **principle violated** (check id + name + source) · **evidence** (viewport, theme, element, screenshot or
file ref) · **severity** · **concrete fix** (a known pattern, sized to be done) · **effect on the goal** (one clause).
Order: **top 3 by impact on the goal first** — a severity-2 on the CTA outranks a severity-3 in the footer. Then the rest by
severity. Then **done well: 2–4 specific strengths** (element · why it works · principle satisfied) — a critique without them is
not fair and tells the builder nothing about what to keep. Not seen → "to verify", never a violation.

## 4. Deliverable

1. **Report** → `<root>/.hyperui/critique/<yyyy-mm-dd>-<target>.md` (template in `severity-and-report.md`; `<target>` = host or
   mock name, slugged). English. Sources section lists only the URLs from `references/sources.md` that the findings cite.
2. **Artifact**: publish the same content as a page: `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/spec-page.py" <report.md>
   <report>.html --suffix none --track critique --lang <lang> --root <root>` (the spec page template, rules in
   `skills/spec/references/spec-artifacts.md`; hand-convert only without `python3`): title `Critique — <target>`,
   track `critique`, status `draft`, icon `document`. No Artifact tool (headless `-p`, evals) → write the filled template to
   `<root>/.hyperui/critique/<yyyy-mm-dd>-<target>.html` and give the path. Record it in `state.md` `artifacts:` as
   `critique/<yyyy-mm-dd>-<target>.md: <url or path>` and in the report's frontmatter `artifact_url`.
3. **Reply** (≤ 12 lines for dev/senior, ≤ 15 for non-tech, in the conversation language): the artifact link or path · the
   goal as understood · the **top 3** (one line each: finding · principle **+ author/source** · severity · fix) · **2 strengths** · the **verdict
   line** "Will this achieve <goal>? likely / at risk / no — because …" · the evidence line (tool and viewports, or "page not
   seen — static critique only") · the root §9 **care line** (`heuristics checked (22)` · `a11y` · `responsive` · `dark mode` ·
   `performance (CWV)` · `sources cited` · `verified in Chrome at 360/768/1280` — only what ran) · the root §9 telemetry consent line when
   `profile.sh user-get telemetry` is empty or `unasked` (once per machine) · then the **choice prompt**
   (root §9: `AskUserQuestion` when available, else a numbered list as the LAST thing):
   - target is the user's own code or direction → **fix the top 3 now (Recommended)** · fix everything · explain a finding · stop
   - target is someone else's site (competitor, reference) → **design a direction that fixes the top 3 (Recommended)** · spec the
     fixes · explain a finding · stop
   "Fix" routes to `design` (visual/structure) or `build` (code) with the finding ids in the args; `state.md` `open:` keeps
   `pending choice: critique fixes` until answered.
4. `state.md`: `phase: review`, `next:` the chosen option, `last_updated:` today. With telemetry consent (root §9):
   `"${CLAUDE_PLUGIN_ROOT}/scripts/telemetry.sh" event critique critique severity_max=<highest severity found>`. One line in `decisions.md` only when the
   user settles a fix that changes the design (`date · <fix> · <principle> · <source url>`).

## 5. When building — the checklist as a gate

`design` runs a quick pass of `references/checklist.md` on every direction before presenting it and on every page before
"done" (cognitive load C11–C12, match and consistency C3–C6, feedback states C1–C2, recovery paths C13–C16, platform
conventions C6); severity ≥ 3 is fixed before the user sees it, and the care line says `heuristics checked`. `build` applies
the same quick pass to any UI task after green tests. This skill is called in full only when the user asks for a critique or
when a direction fails the quick pass twice.

## 6. Tone

- **non-tech**: plain words; each finding as *what a visitor feels* ("you cannot tell which button downloads, so most people
  will hesitate") + the fix in one sentence, **followed by the author and principle in parentheses** ("— Norman, feedback;
  Nielsen #1"). The reference is never dropped for anyone: it is what makes the critique trustworthy, not opinion.
- **dev / senior**: principle names (`C4 labels predict outcomes · H2 · Fogg Ability`), severities, sources; no glosses.
- **Every recommendation, in the reply and in the report, names its author/source** (Norman, Nielsen #n, ISO 9241-110,
  Shneiderman, Clark & Brennan, Munzner, Fogg, LIFT, Baymard, WCAG…). A finding without a named source is not a finding;
  if no listed source supports it, label it "my judgement" explicitly.
- Never lecture, never pad: one line per finding — evidence · fix · author + principle (required) — no preamble (root §5 token
  economy). Criticize the screen, not the person who made it.
- **Cite the principle's source** from `references/sources.md` (or a page opened this session); never invent a URL, never
  propagate the misreadings listed there (7±2 per screen, the 3-click rule, Fitts as "make it big", F-pattern as a goal…).
- A claim about numbers (abandonment rates, CWV thresholds) carries its source; a number you could not verify is
  marked "(unverified)" or dropped.

## Sources

Cite only URLs that are listed in a skill/reference or that you opened this session; never construct or guess a URL.

Canonical list with every URL: [`references/sources.md`](references/sources.md). Research snapshot:
`docs/research/hci-ux-foundations.md` (2026-10-06) and `docs/research/munzner-vad.md` (2026-10-03). Key pages:
Nielsen's 10 heuristics https://www.nngroup.com/articles/ten-usability-heuristics/ · severity scale
https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/ · Shneiderman's 8 golden rules
https://www.cs.umd.edu/users/ben/goldenrules.html · ISO 9241-110 https://www.iso.org/standard/75258.html · Norman, signifiers
https://jnd.org/signifiers-not-affordances/ · the two gulfs https://www.nngroup.com/articles/two-ux-gulfs-evaluation-execution/ ·
Clark & Brennan 1991 (grounding) and Schegloff et al. 1977 (repair) PDFs in `references/sources.md` · Fogg https://behaviormodel.org/ ·
LIFT https://conversion.com/blog/the-six-landing-page-conversion-rate-factors/ · Baymard https://baymard.com/lists/cart-abandonment-rate ·
Core Web Vitals https://web.dev/articles/vitals · WCAG 2.2 https://www.w3.org/WAI/WCAG22/quickref/ · deceptive.design
https://www.deceptive.design/types · Munzner https://www.cs.ubc.ca/~tmm/vadbook/
