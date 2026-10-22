#!/usr/bin/env bash
# hyperui:setup — install the frontend craft stack into the current project.
# Idempotent: every step checks before acting; failures never abort the others.
# Steps: preflight → Motion (npm) → Motion AI Kit (official /motion skill + motion-reviewer
# agent from the motion-ai npm package, and the hosted `motion` MCP; `motion-plus` only with
# --motion-plus) → HyperFrames → Archify (diagram engine, always global) → UI UX Pro Max → frontend-design →
# Impeccable → 21st.dev MCP → Playwright MCP (opt-in, --playwright-mcp: headless browser fallback for visual checks).
set -euo pipefail

GLOBAL=0
DRY=0
SKIP_HYPERFRAMES=0
SKIP_ARCHIFY=0
SKIP_UIPRO=0
SKIP_MOTION=0
SKIP_21ST=0
SKIP_FD=0
SKIP_IMP=0
SKIP_MKIT=0
MOTION_PLUS=0
PLAYWRIGHT_MCP=0
INSTALL_PREREQS=0
KEY_21ST="${TWENTY_FIRST_API_KEY:-}"

usage() {
  cat <<USAGE
Usage: setup.sh [options]

Installs into the current project (cwd):
  Motion (npm)            Motion AI Kit (/motion skill + motion MCP)    HyperFrames skills    Archify (diagram engine)
  UI UX Pro Max skill     frontend-design plugin    Impeccable plugin    21st.dev MCP (user scope, needs a key)

Options:
  --global              Install the skills to ~/.claude/skills instead of ./.claude/skills
  --21st-key <key>      21st.dev API key (or export TWENTY_FIRST_API_KEY)
  --skip-hyperframes    --skip-archify    --skip-uipro    --skip-motion    --skip-motion-kit    --skip-21st
  --skip-frontend-design    --skip-impeccable
  --motion-plus         Also register the motion-plus MCP (Motion+ subscribers; sign in from the MCP settings)
  --playwright-mcp      Also register the Playwright MCP (headless; local scope, user with --global) as the
                        browser fallback for visual checks when Claude in Chrome (claude --chrome) is not available
  --install-prereqs     Install missing node (24 LTS) / python3 with Homebrew on macOS (non-interactive;
                        only after the user said yes). On Linux/WSL2 it prints the distro lines.
  --telemetry | --no-telemetry
                        Answer the anonymous-usage question now (yes / no) instead of being asked once
                        after the first finished task; see README "Telemetry" (default: unasked = off)
  --dry-run             Print every command instead of running it
  -h, --help            This help

Prerequisites (you install these; setup only helps): Claude Code CLI signed in, git,
Node 24 LTS recommended (>= 20 required) + npm, python3. Terraform is NOT installed here: the infra specialist offers it on first use.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --global) GLOBAL=1 ;;
    --dry-run) DRY=1 ;;
    --skip-hyperframes) SKIP_HYPERFRAMES=1 ;;
    --skip-archify) SKIP_ARCHIFY=1 ;;
    --skip-uipro) SKIP_UIPRO=1 ;;
    --skip-motion) SKIP_MOTION=1 ;;
    --skip-21st) SKIP_21ST=1 ;;
    --skip-frontend-design) SKIP_FD=1 ;;
    --skip-impeccable) SKIP_IMP=1 ;;
    --skip-motion-kit) SKIP_MKIT=1 ;;
    --motion-plus) MOTION_PLUS=1 ;;
    --playwright-mcp) PLAYWRIGHT_MCP=1 ;;
    --install-prereqs) INSTALL_PREREQS=1 ;;
    --telemetry) TELEMETRY=yes ;;
    --no-telemetry) TELEMETRY=no ;;
    --21st-key) shift; KEY_21ST="${1:-}" ;;
    --21st-key=*) KEY_21ST="${1#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[hyperui] ✗ unknown option: $1"; usage; exit 2 ;;
  esac
  shift
done

