#!/usr/bin/env bash
# SessionStart (startup) hook: introduce hyperui once per project.
# Resolves the project root(s) with profile.sh (cwd, or the repo(s) remembered for this
# directory via `/hyperui --repo <path>`), then prints the full intro as SessionStart
# additionalContext when <root>/.hyperui/ is missing; when it exists, prints one routing line so
# bare requests ("what can you do?", "where do I start?", product work) still reach the hyperui
# skill instead of generic Claude Code help. When this directory works on another repo, says so.
# Also runs scripts/update-check.sh (24 h cache) and, when a newer hyperui exists that the user
# has not declined, appends a one-line update offer to the context. Also fires
# scripts/telemetry.sh flush in the background (opt-in telemetry: no-op without consent, daily
# POST otherwise, 3 s curl, silent) so it never delays the session.
set -u

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
ROOTS="$("$PLUGIN_ROOT/scripts/profile.sh" roots 2>/dev/null || true)"
[ -n "$ROOTS" ] || ROOTS="$PROJECT_DIR"
PRIMARY="$(printf '%s\n' "$ROOTS" | head -n1)"
( "$PLUGIN_ROOT/scripts/telemetry.sh" flush >/dev/null 2>&1 & ) 2>/dev/null

# JSON string escaping for paths (backslash, double quote); paths are one line each.
esc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }
LIST="$(printf '%s\n' "$ROOTS" | paste -sd, - | sed 's/,/, /g')"
WORKS_ON=""
if [ "$PRIMARY" != "$PROJECT_DIR" ] || [ "$(printf '%s\n' "$ROOTS" | grep -c .)" -gt 1 ]; then
  WORKS_ON=" This directory works on $(esc "$LIST") (remembered root(s); run profile.sh root / roots for the exact paths, keep .hyperui/ and every repo read or write there, and say /hyperui --repo . to work here instead)."
fi

# Update offer (silent on any failure; update-check.sh always exits 0 and prints one JSON line).
# json_str <key> <json>: the string value of a one-level key ("" when null/missing).
json_str() { printf '%s' "$2" | sed -nE 's/.*"'"$1"'"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' | head -n1; }
UPDATE=""
UC="$("$PLUGIN_ROOT/scripts/update-check.sh" 2>/dev/null || true)"
if printf '%s' "$UC" | grep -q '"update_available":true'; then
  LATEST="$(json_str latest "$UC")"; INSTALLED="$(json_str installed "$UC")"
  DECLINED="$(json_str declined "$UC")"; NEW="$(json_str whats_new "$UC")"
  if [ -n "$LATEST" ] && [ "$LATEST" != "$DECLINED" ]; then
    WHATS=""; [ -n "$NEW" ] && WHATS=" What's new: $(esc "$NEW")"
    UPDATE=" hyperui $(esc "$LATEST") is available (installed $(esc "$INSTALLED")).$WHATS In the first reply, offer in ONE line to update (npx @tizonai/hyperui update — or claude plugin update hyperui@tizonai — then restart Claude Code) with a yes/later choice, summarizing what's new in that same line when given; if the user says later, run $(esc "$PLUGIN_ROOT")/scripts/update-check.sh --decline $(esc "$LATEST") and do not mention it again for that version."
  fi
fi

# Telemetry consent (opt-in; asked once per machine by the entry skill, §9). While unasked, remind the
# session so the first closed unit of work carries the one-line question. Silent on any failure.
TEL=""
case "$("$PLUGIN_ROOT/scripts/telemetry.sh" status 2>/dev/null | sed -nE 's/^consent: (.*)$/\1/p')" in
  yes|no) ;;
  *) TEL=" Telemetry consent is unasked on this machine: when the first unit of work closes in this session, add the one-line consent question from the hyperui skill (section 9, Telemetry) right before the closing choice prompt, in the user language, then store the answer with $(esc "$PLUGIN_ROOT")/scripts/telemetry.sh consent yes or no (no answer = no); never ask again after that." ;;
esac

if [ -d "$PRIMARY/.hyperui" ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This project uses hyperui (.hyperui/ present in %s). For anything about designing, planning, building, reviewing or shipping the product, and for questions like what can you do or where do I start, invoke the hyperui skill first; it reads .hyperui/profile.md and .hyperui/state.md and routes.%s%s%s"}}\n' "$(esc "$PRIMARY")" "$WORKS_ON" "$UPDATE" "$TEL"
  exit 0
fi

# Plain ASCII text, no quotes/backslashes, so the JSON below needs no escaping beyond \n.
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"hyperui welcome (this project has no .hyperui/ folder yet).\\nIntro master text (English; render it in the user'"'"'s language):\\nI'"'"'m hyperui. I help you take a product with a UI from idea to shipped: I show you how it\\nwould look first, then plan it, build it, check it, and guide you to put it online. I'"'"'ll ask\\nyou at most three things now and remember the rest in a .hyperui/ folder in this project,\\nso you never answer twice. You can just tell me what you want in your own words.\\nIf the user has not yet been introduced to hyperui in this project, greet them in THEIR language with this intro, then follow the hyperui skill.%s%s%s"}}\n' "$WORKS_ON" "$UPDATE" "$TEL"
exit 0
