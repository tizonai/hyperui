---
hyperui: 1                       # schema version
archetype: senior                # non-tech | dev | senior
conversation_language: es        # BCP-47 primary tag of how the user writes (es, en, …)
product_languages: en            # asked at the brief; [] until asked
i18n: false                      # several locales / default locale / RTL needs
purpose: business                # personal | business
budget: ""                       # $0 | <20 | <100 | startup — only when purpose = business
country: ""                      # seller/operator country (ISO 3166-1 alpha-2) — drives payments and signing advice
platform: Claude Code plugin     # web | mobile | macos | windows | multi
stack: [bash, python3, node (zero-dep), markdown skills] # inferred from the repo first, asked only if nothing exists
providers:
  host: ""                       # cloudflare-workers | vercel | amplify | firebase | …
  db: ""                         # neon | supabase | …
  auth: ""                       # supabase | clerk | better-auth | …
  payments: ""                   # paddle | polar | creem | mercadopago | paypal | stripe | none
  domain: ""                     # cloudflare | porkbun | route53 | none
design:
  direction: ""                  # e.g. "Luminous Soft-Tech"
  fonts: { display: "", body: "" }
  palette: { bg: "", accent: "" }
  motion: ""                     # restrained | expressive
tone_notes: ""                   # e.g. "terse; technical terms; no metaphors"
dispatch: auto                   # auto | inline | sonnet | opus | haiku — subagent/model override said in words ("no uses subagentes")
versioning: auto                 # auto | off — auto: every code change bumps SemVer + CHANGELOG (skills/git/references/versioning.md); off when the user says "no versioning"
version_file: ""                 # auto-detected once, then stored: package.json | pyproject.toml | Cargo.toml | pubspec.yaml | …
private: false                   # true after `profile.sh private` (.hyperui/ added to .gitignore)
---
<!-- Free notes the model may append below (one line each, dated). -->