ok()   { printf '[hyperui] ✓ %s\n' "$*"; }
skip() { printf '[hyperui] skip %s\n' "$*"; }
fail() { printf '[hyperui] ✗ %s\n' "$*"; }
warn() { printf '[hyperui] ! %s\n' "$*"; }
did()  { if [[ $DRY -eq 1 ]]; then printf "[hyperui] ✓ (dry-run) would: %s\n" "$*"; else printf "[hyperui] ✓ %s\n" "$*"; fi; }
status_installed() { if [[ $DRY -eq 1 ]]; then echo "would install"; else echo "installed"; fi; }

FAILURES=()
declare -a SUMMARY=()
record() { SUMMARY+=("$1|$2|$3"); }   # component | status | where

# run <description> <cmd...> — prints in dry-run, executes otherwise. Returns cmd status.
run() {
  local desc="$1"; shift
  if [[ $DRY -eq 1 ]]; then
    printf '[hyperui] dry-run %s:\n        %s\n' "$desc" "$*"
    return 0
  fi
  "$@"
}

if [[ $GLOBAL -eq 1 ]]; then
  SKILLS_DIR="$HOME/.claude/skills"
  AGENTS_DIR="$HOME/.claude/agents"
  MCP_SCOPE=user
  SCOPE_LABEL="global (~/.claude/skills)"
else
  SKILLS_DIR="$PWD/.claude/skills"
  AGENTS_DIR="$PWD/.claude/agents"
  MCP_SCOPE=local
  SCOPE_LABEL="project (./.claude/skills)"
fi

echo "[hyperui] setup — scope: $SCOPE_LABEL — cwd: $PWD"
[[ $DRY -eq 1 ]] && echo "[hyperui] DRY RUN: nothing will be installed"

# ---------------------------------------------------------------- a. preflight
# Install hints per OS (official sources: https://brew.sh, https://nodejs.org/en/download,
# https://github.com/nodesource/distributions, https://www.python.org/downloads/).
OS="$(uname -s 2>/dev/null || echo unknown)"
HAS_BREW=0; command -v brew >/dev/null 2>&1 && HAS_BREW=1
BREW_LINE='/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
hint() { # <tool> -> prints the install line(s) for this OS
  case "$OS" in
    Darwin)
      if [[ $HAS_BREW -eq 1 ]]; then
        case "$1" in node) echo "brew install node@24 && brew link --overwrite node@24   (Node 24 LTS; or nvm: nvm install 24)" ;; python3) echo "brew install python" ;; esac
      else
        echo "install Homebrew first (https://brew.sh): $BREW_LINE"
        case "$1" in node) echo "then: brew install node@24 && brew link --overwrite node@24   (or nvm: nvm install 24)" ;; python3) echo "then: brew install python" ;; esac
      fi ;;
    Linux)
      case "$1" in
        node)    echo "recommended, no sudo: nvm (https://github.com/nvm-sh/nvm) then: nvm install 24"
                 echo "Debian/Ubuntu (NodeSource 24.x): curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt-get install -y nodejs"
                 echo "Fedora/RHEL: sudo dnf install -y nodejs npm   — or any method at https://nodejs.org/en/download" ;;
        python3) echo "Debian/Ubuntu: sudo apt-get install -y python3   Fedora/RHEL: sudo dnf install -y python3" ;;
      esac ;;
    *) echo "Windows: use WSL2 (https://learn.microsoft.com/windows/wsl/install) and follow the Linux lines; or https://nodejs.org/en/download" ;;
  esac
}

