#!/usr/bin/env node
// hyperui diagram helpers around Archify (the engine; see scripts/archify.sh). Archify validates
// and renders; this script only adds what hyperui needs on top of its IR. Node >= 20, ESM, no
// dependencies beyond node: modules. Output is deterministic.
//
//   node scripts/diagram-check.mjs mermaid <archify-ir.json> [--out <dir>]   write <name>.mmd (flowchart LR,
//                                   sequenceDiagram or stateDiagram-v2) for architecture | workflow | sequence |
//                                   dataflow | lifecycle; other types print "no Mermaid export for <type>"
//   node scripts/diagram-check.mjs migrate <v1.json> <out.json>              hyperui v1 architecture IR -> Archify IR
//   node scripts/diagram-check.mjs --self-test
//
// Sections: mermaid | migrate | archify | cli | self-test

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, '..');
const FIXTURES = path.join(HERE, 'fixtures');
const MERMAID_TYPES = ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle'];

// ---- mermaid
const mmId = (id) => String(id).replace(/[^A-Za-z0-9_]/g, '_');
const mmLabel = (s) => String(s).replace(/"/g, '#quot;');
const slug = (s, i) => mmId(String(s || `group${i}`).toLowerCase().trim().replace(/\s+/g, '_')) || `group${i}`;
const shape = (type, label) => {
  const l = `"${mmLabel(label)}"`;
  switch (type) {
    case 'database': return `[(${l})]`;
    case 'external': return `([${l}])`;
    case 'messagebus': return `[[${l}]]`;
    default: return `[${l}]`;
  }
};
const edgeOp = (variant) => variant === 'emphasis' ? '==>' : variant === 'dashed' ? '-.->' : '-->';
const edgeLine = (e) => `  ${mmId(e.from)} ${edgeOp(e.variant)}${e.label ? `|"${mmLabel(e.label)}"|` : ''} ${mmId(e.to)}`;

// flowchart with one subgraph per group; `groups` = [{ id, label, members: [node] }]. A node sits in the first
// group that wraps it, smallest group first (Mermaid has no overlapping subgraphs); an emptied group is dropped.
function flowchart(nodes, groups, edges) {
  const lines = ['flowchart LR'];
  const grouped = new Set();
  for (const g of groups) {
    if (!g.members.length) continue;
    lines.push(`  subgraph ${g.id} ["${mmLabel(g.label)}"]`);
    for (const n of g.members) { lines.push(`    ${mmId(n.id)}${shape(n.type, n.label)}`); grouped.add(n.id); }
    lines.push('  end');
  }
  for (const n of nodes) if (!grouped.has(n.id)) lines.push(`  ${mmId(n.id)}${shape(n.type, n.label)}`);
  for (const e of edges) lines.push(edgeLine(e));
  return `${lines.join('\n')}\n`;
}

export function toMermaid(doc) {
  const t = doc.diagram_type;
  if (!MERMAID_TYPES.includes(t)) return null;
  if (t === 'architecture') {
    const byId = new Map((doc.components || []).map((c) => [c.id, c]));
    const taken = new Set(); const placed = new Set();
    // smallest boundary first, so a security group nested in a region keeps its own members
    const ordered = (doc.boundaries || []).map((b, i) => ({ b, i })).sort((p, q) => (p.b.wraps || []).length - (q.b.wraps || []).length || p.i - q.i);
    const groups = ordered.map(({ b, i }) => {
      let id = slug(b.label, i); while (taken.has(id)) id = `${id}_${i}`; taken.add(id);
      const members = (b.wraps || []).map((w) => byId.get(w)).filter((n) => n && !placed.has(n.id) && placed.add(n.id));
      return { id, label: b.label, members };
    });
    return flowchart(doc.components || [], groups, doc.connections || []);
  }
  if (t === 'workflow') {
    const groups = (doc.lanes || []).map((l, i) => ({ id: slug(l.id || l.label, i), label: l.label || l.id, members: (doc.nodes || []).filter((n) => n.lane === l.id) }));
    return flowchart(doc.nodes || [], groups, doc.edges || []);
  }
  if (t === 'dataflow') {
    const groups = (doc.stages || []).map((s, i) => ({ id: slug(s.label, i), label: s.label || `Stage ${i + 1}`, members: (doc.nodes || []).filter((n) => n.stage === i) }));
    return flowchart(doc.nodes || [], groups, doc.flows || []);
  }
  if (t === 'sequence') {
    const lines = ['sequenceDiagram'];
    for (const p of doc.participants || []) lines.push(`  ${p.type === 'external' ? 'actor' : 'participant'} ${mmId(p.id)} as ${p.label}`);
    const messages = [...(doc.messages || [])].sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
    for (const m of messages) {
      const arrow = m.variant === 'return' ? '-->>' : m.variant === 'dashed' ? '-)' : '->>';
      lines.push(`  ${mmId(m.from)}${arrow}${mmId(m.to)}: ${m.label || ''}`.trimEnd());
      if (m.note) lines.push(`  Note over ${mmId(m.from)},${mmId(m.to)}: ${m.note}`);
    }
    return `${lines.join('\n')}\n`;
  }
  // lifecycle
  const lines = ['stateDiagram-v2'];
  const states = doc.states || [];
  for (const s of states) lines.push(`  ${mmId(s.id)}: ${s.label}`);
  for (const s of states) if (s.type === 'start') lines.push(`  [*] --> ${mmId(s.id)}`);
  for (const tr of doc.transitions || []) lines.push(`  ${mmId(tr.from)} --> ${mmId(tr.to)}${tr.label ? `: ${tr.label}` : ''}`);
  for (const s of states) if (s.type === 'success' || s.type === 'failure') lines.push(`  ${mmId(s.id)} --> [*]`);
  return `${lines.join('\n')}\n`;
}

// ---- migrate (hyperui v1 architecture IR -> Archify architecture IR)
// row/col -> pos (x = 40 + col*230, y = 60 + row*140), size [130, 60]; actor -> external;
// groups -> boundaries (kind region); edges -> connections with ids; v1 geometry (w/h, sides, via) is dropped.
export const V1_GRID = { x0: 40, y0: 60, colPitch: 230, rowPitch: 140, size: [130, 60] };
export function migrateV1(doc, outputName) {
  if (!doc || doc.schema_version !== 1 || !doc.diagram_type || !Array.isArray(doc.nodes)) throw new Error('not a hyperui v1 IR (schema_version 1, diagram_type and nodes[] expected)');
  if (doc.diagram_type !== 'architecture') throw new Error(`v1 ${doc.diagram_type}: no migration — re-author in Archify IR (see the type router in Archify's SKILL.md)`);
  const meta = { title: String(doc.meta?.title || 'Untitled'), output: outputName };
  if (doc.meta?.description) meta.subtitle = String(doc.meta.description);
  meta.locale = String(doc.meta?.lang || 'en');
  meta.quality_profile = 'showcase';
  const out = { schema_version: 1, diagram_type: 'architecture', meta, components: [], boundaries: [], connections: [] };
  for (const n of doc.nodes) {
    const c = { id: n.id, type: n.type === 'actor' ? 'external' : n.type, label: n.label };
    if (n.sublabel) c.sublabel = n.sublabel;
    c.pos = [V1_GRID.x0 + (n.col || 0) * V1_GRID.colPitch, V1_GRID.y0 + (n.row || 0) * V1_GRID.rowPitch];
    c.size = [...V1_GRID.size];
    out.components.push(c);
  }
  for (const g of doc.groups || []) out.boundaries.push({ kind: 'region', label: g.label || g.id, wraps: [...(g.wraps || [])] });
  if (!out.boundaries.length) delete out.boundaries;
  const ids = new Set();
  for (const e of doc.edges || []) {
    let id = `${e.from}-${e.to}`; let k = 2;
    while (ids.has(id)) id = `${e.from}-${e.to}-${k++}`;
    ids.add(id);
    const c = { id, from: e.from, to: e.to };
    if (e.label) c.label = e.label;
    c.variant = e.variant === 'return' ? 'dashed' : (e.variant || 'default');
    out.connections.push(c);
  }
  return out;
}

// ---- archify (the self-test uses the engine when it is installed; nothing else here calls it)
export function archifyRoot() {
  const r = spawnSync('bash', [path.join(HERE, 'archify.sh'), 'locate'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}
export function archifyValidate(root, type, file) {
  const r = spawnSync('node', [path.join(root, 'bin', 'archify.mjs'), 'validate', type, file], { encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` };
}

// ---- cli
const USAGE = `usage:
  diagram-check.mjs mermaid <archify-ir.json> [--out <dir>]
  diagram-check.mjs migrate <v1.json> <out.json>
  diagram-check.mjs --self-test
`;
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function readDoc(file) {
  try { return readJson(file); }
  catch (e) { process.stderr.write(`cannot read ${file}: ${e.message}\n`); process.exit(2); }
}
function main(argv) {
  if (argv.includes('--self-test')) process.exit(selfTest());
  const [cmd, file, ...rest] = argv;
  if (!cmd || cmd === '--help' || cmd === '-h') { process.stdout.write(USAGE); process.exit(cmd ? 0 : 2); }
  if (!file) { process.stderr.write(USAGE); process.exit(2); }
  const abs = path.resolve(file);
  if (cmd === 'mermaid') {
    let outDir = path.dirname(abs);
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--out') outDir = path.resolve(rest[++i] || '.');
      else if (rest[i].startsWith('--out=')) outDir = path.resolve(rest[i].slice(6));
      else { process.stderr.write(`unknown option ${rest[i]}\n${USAGE}`); process.exit(2); }
    }
    const doc = readDoc(abs);
    const mmd = toMermaid(doc);
    if (mmd === null) { process.stdout.write(`no Mermaid export for ${doc.diagram_type || 'this type'} (supported: ${MERMAID_TYPES.join(', ')})\n`); process.exit(0); }
    fs.mkdirSync(outDir, { recursive: true });
    const p = path.join(outDir, `${path.basename(abs).replace(/\.json$/i, '')}.mmd`);
    fs.writeFileSync(p, mmd);
    process.stdout.write(`wrote ${p}\n`);
    process.exit(0);
  }
  if (cmd === 'migrate') {
    const outFile = rest[0] ? path.resolve(rest[0]) : null;
    if (!outFile) { process.stderr.write(USAGE); process.exit(2); }
    let out;
    try { out = migrateV1(readDoc(abs), `${path.basename(outFile).replace(/\.json$/i, '')}.html`); }
    catch (e) { process.stderr.write(`migrate: ${e.message}\n`); process.exit(2); }
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`);
    process.stdout.write(`wrote ${outFile} (${out.components.length} components, ${out.connections.length} connections, ${(out.boundaries || []).length} boundaries) — next: archify.sh run validate architecture ${outFile}\n`);
    process.exit(0);
  }
  process.stderr.write(`unknown command ${cmd}\n${USAGE}`);
  process.exit(2);
}

// ---- self-test
export function selfTest() {
  const results = [];
  const test = (name, fn) => {
    try { fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, error: e && e.message ? e.message : String(e) }); }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
  const count = (text, re) => (text.match(re) || []).length;
  const root = archifyRoot();
  const example = (file, fixture) => {
    const p = root ? path.join(root, 'examples', file) : null;
    return p && fs.existsSync(p) ? readJson(p) : fixture;
  };
  const inline = {
    architecture: { schema_version: 1, diagram_type: 'architecture', meta: { title: 'F', output: 'f.html' }, components: [{ id: 'a', type: 'external', label: 'A' }, { id: 'b', type: 'backend', label: 'B' }, { id: 'c', type: 'database', label: 'C' }], boundaries: [{ kind: 'region', label: 'Cloud', wraps: ['b', 'c'] }], connections: [{ id: 'a-b', from: 'a', to: 'b', label: 'HTTPS', variant: 'emphasis' }, { id: 'b-c', from: 'b', to: 'c', variant: 'dashed' }] },
    workflow: { schema_version: 2, diagram_type: 'workflow', meta: { title: 'F', output: 'f.html' }, lanes: [{ id: 'l1', label: 'Lane 1' }, { id: 'l2', label: 'Lane 2' }], nodes: [{ id: 'a', lane: 'l1', col: 0, type: 'frontend', label: 'A' }, { id: 'b', lane: 'l2', col: 1, type: 'backend', label: 'B' }], edges: [{ id: 'a-b', from: 'a', to: 'b', label: 'go' }] },
    sequence: { schema_version: 1, diagram_type: 'sequence', meta: { title: 'F', output: 'f.html' }, participants: [{ id: 'u', type: 'external', label: 'User' }, { id: 'a', type: 'backend', label: 'API' }], messages: [{ id: 'm2', from: 'a', to: 'u', y: 200, label: '200 OK', variant: 'return' }, { id: 'm1', from: 'u', to: 'a', y: 100, label: 'GET /x', note: 'cold' }] },
    dataflow: { schema_version: 1, diagram_type: 'dataflow', meta: { title: 'F', output: 'f.html' }, stages: [{ label: 'Sources' }, { label: 'Store' }], nodes: [{ id: 'w', type: 'frontend', label: 'Web', stage: 0, row: 0 }, { id: 'd', type: 'database', label: 'DB', stage: 1, row: 0 }], flows: [{ id: 'w-d', from: 'w', to: 'd', label: 'events', variant: 'emphasis' }] },
    lifecycle: { schema_version: 3, diagram_type: 'lifecycle', meta: { title: 'F', output: 'f.html' }, states: [{ id: 's', type: 'start', label: 'Start' }, { id: 'r', type: 'active', label: 'Run' }, { id: 'd', type: 'success', label: 'Done' }], transitions: [{ id: 't1', from: 's', to: 'r', label: 'go' }, { id: 't2', from: 'r', to: 'd' }] },
  };
  const docs = {
    architecture: example('web-app.architecture.json', inline.architecture),
    workflow: example('agent-tool-call.workflow.json', inline.workflow),
    sequence: example('cache-miss-request.sequence.json', inline.sequence),
    dataflow: example('product-analytics.dataflow.json', inline.dataflow),
    lifecycle: example('deployment-release.lifecycle.json', inline.lifecycle),
  };
  const src = root ? "Archify's examples" : 'inline fixtures';
  const EDGE = /(-->|==>|-\.->)/g;

  test(`mermaid architecture (${src}): flowchart LR, one edge per connection, one subgraph per boundary`, () => {
    const d = docs.architecture; const m = toMermaid(d);
    assert(m.startsWith('flowchart LR\n'), 'header');
    const seen = new Set();
    const exclusive = [...(d.boundaries || [])].sort((p, q) => p.wraps.length - q.wraps.length).filter((b) => b.wraps.some((w) => !seen.has(w) && seen.add(w))).length;
    assert(count(m, /^  subgraph /gm) === exclusive, `subgraphs: ${count(m, /^  subgraph /gm)} vs ${exclusive} boundaries with exclusive members`);
    assert(count(m, EDGE) === (d.connections || []).length, 'edges');
    for (const c of d.components) assert(m.includes(mmId(c.id)), `node ${c.id}`);
  });
  test(`mermaid workflow (${src}): one subgraph per lane, one edge per edge`, () => {
    const d = docs.workflow; const m = toMermaid(d);
    assert(m.startsWith('flowchart LR\n'), 'header');
    assert(count(m, /^  subgraph /gm) === (d.lanes || []).filter((l) => d.nodes.some((n) => n.lane === l.id)).length, 'lanes');
    assert(count(m, EDGE) === (d.edges || []).length, 'edges');
  });
  test(`mermaid sequence (${src}): participants, messages in y order, return arrows`, () => {
    const d = docs.sequence; const m = toMermaid(d);
    assert(m.startsWith('sequenceDiagram\n'), 'header');
    assert(count(m, /^  (participant|actor) /gm) === d.participants.length, 'participants');
    assert(count(m, /^  \w+(->>|-->>|-\))\w+: /gm) === d.messages.length, 'messages');
    const first = [...d.messages].sort((a, b) => (a.y ?? 0) - (b.y ?? 0))[0];
    assert(m.split('\n').find((l) => /^  \w+(->>|-->>|-\))/.test(l)).startsWith(`  ${mmId(first.from)}`), 'y order');
    if (d.messages.some((x) => x.variant === 'return')) assert(m.includes('-->>'), 'return arrow');
  });
  test(`mermaid dataflow (${src}): one subgraph per stage, one edge per flow`, () => {
    const d = docs.dataflow; const m = toMermaid(d);
    assert(m.startsWith('flowchart LR\n'), 'header');
    assert(count(m, /^  subgraph /gm) === d.stages.filter((s, i) => d.nodes.some((n) => n.stage === i)).length, 'stages');
    assert(count(m, EDGE) === (d.flows || []).length, 'flows');
  });
  test(`mermaid lifecycle (${src}): stateDiagram-v2, start/terminal markers, one line per transition`, () => {
    const d = docs.lifecycle; const m = toMermaid(d);
    assert(m.startsWith('stateDiagram-v2\n'), 'header');
    assert(count(m, /^  \[\*\] --> /gm) === d.states.filter((s) => s.type === 'start').length, 'start markers');
    assert(count(m, /^  \w+ --> \[\*\]$/gm) === d.states.filter((s) => s.type === 'success' || s.type === 'failure').length, 'terminal markers');
    assert(count(m, /^  \w+ --> \w+/gm) === d.transitions.length, 'transitions');
  });
  test('mermaid: unsupported types (erd, tree, class, timeline, waterfall, explainer) return null', () => {
    for (const t of ['erd', 'tree', 'class', 'timeline', 'waterfall', 'explainer']) assert(toMermaid({ diagram_type: t }) === null, t);
  });
  test('mermaid: labels with quotes are escaped and ids with dashes are made safe', () => {
    const m = toMermaid({ diagram_type: 'architecture', components: [{ id: 'web-app', type: 'frontend', label: 'Web "shop"' }], connections: [] });
    assert(m.includes('web_app["Web #quot;shop#quot;"]'), m);
  });

  const v1 = readJson(path.join(FIXTURES, 'web-shop.v1.json'));
  const expected = readJson(path.join(FIXTURES, 'web-shop.architecture.json'));
  test('migrate: v1 web-shop -> Archify IR (pos formula, actor->external, boundaries, connection ids, meta)', () => {
    const out = migrateV1(v1, 'web-shop.architecture.html');
    assert(out.meta.output === 'web-shop.architecture.html' && out.meta.locale === 'en' && out.meta.title === v1.meta.title, 'meta');
    assert(out.components.length === v1.nodes.length && out.connections.length === v1.edges.length, 'counts');
    const visitor = out.components.find((c) => c.id === 'visitor');
    assert(visitor.type === 'external', 'actor -> external');
    assert(visitor.pos[0] === 40 + 0 * 230 && visitor.pos[1] === 60 + 1 * 140, `pos ${visitor.pos}`);
    const email = out.components.find((c) => c.id === 'email');
    assert(email.pos[0] === 40 + 3 * 230 && email.pos[1] === 60 + 3 * 140 && email.size[0] === 130 && email.size[1] === 60, 'pos/size');
    assert(out.boundaries.length === 1 && out.boundaries[0].kind === 'region' && out.boundaries[0].wraps.length === 5, 'boundaries');
    assert(new Set(out.connections.map((c) => c.id)).size === out.connections.length, 'unique ids');
    assert(out.connections.every((c) => ['default', 'emphasis', 'security', 'dashed'].includes(c.variant)), 'variants');
    assert(!JSON.stringify(out).includes('"row"') && !JSON.stringify(out).includes('"col"'), 'no row/col left');
  });
  test('migrate: equals the committed fixture except for its two label repairs', () => {
    const out = migrateV1(v1, 'web-shop.architecture.html');
    const strip = (d) => ({ ...d, connections: d.connections.map(({ labelDy, labelAt, ...c }) => c) });
    assert(JSON.stringify(strip(out)) === JSON.stringify(strip(expected)), 'structure differs from scripts/fixtures/web-shop.architecture.json');
    assert(expected.connections.filter((c) => c.labelDy !== undefined || c.labelAt !== undefined).length <= 2, 'fixture has more than 2 label repairs');
  });
  test('migrate: v1 types other than architecture are refused with "re-author in Archify IR"', () => {
    let msg = '';
    try { migrateV1({ schema_version: 1, diagram_type: 'flow', meta: { title: 'x' }, nodes: [] }, 'x.html'); } catch (e) { msg = e.message; }
    assert(/re-author in Archify IR/.test(msg), msg);
  });
  test('cli: mermaid writes <name>.mmd next to the IR (or under --out); migrate writes the Archify IR, exits 2 otherwise', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hyperui-diagram-'));
    const self = fileURLToPath(import.meta.url);
    try {
      const ir = path.join(tmp, 'x.json'); fs.writeFileSync(ir, JSON.stringify(inline.architecture));
      let r = spawnSync('node', [self, 'mermaid', ir], { encoding: 'utf8' });
      assert(r.status === 0 && fs.existsSync(path.join(tmp, 'x.mmd')), `mermaid: ${r.stdout}${r.stderr}`);
      r = spawnSync('node', [self, 'mermaid', ir, '--out', path.join(tmp, 'o')], { encoding: 'utf8' });
      assert(r.status === 0 && fs.existsSync(path.join(tmp, 'o', 'x.mmd')), '--out');
      fs.writeFileSync(path.join(tmp, 'erd.json'), JSON.stringify({ diagram_type: 'erd' }));
      r = spawnSync('node', [self, 'mermaid', path.join(tmp, 'erd.json')], { encoding: 'utf8' });
      assert(r.status === 0 && /no Mermaid export for erd/.test(r.stdout), r.stdout);
      r = spawnSync('node', [self, 'migrate', path.join(FIXTURES, 'web-shop.v1.json'), path.join(tmp, 'm', 'shop.json')], { encoding: 'utf8' });
      assert(r.status === 0 && readJson(path.join(tmp, 'm', 'shop.json')).meta.output === 'shop.html', `migrate: ${r.stdout}${r.stderr}`);
      r = spawnSync('node', [self, 'migrate', path.join(tmp, 'erd.json'), path.join(tmp, 'no.json')], { encoding: 'utf8' });
      assert(r.status === 2, 'non-v1 input exits 2');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
  if (root) {
    test('archify: the committed migration fixture validates with 0 errors', () => {
      const r = archifyValidate(root, 'architecture', path.join(FIXTURES, 'web-shop.architecture.json'));
      assert(r.ok, r.out.split('\n').slice(0, 6).join(' | '));
    });
  } else {
    results.push({ name: 'archify: fixture validation skipped (Archify not installed; run scripts/archify.sh ensure)', ok: true });
  }
  const dogfood = path.join(PLUGIN_ROOT, '.hyperui', 'diagrams', 'hyperui-architecture.json');
  if (fs.existsSync(dogfood)) {
    test('dogfood: .hyperui/diagrams/hyperui-architecture.json is Archify IR and exports one edge per connection', () => {
      const d = readJson(dogfood);
      assert(d.diagram_type === 'architecture' && Array.isArray(d.components) && Array.isArray(d.connections) && d.meta?.output, 'Archify shape (components/connections/meta.output)');
      const m = toMermaid(d);
      assert(count(m, EDGE) === d.connections.length && count(m, /^  subgraph /gm) === (d.boundaries || []).length, 'edges/subgraphs');
    });
  }

  const failed = results.filter((r) => !r.ok);
  for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : ` — ${r.error}`}`);
  console.log(`self-test: ${results.length - failed.length} passed, ${failed.length} failed`);
  return failed.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
