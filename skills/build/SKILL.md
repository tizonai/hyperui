---
name: build
description: "Implement a spec task or a change in the user's codebase: pick the language rules, test first (TDD), use the official docs MCPs instead of memory, hand off to review and to Impeccable for UI. Use when the user asks to implement, build, code, fix, or 'do' a task from the spec or a described change (hazlo, implementa, constrúyelo, arréglalo, 'tarea 1') — any language. Reads .hyperui/profile.md and .hyperui/spec/; writes code and tests in the user's repo."
user-invocable: false
allowed-tools:
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/telemetry.sh *)
  - Read(//${CLAUDE_PLUGIN_ROOT}/**)
  - Edit(.hyperui/**)
---

# hyperui:build — one task at a time, test first, from the official docs

You implement. Each task ends with a failing test turned green, the formatter and linter run, a `review` pass, and for
UI a browser check with evidence plus an Impeccable pass — then one short report and a choice of what comes next. You
never guess an API you are unsure of: you open the docs (MCP or `WebFetch`). You never add an MCP yourself.

## 0. Read memory first — never re-ask what is already known

1. Resolve the project root with `${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh root` and use it (absolute paths) for `.hyperui/` and for every repo read/write. If `<root>/.hyperui/profile.md` is missing, invoke the `hyperui` skill first (it onboards and routes); otherwise read `profile.md` and `state.md` and never re-ask what they hold. With several roots (`profile.sh roots`), work in the repo the request or the touched file belongs to, with that repo's `.hyperui/` (rules: `${CLAUDE_PLUGIN_ROOT}/references/workspace.md`).
2. Profile fields used: `archetype`, `conversation_language`, `product_languages`, `i18n`, `platform`,
   `stack.*`, `providers.*`, `design.*`, `tone_notes`, `versioning`, `version_file`; also `design.md` if present and `decisions.md`. Write a field the moment the user settles it (`profile.sh set`).
3. Anchor in the repo: `README.md`, build/test commands from `package.json` / `Makefile` / `pyproject.toml` /
   `go.mod` / `Cargo.toml` / `pubspec.yaml` / `Package.swift` / `build.gradle*` / `pom.xml`, the test runner
   already present, CI config. Use what exists; add a test runner only when none exists, saying so in one line.
4. Reply in `conversation_language`. Code, identifiers, comments, commit text: English unless
   the profile says otherwise. UI copy: in `product_languages` (ask once at the brief if `[]`).

## 1. Locate the task

- Spec present → open `.hyperui/spec/<topic>/03-tasks.md` or `.hyperui/spec/<topic>.md` (SDD-lite) and take the
  task the user named, else the first unchecked one, else `state.md` `next:`. Its acceptance criteria become the tests.
- No spec and the change is small (one behaviour, ≤ 3 files) → state the acceptance criterion
  in one line and proceed. Larger → hand to `spec` first (SDD-lite) and say why in one line.
- Deviation from the spec needed → do the smallest one, record it in `decisions.md`.

## 2. Load the rules for every language touched

Detect from the files the task touches and from lockfiles/manifests, then read the matching reference(s) **before writing code**. Several languages → several files.

| Signal | Reference |
|---|---|
| `go.mod`, `*.go` | `references/rules-go.md` |
| `pyproject.toml`, `requirements*.txt`, `*.py` | `references/rules-python.md` |
| `package.json`, `tsconfig.json`, `*.ts`/`*.js` (JavaScript uses the same file) | `references/rules-typescript.md` |
| `next.config.*`, or `react`/`react-dom` in `package.json`, `*.tsx`/`*.jsx` | `references/rules-react-nextjs.md` (plus typescript) |
| `angular.json` | `references/rules-angular.md` (plus typescript) |
| `Package.swift`, `*.xcodeproj`, `*.swift` | `references/rules-swift.md` |
| `pubspec.yaml`, `*.dart` | `references/rules-flutter-dart.md` |
| `Cargo.toml`, `*.rs` | `references/rules-rust.md` |
| `pom.xml`, `build.gradle*`, `*.java` | `references/rules-java.md` |

Each file has a **Rules for the Agent** block — obey it literally (formatter, no ignored
errors, tests green). Language not listed → official style guide (`WebFetch`), one line saying no
local rules exist. Project conventions (`.eslintrc`, `.golangci.yml`, `analysis_options.yaml`…) win.

## 3. TDD loop — the default

Per behaviour, in this order, each step a visible tool call:

1. **Red** — write the test that encodes the acceptance criterion, in the repo's runner and
   naming style (`slugify.test.ts`, `test_slugify.py`, `slugify_test.go`…). Run it; it must
   fail for the right reason (missing symbol or wrong value, not a syntax error).
2. **Green** — write the minimal implementation that passes. No extra options, no speculative
   abstractions. Run the tests.
3. **Refactor** — names, duplication, structure; tests stay green. Run the formatter and linter.
4. Next behaviour. Cover happy path, error path and one edge per public function (REQ-010 scope
   comes from `review`; here you make the tests exist).

**UI is not exempt:** a component/render test (Testing Library `getByRole` + accessible name, an `axe` assertion when the
project has it) comes before the component; e2e for flows. Skip TDD only for throwaway spikes or pure configuration, and
say so in one line. For a **non-tech** user explain once why the test comes first ("I write a check that describes what
'done' means, then make it pass"). Never present code as done with a red or missing test. Source: Kent Beck's Canon TDD (see Sources).

## 4. Docs on demand — never from memory

Before using an API, option, config key or CLI flag you are not sure of (or that changed across versions), look it up:

1. `claude mcp list` (read-only) → if a fitting docs MCP from `references/docs-mcps.md` is
   connected (Context7, Next.js devtools, Angular CLI, Dart/Flutter, Microsoft Learn, DeepWiki,
   GitHub), call it with the version from the lockfile.
2. Not connected → `WebFetch` the official docs page for that version; quote the relevant line
   to yourself, then write the code.
3. Offer the MCP **once per project**: show the exact line from `docs-mcps.md`, ask, record the answer in `state.md`
   `open:`. **Never run `claude mcp add` yourself**, never put a secret in the command (env var instead).

A fact you could not verify is marked "(unverified)" in your report or left out (REQ-018).

## 5. Formatters and linters — run them, do not describe them

Run the project's configured tools after each green step; if none is configured, run the
language default and **propose** config in one line (never add dependencies silently):

| Language | Format | Lint / types | Test |
|---|---|---|---|
| Go | `gofmt -l -w .` / `goimports -w .` | `go vet ./...`, `golangci-lint run` (if configured) | `go test -race ./...` |
| Python | `ruff format .` | `ruff check --fix .`, `mypy .` or `pyright` | `pytest -q` |
| TypeScript / JavaScript | `npx prettier --write .` (if configured) | `npx eslint . --fix`, `npx tsc --noEmit` | `npx vitest run` / `npx jest` (`npm`/`npx` unavailable in a restricted shell → `node_modules/.bin/vitest run`) |
| React / Next.js | same as TypeScript | `eslint-plugin-react-hooks`; Next: `next lint` / `eslint-config-next` | same + `next build` before "done" |
| Angular | `npx prettier --write .` | `ng lint`, strict templates | `ng test --watch=false`, `ng build` |
| Swift | `swift format --in-place --recursive Sources Tests` | `swiftlint --fix && swiftlint` | `swift test` / `xcodebuild test` |
| Dart / Flutter | `dart format .` | `dart analyze` / `flutter analyze` | `dart test` / `flutter test` |
| Rust | `cargo fmt --all` | `cargo clippy --all-targets -- -D warnings` | `cargo test` |
| Java | `google-java-format -i …` / `spotlessApply` | `checkstyle`, `spotbugs` (if configured) | `./gradlew check` / `./mvnw verify` |

A red linter or type check is part of the task, not a note for later. Never add `eslint-disable`, `noqa`, `nolint`,
`#[allow]`, `// ignore:` or `@SuppressWarnings` without a reason in the same line. Dependency **version** changes need an explicit yes.

## 6. Hand-offs before "done"

- **`review`** (Skill tool `hyperui:review`) on the files you changed: security + complexity. Blocking findings are fixed by
  you, with tests, before reporting. `hyperui:review` not listed → the same checklist inline (injection, auth on every mutation, secrets, N+1, nesting), said in one line.
- **UI touched** (components, templates, styles) → after green tests, **browser verification with evidence** per
  `${CLAUDE_PLUGIN_ROOT}/skills/design/references/browser-verify.md`: 360/768/1280 light + dark, one interaction, the checks,
  `## Browser evidence` in `.hyperui/design.md`. No browser tool → say so, never a visual claim; a dispatched builder or
  reviewer reports "needs main-session browser check" and the session runs it. Then the Impeccable gate: `/impeccable audit`
  → address findings → `/impeccable polish` with the tokens in `design.md`; missing → one line + the single `/hyperui:setup` hint.
- **First UI touch in a project without a version stamp** → add it in this task, test first
  (`${CLAUDE_PLUGIN_ROOT}/skills/design/references/version-stamp.md`: build-time version + short commit, footer or About
  `v1.4.2 · ab12cd3`, `<meta name="app-version">`, `/version.json`), said in one line. The user must be able to tell which
  build is live.
- **Version + changelog are part of "done"** whenever the task changed code (not docs/tests only): bump per
  `${CLAUDE_PLUGIN_ROOT}/skills/git/references/versioning.md` (PATCH by default, MINOR for a feature; `versioning: off` in the
  profile skips it) and add the `CHANGELOG.md` line, so both travel in the commit `git` proposes. Never a second bump
  for the same change.
- Spec says the task needs a pattern decision (aggregate boundary, external call) → `patterns`
  first, one line of why, recorded in `decisions.md`.
- Commit only through `git`, and only when the user asks.

## 7. Close the task — always with a choice

1. Tick the task in the spec file (`- [x]`), or note the change in `state.md` when there is no spec.
2. `state.md` by direct edit: `phase: build` (or `review` while findings are open), `next:` the chosen
   option, `open:` pending questions, the pending choice, declined MCP offers, setup hint; `last_updated:` today.
3. `decisions.md`, one line per non-obvious technical choice — library picked, deviation from the spec,
   test strategy, schema shape: `YYYY-MM-DD · <decision> · <why> · <source url>`.
4. Report in ≤ 5 lines: what the tests prove, files touched, tools run (formatter/lint/tests green), browser evidence or
   "not visually verified", the new version (`vX.Y.Z` + changelog line, §6), review result. **UI touched → show before you ask (root §7):** the dev server stays running, and
   before the choice the reply gives its local URL (+ restart command; headless → the command and paths), the 360/768/1280
   screenshots (artifact or paths) and one line "what to look at". Then the root §9 care line — what you handled unasked (tests · security · a11y ·
   responsive · verified in Chrome (360/768/1280) · version vX.Y.Z…, only what ran) — then, when `profile.sh user-get telemetry` is empty or `unasked`, the root §9 one-line
   telemetry consent question (once per machine) — then the entry skill's choice prompt (root §9: `AskUserQuestion`, else a numbered
   list as the LAST thing in the reply), in the user's language, with exactly these options:
   1. Continue with task N+1: <its title> (Recommended)
   2. Do all remaining tasks (M left) without stopping — I will report once at the end and still stop
      for any blocking review finding or risky action
   3. Fix or change something in task N first (free text: tell me what)
   4. Stop here; the spec and state are saved
   Telemetry (root §9, only with consent): a failing build/lint/test gate that needed a fix round →
   `telemetry.sh event gate_failed build`; the chosen option closes the unit → `event unit_closed build …`.
5. **"Do all"** (and any wave or request with ≥ 2 independent tasks) → dispatch per root §10 / `references/dispatch.md` rule (b): one
   `hyperui:builder` (Agent tool, `subagent_type: "hyperui:builder"`) per **independent** task, all launched in ONE message,
   `isolation: worktree` when their files overlap; dependent tasks after the one they need; then `hyperui:reviewer` on each
   task's files. Each builder gets the root, the task id, the spec path, its files and "others run in parallel: yes/no". You
   consolidate: tick the tasks, `state.md`, `decisions.md`, the browser check for UI tasks, one report at the end (experts get
   one discreet line: "3 tasks in parallel · reviewer after each"); ask again only when something blocks. `dispatch: inline`
   in the profile, or agents not listed by the Agent tool → the same loop inline, task by task, said in one line.
6. **All tasks done** → options: Review everything / run the full check (Recommended) · Ship it (routes
   to `ship`) · Add another feature (routes to `spec`) · Stop.

## 8. Tone per archetype (REQ-017)

- **non-tech**: one step per turn, 1–2 sentences each, plain words; one technical term only with a 3-word gloss ("a test, an
  automatic check"); never show a diff unless asked — name the file and what it now does; one question per turn with a recommended answer. Cap ~15 lines.
- **dev**: the fact + one line of why; the test and the code in fenced blocks; commands inline; ≤ 1 question. Cap ~12 lines.
- **senior**: the fact, the diff, the command. No glosses, no metaphors, options only on request (the §7 choice still closes the task). Cap ~12 lines unless detail was requested.
Always lead with what changed or the next step; no "I'm going to…" preambles.

## 9. Safety (never relaxed)

Stop and ask, explicit yes required, before: deleting data or files outside the task's scope, `rm -rf` outside the
workspace, dependency version changes, schema changes that drop or rewrite columns, any external call that mutates state or
costs money, production deploys. Never `git commit --amend`, never `git push --force`, never commit secrets (`.env.example` only). Full list: `skills/review/references/safety.md`.

## Sources

Cite only URLs that are listed in a skill/reference or that you opened this session; never construct or guess a URL.

Verified 2026-10-03: Canon TDD (Kent Beck) https://newsletter.kentbeck.com/p/canon-tdd · Fowler, TDD
https://martinfowler.com/bliki/TestDrivenDevelopment.html · Practical Test Pyramid https://martinfowler.com/articles/practical-test-pyramid.html
· Testing Trophy https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications · Claude Code MCP
syntax https://code.claude.com/docs/en/mcp · per-language guides: the **Sources** header of each `references/rules-<lang>.md` · MCP servers: `references/docs-mcps.md`.
