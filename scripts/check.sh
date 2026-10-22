#!/usr/bin/env bash
# hyperui quality gate. Run from anywhere: scripts/check.sh
#
# Checks, in order:
#   (a) claude plugin validate .        — manifests + skills            (hard fail)
#   (b) bash -n scripts/*.sh            — every script parses           (hard fail)
#   (c) frontmatter lint                — every SKILL.md (skills/*/ and root) has
#                                         name: and description:        (hard fail)
#                                         every skills/*/SKILL.md except setup/doctor has
#                                         user-invocable: false         (gated, see below)
#   (d) sources lint                    — every skills/*/SKILL.md except setup/doctor has a
#                                         "## Sources" heading          (gated, see below)
#   (d2) allowed-tools lint             — every skills/*/SKILL.md except setup/doctor declares
#                                         allowed-tools with Read(//${CLAUDE_PLUGIN_ROOT}/**)
#                                         (the only form that pre-approves reference reads
#                                         AND stays scoped to the plugin; bare Read leaks,
#                                         single-slash form never matches)      (gated)
#   (d3) preamble lint                  — every skills/*/SKILL.md except setup/doctor contains
#                                         the exact root-resolution preamble sentence (see
#                                         PREAMBLE below: profile.sh root + profile-missing
#                                         fallback "invoke the `hyperui` skill first") and
#                                         declares Bash(${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh *)
#                                         in allowed-tools (every specialist runs `root`) (gated)
#   (d4) agents lint                    — every agents/*.md has frontmatter name:, description:
#                                         and model: (plugin agent contract)           (gated)
#   (e) company-agnostic grep           — no employer/team-specific strings anywhere in the
#                                         repo (excluding .git, node_modules and this file,
#                                         which necessarily contains the pattern)  (hard fail)
#   (f) node --check scripts/*.mjs      — every Node script parses                (hard fail)
#   (g) diagram self-test               — node scripts/diagram-check.mjs --self-test
#                                         (Mermaid export of the 5 exportable Archify types, v1 ->
#                                         Archify migration vs scripts/fixtures/, dogfood IR) (hard fail)
#   (g2) spec-page self-test             — python3 scripts/spec-page.py --self-test
#                                         (headings, toc, tables, mermaid, checklists, fragment/full) (hard fail)
#   (h') archify attribution            — NOTICE names Archify (MIT, github.com/tt-a1i/archify) as an
#                                         external engine installed separately — no adapted-code
#                                         wording, no LICENSE-archify copy, no "Adapted from archify"
#                                         headers left in scripts/ or skills/           (hard fail)
#   (j) archify smoke                   — when Archify is installed (scripts/archify.sh locate):
#                                         validate + deliver the dogfood IR, output HTML carries
#                                         data-animation="trace"; not installed → reported as
#                                         skipped, never failed                        (hard fail)
#
# Gate toggle (.hyperui-gate at the repo root):
#   The file holds a single word on its first non-comment line:
#     lenient  — (c)'s user-invocable rule and (d)/(d2)/(d3)/(d4) print "!" warnings, exit code unaffected.
#                Used during wave 1 so specialists can be migrated incrementally.
#     strict   — those warnings become failures. Flip to strict once every specialist is done.
#   Lines starting with "#" are comments. A missing file means lenient.
#
# Exit code: 0 when every hard check passes, 1 otherwise.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAIL=0
WARN=0
SKIP=0
ok()   { printf '[check] \xe2\x9c\x93 %s\n' "$*"; }
skipped() { printf '[check] - %s\n' "$*"; SKIP=$((SKIP + 1)); }
bad()  { printf '[check] \xe2\x9c\x97 %s\n' "$*"; FAIL=1; }
warn() { printf '[check] ! %s\n' "$*"; WARN=$((WARN + 1)); }

GATE="lenient"
if [[ -f .hyperui-gate ]]; then
  GATE="$(grep -vE '^[[:space:]]*(#|$)' .hyperui-gate | head -n1 | tr -d '[:space:]' || true)"
  [[ -z "$GATE" ]] && GATE="lenient"
fi
case "$GATE" in
  lenient|strict) ;;
  *) bad ".hyperui-gate: unknown value '$GATE' (expected lenient|strict)"; GATE="strict" ;;
esac
# (d3) the exact preamble sentence every specialist must contain, on one line
PREAMBLE='Resolve the project root with `${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh root` and use it (absolute paths) for `.hyperui/` and for every repo read/write. If `<root>/.hyperui/profile.md` is missing, invoke the `hyperui` skill first (it onboards and routes); otherwise read `profile.md` and `state.md` and never re-ask what they hold.'