preflight() {
  PREFLIGHT_OK=1; MISSING=()
  if command -v node >/dev/null 2>&1; then
    NODE_MAJOR="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
    if [[ "$NODE_MAJOR" -ge 22 ]]; then
      ok "node $(node --version) (24 LTS recommended)"
    elif [[ "$NODE_MAJOR" -ge 20 ]]; then
      warn "node $(node --version) works but is end-of-life; recommended Node 24 LTS — $(hint node | head -1)"
    else
      fail "node >= 20 required, 24 LTS recommended (found $(node --version)) — $(hint node | head -1)"; PREFLIGHT_OK=0; MISSING+=(node)
    fi
  else
    fail "node not found — install: $(hint node | head -1)"; hint node | tail -n +2 | sed 's/^/        /'; PREFLIGHT_OK=0; MISSING+=(node)
  fi
  if command -v npm >/dev/null 2>&1; then ok "npm $(npm --version)"; else fail "npm not found (comes with node)"; PREFLIGHT_OK=0; fi
  if command -v python3 >/dev/null 2>&1; then
    ok "python3 $(python3 --version 2>&1 | awk '{print $2}') (profile.sh, permit.sh, UI UX Pro Max scripts)"
  else
    fail "python3 not found — install: $(hint python3 | head -1)"; hint python3 | tail -n +2 | sed 's/^/        /'
    warn "without python3: profile.sh falls back to awk, permit.sh stays silent (permission prompts appear), UI UX Pro Max search is unavailable"
    PREFLIGHT_OK=0; MISSING+=(python3)
  fi
  if command -v git >/dev/null 2>&1; then ok "git $(git --version | awk '{print $3}')"; else warn "git not found — the git specialist and plugin updates need it"; fi
  if command -v claude >/dev/null 2>&1; then
    ok "claude CLI $(claude --version 2>/dev/null | head -1)"
    HAS_CLAUDE=1
  else
    warn "claude CLI not found — Motion MCP, frontend-design, Impeccable and 21st MCP steps will be skipped"
    HAS_CLAUDE=0
  fi
}
preflight

if [[ $PREFLIGHT_OK -eq 0 && $INSTALL_PREREQS -eq 1 && ${#MISSING[@]} -gt 0 ]]; then
  if [[ "$OS" == "Darwin" && $HAS_BREW -eq 1 ]]; then
    for m in "${MISSING[@]}"; do
      case "$m" in node) PKG=node@24 ;; python3) PKG=python ;; *) continue ;; esac
      if run "install $m with Homebrew" brew install "$PKG"; then
        did "$m installed (brew install $PKG)"
        [[ "$PKG" == node@24 ]] && { run "link node@24" brew link --overwrite node@24 || warn "brew link node@24 failed; run it yourself"; }
      else fail "brew install $PKG failed"; FAILURES+=("prereq-$m"); fi
    done
    [[ $DRY -eq 0 ]] && { echo "[hyperui] re-running preflight"; preflight; }
  elif [[ "$OS" == "Darwin" ]]; then
    fail "--install-prereqs needs Homebrew; install it first (interactive, asks for your password): $BREW_LINE"
  else
    fail "--install-prereqs runs package managers only on macOS; on this OS run the lines above yourself (they need sudo)"
  fi
fi
if [[ $PREFLIGHT_OK -eq 0 ]]; then
  FAILURES+=("preflight")
  warn "preflight failed; npm-based steps will likely fail too. Fix the lines above, or ask hyperui to run them: /hyperui:setup --install-prereqs"
fi

# ---------------------------------------------------------------- b. motion
if [[ $SKIP_MOTION -eq 1 ]]; then
  skip "motion (--skip-motion)"; record "Motion" "skipped" "-"
elif [[ ! -f package.json ]]; then
  skip "motion: no package.json in cwd (not a JS project)"; record "Motion" "skipped (no package.json)" "-"
elif grep -Eq '"motion"[[:space:]]*:' package.json; then
  ok "motion already in package.json"; record "Motion" "present" "package.json"
else
  if   [[ -f pnpm-lock.yaml ]]; then PM=pnpm; CMD=(pnpm add motion)
  elif [[ -f yarn.lock ]];      then PM=yarn; CMD=(yarn add motion)
  elif [[ -f bun.lockb || -f bun.lock ]]; then PM=bun; CMD=(bun add motion)
  else PM=npm; CMD=(npm install motion); fi
  if run "install motion via $PM" "${CMD[@]}"; then
    did "motion installed ($PM)"; record "Motion" "$(status_installed)" "package.json ($PM)"
  else
    fail "motion install failed ($PM)"; FAILURES+=("motion"); record "Motion" "FAILED" "-"
  fi
