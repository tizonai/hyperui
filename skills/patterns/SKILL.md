---
name: patterns
description: "Architecture and design patterns only when the spec calls for them: DDD tactical building blocks, CQRS, hexagonal boundaries, GoF patterns (singleton, strategy, …), resilience (circuit breaker, retry, bulkhead, timeouts, rate limiting). Use for backend/architecture questions, never for a landing page or a static site: aggregates, consistency, external API or database calls, webhooks, read vs write models, 'what architecture/patterns does this need' (any language). Answers 'no pattern needed' when nothing fits. Reads .hyperui/profile.md and .hyperui/spec/, writes the choice into the spec design and .hyperui/decisions.md."
user-invocable: false
allowed-tools:
  - Bash(${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh *)
  - Read(//${CLAUDE_PLUGIN_ROOT}/**)
  - Edit(.hyperui/**)
---

# hyperui:patterns — a pattern only where a real force exists

You pick architecture and resilience patterns **only when the spec has the problem the pattern
solves**. Each pick is one line of why plus a source. No problem, no pattern — and you say so.

## 1. Read before answering

1. Resolve the project root with `${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh root` and use it (absolute paths) for `.hyperui/` and for every repo read/write. If `<root>/.hyperui/profile.md` is missing, invoke the `hyperui` skill first (it onboards and routes); otherwise read `profile.md` and `state.md` and never re-ask what they hold. With several roots (`profile.sh roots`), work in the repo the request or the touched file belongs to, with that repo's `.hyperui/` (rules: `${CLAUDE_PLUGIN_ROOT}/references/workspace.md`).
2. Read `.hyperui/profile.md` (`archetype`, `stack.*`, `providers.*`, `conversation_language`,
   `tone_notes`) and `.hyperui/state.md`. Never ask for a field that has a value.
3. Read the spec: `.hyperui/spec/<topic>/02-design.md` (full track) or `.hyperui/spec/<topic>.md`
   (SDD-lite); also `brief.md` and `decisions.md`, and every `.hyperui/diagrams/*.json` when present:
   they are Archify IR — `components[]` (type, sublabel), `boundaries[]` and `connections[]` (labels: sync, async,
   cross-boundary mechanism; `nodes`/`edges` in workflow and dataflow files) — the components, dependencies and flows you scan for triggers — read the JSON, never the
   drawing. No spec → read the repo (routes, models, HTTP clients, queues) and the user's message. Never
   re-ask what the spec already says. A pattern that changes the topology (an outbox, a queue, a bulkhead)
   → say which component/connection it adds so `diagram` can update the view.
4. Before naming a pattern, open its reference
   (`${CLAUDE_PLUGIN_ROOT}/skills/patterns/references/<file>.md`; if that read is denied, the
   table in §2 and `## Sources` are the contract — do not stop) and, for a claim beyond it,
   the linked page. Do not answer from memory. **Cite only URLs listed in this
   skill or its references; never build or guess a URL** — no listed source → "(unverified)".

## 2. Triggers → pattern (the only way a pattern enters the design)

Scan the spec for each trigger. A pattern is named only when its trigger is present.

| Trigger in the spec | Pattern | Why (one line) | Source |
|---|---|---|---|
| A rule that must hold across several entities in one change (order total = sum of lines; seats ≤ capacity; one active subscription per account) | **Aggregate** (root + invariants, one transaction per aggregate) + **repository** per aggregate | The root is the only door, so the rule cannot be bypassed | `references/ddd.md` |
| Concepts with value equality (money, email, date range) | **Value object** | Validated once, immutable, no identity bugs | `references/ddd.md` |
| "When X happens, also do Y" across modules (payment succeeded → activate plan → send email) | **Domain event** (+ **transactional outbox** when the side effect leaves the process) | Decouples the side effect from the state change | `references/ddd.md` |
| Same word means different things in two areas (billing "account" vs auth "account") | **Bounded context** | Separate models stop one area's change breaking the other | `references/ddd.md` |
| Reads and writes scale differently; a reporting/dashboard model unlike the write model | **CQRS** — warn about the added complexity; **no event sourcing by default** (only with an explicit audit/replay need) | Each side gets the shape and scaling it needs | `references/cqrs.md` |
| Domain core must not depend on a framework, DB or provider (provider may change; core tested without I/O) | **Hexagonal** ports and adapters (dependency rule inward) | Swap Stripe/Postgres/HTTP without touching rules | `references/hexagonal.md` |
| Any external HTTP / DB / SDK call that can hang or fail (email API, payment API, third-party SDK) | **Timeout** on every call + **retry** with exponential backoff and jitter (idempotent ops or idempotency key) + **circuit breaker** around each dependency — always all three, also behind an outbox worker | A slow provider must not take your request threads down with it | `references/resilience.md` |
| Inbound webhook or at-least-once message (payment provider events, queues) | **Idempotent consumer** (dedupe on the event id, atomically with the side effect) | Providers redeliver; a duplicate must not double-charge or double-activate | `references/resilience.md` |
| One dependency or tenant can starve the rest (shared pool, noisy neighbour) | **Bulkhead** (separate pool/queue/concurrency limit per dependency) | A failure stays in its compartment | `references/resilience.md` |
| Calling a provider with a quota / protecting your API from bursts | **Rate limiting** (client side) / **throttling** (server side, 429 + `Retry-After`) | Stay inside limits instead of retry storms | `references/resilience.md` |
| One instance of an expensive resource (DB pool, HTTP client, SDK client) | **Singleton scope via the DI container / module composition root**, not a global | One instance with lifecycle control, still replaceable in tests | `references/gof.md` |
| Swap an algorithm at runtime (pricing rule, payment provider, export format) | **Strategy** | New variant = new class, no `if` chain | `references/gof.md` |
| A third-party API whose shape does not match your port | **Adapter** | Translation lives in one place | `references/gof.md` |
| Object creation depends on config/type (provider chosen per country) | **Factory method** | Callers do not know concrete classes | `references/gof.md` |

Serverless/edge hosts (Workers, Lambda) do not drop the circuit breaker: keep it at the call
site and put its state in a shared store (Durable Object, KV, Redis) or in the single queue
worker that makes the call; say where in one line.

Defaults that are not patterns but always apply to a backend: config in the environment and
stateless processes (12-Factor); transactional email and payments are external calls, so the
resilience row applies to them.

## 3. When NOT to (REQ-009) — say "no pattern needed" explicitly

- **Landing page, marketing or static site, portfolio, docs site:** none of this. No DDD, no
  CQRS, no hexagonal, no circuit breaker. A contact form posting to a hosted form service is
  not an "external call architecture". Answer: "No architecture pattern needed: it's a static
  landing. Plain components + the host's build is the whole design." Do not list the patterns
  you are not using beyond one short clause.
- **CRUD over one or two tables, no cross-entity rule:** framework defaults (controller →
  ORM). No aggregates, no CQRS, no repository layer on top of the ORM.
- **One external call that is non-critical** (analytics ping): a timeout is enough.
- **CQRS** with simple rules or a CRUD UI; **event sourcing** without an audit/replay need,
  for an MVP, or a team new to event-driven systems.
- **Circuit breaker** for in-process calls, or as a substitute for business-error handling.
- **Retry** on non-idempotent operations without an idempotency key; nested retries.
- **GoF** "because it's clean": a pattern needs a force (a second variant, a lifecycle) today.
- **Singleton** as a global variable or service locator for convenience.

When the spec is ambiguous (is there a backend?), state the assumption in one line and answer
for it; do not ask unless the answer changes the design.

## 4. Write the choice

1. Into the design: append a `## Patterns` section to `.hyperui/spec/<topic>/02-design.md`
   (or a `Patterns:` line in the Design section of `sdd-lite`). One line each:
   `- <Pattern> at <where> — <why, one line> — <source URL>`. For "none":
   `- None needed — <one-line reason>`.
2. Into `.hyperui/decisions.md`, one ADR line each:
   `YYYY-MM-DD · pattern = circuit breaker + retry on email API · provider can hang; protect request threads · https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker`.
   For "none": `YYYY-MM-DD · patterns = none · static landing, no backend · —`.
3. Content written to `.hyperui/` is English. Update `state.md` `next:` (usually the first
   build task). Never touch application code here; `build` implements.

## 5. Tone per archetype (reply in `conversation_language`)

- **non-tech:** no pattern names unless they help; per pick, one-sentence analogy + what it
  protects ("If the email service is down, we stop calling it for a minute instead of making
  your customers wait — like a fuse"). "No pattern needed" in one line, then the next step.
- **dev:** pattern name + where + one line of why + source link; ≤ 12 lines.
- **senior:** pattern + placement + source; parameters only when asked (timeouts, thresholds).
  No glosses, no metaphors.

Lead with the answer ("Needs: aggregates for Subscription and Invoice; timeout + retry +
circuit breaker on the email API; idempotent webhook consumer."), then the lines. At most one
question per reply, only when the decision is genuinely the user's.

## Sources

Cite only URLs that are listed in a skill/reference or that you opened this session; never construct or guess a URL.

Opened 2026-10-03; each reference lists its URLs.
- DDD: https://www.domainlanguage.com/ddd/ · https://www.informit.com/store/implementing-domain-driven-design-9780321834577 ·
  https://github.com/ddd-crew · https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design ·
  https://martinfowler.com/bliki/DDD_Aggregate.html
- CQRS / Event Sourcing: https://martinfowler.com/bliki/CQRS.html ·
  https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs ·
  https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing
- Hexagonal / Clean: https://alistair.cockburn.us/hexagonal-architecture ·
  https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- GoF: https://refactoring.guru/design-patterns · https://refactoring.guru/design-patterns/singleton ·
  https://refactoring.guru/design-patterns/strategy · https://martinfowler.com/articles/injection.html
- Resilience: https://martinfowler.com/bliki/CircuitBreaker.html ·
  https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker ·
  https://learn.microsoft.com/en-us/azure/architecture/patterns/retry ·
  https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead ·
  https://learn.microsoft.com/en-us/azure/architecture/patterns/rate-limiting-pattern ·
  https://learn.microsoft.com/en-us/azure/architecture/patterns/idempotent-consumer ·
  https://learn.microsoft.com/en-us/azure/architecture/databases/guide/transactional-out-box-cosmos ·
  https://resilience4j.readme.io/docs/getting-started · https://www.pollydocs.org/
- Principles: https://12factor.net/ · https://learn.microsoft.com/en-us/azure/well-architected/ ·
  https://docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html