# gated: report a gated finding as a warning (lenient) or a failure (strict)
gated() { if [[ "$GATE" == "strict" ]]; then bad "$*"; else warn "$* (gate: lenient)"; fi; }

# (a) plugin validate
if command -v claude >/dev/null 2>&1; then
  if out="$(claude plugin validate . 2>&1)"; then
    ok "claude plugin validate ."
  else
    bad "claude plugin validate . failed:"
    printf '%s\n' "$out" | sed 's/^/        /'
  fi
else
  bad "claude CLI not found; cannot run 'claude plugin validate .'"
fi

# (b) bash -n
shopt -s nullglob
scripts=(scripts/*.sh)
bn_fail=0
for f in "${scripts[@]}"; do
  if ! err="$(bash -n "$f" 2>&1)"; then
    bad "bash -n $f: $err"; bn_fail=1
  fi
done
[[ $bn_fail -eq 0 ]] && ok "bash -n on ${#scripts[@]} script(s)"

# frontmatter helper: prints the YAML frontmatter block (between the first two --- lines)
frontmatter() {
  awk 'NR==1 && $0!="---" {exit} NR==1 {next} $0=="---" {exit} {print}' "$1"
}

# (c) frontmatter lint + (d) sources lint
skill_files=(skills/*/SKILL.md)
[[ -f SKILL.md ]] && skill_files+=(SKILL.md)
fm_fail=0; gated_count=0
for f in "${skill_files[@]}"; do
  fm="$(frontmatter "$f")"
  if [[ -z "$fm" ]]; then bad "$f: missing YAML frontmatter"; fm_fail=1; continue; fi
  grep -qE '^name:[[:space:]]*[^[:space:]]' <<<"$fm" || { bad "$f: frontmatter lacks name:"; fm_fail=1; }
  grep -qE '^description:[[:space:]]*[^[:space:]]' <<<"$fm" || { bad "$f: frontmatter lacks description:"; fm_fail=1; }

  [[ "$f" == SKILL.md ]] && continue
  skill="$(basename "$(dirname "$f")")"
  [[ "$skill" == setup || "$skill" == doctor ]] && continue
  if ! grep -qE '^user-invocable:[[:space:]]*false[[:space:]]*$' <<<"$fm"; then
    gated "$f: specialist lacks 'user-invocable: false'"; gated_count=$((gated_count + 1))
  fi
  if ! grep -qE '^##[[:space:]]+Sources[[:space:]]*$' "$f"; then
    gated "$f: specialist lacks a '## Sources' heading"; gated_count=$((gated_count + 1))
  fi
  if ! grep -qF 'Read(//${CLAUDE_PLUGIN_ROOT}/**)' <<<"$fm"; then
    gated "$f: specialist lacks allowed-tools 'Read(//\${CLAUDE_PLUGIN_ROOT}/**)' (reference reads outside the project need it)"; gated_count=$((gated_count + 1))
  fi
  if ! grep -qF -- "$PREAMBLE" "$f"; then
    gated "$f: specialist lacks the exact root-resolution preamble sentence (see PREAMBLE in check.sh)"; gated_count=$((gated_count + 1))
  fi
  if ! grep -qF 'Bash(${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh *)' <<<"$fm"; then
    gated "$f: specialist lacks allowed-tools 'Bash(\${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh *)' (needed for profile.sh root)"; gated_count=$((gated_count + 1))
  fi
done
[[ $fm_fail -eq 0 ]] && ok "frontmatter name/description on ${#skill_files[@]} SKILL.md file(s)"
[[ $gated_count -eq 0 ]] && ok "specialists: user-invocable: false + ## Sources + allowed-tools (Read + profile.sh) + root preamble (gate: $GATE)"