fi

# ---------------------------------------------------------------- b2. motion ai kit
# Official kit (MIT, https://github.com/motiondivision/ai-kit). Its installer (`npx motion-ai`)
# is interactive-only, so we replicate what it does for Claude Code: copy the package's
# content/skills/motion and content/agents/motion-reviewer.md, then register the hosted MCP.
if [[ $SKIP_MKIT -eq 1 ]]; then
  skip "motion ai kit (--skip-motion-kit)"
  record "Motion AI Kit skill" "skipped" "-"; record "Motion MCP" "skipped" "-"
else
  if [[ -d "$SKILLS_DIR/motion" ]]; then
    ok "motion skill already at $SKILLS_DIR/motion"; record "Motion AI Kit skill" "present" "$SKILLS_DIR/motion"
  elif [[ $DRY -eq 1 ]]; then
    run "download the Motion AI Kit" npm pack motion-ai@latest --pack-destination "<tmpdir>" --silent
    run "unpack it" tar xzf "<tmpdir>/motion-ai-<version>.tgz" -C "<tmpdir>"
    run "copy the /motion skill" cp -R "<tmpdir>/package/content/skills/motion" "$SKILLS_DIR/motion"
    run "copy the motion-reviewer agent" cp "<tmpdir>/package/content/agents/motion-reviewer.md" "$AGENTS_DIR/"
    did "motion ai kit skill → $SKILLS_DIR/motion, agent → $AGENTS_DIR"
    record "Motion AI Kit skill" "$(status_installed)" "$SKILLS_DIR/motion"
  else
    MK_TMP="$(mktemp -d 2>/dev/null || mktemp -d -t hyperui-motion)"
    MK_OK=0
    if (cd "$MK_TMP" && npm pack motion-ai@latest --pack-destination "$MK_TMP" --silent >/dev/null) \
       && tar xzf "$MK_TMP"/motion-ai-*.tgz -C "$MK_TMP" \
       && [[ -f "$MK_TMP/package/content/skills/motion/SKILL.md" ]] \
       && mkdir -p "$SKILLS_DIR" "$AGENTS_DIR" \
       && cp -R "$MK_TMP/package/content/skills/motion" "$SKILLS_DIR/motion"; then
      MK_OK=1
      if [[ -f "$MK_TMP/package/content/agents/motion-reviewer.md" ]]; then
        cp "$MK_TMP/package/content/agents/motion-reviewer.md" "$AGENTS_DIR/" || warn "motion-reviewer agent copy failed"
      fi
    fi
    MK_VER="$(node -e 'try{console.log(require(process.argv[1]).version)}catch(e){}' "$MK_TMP/package/package.json" 2>/dev/null || true)"
    rm -rf "$MK_TMP"
    if [[ $MK_OK -eq 1 ]]; then
      did "motion ai kit${MK_VER:+ $MK_VER} skill → $SKILLS_DIR/motion, agent → $AGENTS_DIR"
      record "Motion AI Kit skill" "installed${MK_VER:+ ($MK_VER)}" "$SKILLS_DIR/motion"
    else
      fail "motion ai kit install failed (npm pack motion-ai)"; FAILURES+=("motion-kit"); record "Motion AI Kit skill" "FAILED" "-"
    fi
  fi

  # MCP: local scope = this project only, stored in ~/.claude.json (never committed); user with --global.
  if [[ $HAS_CLAUDE -eq 0 ]]; then
    skip "motion MCP: claude CLI not found"; record "Motion MCP" "skipped (no claude)" "-"
  else
    MCP_LIST=""; [[ $DRY -eq 0 ]] && MCP_LIST="$(claude mcp list 2>/dev/null || true)"
    MCP_NAMES=(motion); [[ $MOTION_PLUS -eq 1 ]] && MCP_NAMES+=(motion-plus)
    MCP_STATUS=""; MCP_ADDED=0; MCP_FAILED=0
    for name in "${MCP_NAMES[@]}"; do
      url="https://mcp.motion.dev"; [[ "$name" == motion-plus ]] && url="https://mcp.motion.dev/plus"
      if grep -Eq "^$name:" <<<"$MCP_LIST"; then
        ok "$name MCP already registered"
      elif run "register $name MCP ($MCP_SCOPE scope)" claude mcp add --transport http --scope "$MCP_SCOPE" "$name" "$url"; then
        did "$name MCP registered ($MCP_SCOPE scope)"; MCP_ADDED=1
      else
        fail "$name MCP registration failed"; FAILURES+=("$name-mcp"); MCP_FAILED=1
      fi
    done
    if   [[ $MCP_FAILED -eq 1 ]]; then MCP_STATUS="FAILED"
    elif [[ $MCP_ADDED -eq 1 ]];  then MCP_STATUS="$(status_installed)"
    else MCP_STATUS="present"; fi
    record "Motion MCP" "$MCP_STATUS" "claude mcp: ${MCP_NAMES[*]} ($MCP_SCOPE scope)"
    [[ $MOTION_PLUS -eq 0 ]] && echo "[hyperui] Motion+ subscriber? rerun with --motion-plus to add the motion-plus MCP (sign in from the MCP settings)"
  fi
