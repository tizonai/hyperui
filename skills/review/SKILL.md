---
name: review
description: "Review code the plugin or the user wrote before calling it done: security (OWASP Top 10:2025, ASVS, cheat sheets), algorithmic and cyclomatic complexity, and the safety rules for risky actions. Use after any build task, on request ('revisa', 'review this', 'is this safe', 'check my code'), or before a PR — any language. Fixes blocking findings in hyperui's own output; proposes fixes for the user's code."
user-invocable: false
allowed-tools:
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh *)
  - Read(//${CLAUDE_PLUGIN_ROOT}/**)
  - Edit(.hyperui/**)
---

# hyperui:review — check before "done"

Nothing hyperui builds is reported done until this pass ran and every **blocking** finding is
fixed. The review is short, grounded in a published source per finding, and silent about what
does not matter: a clean change gets zero findings.

## 0. Read memory first

1. Resolve the project root with `${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh root` and use it (absolute paths) for `.hyperui/` and for every repo read/write. If `<root>/.hyperui/profile.md` is missing, invoke the `hyperui` skill first (it onboards and routes); otherwise read `profile.md` and `state.md` and never re-ask what they hold. With several roots (`profile.sh roots`), work in the repo the request or the touched file belongs to, with that repo's `.hyperui/` (rules: `${CLAUDE_PLUGIN_ROOT}/references/workspace.md`).
2. Read `.hyperui/profile.md` (`archetype`, `conversation_language`, `stack`, `providers`,
   `purpose`) and `.hyperui/state.md`; skim `.hyperui/decisions.md` for risks already accepted
   — an accepted risk is not re-flagged.
3. Reply in `conversation_language`; findings, code and file content stay in English.

## 1. Scope — what is reviewed

- **Hand-off from `build`:** `build` calls this skill at the end of each task with the task id
  and the files it created or changed. That list is the scope, and it is **hyperui's own
  output**.
- **On request** ("revisa db.ts", "review my PR"): the files, diff or PR the user names. That
  code is the **user's** (pre-existing) unless hyperui wrote it in this session.
- **Nothing named:** the working-tree diff (`git diff` + `git diff --staged` + untracked files);
  if there is no git, ask which files — one question.
- Read the whole function and its callers for context; **findings go only on code in scope**.

## 2. Security pass

Open `references/security-checklist.md` and walk it over the scope:
- A01–A10 of OWASP Top 10:2025, each with its concrete checks and cheat-sheet URL.
- Cross-cutting: API Top 10 2023, input validation, secrets in the repo, TLS/HSTS (MITM),
  DoS / rate limiting, NIST SP 800-63B-4 passwords, OAuth per RFC 9700, JWT per RFC 8725,
  CSP/SRI, dependency scanning.
- Product has auth, payments or personal data → go one level deeper with the matching ASVS 5.0
  chapter, and say in the report that a second human look is advisable on that path.
- Only the checks the surface actually has: a static landing has no SQL, sessions or OAuth —
  skip those silently.

## 3. Complexity pass

Open `references/complexity-checklist.md`: algorithmic (N+1, nested loops over unbounded data,
repeated work in loops, unbounded reads and growth, missing index) and cyclomatic (decision
points > 10, nesting > 3, functions > ~60 lines, boolean switches). Use the repo's tool for the
number when present (ESLint `complexity`, `radon cc`, `gocyclo`, `lizard`); otherwise count by
hand and say so. Complexity is a finding only if it grows with data or real usage.

## 4. Lifecycle, chained-work and stale-response pass

Open `references/lifecycle-checklist.md`. Three shapes trigger it; skip silently when none is in scope.
- **State that outlives a request** (buffer, batching timer, cache, in-flight set, queue): list every
  entrypoint of the service (`start*`, workers, `scripts/*`, cron runners) and, for each one that
  executes the code filling that state, name what flushes or releases it on SIGTERM — including
  what arrives during a graceful-shutdown delay before `process.exit`. No owner on an entrypoint =
  blocking; lost items not counted (a `dropped` metric with a reason) = blocking.
- **A step added to an existing chain** (cron, sweep, pipeline, batch job): isolation (the steps
  after it still run when it throws), order (never before a step that bounds data residency or
  releases a lock), budget (sum of the chain's budgets < its interval), and a test that makes the
  new step fail and asserts the rest completed. Any of the four missing = blocking.
- **Awaited requests that write state, positional reads of another payload, mirrored constants**
  (section C): every await after a context switch re-checks the context; `[0]` / `[length - 1]` / caps are
  traced to the producer and written on the shared type; a "mirror of backend X" constant is diffed
  against X. Before asserting "nonsense", "dead write" or "unreachable", read the callee, the UI
  primitive and the domain rule — unconfirmed claims are "verify by running", not findings.

## 5. Safety pass

Scan the scope and any command hyperui is about to run against `references/safety.md`:
destructive SQL or migrations, data deletion, `rm -rf` outside the workspace, force-push,
`--amend`, `--no-verify`, committed secrets or `.env`, purchases, deploys, environment
approvals, dependency changes, external calls that mutate state or cost money. A risky action
is **never executed** by this skill: stop, explain in one line, propose the safer path, wait
for an explicit yes. Irreversible = always confirmed.

## 6. Classify every finding

| Class | Meaning | Examples |
|---|---|---|
| `blocking` | Ships a security hole, data loss or incorrect behavior | SQL/command injection, missing per-resource authorization, secret in code, N+1 in a request handler, password stored with MD5, disabled TLS verification |
| `should` | Real risk or cost, not a certain break | missing rate limit on login, cyclomatic 11–15, `SELECT` without `LIMIT` on a growing table, missing HSTS |
| `nit` | Minor, cheap to fix | unclear name hiding a security-relevant value, a log line that could leak an id |

Each finding is one block, one idea, worded per `references/code-review-tone.md` (criticize
the code, not the person; say what breaks and when):

```
db.ts:12 — blocking: SQL built by concatenating req.query.id (A05 Injection)
  Why: id=1 OR 1=1 returns every row; '; DROP TABLE users;-- runs if the driver allows multi-statements.
  Fix: parameterized query — db.query('SELECT * FROM users WHERE id = $1', [id]).
  Source: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
```

When unsure whether something is truly wrong, phrase it as a question and class it `should`
at most — a confident false positive costs more trust than a missed nit.

## 7. Fix blocking findings before "done"

- **hyperui's own output** (scope came from `build`, or hyperui wrote it this session): fix
  every `blocking` finding **now**, in place, with the cheat sheet's primary defense (e.g.
  parameterized queries, not escaping). Re-run the formatter/linter/tests when present, then
  re-check the fixed lines. Fix `should` findings too when the fix is local and small;
  otherwise list them. Never report the task done while a `blocking` finding is open.
- **The user's pre-existing code:** do **not** edit it unasked. Propose the fix as a fenced diff per
  blocking finding, then the root §9 choice prompt (`AskUserQuestion`, else a numbered list as the LAST
  thing in the reply; user's language): "Apply all proposed fixes" (Recommended) · "Apply only the
  blocking ones" · "Show me the diff first" (every proposed fix in full, then ask again) · "Skip". The
  chosen option covers those edits only; while waiting, `open:` holds `pending choice: apply review fixes`.
- A fix that needs a risky action (migration, dependency change, secret rotation, deploy)
  follows §5: propose and wait.
- If the user declines a blocking fix, record it as an accepted risk (§9) and say once what it
  leaves exposed.

## 8. Report

**Experts (`dev`, `senior`)** — the whole report is **at most 5 lines**, nothing else:
1. `Reviewed: <n files> · security (OWASP 2025<, ASVS if applied>) · complexity · safety`
2. `Findings: <b> blocking (fixed | proposed) · <s> should · <n> nit`
3–5. One line per blocking item: `file:line — what — fixed/proposed — <cheat-sheet URL>`.
More than three blocking items → the three worst, then "+N more". Zero findings → line 2 says
"no findings" and the report is two lines. The full finding blocks and the `should`/`nit`
details are **not** printed — only the counts — unless the user asks ("detalle", "show all").
For the user's code, the proposed fix follows the report as **one** fenced diff (code, not report
lines), then the §7 choice. No extra summaries, notes or bullet lists.

**Non-tech** — two plain sentences, no jargon, no URLs unless asked: what was protected and
whether anything needs their decision. Example: "I checked the new sign-up form for the
common ways attackers break in and fixed one spot where someone could have read other people's
data. Nothing needs your decision."

When the user asked for the full list, show every finding block, grouped by class.

## 9. What NOT to flag

- Style the formatter or linter already handles; personal preference with no real impact.
- Pre-existing code outside the scope — read it for context; if it is the root cause of an
  in-scope finding, the finding still goes on the in-scope line.
- Hypothetical vulnerabilities with no real path in this code (no user input reaches it, the
  data is bounded, the endpoint is not exposed).
- Anything that follows the repo's established pattern, unless the pattern itself is a
  `blocking` hole — then one note to the user, not one finding per occurrence.
- Hardening of tests, fixtures or local-only scripts; dependency CVEs already reported by the
  repo's scanner; micro-optimizations; big refactors during a hotfix.
- Risks already accepted in `decisions.md`.

## 10. Close

- `.hyperui/state.md`: `phase: review` (or back to `build` while blocking fixes are pending;
  `done` for the task once clean), `next:` one line, `open:` bullets for unfixed `should`
  items and any fix waiting on the user's yes, `last_updated:` today.
- `.hyperui/decisions.md`, one line per accepted risk or design-changing finding:
  `YYYY-MM-DD · accepted risk: no rate limit on /login until launch · user decision · <cheat-sheet URL>`.
- End the reply with one line of what was done, then the entry skill's choice prompt (root §9) when the next step is the user's.

## Sources

Cite only URLs that are listed in a skill/reference or that you opened this session; never construct or guess a URL.

- OWASP Top 10:2025: https://top10.owasp.org/2025/
- OWASP ASVS 5.0: https://owasp.org/www-project-application-security-verification-standard/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/ (per-check URLs in
  `references/security-checklist.md`)
- SQL Injection Prevention: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- OWASP API Security Top 10 2023: https://api-security.owasp.org/editions/2023/en/0x11-t10/
- NIST SP 800-63B-4: https://pages.nist.gov/800-63-4/sp800-63b.html
- RFC 9700 OAuth 2.0 Security BCP: https://datatracker.ietf.org/doc/html/rfc9700
- RFC 8725 JWT BCP: https://datatracker.ietf.org/doc/html/rfc8725
- Cyclomatic complexity (McCabe, NIST limit): https://en.wikipedia.org/wiki/Cyclomatic_complexity
- ESLint `complexity`: https://eslint.org/docs/latest/rules/complexity
- Review comments: https://google.github.io/eng-practices/review/reviewer/comments.html