# (d4) agents lint: name + description + model on every plugin agent
agent_files=(agents/*.md)
ag_count=0
for f in "${agent_files[@]}"; do
  fm="$(frontmatter "$f")"
  if [[ -z "$fm" ]]; then gated "$f: agent lacks YAML frontmatter"; ag_count=$((ag_count + 1)); continue; fi
  for key in name description model; do
    grep -qE "^${key}:[[:space:]]*[^[:space:]]" <<<"$fm" || { gated "$f: agent frontmatter lacks ${key}:"; ag_count=$((ag_count + 1)); }
  done
done
[[ $ag_count -eq 0 ]] && ok "agents: name/description/model on ${#agent_files[@]} agents/*.md file(s) (gate: $GATE)"

# (f) node --check on every Node script
mjs=(scripts/*.mjs)
nc_fail=0
for f in "${mjs[@]}"; do
  if ! err="$(node --check "$f" 2>&1)"; then bad "node --check $f: $err"; nc_fail=1; fi
done
[[ $nc_fail -eq 0 ]] && ok "node --check on ${#mjs[@]} script(s)"

# (g) diagram helpers self-test (Mermaid export, v1 -> Archify migration, dogfood IR; uses Archify's examples when installed)
if [[ -f scripts/diagram-check.mjs ]]; then
  if out="$(node scripts/diagram-check.mjs --self-test 2>&1)"; then
    ok "diagram-check.mjs --self-test: $(printf '%s\n' "$out" | tail -n1 | sed 's/^self-test: //')"
  else
    bad "diagram-check.mjs --self-test failed:"
    printf '%s\n' "$out" | grep -E '^(FAIL|self-test:)' | sed 's/^/        /'
  fi
fi

# (g2) spec page converter self-test (standard library only; the template is read from the tree)
if [[ -f scripts/spec-page.py ]]; then
  if command -v python3 >/dev/null 2>&1; then
    if out="$(python3 scripts/spec-page.py --self-test 2>&1)"; then
      ok "spec-page.py --self-test: $(printf '%s\n' "$out" | tail -n1 | sed 's/^self-test: //')"
    else
      bad "spec-page.py --self-test failed:"
      printf '%s\n' "$out" | grep -E '^(FAIL|self-test:)' | sed 's/^/        /'
    fi
  else
    bad "python3 not found; cannot run 'scripts/spec-page.py --self-test'"
  fi
fi

# (h') archify attribution: Archify is an external MIT engine, installed separately — never adapted code
if grep -q 'Archify' NOTICE && grep -q 'MIT' NOTICE && grep -q 'github.com/tt-a1i/archify' NOTICE && grep -qi 'external engine' NOTICE && ! grep -qi 'adapted' NOTICE; then
  ok "NOTICE names Archify (MIT, external engine)"
else
  bad "NOTICE must name Archify (MIT, https://github.com/tt-a1i/archify) as an external engine installed separately, with no adapted-code wording"
fi
if [[ ! -e skills/diagram/LICENSE-archify ]] && ! grep -rqs --exclude=check.sh 'Adapted from archify' scripts skills templates; then
  ok "no adapted Archify code: no LICENSE-archify copy, no 'Adapted from archify' headers"
else
  bad "adapted-code leftovers: skills/diagram/LICENSE-archify or 'Adapted from archify' headers still present"
fi

# (j) archify smoke: with the engine installed, validate + deliver the dogfood IR into a temp dir
if ar="$(bash scripts/archify.sh locate 2>/dev/null)"; then
  ir="$ROOT/.hyperui/diagrams/hyperui-architecture.json"
  if [[ -f "$ir" ]]; then
    tmp="$(mktemp -d)"
    if out="$(bash scripts/archify.sh run validate architecture "$ir" 2>&1)" \
       && out2="$(bash scripts/archify.sh run deliver architecture "$ir" "$tmp/hyperui-architecture.html" 2>&1)" \
       && grep -q 'data-animation="trace"' "$tmp/hyperui-architecture.html"; then
      ok "archify smoke: validate + deliver of .hyperui/diagrams/hyperui-architecture.json (archify $(bash scripts/archify.sh version 2>/dev/null) at $ar)"
    else
      bad "archify smoke failed (validate/deliver of the dogfood IR):"
      printf '%s\n%s\n' "${out:-}" "${out2:-}" | grep -v '^$' | tail -n 8 | sed 's/^/        /'
    fi
    rm -rf "$tmp"
  else
    bad "archify smoke: $ir is missing"
  fi
else
  skipped "archify smoke: Archify not installed (scripts/archify.sh ensure) — skipped, not failed"
fi

# (e) company-agnostic grep
if hits="$(grep -rnIiE '\bolo\b|ubits|ololabs|engage-specs|OLO-[0-9]' \
      --exclude-dir=.git --exclude-dir=node_modules --exclude=check.sh . 2>/dev/null)"; then
  bad "company-agnostic grep found hits:"
  printf '%s\n' "$hits" | sed 's/^/        /'
else
  ok "company-agnostic grep: clean"
fi

if [[ $FAIL -ne 0 ]]; then
  printf '[check] \xe2\x9c\x97 FAILED (%d warning(s), %d skipped)\n' "$WARN" "$SKIP"; exit 1
fi
printf '[check] \xe2\x9c\x93 PASSED (%d warning(s), %d skipped, gate: %s)\n' "$WARN" "$SKIP" "$GATE"
exit 0
