# Lifecycle, chained-work and stale-response checklist

Why this exists: a 2026-10-23 review of a cdp change found a step-log buffer flushed on SIGTERM only in
the API entrypoint while every write happened on worker pods, and a new prune inserted into a sweep
before the step that bounds PII retention, with a third 20 s budget that made the sweep's worst case
equal its one-minute interval. Neither is a security or complexity finding; both are lifecycle.

## A. State that outlives a request

Trigger: the scope adds or changes a buffer, a batching/flush timer, an in-memory cache, an in-flight
set, a local queue, a file handle kept open, a lazily-started background loop.

1. **Entrypoints.** List them from the repo, not from memory: `start*.{ts,js,py,go}`, `main*`,
   `scripts/*`, `cmd/*`, cron/job runners, worker/consumer bootstraps, serverless handlers.
2. **Who fills the state.** For each call site that writes into it, name the entrypoint that executes
   it (API request path, queue consumer, scheduled job). An API-only flush protects nothing when the
   writers are consumers.
3. **Shutdown per entrypoint.** `grep -rn "SIGTERM\|SIGINT\|beforeExit\|shutdown" <entrypoints and the
   frameworks they use>`. For each entrypoint from step 2: what flushes/releases the state, and when?
   Frameworks often keep serving for a readiness delay (10–30 s) before `process.exit`: a flush fired
   at the first signal misses everything recorded during that delay. The flush must run **last**
   (shutdown callback) or the writer must enter a drain mode (write-through until exit).
4. **Accounting.** Anything that cannot be written at shutdown is counted (`dropped` with
   `reason:shutdown`) or logged once with a count. Silent loss is a finding even when the data is
   "only metrics": the dashboard built on them will lie at every deploy.
5. **Tests.** One test per behaviour: drain mode writes through; a failing final flush counts
   dropped; the hook is registered on every entrypoint (or the shared bootstrap they call).

## B. A step added to an existing chain

Trigger: the scope adds a step to a cron, sweep, scheduler, pipeline, batch job or a sequence of
maintenance queries that already exists.

1. **Isolation.** If the new step throws (lock, statement timeout, missing table, network), do the
   steps after it still run? `try/catch` + log + metric around it, or move it last.
2. **Order.** List the chain's steps and mark the ones that protect an invariant: data residency
   (PII retention, payload expiry), lock release, idempotency markers, acknowledgements. The new step
   runs **after** all of them unless a documented dependency says otherwise.
3. **Budget.** Write the time budget of every step and sum them. The sum must be clearly below the
   schedule interval; a chain whose worst case equals its interval overlaps itself. A new step gets its
   **own** budget constant, not a copy of its neighbour's.
4. **Volume.** For a new DELETE/UPDATE over a table that grows fast, estimate rows/day and whether
   batched deletes within the budget can keep up; if not, say that the real fix is partitioning by
   time or a rollup, and record it as a follow-up with the numbers.
5. **Tests.** Make the new step fail and assert the rest of the chain completed and the failure was
   counted; assert the budget option is honoured.

## C. Stale responses, contracts and mirrored constants

Trigger: UI or service code that awaits a request and then writes state, or that reads a field by position
from another service's payload, or that declares a constant said to mirror another repo.

1. **Context switch audit.** Find the watcher that resets state on a context change (program, tenant, route,
   selection). List every `await` in the same file whose continuation writes state or emits. Each one
   captures the context before the await and bails if it changed. A file with one guarded handler and three
   unguarded ones is three findings, not a pass.
2. **Ordering and caps across the contract.** `[0]`, `[length - 1]`, `.find` first-match, `Math.min(x, CAP)`:
   trace each to the producer (`ORDER BY`, constant, enum) and require the assumption to be written on the
   shared type. Diff every "mirror of backend X" constant against X now.
3. **Refresh keys.** A refresh keyed on another response's field (`computed_at`, etag) is silent whenever
   that response fails, is rate-limited or is cached: key on the tick.
4. **One hop further.** Before asserting "renders nonsense", "dead write", "collides" or "unreachable":
   open the callee, the UI primitive (`disabled` vs `loading`), and the domain validation that bounds the
   input. Unconfirmed → "verify by running", never a defect.

Origin: 2026-10-26, two automated reviews of the same PR — one found 14 items of which 4 were misreads from
stopping one hop short, the other missed the only real race because it audited the guards that existed
instead of the handlers that lacked one.

## Report lines

`lifecycle: <N> entrypoints checked · state owners: <ok|missing on X>` and
`chain: <job> · isolation ok · order ok · budget <sum> s / <interval> s` — only when the pass ran.