fi

# ---------------------------------------------------------------- c. hyperframes
if [[ $SKIP_HYPERFRAMES -eq 1 ]]; then
  skip "hyperframes (--skip-hyperframes)"; record "HyperFrames skills" "skipped" "-"
elif [[ -d "$SKILLS_DIR/hyperframes" ]]; then
  ok "hyperframes skills already at $SKILLS_DIR/hyperframes"; record "HyperFrames skills" "present" "$SKILLS_DIR"
else
  CMD=(npx -y skills add heygen-com/hyperframes -a claude-code -s '*' -y --copy)
  [[ $GLOBAL -eq 1 ]] && CMD+=(-g)
  if run "install HyperFrames skills" "${CMD[@]}"; then
    did "hyperframes skills installed → $SKILLS_DIR"; record "HyperFrames skills" "$(status_installed)" "$SKILLS_DIR"
  else
    fail "hyperframes skills install failed"; FAILURES+=("hyperframes"); record "HyperFrames skills" "FAILED" "-"
  fi
fi

# ---------------------------------------------------------------- c2. archify (diagram engine)
# Archify (MIT, https://github.com/tt-a1i/archify) draws every `diagram` specialist diagram. Always a
# global skill (~/.claude/skills/archify): scripts/archify.sh looks there after the project's
# .claude/skills and updates it on every diagram task, so this step only covers the first install.
ARCHIFY_SH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/archify.sh"
if [[ $SKIP_ARCHIFY -eq 1 ]]; then
  skip "archify (--skip-archify)"; record "Archify (diagrams)" "skipped" "-"
elif ARCHIFY_ROOT="$(bash "$ARCHIFY_SH" locate 2>/dev/null)"; then
  ok "archify $(bash "$ARCHIFY_SH" version 2>/dev/null || echo '?') already at $ARCHIFY_ROOT"; record "Archify (diagrams)" "present" "$ARCHIFY_ROOT"
else
  CMD=(npx -y skills add tt-a1i/archify -g -a claude-code -y --copy)
  if run "install Archify (diagram engine, global)" "${CMD[@]}"; then
    did "archify installed → $HOME/.claude/skills/archify"; record "Archify (diagrams)" "$(status_installed)" "$HOME/.claude/skills/archify"
  else
    fail "archify install failed (npx -y skills add tt-a1i/archify)"; FAILURES+=("archify"); record "Archify (diagrams)" "FAILED" "-"
  fi
fi

# ---------------------------------------------------------------- d. ui ux pro max
if [[ $SKIP_UIPRO -eq 1 ]]; then
  skip "ui-ux-pro-max (--skip-uipro)"; record "UI UX Pro Max" "skipped" "-"
