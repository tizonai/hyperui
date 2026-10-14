#!/usr/bin/env node
// hyperui — one-command installer/updater for the hyperui Claude Code plugin.
// Zero dependencies. Node >= 20.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const MARKETPLACE = 'tizonai';
const MARKETPLACE_SOURCE = 'tizonai/hyperui';
const PLUGIN = `hyperui@${MARKETPLACE}`;
const CLAUDE_INSTALL_URL = 'https://code.claude.com/docs/en/quickstart';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));

const log = (msg = '') => console.log(`[hyperui] ${msg}`);
const err = (msg) => console.error(`[hyperui] ERROR: ${msg}`);

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('-')));
const command = args.find((a) => !a.startsWith('-')) ?? 'install';
const dryRun = flags.has('--dry-run');

function help() {
  console.log(`hyperui ${pkg.version} — installer for the hyperui Claude Code plugin

Usage: npx @tizonai/hyperui [command] [options]

Commands:
  install      Add the ${MARKETPLACE} marketplace and install ${PLUGIN} (default)
               Re-running it updates both instead.
  update       Update the ${MARKETPLACE} marketplace, then ${PLUGIN} (restart Claude Code after)
  doctor       Show Claude Code, plugin, Node, Python and OS status
  uninstall    Uninstall ${PLUGIN}, then ask before removing the ${MARKETPLACE} marketplace

Options:
  --dry-run    Print the claude commands instead of running them (install, update, uninstall)
  -v, --version  Print the version
  -h, --help   Show this help

Docs: ${pkg.homepage}`);
}

function hasClaude() {
  const r = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}

function requireClaude() {
  if (hasClaude()) return;
  err('the `claude` command (Claude Code) was not found on your PATH.');
  log(`Install Claude Code first: ${CLAUDE_INSTALL_URL}`);
  log('Then run `npx @tizonai/hyperui install` again.');
  process.exit(1);
}

// Read-only query; returns stdout (or null if it failed).
function query(cmdArgs) {
  const r = spawnSync('claude', cmdArgs, { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return r.stdout;
}

function marketplacePresent() {
  const json = query(['plugin', 'marketplace', 'list', '--json']);
  if (json !== null) {
    try {
      return JSON.parse(json).some((m) => m.name === MARKETPLACE);
    } catch { /* fall through to text */ }
  }
  const text = query(['plugin', 'marketplace', 'list']) ?? '';
  return new RegExp(`\\b${MARKETPLACE}\\b`).test(text);
}

function pluginInfo() {
  const json = query(['plugin', 'list', '--json']);
  if (json !== null) {
    try {
      return JSON.parse(json).find((p) => p.id === PLUGIN) ?? null;
    } catch { /* fall through to text */ }
  }
  const text = query(['plugin', 'list']) ?? '';
  return text.includes(PLUGIN) ? { id: PLUGIN } : null;
}

// Mutating command: inherits stdio, never swallows a failure.
function run(cmdArgs) {
  const line = `claude ${cmdArgs.join(' ')}`;
  if (dryRun) {
    log(`(dry-run) ${line}`);
    return;
  }
  log(`$ ${line}`);
  const r = spawnSync('claude', cmdArgs, { stdio: 'inherit' });
  if (r.error) {
    err(`could not run \`${line}\`: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) {
    err(`\`${line}\` failed (exit ${r.status ?? r.signal}).`);
    process.exit(r.status || 1);
  }
}

function install() {
  requireClaude();
  if (marketplacePresent()) {
    log(`Marketplace "${MARKETPLACE}" already added — updating it.`);
    run(['plugin', 'marketplace', 'update', MARKETPLACE]);
  } else {
    run(['plugin', 'marketplace', 'add', MARKETPLACE_SOURCE]);
  }
  const installed = pluginInfo();
  if (installed) {
    log(`${PLUGIN} already installed${installed.version ? ` (${installed.version})` : ''} — updating it.`);
    run(['plugin', 'update', PLUGIN]);
  } else {
    run(['plugin', 'install', PLUGIN]);
  }
  log(dryRun ? 'Dry run finished — nothing was changed.' : 'Done.');
  log('');
  log('Next steps:');
  log('  1. Restart Claude Code (quit and open it again) so the plugin loads.');
  log('  2. Open your project folder and start `claude` there.');
  log('  3. Run `/hyperui:setup` once per project.');
  log('  4. Type `/hyperui <what you want to build>` — e.g. `/hyperui a landing page for my bakery`.');
}

// update = marketplace update, then plugin update. Not installed yet -> install does the right thing.
function update() {
  requireClaude();
  if (!dryRun && (!marketplacePresent() || !pluginInfo())) {
    log(`${PLUGIN} is not installed yet — running install instead.`);
    return install();
  }
  run(['plugin', 'marketplace', 'update', MARKETPLACE]);
  run(['plugin', 'update', PLUGIN]);
  log(dryRun ? 'Dry run finished — nothing was changed.' : 'Updated. Restart Claude Code (quit and open it again) to load the new version.');
}

async function uninstall() {
  requireClaude();
  if (pluginInfo() || dryRun) {
    run(['plugin', 'uninstall', PLUGIN]);
  } else {
    log(`${PLUGIN} is not installed — skipping plugin uninstall.`);
  }
  if (!marketplacePresent() && !dryRun) {
    log(`Marketplace "${MARKETPLACE}" is not configured — nothing else to remove.`);
    return;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let answer = '';
  try {
    answer = await rl.question(`[hyperui] Also remove the "${MARKETPLACE}" marketplace? [y/N] `);
  } finally {
    rl.close();
  }
  if (/^y(es)?$/i.test(answer.trim())) {
    run(['plugin', 'marketplace', 'remove', MARKETPLACE]);
  } else {
    log(`Kept the "${MARKETPLACE}" marketplace.`);
  }
  log('Done. Restart Claude Code to apply.');
}

function versionOf(cmd, cmdArgs = ['--version']) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
  if (r.error || r.status !== 0) return 'not found';
  return (r.stdout || r.stderr).trim().split('\n')[0];
}

function doctor() {
  log(`hyperui CLI ${pkg.version}`);
  log(`OS:        ${os.type()} ${os.release()} (${process.platform}/${process.arch})`);
  log(`Node:      ${process.version}`);
  log(`python3:   ${versionOf('python3')}`);
  const claude = versionOf('claude');
  log(`claude:    ${claude}`);
  if (claude === 'not found') {
    log(`Install Claude Code: ${CLAUDE_INSTALL_URL}`);
    return;
  }
  log(`marketplace "${MARKETPLACE}": ${marketplacePresent() ? 'present' : 'missing'}`);
  const p = pluginInfo();
  if (p) {
    const state = p.enabled === false ? 'disabled' : p.enabled === true ? 'enabled' : 'installed';
    log(`plugin ${PLUGIN}: ${state}${p.version ? ` (${p.version})` : ''}`);
  } else {
    log(`plugin ${PLUGIN}: missing — run \`npx @tizonai/hyperui install\``);
  }
}

async function main() {
  if (flags.has('--help') || flags.has('-h')) return help();
  if (flags.has('--version') || flags.has('-v')) return console.log(pkg.version);
  switch (command) {
    case 'install': return install();
    case 'update': return update();
    case 'doctor': return doctor();
    case 'uninstall': return uninstall();
    default:
      err(`unknown command "${command ?? args.join(' ')}".`);
      help();
      process.exit(1);
  }
}

main().catch((e) => {
  err(e?.stack || String(e));
  process.exit(1);
});
