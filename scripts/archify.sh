#!/usr/bin/env bash
# hyperui diagram engine helper: finds, installs, updates and runs Archify (MIT,
# https://github.com/tt-a1i/archify), the toolchain the `diagram` specialist draws with.
# Archify is a Claude Code skill installed with `npx skills`; hyperui never vendors it.
#
# Usage:
#   archify.sh locate              print the Archify root (project .claude/skills/archify first,
#                                  then ~/.claude/skills/archify); exit 1 when missing
#   archify.sh version             print the installed version (skill-release.json)
#   archify.sh ensure [--no-update]
#                                  locate → install when missing → update (bounded to 90 s) →
#                                  print `archify <version> at <root>[ (update skipped: <reason>)]`;
#                                  exit 0 unless Archify is missing and the install failed
#   archify.sh run <args...>       exec `node <root>/bin/archify.mjs <args...>` (cwd unchanged; pass
#                                  absolute paths). Archify CLI: render | validate | deliver |
#                                  finalize | check | doctor | examples | guide
#
# Install:  npx -y skills add tt-a1i/archify -g -a claude-code -y --copy
# Update:   npx -y skills update archify -g -y
# Node >= 18, no runtime dependencies. HYPERUI_ARCHIFY_ROOT overrides the lookup.
set -euo pipefail

CWD="${CLAUDE_PROJECT_DIR:-$PWD}"
UPDATE_BOUND="${HYPERUI_ARCHIFY_UPDATE_SECONDS:-90}"
INSTALL_BOUND="${HYPERUI_ARCHIFY_INSTALL_SECONDS:-300}"
INSTALL_CMD=(npx -y skills add tt-a1i/archify -g -a claude-code -y --copy)
UPDATE_CMD=(npx -y skills update archify -g -y)

die() { echo "archify.sh: $*" >&2; exit 1; }
usage() { sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

# ---------------------------------------------------------------- locate / version
find_root() {
  local c
  for c in "${HYPERUI_ARCHIFY_ROOT:-}" "$CWD/.claude/skills/archify" "$HOME/.claude/skills/archify"; do
    [ -n "$c" ] && [ -f "$c/bin/archify.mjs" ] && { echo "$c"; return 0; }
  done
  return 1
}

version_of() { # <root>
  local f="$1/skill-release.json"
  [ -f "$f" ] || { echo "unknown"; return 0; }
  if command -v node >/dev/null 2>&1; then
    node -e 'try{process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).version||"unknown"))}catch(e){process.stdout.write("unknown")}' "$f"
    echo
  else
    sed -nE 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$f" | head -n1 | grep . || echo "unknown"
  fi
}

# ---------------------------------------------------------------- bounded run
# bounded <seconds> <log> <cmd...> — run cmd in its own process group with stdin closed, kill the
# whole group when the bound passes (macOS has no `timeout`; npx spawns children). Returns the
# command's exit status, 124 when the bound killed it.
bounded() {
  local secs="$1" log="$2"; shift 2
  local pid wd rc=0
  set -m
  "$@" <"/dev/null" >"$log" 2>&1 &
  pid=$!
  set +m
  rm -f "$log.timeout"
  # The watchdog gets its own process group and no stdio: a caller reading our stdout through a
  # pipe (Claude Code does) would otherwise wait for the inherited `sleep` to finish the bound.
  set -m
  ( sleep "$secs"; : > "$log.timeout"; kill -- -"$pid" 2>/dev/null; kill "$pid" 2>/dev/null ) </dev/null >/dev/null 2>&1 &
  wd=$!
  set +m
  wait "$pid" 2>/dev/null || rc=$?
  kill -- -"$wd" 2>/dev/null; kill "$wd" 2>/dev/null; wait "$wd" 2>/dev/null || true
  if [ -e "$log.timeout" ]; then rm -f "$log.timeout"; rc=124; fi
  return $rc
}

offline_log() { grep -qiE 'ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENETUNREACH|network|getaddrinfo|fetch failed' "$1" 2>/dev/null; }

# ---------------------------------------------------------------- commands
cmd_locate() { find_root || die "Archify not found (looked in $CWD/.claude/skills/archify and $HOME/.claude/skills/archify); run: archify.sh ensure"; }

cmd_version() { local r; r="$(find_root)" || die "Archify not found; run: archify.sh ensure"; version_of "$r"; }

cmd_ensure() {
  local no_update=0 root="" skipped="" log rc=0
  [ "${1:-}" = "--no-update" ] && no_update=1
  command -v node >/dev/null 2>&1 || die "node not found (Archify needs Node >= 18)"
  command -v npx  >/dev/null 2>&1 || die "npx not found (comes with npm)"
  log="$(mktemp 2>/dev/null || mktemp -t hyperui-archify)"
  trap "rm -f '$log' '$log.timeout'" EXIT
  if ! root="$(find_root)"; then
    echo "Archify (diagram engine) is not installed; installing it to ~/.claude/skills/archify (${INSTALL_CMD[*]})"
    bounded "$INSTALL_BOUND" "$log" "${INSTALL_CMD[@]}" || rc=$?
    if ! root="$(find_root)"; then
      tail -n 5 "$log" >&2 2>/dev/null || true
      if [ "$rc" -eq 124 ]; then die "install timed out after ${INSTALL_BOUND} s"; fi
      die "install failed (exit $rc); run it yourself: ${INSTALL_CMD[*]}"
    fi
    skipped="just installed"
  elif [ "$no_update" -eq 1 ]; then
    skipped="--no-update"
  else
    bounded "$UPDATE_BOUND" "$log" "${UPDATE_CMD[@]}" || rc=$?
    if [ "$rc" -eq 124 ]; then skipped="timed out after ${UPDATE_BOUND} s"
    elif [ "$rc" -ne 0 ]; then
      if offline_log "$log"; then skipped="offline"; else skipped="update exited $rc"; fi
    fi
  fi
  printf 'archify %s at %s' "$(version_of "$root")" "$root"
  [ -n "$skipped" ] && printf ' (update skipped: %s)' "$skipped"
  echo
}

cmd_run() {
  local r; r="$(find_root)" || die "Archify not found; run: archify.sh ensure"
  [ $# -gt 0 ] || die "usage: run <archify args...>"
  exec node "$r/bin/archify.mjs" "$@"
}

cmd="${1:-}"
[ $# -gt 0 ] && shift
case "$cmd" in
  locate)  cmd_locate ;;
  version) cmd_version ;;
  ensure)  cmd_ensure "$@" ;;
  run)     cmd_run "$@" ;;
  -h|--help|help|"") usage ;;
  *)       die "unknown command: $cmd (try --help)" ;;
esac