elif [[ -d "$SKILLS_DIR/ui-ux-pro-max" ]]; then
  ok "ui-ux-pro-max already at $SKILLS_DIR/ui-ux-pro-max"; record "UI UX Pro Max" "present" "$SKILLS_DIR"
else
  CMD=(npx -y ui-ux-pro-max-cli init --ai claude)
  [[ $GLOBAL -eq 1 ]] && CMD+=(--global)
  if run "install UI UX Pro Max skill" "${CMD[@]}"; then
    did "ui-ux-pro-max installed → $SKILLS_DIR"; record "UI UX Pro Max" "$(status_installed)" "$SKILLS_DIR"
  else
    fail "ui-ux-pro-max install failed"; FAILURES+=("ui-ux-pro-max"); record "UI UX Pro Max" "FAILED" "-"
  fi
fi

# ---------------------------------------------------------------- e. frontend-design plugin
if [[ $SKIP_FD -eq 1 ]]; then
  skip "frontend-design (--skip-frontend-design)"; record "frontend-design plugin" "skipped" "-"
elif [[ $HAS_CLAUDE -eq 0 ]]; then
  skip "frontend-design: claude CLI not found"; record "frontend-design plugin" "skipped (no claude)" "-"
elif [[ $DRY -eq 0 ]] && claude plugin list 2>/dev/null | grep -q 'frontend-design'; then
  ok "frontend-design plugin already installed"; record "frontend-design plugin" "present" "claude plugins"
else
  if run "install Anthropic frontend-design plugin" claude plugin install frontend-design@claude-plugins-official; then
    did "frontend-design plugin installed"; record "frontend-design plugin" "$(status_installed)" "claude plugins"
  else
    fail "frontend-design plugin install failed"; FAILURES+=("frontend-design"); record "frontend-design plugin" "FAILED" "-"
  fi
fi

# ---------------------------------------------------------------- e2. impeccable plugin
if [[ $SKIP_IMP -eq 1 ]]; then
  skip "impeccable (--skip-impeccable)"; record "Impeccable plugin" "skipped" "-"
elif [[ $HAS_CLAUDE -eq 0 ]]; then
  skip "impeccable: claude CLI not found"; record "Impeccable plugin" "skipped (no claude)" "-"
elif [[ $DRY -eq 0 ]] && claude plugin list 2>/dev/null | grep -q 'impeccable'; then
  ok "impeccable plugin already installed"; record "Impeccable plugin" "present" "claude plugins"
else
  IMP_OK=1
  if [[ $DRY -eq 1 ]] || ! claude plugin marketplace list 2>/dev/null | grep -q 'impeccable'; then
    run "add Impeccable marketplace" claude plugin marketplace add pbakaus/impeccable || IMP_OK=0
  fi
  if [[ $IMP_OK -eq 1 ]] && run "install Impeccable plugin" claude plugin install impeccable@impeccable; then
    did "impeccable plugin installed"; record "Impeccable plugin" "$(status_installed)" "claude plugins (impeccable)"
  else
    fail "impeccable plugin install failed"; FAILURES+=("impeccable"); record "Impeccable plugin" "FAILED" "-"
  fi
fi

# ---------------------------------------------------------------- f. 21st.dev MCP
if [[ $SKIP_21ST -eq 1 ]]; then
  skip "21st MCP (--skip-21st)"; record "21st.dev MCP" "skipped" "-"
elif [[ $HAS_CLAUDE -eq 0 ]]; then
  skip "21st MCP: claude CLI not found"; record "21st.dev MCP" "skipped (no claude)" "-"
elif [[ $DRY -eq 0 ]] && claude mcp list 2>/dev/null | grep -Eq '^21st[: ]'; then
  ok "21st MCP already registered"; record "21st.dev MCP" "present" "claude mcp (user scope)"
elif [[ -z "$KEY_21ST" ]]; then
  skip "21st MCP: no key. Get a free key at https://21st.dev/mcp then rerun with --21st-key <key> or export TWENTY_FIRST_API_KEY"
  record "21st.dev MCP" "skipped (no key)" "-"
