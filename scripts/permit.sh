#!/usr/bin/env bash
# PreToolUse hook (hooks/hooks.json): pre-approve the plugin's OWN surface, nothing else.
#
# Why it exists: a skill that declares `allowed-tools` is itself gated by the Skill tool in the
# default permission mode (interactive: a prompt; headless -p: denied). Every hyperui specialist
# declares `allowed-tools` so it can read its references under ${CLAUDE_PLUGIN_ROOT}, so without
# this hook the single-door routing (hyperui -> specialist) prompts on every hop.
#
# Allows, by returning permissionDecision "allow":
#   - Skill            whose name starts with "hyperui:"
#   - Read/Glob/Grep   of a path under the plugin root (references, templates)
#   - Bash             commands that start with "<plugin root>/scripts/profile.sh",
#                      "<plugin root>/scripts/update-check.sh", "<plugin root>/scripts/verify-deploy.sh"
#                      or "<plugin root>/scripts/telemetry.sh" (quoted or not; verify-deploy.sh only
#                      reads a public URL with curl; telemetry.sh writes only under the data dir), and
#                      "node <plugin root>/scripts/diagram-check.mjs ..." (the diagram validator and
#                      renderer: reads the IR it is given, writes next to it or under --out) and
#                      "python3 <plugin root>/scripts/spec-page.py ..." (markdown -> spec page: reads
#                      the markdown it is given, writes only the output path it is given)
#   - Read/Edit/Write  of a path under <root>/.hyperui/ for every project root resolved by
#                      `profile.sh roots` (the cwd, or the repo(s) remembered for it with
#                      `/hyperui --repo <path>`), so memory lands in the target repo without a
#                      prompt.
#   - Read/Glob/Grep   (reads only) anywhere under a resolved root, so the stack can be inferred
#                      from a repo outside cwd. Edit/Write of repo files outside .hyperui/ are
#                      NOT covered: normal flow (the user approves each one).
# Anything else: no output, exit 0 -> the normal permission flow decides. Deny/ask rules in the
# user's settings still override an "allow" from here (documented hook semantics).
set -u
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
INPUT="$(cat)"
command -v python3 >/dev/null 2>&1 || exit 0
# Project roots, one per line (same resolution as every profile.sh command). The hook runs with
# CLAUDE_PROJECT_DIR set; the JSON `cwd` is the fallback key.
HOOK_CWD="$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print((json.load(sys.stdin) or {}).get("cwd",""))' 2>/dev/null || true)"
ROOTS="$(CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${HOOK_CWD:-$PWD}}" "$ROOT/scripts/profile.sh" roots 2>/dev/null || true)"
# Opt-in trace for debugging the hook: HYPERUI_PERMIT_LOG=/path/file appends input + roots + decision.
HOOK_INPUT="$INPUT" HOOK_ROOT="$ROOT" HOOK_ROOTS="$ROOTS" HOOK_CWD="${CLAUDE_PROJECT_DIR:-${HOOK_CWD:-$PWD}}" python3 - <<'PY'
import json, os, sys
log = os.environ.get("HYPERUI_PERMIT_LOG")
root = os.path.realpath(os.environ["HOOK_ROOT"])
roots = [os.path.realpath(r) for r in os.environ.get("HOOK_ROOTS", "").split("\n") if r.strip()]
try:
    d = json.loads(os.environ["HOOK_INPUT"])
except Exception:
    sys.exit(0)
tool = d.get("tool_name"); inp = d.get("tool_input") or {}
ok = False; why = "hyperui: plugin's own skill/reference/profile.sh/update-check.sh/verify-deploy.sh/telemetry.sh/diagram-check.mjs/spec-page.py"
def under(p, base):
    return bool(p) and os.path.realpath(p).startswith(base + os.sep)
if tool == "Skill" and str(inp.get("skill", "")).startswith("hyperui:"):
    ok = True
elif tool in ("Read", "Glob", "Grep"):
    p = inp.get("file_path") or inp.get("path") or ""
    ok = under(p, root)
elif tool == "Bash":
    cmd = str(inp.get("command", "")).lstrip()
    for script in (root + "/scripts/profile.sh", root + "/scripts/update-check.sh", root + "/scripts/verify-deploy.sh", root + "/scripts/telemetry.sh"):
        if cmd.startswith(script + " ") or cmd.startswith('"' + script + '" ') or cmd == script or cmd == '"' + script + '"':
            ok = True
    mjs = root + "/scripts/diagram-check.mjs"; spg = root + "/scripts/spec-page.py"
    for form in ("node " + mjs + " ", 'node "' + mjs + '" ', "python3 " + spg + " ", 'python3 "' + spg + '" '):
        if cmd.startswith(form) and ";" not in cmd and "&&" not in cmd and "|" not in cmd and "`" not in cmd and "$(" not in cmd:
            ok = True
if not ok and tool in ("Read", "Edit", "Write"):
    p = inp.get("file_path") or inp.get("path") or ""
    if any(under(p, os.path.join(r, ".hyperui")) for r in roots):
        ok = True; why = "hyperui: project memory (.hyperui/) of a resolved project root"
if not ok and tool in ("Read", "Glob", "Grep"):
    p = inp.get("file_path") or inp.get("path") or ""
    if any(under(p, r) or os.path.realpath(p) == r for r in roots if p):
        ok = True; why = "hyperui: read of a resolved project root"
if log:
    with open(log, "a") as f:
        f.write(json.dumps({"tool": tool, "input": inp, "cwd": os.environ.get("HOOK_CWD"), "roots": roots, "ok": ok}) + "\n")
if ok:
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
          "permissionDecision": "allow", "permissionDecisionReason": why}}))
PY
exit 0
