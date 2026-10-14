# Dispatch — subagents, parallelism and model, decided internally

hyperui decides alone when a job runs inline, in a subagent, in parallel, and on which model.
It is never a question and never a menu: the default path is the easy one for everyone, pros
included. The user only sees the result, plus one discreet line when they are an expert.
Summary in the root `SKILL.md` §10; this file holds the rules and the mechanics.

## Rules

| | Situation | Dispatch |
|---|---|---|
| (a) | A small edit, ONE task, one answer, a fix | **Inline**, in the session, as today. |
| (b) | A `03-tasks.md` wave with **≥ 2 independent tasks** (wave 1 is offered as the recommended option at the tasks gate), "Do all remaining tasks" (build §7 option 2), or ≥ 2 independent tasks requested at once | One `hyperui:builder` per **independent** task, all launched in ONE message (parallel). Tasks whose files overlap → `isolation: worktree` on each; disjoint files → same tree. After each builder returns → `hyperui:reviewer` on its files (the reviewers can also run in parallel). Tasks that depend on another's output run **sequentially**, after it. |
| (c) | Docs, prices, free tiers, MCP servers, provider capabilities — anything §8 must ground | `hyperui:researcher`; the session quotes its facts with the URLs it returned, marks "(unverified)" what it could not open. |
| (d) | First contact with a repo (onboarding §2, or a new root) | `hyperui:scout` for the stack facts; the session writes them with `profile.sh set`. A tiny repo (< 20 files) → inline `profile.sh inspect` is enough. |
| (e) | Architecture, the spec, a design direction, copy, anything needing taste or the user's context | The **session model, inline**. Never delegated. |
| (f) | A named model is unavailable (error, not offered) | Retry once with `inherit`; never tell the user which model ran unless asked. |
| (g) | Visibility | `dev`/`senior`: ONE discreet line before the report ("3 tasks in parallel · reviewer after each"). `non-tech`: nothing but the result. Never the agent names, never a progress narration. |
| (h) | The user overrides in words — "hazlo con sonnet", "use opus for this", "no uses subagentes", "do it yourself", "back to automatic" | Obey for the turn and store it: `profile.sh set dispatch <auto|inline|sonnet|opus|haiku>`; `auto` is the default. `inline` disables subagents; a model name makes it the per-invocation `model` for builders and reviewers. |

The "do all" option in `skills/build/SKILL.md` §7 and the spec's tasks-gate option implement (b); a single task keeps the inline TDD loop.

## Mechanics

- **Agents** live in `${CLAUDE_PLUGIN_ROOT}/agents/` and are namespaced `hyperui:<name>`: `builder`
  (`model: inherit`), `reviewer` (`sonnet`), `researcher` (`haiku`), `scout` (`haiku`). Call them
  with the Agent tool: `subagent_type: "hyperui:builder"`, optional `model`, optional `isolation: "worktree"`.
  Each returns a short report (builder ≤ 8 lines, reviewer ≤ 5, researcher ≤ 12, scout ≤ 15).
- **Builder prompt** (one per task): the absolute project root, the task block **verbatim** from the
  spec file plus the design decision ids it depends on, the files it may touch, "other builders run in
  parallel: yes/no", and "do not edit state.md, do not commit" — nothing more (root §5 token economy).
  The builder's report is counts + blocking items + `OPEN:` items only. Independence = no shared files
  and no task reading another's output; when in doubt treat two tasks as dependent and run them in sequence.
- **Worktree result** (`isolation: worktree`): each builder's changes land on its own branch;
  after all return, merge them into the working tree (fast-forward or cherry-pick), run the test
  suite once, then the reviewers. A merge conflict is a blocking finding: stop and ask.
- **Consolidation, by the session**: tick the tasks in the spec file, update `state.md`
  (`phase`, `next`, `open`, `last_updated`), one `decisions.md` line per non-obvious choice the
  builders reported, then ONE report in the user's language (≤ 12 lines for experts: tasks,
  tests, review counts; ≤ 15 plain lines for non-tech), the care line (§9), and the build §7
  options. Blocking findings or a risky action stop the batch and are asked as the turn's choice.
- **Fallback**: if the Agent tool does not list `hyperui:builder` / `hyperui:reviewer` (plugin
  agents not loaded, depth limit inside another agent), run the same loop inline, task by task,
  and say in one line that it ran inline. Never say "coming soon".
- **Cost sense**: haiku for lookups and inspection, sonnet for reviews, the session model for
  code; never spawn a subagent for a job of one or two tool calls.

## Sources

- Subagents (frontmatter `name`, `description`, `model` = `sonnet | opus | haiku | inherit`, `tools`,
  `maxTurns`, `isolation: worktree`; plugin namespacing `plugin:agent`; Agent tool `subagent_type`,
  per-call `model` and `isolation`): https://code.claude.com/docs/en/sub-agents.md
- Plugin agents (`agents/*.md`, supported vs ignored frontmatter fields): https://code.claude.com/docs/en/plugins/components.md#agents