else
  # User scope: the key lives in ~/.claude.json, never in the project → never committed.
  # NOTE: --header is variadic — it must come AFTER the server name and URL or it swallows them.
  if run "register 21st MCP (user scope)" claude mcp add --transport http --scope user \
       21st https://21st.dev/api/mcp --header "x-api-key: $KEY_21ST"; then
    did "21st MCP registered (user scope)"; record "21st.dev MCP" "$(status_installed)" "claude mcp (user scope)"
  else
    fail "21st MCP registration failed"; FAILURES+=("21st"); record "21st.dev MCP" "FAILED" "-"
  fi
fi

# ---------------------------------------------------------------- f2. playwright MCP (opt-in)
# Headless browser fallback for skills/design/references/browser-verify.md when Claude in Chrome is off.
# Official server: https://github.com/microsoft/playwright-mcp (headed by default → --headless).
if [[ $PLAYWRIGHT_MCP -eq 0 ]]; then
  skip "playwright MCP (opt-in: --playwright-mcp)"; record "Playwright MCP" "skipped (opt-in)" "-"
elif [[ $HAS_CLAUDE -eq 0 ]]; then
  skip "playwright MCP: claude CLI not found"; record "Playwright MCP" "skipped (no claude)" "-"
elif [[ $DRY -eq 0 ]] && claude mcp list 2>/dev/null | grep -Eq '^playwright[: ]'; then
  ok "playwright MCP already registered"; record "Playwright MCP" "present" "claude mcp ($MCP_SCOPE scope)"
else
  if run "register Playwright MCP ($MCP_SCOPE scope)" claude mcp add --scope "$MCP_SCOPE" playwright -- npx @playwright/mcp@latest --headless; then
    did "playwright MCP registered ($MCP_SCOPE scope)"; record "Playwright MCP" "$(status_installed)" "claude mcp ($MCP_SCOPE scope)"
  else
    fail "playwright MCP registration failed"; FAILURES+=("playwright-mcp"); record "Playwright MCP" "FAILED" "-"
  fi
fi

# ---------------------------------------------------------------- f3. telemetry (opt-in; explicit answer only)
if [[ -n "${TELEMETRY:-}" ]]; then
  if run "telemetry consent $TELEMETRY" "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/telemetry.sh" consent "$TELEMETRY" >/dev/null; then
    did "telemetry: $TELEMETRY (anonymous usage data; scripts/telemetry.sh status | purge)"; record "Telemetry" "$TELEMETRY" "~/.claude/plugins/data/hyperui/user.md"
  else
    fail "telemetry consent could not be stored"; FAILURES+=("telemetry"); record "Telemetry" "FAILED" "-"
  fi
fi

# ---------------------------------------------------------------- g. summary
echo
echo "[hyperui] summary"
printf '  %-24s %-24s %s\n' "component" "status" "where"
printf '  %-24s %-24s %s\n' "------------------------" "------------------------" "-----"
for row in "${SUMMARY[@]}"; do
  IFS='|' read -r c s w <<<"$row"
  printf '  %-24s %-24s %s\n' "$c" "$s" "$w"
done
echo
if grep -q 'claude mcp' <<<"${SUMMARY[*]}" 2>/dev/null && [[ $DRY -eq 0 ]]; then
  echo "[hyperui] ! MCP servers registered in this run (21st / motion / playwright) become available after you restart Claude Code (or run /mcp)."
fi
echo "[hyperui] Try: /hyperui:design (design brief), /motion (Motion docs, springs, audits), /hyperframes (video), /ui-ux-pro-max, /frontend-design, /impeccable audit"
echo "[hyperui] For live visual checks start Claude Code with \`claude --chrome\` (Claude in Chrome extension, direct plan); without it, \`--playwright-mcp\` adds a headless fallback."

if [[ ${#FAILURES[@]} -gt 0 ]]; then
  echo "[hyperui] ✗ failed steps: ${FAILURES[*]}"
  exit 1
fi
