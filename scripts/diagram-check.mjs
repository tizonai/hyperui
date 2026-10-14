#!/usr/bin/env node
// hyperui diagram toolchain: validate, route, render and export the diagram IR
// (skills/diagram/schema.json). Node >= 20, ESM, no dependencies beyond node: modules.
//
//   node scripts/diagram-check.mjs validate <ir.json> [--json]
//   node scripts/diagram-check.mjs render   <ir.json> [--out <dir>] [--svg]
//   node scripts/diagram-check.mjs mermaid  <ir.json> [--out <dir>]
//   node scripts/diagram-check.mjs from-mermaid <file.mmd> [--out <dir>] [--type <diagram_type>]
//   node scripts/diagram-check.mjs --self-test
//
// Sections: schema | layout | geometry | router | checks | render | mermaid | diagnostics | cli | self-test
// Method: docs/research/archify-diagram-method.md. Helpers marked "Adapted from archify" are MIT
// (skills/diagram/LICENSE-archify, NOTICE). Output is deterministic: the same IR gives the same bytes.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, '..');
const SCHEMA_PATH = path.join(PLUGIN_ROOT, 'skills', 'diagram', 'schema.json');
const TEMPLATE_PATH = path.join(PLUGIN_ROOT, 'templates', 'diagram', 'viewer.html');
const EXAMPLES_DIR = path.join(PLUGIN_ROOT, 'skills', 'diagram', 'references', 'examples');

const FONT = { label: 13, labelMin: 11, sublabel: 10, edge: 11, groupTitle: 12, step: 9 };
const GROUP_TITLE_H = 22;
const MIN_NODE_GAP = 8;        // px between node boxes
const EDGE_CLEARANCE = 2;      // px an edge must keep from a node it does not touch
const PORT_PITCH = 14;         // px between spread ports on one side
const PORT_GUTTER = 16;        // px kept free at each corner of a side
const LABEL_H = 16;            // px height of an edge label mask
const READABLE_WIDTH = 1440;   // px reader width the projected-text check assumes
const MIN_PROJECTED_FONT = 6;  // px
const NODE_BUDGET = 12;        // primary nodes per view before the budget warning
const SEQ = { PW: 120, PH: 44, PITCH: 170, X0: 40, Y0: 40, MSG_PITCH: 40, SELF_W: 36 };
const STRUCTURAL_KEYS = ['nodes', 'groups', 'edges', 'layout', 'mainPath', 'participants', 'messages', 'states', 'transitions'];
const TYPE_NAMES = {
  en: { frontend: 'Frontend', backend: 'Backend', database: 'Database', cloud: 'Cloud', security: 'Security', messagebus: 'Message bus', external: 'External', actor: 'Actor',
    start: 'Start', active: 'Active', waiting: 'Waiting', decision: 'Decision', success: 'Success', failure: 'Failure',
    emphasis: 'Main path', dashed: 'Async / event', security_edge: 'Security', return: 'Return' },
  es: { frontend: 'Frontend', backend: 'Backend', database: 'Base de datos', cloud: 'Nube', security: 'Seguridad', messagebus: 'Bus de mensajes', external: 'Externo', actor: 'Actor',
    start: 'Inicio', active: 'Activo', waiting: 'En espera', decision: 'Decisión', success: 'Éxito', failure: 'Fallo',
    emphasis: 'Camino principal', dashed: 'Asíncrono / evento', security_edge: 'Seguridad', return: 'Retorno' },
};
const STRINGS = {
  en: { up: 'Upstream', down: 'Downstream', clear: 'Clear focus', png: 'PNG', svg: 'SVG', dark: 'Dark mode', light: 'Light mode',
    hint: 'Click or focus a node to highlight its neighbours · Esc clears', in: 'Incoming', out: 'Outgoing',
    noIr: 'The embedded diagram data could not be read; the drawing is static.' },
  es: { up: 'Aguas arriba', down: 'Aguas abajo', clear: 'Quitar foco', png: 'PNG', svg: 'SVG', dark: 'Modo oscuro', light: 'Modo claro',
    hint: 'Haz clic o enfoca un nodo para resaltar sus vecinos · Esc lo quita', in: 'Entrantes', out: 'Salientes',
    noIr: 'No se pudo leer el JSON embebido; el dibujo es estático.' },
};

// ---- schema
let SCHEMA_CACHE = null;
export function loadSchema() {
  if (!SCHEMA_CACHE) SCHEMA_CACHE = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return SCHEMA_CACHE;
}
function defaults() { return loadSchema()['x-defaults']; }
function resolveRef(schema, sub) {
  if (sub && sub.$ref) { const name = sub.$ref.replace('#/$defs/', ''); return { ...schema.$defs[name], 'x-ref': name }; }
  return sub;
}
function describe(v) { return Array.isArray(v) ? 'an array' : v === null ? 'null' : typeof v === 'object' ? 'an object' : `${typeof v} ${JSON.stringify(v)}`; }
function pathLabel(segs) { return segs.length ? segs.map((s, i) => (s.startsWith('[') || i === 0 ? s : `.${s}`)).join('') : 'document'; }
const emptySubject = () => ({ collection: null, index: null, id: null, from: null, to: null });
function subjectOf(collection, index, el) {
  const o = el && typeof el === 'object' ? el : {};
  return { collection, index, id: typeof o.id === 'string' ? o.id : null, from: typeof o.from === 'string' ? o.from : null, to: typeof o.to === 'string' ? o.to : null };
}

function checkValue(schema, sub, value, ctx, out) {
  sub = resolveRef(schema, sub);
  const where = pathLabel(ctx.path);
  const err = (code, text, fixes) => out.push(diag(code, 'error', text, ctx.subject, {}, fixes));
  if (sub.type) {
    const t = sub.type;
    const ok = t === 'object' ? (value !== null && typeof value === 'object' && !Array.isArray(value))
      : t === 'array' ? Array.isArray(value)
        : t === 'integer' ? Number.isInteger(value)
          : t === 'number' ? (typeof value === 'number' && Number.isFinite(value))
            : t === 'string' ? typeof value === 'string'
              : t === 'boolean' ? typeof value === 'boolean' : true;
    if (!ok) { err('schema/type', `${where} must be ${t === 'integer' ? 'an integer' : `a ${t}`}, got ${describe(value)}`, [`set ${where} to ${t === 'integer' ? 'an integer' : `a ${t}`}`]); return; }
  }
  if (sub.enum && !sub.enum.includes(value)) { err('schema/enum', `${where} ${JSON.stringify(value)} is not allowed`, [`choose one of [${sub.enum.join(', ')}]`]); return; }
  if (typeof value === 'string') {
    if (sub.pattern && !new RegExp(sub.pattern).test(value)) {
      if (sub['x-ref'] === 'id') err('schema/id-pattern', `${where} "${value}" is not a valid id`, [`use an id matching ${sub.pattern} (a letter first, then letters, digits, _ or -)`]);
      else err('schema/pattern', `${where} "${value}" does not match ${sub.pattern}`, [`use a value matching ${sub.pattern}`]);
    }
    if (sub.minLength !== undefined && value.length < sub.minLength) err('schema/range', `${where} must have at least ${sub.minLength} character(s)`, [`fill in ${where}`]);
    if (sub.maxLength !== undefined && value.length > sub.maxLength) err('schema/range', `${where} has ${value.length} characters (max ${sub.maxLength})`, [`shorten ${where} to ${sub.maxLength} characters`]);
  }
  if (typeof value === 'number') {
    if (sub.minimum !== undefined && value < sub.minimum) err('schema/range', `${where} ${value} is below the minimum ${sub.minimum}`, [`set ${where} to at least ${sub.minimum}`]);
    if (sub.maximum !== undefined && value > sub.maximum) err('schema/range', `${where} ${value} is above the maximum ${sub.maximum}`, [`set ${where} to at most ${sub.maximum}`]);
  }
  if (Array.isArray(value)) {
    if (sub.minItems !== undefined && value.length < sub.minItems) err('schema/range', `${where} needs at least ${sub.minItems} item(s)`, [`add items to ${where}`]);
    if (sub.maxItems !== undefined && value.length > sub.maxItems) err('schema/range', `${where} has ${value.length} items (max ${sub.maxItems})`, [`split the diagram (meta.related) so ${where} has at most ${sub.maxItems} items`]);
    if (sub.items) {
      value.forEach((item, i) => {
        const top = ctx.path.length === 1;
        const subject = top ? subjectOf(ctx.path[0], i, item) : ctx.subject;
        checkValue(schema, sub.items, item, { path: [...ctx.path, `[${i}]`], subject }, out);
      });
    }
  }
  if (sub.type === 'object' && value && typeof value === 'object') {
    const props = sub.properties || {};
    for (const key of Object.keys(value)) {
      if (!(key in props)) err('schema/unknown-property', `${where} has unsupported property "${key}"`, [`remove unsupported property "${key}" from ${where}`]);
    }
    for (const req of sub.required || []) if (!(req in value)) err('schema/missing-property', `${where} lacks required property "${req}"`, [`add "${req}" to ${where}`]);
    for (const key of Object.keys(value)) if (key in props) checkValue(schema, props[key], value[key], { ...ctx, path: [...ctx.path, key] }, out);
  }
}

function crossChecks(schema, doc, out) {
  const byType = schema['x-by-type'][doc.diagram_type];
  for (const k of STRUCTURAL_KEYS) {
    if (k in doc && !byType.allowed.includes(k)) {
      const others = Object.keys(schema['x-by-type']).filter((t) => schema['x-by-type'][t].allowed.includes(k));
      out.push(diag('schema/diagram-type', 'error', `"${k}" does not belong to a ${doc.diagram_type} diagram`, emptySubject(), {}, [`remove "${k}" or set diagram_type to one of [${others.join(', ')}]`]));
    }
  }
  for (const k of byType.required) if (!(k in doc)) out.push(diag('schema/diagram-type', 'error', `a ${doc.diagram_type} diagram requires "${k}"`, emptySubject(), {}, [`add "${k}" to the document`]));
  const seen = new Map();
  for (const c of ['nodes', 'states', 'groups', 'participants']) {
    (doc[c] || []).forEach((el, i) => {
      if (seen.has(el.id)) out.push(diag('schema/duplicate-id', 'error', `id "${el.id}" is already used by ${seen.get(el.id)}`, subjectOf(c, i, el), {}, [`rename "${el.id}" in ${c}[${i}] (ids are unique across nodes, states, groups and participants)`]));
      else seen.set(el.id, `${c}[${i}]`);
    });
  }
  const relSeen = new Map();
  for (const c of ['edges', 'transitions', 'messages']) {
    (doc[c] || []).forEach((el, i) => {
      if (typeof el.id !== 'string') return;
      if (relSeen.has(el.id)) out.push(diag('schema/duplicate-id', 'error', `relationship id "${el.id}" is already used by ${relSeen.get(el.id)}`, subjectOf(c, i, el), {}, [`rename "${el.id}" in ${c}[${i}]`]));
      else relSeen.set(el.id, `${c}[${i}]`);
    });
  }
  const elementIds = new Set([...(doc.nodes || []), ...(doc.states || []), ...(doc.participants || [])].map((n) => n.id));
  for (const c of ['edges', 'transitions', 'messages']) {
    (doc[c] || []).forEach((e, i) => {
      for (const end of ['from', 'to']) {
        if (!elementIds.has(e[end])) out.push(diag('schema/unknown-endpoint', 'error', `${end} "${e[end]}" does not exist`, subjectOf(c, i, e), {}, [`point ${end} at an existing id or add an element "${e[end]}"`]));
      }
      if (e.from === e.to && c !== 'messages' && elementIds.has(e.from)) out.push(diag('schema/self-loop', 'error', `self-loops are not supported in v1`, subjectOf(c, i, e), {}, [`remove the ${c.slice(0, -1)} "${e.from}" -> "${e.to}" or model it as a note in the label of another edge`]));
    });
  }
  (doc.groups || []).forEach((g, i) => {
    for (const id of g.wraps) if (!elementIds.has(id)) out.push(diag('schema/unknown-endpoint', 'error', `wraps "${id}" which does not exist`, subjectOf('groups', i, g), {}, [`remove "${id}" from wraps or add that node`]));
  });
  (doc.mainPath || []).forEach((id, i) => {
    if (!elementIds.has(id)) out.push(diag('schema/unknown-endpoint', 'error', `mainPath[${i}] "${id}" does not exist`, { collection: 'mainPath', index: i, id, from: null, to: null }, {}, [`remove "${id}" from mainPath or add that node`]));
  });
}

export function validateDocument(doc) {
  const schema = loadSchema();
  const diagnostics = [];
  checkValue(schema, schema, doc, { path: [], subject: emptySubject() }, diagnostics);
  if (diagnostics.length === 0) crossChecks(schema, doc, diagnostics);
  if (diagnostics.some((d) => d.severity === 'error')) return { diagnostics, model: null };
  const model = buildModel(doc);
  runChecks(model, diagnostics);
  return { diagnostics, model };
}

// ---- layout
function rectOf(n) { return { x: n.x, y: n.y, w: n.w, h: n.h }; }
function inflate(r, d) { return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d }; }
const opposite = (a, b) => (a === 'left' && b === 'right') || (a === 'right' && b === 'left') || (a === 'top' && b === 'bottom') || (a === 'bottom' && b === 'top');
const isHorizontalSide = (s) => s === 'left' || s === 'right';
const outward = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

function buildModel(doc) {
  if (doc.diagram_type === 'sequence') return buildSequenceModel(doc);
  const D = defaults();
  const L = { ...D.layout, ...(doc.layout || {}) };
  const life = doc.diagram_type === 'lifecycle';
  const rawNodes = life ? doc.states : doc.nodes;
  const rawEdges = (life ? doc.transitions : doc.edges) || [];
  const nodes = rawNodes.map((n, i) => {
    const w = n.w ?? L.cellW, h = n.h ?? L.cellH;
    const x = L.origin[0] + n.col * (L.cellW + L.gapX), y = L.origin[1] + n.row * (L.cellH + L.gapY);
    return { ...n, index: i, type: life ? 'state' : n.type, stateType: life ? n.type : null, step: life ? String(i + 1).padStart(2, '0') : null, x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const groups = (doc.groups || []).map((g, i) => {
    const members = g.wraps.map((id) => byId.get(id)).filter(Boolean);
    const pad = g.pad ?? D['group.pad'];
    const x0 = Math.min(...members.map((m) => m.x)) - pad, y0 = Math.min(...members.map((m) => m.y)) - pad - GROUP_TITLE_H;
    const x1 = Math.max(...members.map((m) => m.x + m.w)) + pad, y1 = Math.max(...members.map((m) => m.y + m.h)) + pad;
    const titleBox = { x: x0 + pad, y: y0 + 4, w: round2(minimumNodeTextWidth(g.label, FONT.groupTitle)), h: GROUP_TITLE_H - 4 };
    return { ...g, index: i, members, pad, x: x0, y: y0, w: x1 - x0, h: y1 - y0, titleBox };
  });
  const mainPairs = new Set();
  if (doc.diagram_type === 'flow' && doc.mainPath) for (let i = 1; i < doc.mainPath.length; i++) mainPairs.add(`${doc.mainPath[i - 1]}->${doc.mainPath[i]}`);
  const edges = rawEdges.map((e, i) => ({
    ...e, index: i, collection: life ? 'transitions' : 'edges',
    variant: e.variant || (mainPairs.has(`${e.from}->${e.to}`) ? 'emphasis' : 'default'),
    fromNode: byId.get(e.from), toNode: byId.get(e.to),
  }));
  assignSides(edges);
  assignPorts(nodes, edges);
  const maxRight = Math.max(...nodes.map((n) => n.x + n.w), ...groups.map((g) => g.x + g.w));
  const maxBottom = Math.max(...nodes.map((n) => n.y + n.h), ...groups.map((g) => g.y + g.h));
  const viewBox = { w: Math.ceil(maxRight + L.origin[0]), h: Math.ceil(maxBottom + 40) };
  for (const e of edges) e.points = routeEdge(e, nodes, viewBox);
  const labelObstacles = [...nodes.map(rectOf), ...groups.map((g) => g.titleBox)];
  for (const e of edges) e.labelBox = e.label ? placeLabel(e, labelObstacles) : null;
  return { kind: 'grid', type: doc.diagram_type, doc, L, nodes, groups, edges, byId, viewBox };
}

function buildSequenceModel(doc) {
  const participants = doc.participants.map((p, i) => {
    const x = SEQ.X0 + i * SEQ.PITCH;
    return { ...p, index: i, x, y: SEQ.Y0, w: SEQ.PW, h: SEQ.PH, cx: x + SEQ.PW / 2, cy: SEQ.Y0 + SEQ.PH / 2 };
  });
  const byId = new Map(participants.map((p) => [p.id, p]));
  const msg0 = SEQ.Y0 + SEQ.PH + 40;
  const messages = doc.messages.map((m, i) => {
    const f = byId.get(m.from), t = byId.get(m.to);
    return { ...m, index: i, collection: 'messages', y: msg0 + i * SEQ.MSG_PITCH, x1: f.cx, x2: t.cx, self: f === t, variant: m.variant || 'default' };
  });
  const viewBox = { w: SEQ.X0 * 2 + (participants.length - 1) * SEQ.PITCH + SEQ.PW, h: msg0 + messages.length * SEQ.MSG_PITCH + 24 };
  return { kind: 'sequence', type: 'sequence', doc, participants, messages, nodes: participants, groups: [], edges: [], byId, viewBox };
}

function assignSides(edges) {
  for (const e of edges) {
    const f = e.fromNode, t = e.toNode;
    const dx = t.cx - f.cx, dy = t.cy - f.cy, horiz = Math.abs(dx) >= Math.abs(dy);
    const autoFrom = horiz ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
    const autoTo = horiz ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
    e.fromSidePinned = Boolean(e.fromSide); e.toSidePinned = Boolean(e.toSide);
    e.fromSide = e.fromSide || autoFrom; e.toSide = e.toSide || autoTo;
  }
}

// Adapted from archify archify/renderers/shared/geometry.mjs@bb990b1 (MIT) — automaticPortSpread:
// ports start at the side midpoint; shared sides spread symmetrically (14 px pitch, 16 px corner gutter).
// hyperui addition: an edge aligned with its partner keeps the midpoint so straight edges stay straight.
function assignPorts(nodes, edges) {
  const bySide = new Map();
  for (const e of edges) {
    for (const end of ['from', 'to']) {
      const node = end === 'from' ? e.fromNode : e.toNode, side = end === 'from' ? e.fromSide : e.toSide;
      const key = `${node.id}|${side}`;
      if (!bySide.has(key)) bySide.set(key, { node, side, items: [] });
      bySide.get(key).items.push({ edge: e, end });
    }
  }
  for (const { node, side, items } of bySide.values()) {
    const axisY = isHorizontalSide(side);
    const center = axisY ? node.cy : node.cx;
    for (const it of items) {
      const other = it.end === 'from' ? it.edge.toNode : it.edge.fromNode;
      const otherSide = it.end === 'from' ? it.edge.toSide : it.edge.fromSide;
      it.other = axisY ? other.cy : other.cx;
      it.aligned = Math.abs(it.other - center) < 0.5 && opposite(side, otherSide);
      it.dir = it.aligned ? 0 : (Math.sign(it.other - center) || (it.end === 'from' ? 1 : -1));
    }
    items.sort((a, b) => a.dir - b.dir || a.other - b.other || a.edge.index - b.edge.index);
    const negs = items.filter((i) => i.dir < 0), zeros = items.filter((i) => i.dir === 0), poss = items.filter((i) => i.dir > 0);
    if (zeros.length) {
      zeros.forEach((it, i) => { it.offset = (i - (zeros.length - 1) / 2) * PORT_PITCH; });
      const lo = zeros[0].offset, hi = zeros[zeros.length - 1].offset;
      negs.forEach((it, k) => { it.offset = lo - (negs.length - k) * PORT_PITCH; });
      poss.forEach((it, k) => { it.offset = hi + (k + 1) * PORT_PITCH; });
    } else {
      items.forEach((it, i) => { it.offset = (i - (items.length - 1) / 2) * PORT_PITCH; });
    }
    const half = Math.max(0, (axisY ? node.h : node.w) / 2 - PORT_GUTTER);
    for (const it of items) {
      const off = Math.max(-half, Math.min(half, it.offset));
      const port = axisY
        ? [side === 'left' ? node.x : node.x + node.w, node.cy + off]
        : [node.cx + off, side === 'top' ? node.y : node.y + node.h];
      if (it.end === 'from') { it.edge.fromPort = port; it.edge.fromOffset = off; } else { it.edge.toPort = port; it.edge.toOffset = off; }
    }
  }
}

// ---- geometry
// Adapted from archify archify/renderers/shared/geometry.mjs@bb990b1 (MIT)
export function rectsOverlap(a, b, gap = 0) {
  return !(a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x || a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y);
}
// Clear distance between two rects (negative when they overlap).
export function rectsGap(a, b) {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  if (dx < 0 && dy < 0) return Math.max(dx, dy);
  return Math.max(dx, dy, 0) === 0 ? 0 : Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}
// Adapted from archify archify/renderers/shared/geometry.mjs@bb990b1 (MIT) — Liang–Barsky clip.
export function segmentIntersectsRect(p, q, r) {
  let t0 = 0, t1 = 1;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const checks = [[-dx, p[0] - r.x], [dx, r.x + r.w - p[0]], [-dy, p[1] - r.y], [dy, r.y + r.h - p[1]]];
  for (const [pk, qk] of checks) {
    if (pk === 0) { if (qk < 0) return false; continue; }
    const t = qk / pk;
    if (pk < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t0 <= t1;
}
// Adapted from archify archify/renderers/shared/geometry.mjs@bb990b1 (MIT) — strict X crossing, no touches.
export function properSegmentIntersection(p1, p2, p3, p4) {
  const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const o1 = o(p1, p2, p3), o2 = o(p1, p2, p4), o3 = o(p3, p4, p1), o4 = o(p3, p4, p2);
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0 || o1 === o2 || o3 === o4) return null;
  const d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
  const t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / d;
  return [round2(p1[0] + t * (p2[0] - p1[0])), round2(p1[1] + t * (p2[1] - p1[1]))];
}
// Adapted from archify archify/renderers/shared/geometry.mjs@bb990b1 (MIT) — distance from an
// axis-aligned segment to a rect (0 when they touch or cross).
export function segmentRectClearance(p, q, r) {
  const minX = Math.min(p[0], q[0]), maxX = Math.max(p[0], q[0]), minY = Math.min(p[1], q[1]), maxY = Math.max(p[1], q[1]);
  const dx = Math.max(r.x - maxX, minX - (r.x + r.w), 0), dy = Math.max(r.y - maxY, minY - (r.y + r.h), 0);
  return round2(Math.hypot(dx, dy));
}
// Adapted from archify archify/renderers/shared/utils.mjs@bb990b1 (MIT) — CJK characters count 2.
export function textUnits(s) {
  let u = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    u += (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xac00 && c <= 0xd7af) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef) ? 2 : 1;
  }
  return u;
}
// Adapted from archify archify/renderers/shared/text-fit.mjs@bb990b1 (MIT)
export function minimumNodeTextWidth(label, font) { return 0.6 * font * textUnits(label) + 8; }
// Adapted from archify archify/renderers/shared/text-fit.mjs@bb990b1 (MIT) — largest font in [min, max] that fits.
export function fittedFontSize(label, width, max = FONT.label, min = FONT.labelMin) {
  for (let f = max; f >= min; f--) if (minimumNodeTextWidth(label, f) <= width) return f;
  return null;
}
export const sublabelWidth = (s) => 5.4 * textUnits(s) + 8;
export const labelMaskWidth = (s) => 6.5 * textUnits(s) + 13;
export const labelGapRequired = (s) => 6.5 * textUnits(s) + 21;
const round2 = (v) => Math.round(v * 100) / 100;
const segLength = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const samePoint = (a, b) => a[0] === b[0] && a[1] === b[1];
function segmentsOf(pts) { const s = []; for (let i = 1; i < pts.length; i++) s.push([pts[i - 1], pts[i]]); return s; }
function simplify(pts) {
  const out = [];
  for (const p of pts) if (!out.length || !samePoint(out[out.length - 1], p)) out.push(p);
  for (let i = 1; i < out.length - 1;) {
    const a = out[i - 1], b = out[i], c = out[i + 1];
    if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) out.splice(i, 1); else i++;
  }
  return out;
}

// ---- router
function routeEdge(e, nodes, viewBox) {
  const others = nodes.filter((n) => n !== e.fromNode && n !== e.toNode).map(rectOf);
  const p0 = e.fromPort, p1 = e.toPort;
  if (e.via) return viaRoute(e);
  const clean = (pts) => segmentsOf(pts).every(([a, b]) => others.every((r) => segmentRectClearance(a, b, r) > EDGE_CLEARANCE));
  const candidates = [];
  const straight = straightRoute(e); if (straight) candidates.push(straight);
  const l = lRoute(e); if (l) candidates.push(l);
  const z = zRoute(e); if (z) candidates.push(z);
  for (const c of candidates) if (clean(c)) return c;
  const d = dijkstraRoute(e, nodes, viewBox);
  if (d) return d;
  return candidates[0] || [p0, p1];
}
function leaves(side, from, to) { const [ox, oy] = outward[side]; return ox ? Math.sign(to[0] - from[0]) === ox && to[1] === from[1] : Math.sign(to[1] - from[1]) === oy && to[0] === from[0]; }
function straightRoute(e) {
  const p0 = e.fromPort, p1 = e.toPort;
  if (!opposite(e.fromSide, e.toSide)) return null;
  if (isHorizontalSide(e.fromSide) ? p0[1] !== p1[1] : p0[0] !== p1[0]) return null;
  return leaves(e.fromSide, p0, p1) ? [p0, p1] : null;
}
function lRoute(e) {
  const p0 = e.fromPort, p1 = e.toPort;
  let corner;
  if (isHorizontalSide(e.fromSide) && !isHorizontalSide(e.toSide)) corner = [p1[0], p0[1]];
  else if (!isHorizontalSide(e.fromSide) && isHorizontalSide(e.toSide)) corner = [p0[0], p1[1]];
  else return null;
  if (segLength(p0, corner) < MIN_NODE_GAP || segLength(corner, p1) < MIN_NODE_GAP) return null;
  if (!leaves(e.fromSide, p0, corner) || !leaves(e.toSide, p1, corner)) return null;
  return [p0, corner, p1];
}
// Two-bend routes. The middle line sits in the gap between the two boxes, pulled towards the source by
// half the port offsets: in a fan-out the edge leaving the port farthest from the centre turns first, so
// fan-out (and, mirrored, fan-in) edges never cross each other and never share a line.
function zRoute(e) {
  const p0 = e.fromPort, p1 = e.toPort, f = e.fromNode, t = e.toNode;
  const pull = (Math.abs(e.fromOffset || 0) + Math.abs(e.toOffset || 0)) / 2;
  const dir = e.fromSide === 'right' || e.fromSide === 'bottom' ? 1 : -1;
  const h = isHorizontalSide(e.fromSide);
  if (h !== isHorizontalSide(e.toSide)) return null;
  let pts;
  if (opposite(e.fromSide, e.toSide)) {
    if (h) {
      if (p0[1] === p1[1]) return null;
      const mid = round2((e.fromSide === 'right' ? (f.x + f.w + t.x) / 2 : (t.x + t.w + f.x) / 2) - dir * pull);
      pts = [p0, [mid, p0[1]], [mid, p1[1]], p1];
    } else {
      if (p0[0] === p1[0]) return null;
      const mid = round2((e.fromSide === 'bottom' ? (f.y + f.h + t.y) / 2 : (t.y + t.h + f.y) / 2) - dir * pull);
      pts = [p0, [p0[0], mid], [p1[0], mid], p1];
    }
  } else {
    const bridge = 24 + pull;
    if (h) {
      if (p0[1] === p1[1]) return null;
      const bx = e.fromSide === 'right' ? Math.max(f.x + f.w, t.x + t.w) + bridge : Math.min(f.x, t.x) - bridge;
      pts = [p0, [bx, p0[1]], [bx, p1[1]], p1];
    } else {
      if (p0[0] === p1[0]) return null;
      const by = e.fromSide === 'bottom' ? Math.max(f.y + f.h, t.y + t.h) + bridge : Math.min(f.y, t.y) - bridge;
      pts = [p0, [p0[0], by], [p1[0], by], p1];
    }
  }
  if (!leaves(e.fromSide, pts[0], pts[1]) || !leaves(e.toSide, pts[3], pts[2])) return null;
  if (segmentsOf(pts).some(([a, b]) => segLength(a, b) < MIN_NODE_GAP)) return null;
  return pts;
}
function viaRoute(e) {
  const pts = [e.fromPort];
  let cur = e.fromPort, horizontalFirst = isHorizontalSide(e.fromSide);
  for (const v of e.via) {
    if (cur[0] !== v[0] && cur[1] !== v[1]) {
      const corner = horizontalFirst ? [v[0], cur[1]] : [cur[0], v[1]];
      pts.push(corner);
      horizontalFirst = corner[1] !== v[1] ? true : false;
      if (corner[0] === v[0]) horizontalFirst = true; else horizontalFirst = false;
    } else {
      horizontalFirst = cur[1] === v[1] ? false : true;
    }
    pts.push(v); cur = v;
  }
  const p1 = e.toPort;
  if (isHorizontalSide(e.toSide)) { if (cur[1] !== p1[1]) pts.push([cur[0], p1[1]]); }
  else if (cur[0] !== p1[0]) pts.push([p1[0], cur[1]]);
  pts.push(p1);
  return simplify(pts);
}
function dijkstraRoute(e, nodes, viewBox) {
  const INF = 4;
  const p0 = e.fromPort, p1 = e.toPort;
  const stub = (p, side) => [p[0] + outward[side][0] * PORT_GUTTER, p[1] + outward[side][1] * PORT_GUTTER];
  const s0 = stub(p0, e.fromSide), s1 = stub(p1, e.toSide);
  const rects = nodes.map((n) => inflate(rectOf(n), INF));
  const xs = new Set([s0[0], s1[0]]), ys = new Set([s0[1], s1[1]]);
  for (const n of nodes) { xs.add(n.x - 12); xs.add(n.x + n.w + 12); ys.add(n.y - 12); ys.add(n.y + n.h + 12); }
  const X = [...xs].filter((v) => v >= 8 && v <= viewBox.w - 8 || v === s0[0] || v === s1[0]).sort((a, b) => a - b);
  const Y = [...ys].filter((v) => v >= 8 && v <= viewBox.h - 8 || v === s0[1] || v === s1[1]).sort((a, b) => a - b);
  const blocked = (x, y) => rects.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  const clear = (a, b) => rects.every((r) => !segmentIntersectsRect(a, b, r));
  const key = (i, j, d) => (i * Y.length + j) * 2 + d;
  const i0 = X.indexOf(s0[0]), j0 = Y.indexOf(s0[1]), i1 = X.indexOf(s1[0]), j1 = Y.indexOf(s1[1]);
  if (i0 < 0 || j0 < 0 || i1 < 0 || j1 < 0) return null;
  const startDir = isHorizontalSide(e.fromSide) ? 0 : 1, endDir = isHorizontalSide(e.toSide) ? 0 : 1;
  const dist = new Map(), prev = new Map();
  const heap = [];
  const push = (c, i, j, d) => { heap.push([c, i, j, d]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  dist.set(key(i0, j0, startDir), 0); push(0, i0, j0, startDir);
  let found = null;
  while (heap.length) {
    const [c, i, j, d] = pop();
    const k = key(i, j, d);
    if (dist.get(k) !== c) continue;
    if (i === i1 && j === j1 && d === endDir) { found = k; break; }
    const moves = [[1, 0, 0], [-1, 0, 0], [0, 1, 1], [0, -1, 1]];
    for (const [di, dj, nd] of moves) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= X.length || nj >= Y.length) continue;
      const a = [X[i], Y[j]], b = [X[ni], Y[nj]];
      if (blocked(b[0], b[1]) || !clear(a, b)) continue;
      const nc = c + segLength(a, b) + (nd !== d ? 40 : 0);
      const nk = key(ni, nj, nd);
      if (!dist.has(nk) || nc < dist.get(nk)) { dist.set(nk, nc); prev.set(nk, k); push(nc, ni, nj, nd); }
    }
  }
  if (found === null) return null;
  const pts = [];
  for (let k = found; k !== undefined; k = prev.get(k)) { const cell = Math.floor(k / 2); pts.push([X[Math.floor(cell / Y.length)], Y[cell % Y.length]]); }
  pts.reverse();
  return simplify([p0, ...pts, p1]);
}
// The label sits on the longest segment: centred on a horizontal one, beside a vertical one. Without an
// authored labelAt it tries a few positions along the segment and keeps the first that touches no node
// and no group title; the check still reports what remains.
function placeLabel(e, obstacles = []) {
  const segs = segmentsOf(e.points);
  let best = 0;
  for (let i = 1; i < segs.length; i++) if (segLength(...segs[i]) > segLength(...segs[best])) best = i;
  const [a, b] = segs[best], horizontal = a[1] === b[1], w = labelMaskWidth(e.label);
  const at = (t) => {
    const mx = round2(a[0] + (b[0] - a[0]) * t), my = round2(a[1] + (b[1] - a[1]) * t);
    const box = horizontal ? { x: mx - w / 2, y: my - LABEL_H / 2, w, h: LABEL_H } : { x: mx + 6, y: my - LABEL_H / 2, w, h: LABEL_H };
    return { ...box, horizontal, segIndex: best, segLen: segLength(a, b), textX: round2(box.x + w / 2), textY: my, t };
  };
  const candidates = e.labelAt !== undefined ? [e.labelAt] : [0.5, 0.38, 0.62, 0.26, 0.74];
  for (const t of candidates) { const box = at(t); if (!obstacles.some((r) => rectsOverlap(box, r))) return box; }
  return at(candidates[0]);
}

// ---- checks
function runChecks(m, out) {
  if (m.kind === 'sequence') { runSequenceChecks(m, out); return; }
  const { nodes, groups, edges, L } = m;
  const coll = m.type === 'lifecycle' ? 'states' : 'nodes';
  const nodeSubject = (n) => ({ collection: coll, index: n.index, id: n.id, from: null, to: null });
  const edgeSubject = (e) => ({ collection: e.collection, index: e.index, id: e.id ?? null, from: e.from, to: e.to });
  const groupSubject = (g) => ({ collection: 'groups', index: g.index, id: g.id, from: null, to: null });
  const edgeName = (e) => `${e.from} -> ${e.to}`;
  // 2. cells
  const cells = new Map();
  for (const n of nodes) {
    const k = `${n.row},${n.col}`;
    if (cells.has(k)) out.push(diag('layout/cell-collision', 'error', `"${n.id}" shares row ${n.row} col ${n.col} with "${cells.get(k).id}"`, nodeSubject(n), { points: [[n.row, n.col]] }, [`move "${n.id}" to a free cell (row ${n.row} col ${n.col + 1} or row ${n.row + 1} col ${n.col})`]));
    else cells.set(k, n);
    if (n.col >= L.cols) out.push(diag('layout/out-of-grid', 'error', `col ${n.col} is outside layout.cols = ${L.cols}`, nodeSubject(n), { px: n.col - L.cols + 1 }, [`move "${n.id}" to col <= ${L.cols - 1}`, `raise layout.cols to ${n.col + 1}`]));
  }
  // 3. overlaps
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    if (a.row === b.row && a.col === b.col) continue;
    const gap = round2(rectsGap(rectOf(a), rectOf(b)));
    if (gap < MIN_NODE_GAP) out.push(diag('layout/node-overlap', 'error', `"${a.id}" and "${b.id}" are ${gap} px apart (min ${MIN_NODE_GAP})`, nodeSubject(b), { px: gap, bounds: rectOf(b) }, [`separate "${b.id}" from "${a.id}" by ${round2(MIN_NODE_GAP - gap)} px (another cell, or a smaller w/h)`]));
  }
  for (const g of groups) for (const n of nodes) {
    if (g.members.includes(n)) continue;
    if (rectsOverlap(g, rectOf(n))) out.push(diag('layout/node-overlap', 'error', `group "${g.id}" overlaps "${n.id}", which it does not wrap`, groupSubject(g), { px: 0, bounds: rectOf(n) }, [`move "${n.id}" outside "${g.id}" (another row or col)`, `add "${n.id}" to wraps of "${g.id}"`]));
  }
  // 4. text fit
  for (const n of nodes) {
    const f = fittedFontSize(n.label, n.w);
    n.labelFont = f || FONT.labelMin;
    if (!f) {
      const required = round2(minimumNodeTextWidth(n.label, FONT.labelMin));
      out.push(diag('layout/text-fit', 'error', `label "${n.label}" needs ${required} px, box is ${n.w} px`, nodeSubject(n), { px: { required, available: n.w }, bounds: rectOf(n) }, [`widen to ${Math.ceil(required)} px or shorten label`]));
    }
    if (n.sublabel) {
      const required = round2(sublabelWidth(n.sublabel));
      if (required > n.w) out.push(diag('layout/text-fit', 'error', `sublabel "${n.sublabel}" needs ${required} px, box is ${n.w} px`, nodeSubject(n), { px: { required, available: n.w }, bounds: rectOf(n) }, [`widen to ${Math.ceil(required)} px or shorten sublabel`]));
    }
  }
  for (const g of groups) {
    const required = round2(minimumNodeTextWidth(g.label, FONT.groupTitle) + 2 * g.pad);
    if (required > g.w) out.push(diag('layout/text-fit', 'error', `group title "${g.label}" needs ${required} px, frame is ${g.w} px`, groupSubject(g), { px: { required, available: g.w }, bounds: { x: g.x, y: g.y, w: g.w, h: g.h } }, [`shorten the group label or wrap a wider set of nodes`]));
  }
  // 5. edge through node
  for (const e of edges) {
    for (const [a, b] of segmentsOf(e.points)) {
      for (const n of nodes) {
        if (n === e.fromNode || n === e.toNode) continue;
        const c = segmentRectClearance(a, b, rectOf(n));
        if (c <= EDGE_CLEARANCE) out.push(diag('clean-flow/edge-through-node', 'error', `passes through "${n.id}" (${c} px clearance)`, edgeSubject(e), { px: c, points: [a, b], bounds: rectOf(n) }, [`move "${n.id}" off the ${edgeName(e)} corridor`, `pin fromSide/toSide so ${edgeName(e)} leaves from another side`, `add via points that route around "${n.id}"`]));
      }
    }
  }
  // 6. side direction
  for (const e of edges) {
    const p = e.points;
    if (p.length < 2) continue;
    const first = sideOfDirection(p[0], p[1]), last = sideOfDirection(p[p.length - 1], p[p.length - 2]);
    if (first !== e.fromSide) out.push(diag('clean-flow/endpoint-side-direction', 'error', `leaves "${e.from}" towards the ${first} but fromSide is ${e.fromSide}`, edgeSubject(e), { points: [p[0], p[1]] }, [`change fromSide to ${first}`, `move the first via point so the edge leaves through the ${e.fromSide} side`]));
    if (last !== e.toSide) out.push(diag('clean-flow/endpoint-side-direction', 'error', `enters "${e.to}" through the ${last} side but toSide is ${e.toSide}`, edgeSubject(e), { points: [p[p.length - 2], p[p.length - 1]] }, [`change toSide to ${last}`, `move the last via point so the edge enters through the ${e.toSide} side`]));
  }
  // 7. proper crossings (warning)
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i], b = edges[j];
    if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;
    for (const [p1, p2] of segmentsOf(a.points)) for (const [p3, p4] of segmentsOf(b.points)) {
      const x = properSegmentIntersection(p1, p2, p3, p4);
      if (x) {
        b.crossing = true;
        out.push(diag('composition/proper-crossing', 'warning', `crosses ${edgeName(b)} at [${x[0]}, ${x[1]}]`, edgeSubject(a), { points: [x] }, [`reorder rows or swap cols so ${edgeName(a)} and ${edgeName(b)} do not cross`, `pin a fromSide/toSide to send one edge around`]));
      }
    }
  }
  // 8. labels
  const labelled = edges.filter((e) => e.labelBox);
  for (const e of labelled) {
    const lb = e.labelBox;
    const required = lb.horizontal ? round2(labelGapRequired(e.label)) : LABEL_H + MIN_NODE_GAP;
    if (lb.segLen < required) out.push(diag('composition/label-gap', 'error', `label "${e.label}" needs ${required} px on its segment, which is ${lb.segLen} px`, edgeSubject(e), { px: { required, available: lb.segLen }, points: segmentsOf(e.points)[lb.segIndex] }, [`widen the gap on that segment to ${Math.ceil(required)} px (layout.gapX / gapY, or a wider node)`, `shorten the label`]));
    for (const n of nodes) {
      if (rectsOverlap(lb, rectOf(n))) out.push(diag('composition/label-overlap', 'error', `label "${e.label}" overlaps node "${n.id}"`, edgeSubject(e), { px: 0, bounds: lb }, [`move the label along the edge with labelAt (0..1)`, `move "${n.id}" to another cell`, `shorten the label`]));
    }
    for (const g of groups) {
      if (rectsOverlap(lb, g.titleBox)) out.push(diag('composition/label-overlap', 'error', `label "${e.label}" overlaps the title of group "${g.id}"`, edgeSubject(e), { px: 0, bounds: lb }, [`move the label along the edge with labelAt (0..1)`, `route ${edgeName(e)} away from the top edge of "${g.id}" (pin a side)`, `shorten the label`]));
    }
  }
  for (let i = 0; i < labelled.length; i++) for (let j = i + 1; j < labelled.length; j++) {
    const a = labelled[i], b = labelled[j];
    if (rectsOverlap(a.labelBox, b.labelBox)) out.push(diag('composition/label-overlap', 'error', `label "${a.label}" overlaps label "${b.label}" of ${edgeName(b)}`, edgeSubject(a), { px: 0, bounds: a.labelBox }, [`move one label along its edge with labelAt (0..1)`, `shorten one of the labels`]));
  }
  // 9. canvas
  const inside = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= m.viewBox.w && r.y + r.h <= m.viewBox.h;
  const insidePt = (p) => p[0] >= 0 && p[1] >= 0 && p[0] <= m.viewBox.w && p[1] <= m.viewBox.h;
  for (const n of nodes) if (!inside(rectOf(n))) out.push(diag('layout/out-of-canvas', 'error', `node "${n.id}" is outside the ${m.viewBox.w}x${m.viewBox.h} canvas`, nodeSubject(n), { bounds: rectOf(n) }, [`move "${n.id}" to a lower row/col`]));
  for (const g of groups) if (!inside(g)) out.push(diag('layout/out-of-canvas', 'error', `group "${g.id}" is outside the canvas`, groupSubject(g), { bounds: { x: g.x, y: g.y, w: g.w, h: g.h } }, [`raise layout.origin so the group frame fits`]));
  for (const e of edges) {
    const bad = e.points.find((p) => !insidePt(p));
    if (bad) out.push(diag('layout/out-of-canvas', 'error', `route point [${bad[0]}, ${bad[1]}] is outside the ${m.viewBox.w}x${m.viewBox.h} canvas`, edgeSubject(e), { points: [bad] }, [`move the via point inside the canvas or remove it`]));
    if (e.labelBox && !inside(e.labelBox)) out.push(diag('layout/out-of-canvas', 'error', `label "${e.label}" is outside the canvas`, edgeSubject(e), { bounds: e.labelBox }, [`move the label with labelAt or move the edge`]));
  }
  // 10. projected text
  const fonts = nodes.map((n) => n.labelFont);
  if (nodes.some((n) => n.sublabel)) fonts.push(FONT.sublabel);
  if (labelled.length) fonts.push(FONT.edge);
  const minFont = Math.min(...fonts), scale = Math.min(1, READABLE_WIDTH / m.viewBox.w), projected = round2(minFont * scale);
  if (projected < MIN_PROJECTED_FONT) out.push(diag('readability/projected-text', 'error', `the smallest text projects to ${projected} px at ${READABLE_WIDTH} px wide (min ${MIN_PROJECTED_FONT})`, emptySubject(), { px: { projected, canvas: m.viewBox.w } }, [`split the diagram into related views (meta.related)`, `use fewer columns or smaller gaps so the canvas is at most ${Math.floor(READABLE_WIDTH * minFont / MIN_PROJECTED_FONT)} px wide`]));
  // 11. budget
  if (nodes.length > NODE_BUDGET) out.push(diag('budget/too-many-nodes', 'warning', `${nodes.length} primary nodes in one view (guide: 8–${NODE_BUDGET})`, emptySubject(), { px: nodes.length }, [`split into related diagrams (meta.related) with at most ${NODE_BUDGET} nodes each`]));
}
function sideOfDirection(from, to) {
  if (to[0] > from[0]) return 'right'; if (to[0] < from[0]) return 'left'; if (to[1] > from[1]) return 'bottom'; return 'top';
}
function runSequenceChecks(m, out) {
  for (const p of m.participants) {
    const subject = { collection: 'participants', index: p.index, id: p.id, from: null, to: null };
    const f = fittedFontSize(p.label, p.w); p.labelFont = f || FONT.labelMin;
    if (!f) { const required = round2(minimumNodeTextWidth(p.label, FONT.labelMin)); out.push(diag('layout/text-fit', 'error', `label "${p.label}" needs ${required} px, box is ${p.w} px`, subject, { px: { required, available: p.w }, bounds: rectOf(p) }, [`shorten label to ${Math.floor((p.w - 8) / (0.6 * FONT.labelMin))} characters`])); }
    if (p.sublabel && sublabelWidth(p.sublabel) > p.w) out.push(diag('layout/text-fit', 'error', `sublabel "${p.sublabel}" does not fit ${p.w} px`, subject, { px: { required: round2(sublabelWidth(p.sublabel)), available: p.w }, bounds: rectOf(p) }, [`shorten sublabel`]));
  }
  for (const msg of m.messages) {
    if (msg.self) continue;
    const available = Math.abs(msg.x2 - msg.x1), required = round2(labelGapRequired(msg.label));
    if (available < required) out.push(diag('composition/label-gap', 'error', `message "${msg.label}" needs ${required} px between lifelines, has ${available} px`, { collection: 'messages', index: msg.index, id: msg.id ?? null, from: msg.from, to: msg.to }, { px: { required, available }, points: [[msg.x1, msg.y], [msg.x2, msg.y]] }, [`shorten the message label`, `reorder participants so "${msg.from}" and "${msg.to}" are further apart`]));
  }
}

// ---- render
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v) => String(round2(v));
function pathD(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${fmt(pts[0][0])} ${fmt(pts[0][1])} L${fmt(pts[1][0])} ${fmt(pts[1][1])}`;
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], p = pts[i], b = pts[i + 1];
    const r = Math.min(8, segLength(a, p) / 2, segLength(p, b) / 2);
    const toward = (from, to, dist) => { const len = segLength(from, to) || 1; return [from[0] + (to[0] - from[0]) / len * dist, from[1] + (to[1] - from[1]) / len * dist]; };
    const inPt = toward(p, a, r), outPt = toward(p, b, r);
    d += ` L${fmt(inPt[0])} ${fmt(inPt[1])} Q${fmt(p[0])} ${fmt(p[1])} ${fmt(outPt[0])} ${fmt(outPt[1])}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${fmt(last[0])} ${fmt(last[1])}`;
}
function markerDefs() {
  const variants = ['default', 'emphasis', 'security', 'dashed', 'return'];
  return variants.map((v) => `<marker id="ah-${v}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${v === 'emphasis' ? 10 : 8}" markerHeight="${v === 'emphasis' ? 10 : 8}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path class="ah ah-${v}" d="${v === 'return' ? 'M1 1 L9 5 L1 9' : 'M0 0 L10 5 L0 10 Z'}"/></marker>`).join('');
}
function nodeSvg(n) {
  const cls = n.type === 'state' ? `node n-state s-${n.stateType}` : `node n-${n.type}`;
  const pill = n.type === 'actor' || (n.type === 'state' && ['start', 'success', 'failure'].includes(n.stateType));
  const rx = pill ? n.h / 2 : n.type === 'state' && n.stateType === 'decision' ? 4 : 10;
  const aria = [n.label, n.type === 'state' ? n.stateType : n.type, n.sublabel].filter(Boolean).join(', ');
  const labelY = n.sublabel ? n.cy - 7 : n.cy, subY = n.cy + 9;
  let body = `<rect class="c-mask" x="${fmt(n.x)}" y="${fmt(n.y)}" width="${fmt(n.w)}" height="${fmt(n.h)}" rx="${fmt(rx)}"/>`
    + `<rect class="c-box" x="${fmt(n.x)}" y="${fmt(n.y)}" width="${fmt(n.w)}" height="${fmt(n.h)}" rx="${fmt(rx)}"/>`;
  if (n.type === 'database') body += `<path class="c-cap" d="M${fmt(n.x + 10)} ${fmt(n.y + 9)} H${fmt(n.x + n.w - 10)}"/>`;
  if (n.step) body += `<text class="t-step" x="${fmt(n.x + 10)}" y="${fmt(n.y + 11)}">${n.step}</text>`;
  body += `<text class="t-primary" x="${fmt(n.cx)}" y="${fmt(labelY)}" text-anchor="middle" dominant-baseline="central" font-size="${n.labelFont || FONT.label}">${esc(n.label)}</text>`;
  if (n.sublabel) body += `<text class="t-muted" x="${fmt(n.cx)}" y="${fmt(subY)}" text-anchor="middle" dominant-baseline="central">${esc(n.sublabel)}</text>`;
  const sub = n.sublabel ? ` data-node-sublabel="${esc(n.sublabel)}"` : '';
  return `<g class="${cls}" data-node-id="${esc(n.id)}" data-node-type="${esc(n.type === 'state' ? n.stateType : n.type)}" data-node-label="${esc(n.label)}"${sub} tabindex="0" role="button" aria-label="${esc(aria)}">${body}</g>`;
}
function edgeSvg(e) {
  const d = pathD(e.points);
  const points = e.points.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(';');
  const idAttr = e.id ? ` data-edge-id="${esc(e.id)}"` : '';
  const labelAttr = e.label ? ` data-edge-label="${esc(e.label)}"` : '';
  let body = e.crossing ? `<path class="halo" d="${d}"/>` : '';
  body += `<path class="line" d="${d}" marker-end="url(#ah-${e.variant})"/>`;
  if (e.labelBox) {
    const lb = e.labelBox;
    body += `<rect class="label-mask" x="${fmt(lb.x)}" y="${fmt(lb.y)}" width="${fmt(lb.w)}" height="${fmt(lb.h)}" rx="3"/>`
      + `<text class="t-edge" x="${fmt(lb.textX)}" y="${fmt(lb.textY)}" text-anchor="middle" dominant-baseline="central">${esc(e.label)}</text>`;
  }
  return `<g class="edge e-${e.variant}" data-edge-from="${esc(e.from)}" data-edge-to="${esc(e.to)}"${idAttr}${labelAttr} data-points="${points}">${body}</g>`;
}
function groupSvg(g) {
  return `<g class="group g-${g.kind}" data-group-id="${esc(g.id)}"><rect x="${fmt(g.x)}" y="${fmt(g.y)}" width="${fmt(g.w)}" height="${fmt(g.h)}" rx="12"/>`
    + `<text class="t-group" x="${fmt(g.x + g.pad)}" y="${fmt(g.y + 15)}">${esc(g.label)}</text></g>`;
}
function sequenceSvg(m) {
  const bottom = m.viewBox.h - 16;
  let s = '<g class="lifelines">';
  for (const p of m.participants) s += `<line class="lifeline" x1="${fmt(p.cx)}" y1="${fmt(p.y + p.h)}" x2="${fmt(p.cx)}" y2="${fmt(bottom)}"/>`;
  s += '</g><g class="messages">';
  for (const msg of m.messages) {
    const attrs = `data-edge-from="${esc(msg.from)}" data-edge-to="${esc(msg.to)}" data-edge-label="${esc(msg.label)}"${msg.id ? ` data-edge-id="${esc(msg.id)}"` : ''}`;
    if (msg.self) {
      const x = msg.x1, y = msg.y, w = SEQ.SELF_W;
      s += `<g class="msg edge e-${msg.variant}" ${attrs}><path class="line" d="M${fmt(x)} ${fmt(y)} H${fmt(x + w)} V${fmt(y + 16)} H${fmt(x + 4)}" marker-end="url(#ah-${msg.variant})"/>`
        + `<text class="t-edge" x="${fmt(x + w + 6)}" y="${fmt(y + 8)}" dominant-baseline="central">${esc(msg.label)}</text></g>`;
    } else {
      const dir = Math.sign(msg.x2 - msg.x1), x2 = msg.x2 - dir * 2, mid = (msg.x1 + msg.x2) / 2;
      s += `<g class="msg edge e-${msg.variant}" ${attrs}><path class="line" d="M${fmt(msg.x1)} ${fmt(msg.y)} L${fmt(x2)} ${fmt(msg.y)}" marker-end="url(#ah-${msg.variant})"/>`
        + `<text class="t-edge" x="${fmt(mid)}" y="${fmt(msg.y - 7)}" text-anchor="middle" dominant-baseline="central">${esc(msg.label)}</text>`;
      if (msg.note) s += `<text class="t-note" x="${fmt(mid)}" y="${fmt(msg.y + 9)}" text-anchor="middle" dominant-baseline="central">${esc(msg.note)}</text>`;
      s += '</g>';
    }
  }
  s += '</g><g class="nodes">';
  for (const p of m.participants) s += nodeSvg({ ...p, type: p.type, stateType: null, step: null, labelFont: p.labelFont });
  return `${s}</g>`;
}
export function renderSvg(m) {
  const { w: W, h: H } = m.viewBox;
  const title = esc(m.doc.meta.title), desc = esc(m.doc.meta.description || `${m.type} diagram with ${m.nodes.length} elements`);
  let body = '';
  if (m.kind === 'sequence') body = sequenceSvg(m);
  else {
    body = `<g class="groups">${m.groups.map(groupSvg).join('')}</g>`
      + `<g class="edges">${m.edges.map(edgeSvg).join('')}</g>`
      + `<g class="nodes">${m.nodes.map(nodeSvg).join('')}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="diagram" role="img" viewBox="0 0 ${fmt(W)} ${fmt(H)}" width="${fmt(W)}" height="${fmt(H)}" aria-labelledby="dg-title dg-desc" data-diagram-type="${m.type}">`
    + `<title id="dg-title">${title}</title><desc id="dg-desc">${desc}</desc>`
    + `<defs>${markerDefs()}<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path class="grid-line" d="M24 0H0V24"/></pattern></defs>`
    + `<rect class="canvas" x="0" y="0" width="${fmt(W)}" height="${fmt(H)}"/><rect class="grid" x="0" y="0" width="${fmt(W)}" height="${fmt(H)}"/>`
    + `${body}</svg>`;
}
function renderLegend(m) {
  const names = TYPE_NAMES[(m.doc.meta.lang || 'en').split('-')[0]] || TYPE_NAMES.en;
  const types = [], seen = new Set();
  for (const n of m.nodes) { const t = n.type === 'state' ? n.stateType : n.type; if (!seen.has(t)) { seen.add(t); types.push(t); } }
  let html = types.map((t) => `<li><span class="sw sw-${t}" aria-hidden="true"></span>${esc(names[t] || t)}</li>`).join('');
  const rels = m.kind === 'sequence' ? m.messages : m.edges;
  const variants = [], vseen = new Set();
  for (const e of rels) if (e.variant && e.variant !== 'default' && !vseen.has(e.variant)) { vseen.add(e.variant); variants.push(e.variant); }
  html += variants.map((v) => `<li><span class="ln ln-${v}" aria-hidden="true"></span>${esc(names[v === 'security' ? 'security_edge' : v] || v)}</li>`).join('');
  return html;
}
function tokenOverrides(tokens) {
  if (!tokens) return '';
  const decl = [];
  if (tokens.accent) decl.push(`--accent: ${tokens.accent};`);
  if (tokens.font) decl.push(`--font: ${tokens.font.replace(/[^A-Za-z0-9 ,'"-]/g, '')};`);
  return decl.length ? `:root { ${decl.join(' ')} }` : '';
}
export function renderHtml(doc) {
  const result = validateDocument(doc);
  if (result.diagnostics.some((d) => d.severity === 'error')) return null;
  const svg = renderSvg(result.model);
  const legend = renderLegend(result.model);
  const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const lang = doc.meta.lang, strings = STRINGS[lang.split('-')[0]] || STRINGS.en;
  const ir = JSON.stringify(doc, null, 2).replace(/</g, '\\u003c');
  const html = tpl
    .replace('/* HYPERUI:LANG */', () => esc(lang))
    .replace(/\/\* HYPERUI:TITLE \*\//g, () => esc(doc.meta.title))
    .replace(/\/\* HYPERUI:DESCRIPTION \*\//g, () => esc(doc.meta.description || ''))
    .replace('/* HYPERUI:TOKENS */', () => tokenOverrides(doc.meta.tokens))
    .replace('/* HYPERUI:SVG */', () => svg)
    .replace('/* HYPERUI:LEGEND */', () => legend)
    .replace('/* HYPERUI:IR */', () => ir)
    .replace('/* HYPERUI:STRINGS */', () => JSON.stringify(strings));
  return { html, svg, result };
}

// ---- mermaid
const mmId = (id) => id.replace(/-/g, '_');
const mmLabel = (s) => String(s).replace(/"/g, '#quot;');
export function toMermaid(doc) {
  const t = doc.diagram_type;
  if (t === 'sequence') {
    const lines = ['sequenceDiagram'];
    for (const p of doc.participants) lines.push(`  ${p.type === 'actor' ? 'actor' : 'participant'} ${mmId(p.id)} as ${p.label}`);
    doc.messages.forEach((m, i) => {
      const arrow = m.variant === 'return' ? '-->>' : m.variant === 'dashed' ? '-)' : '->>';
      lines.push(`  ${mmId(m.from)}${arrow}${mmId(m.to)}: ${m.label}`);
      if (m.note) lines.push(`  Note over ${mmId(m.from)},${mmId(m.to)}: ${m.note}`);
    });
    return `${lines.join('\n')}\n`;
  }
  if (t === 'lifecycle') {
    const lines = ['stateDiagram-v2'];
    const inLane = new Map();
    for (const g of doc.groups || []) for (const id of g.wraps) inLane.set(id, g);
    for (const s of doc.states) if (!inLane.has(s.id)) lines.push(`  ${mmId(s.id)}: ${s.label}`);
    for (const g of doc.groups || []) {
      lines.push(`  state "${mmLabel(g.label)}" as ${mmId(g.id)} {`);
      for (const s of doc.states) if (inLane.get(s.id) === g) lines.push(`    ${mmId(s.id)}: ${s.label}`);
      lines.push('  }');
    }
    for (const s of doc.states) if (s.type === 'start') lines.push(`  [*] --> ${mmId(s.id)}`);
    for (const tr of doc.transitions) lines.push(`  ${mmId(tr.from)} --> ${mmId(tr.to)}${tr.label ? `: ${tr.label}` : ''}`);
    for (const s of doc.states) if (s.type === 'success' || s.type === 'failure') lines.push(`  ${mmId(s.id)} --> [*]`);
    return `${lines.join('\n')}\n`;
  }
  const lines = ['flowchart LR'];
  const shape = (n) => {
    const l = `"${mmLabel(n.label)}"`;
    switch (n.type) {
      case 'database': return `[(${l})]`;
      case 'actor': return `([${l}])`;
      case 'messagebus': return `[[${l}]]`;
      case 'external': return `>${l}]`;
      default: return `[${l}]`;
    }
  };
  const grouped = new Set();
  for (const g of doc.groups || []) {
    lines.push(`  subgraph ${mmId(g.id)} ["${mmLabel(g.label)}"]`);
    for (const id of g.wraps) { const n = doc.nodes.find((x) => x.id === id); if (n) { lines.push(`    ${mmId(n.id)}${shape(n)}`); grouped.add(id); } }
    lines.push('  end');
  }
  for (const n of doc.nodes) if (!grouped.has(n.id)) lines.push(`  ${mmId(n.id)}${shape(n)}`);
  for (const e of doc.edges || []) {
    const op = e.variant === 'emphasis' ? '==>' : (e.variant === 'dashed' || e.variant === 'return') ? '-.->' : '-->';
    lines.push(`  ${mmId(e.from)} ${op}${e.label ? `|"${mmLabel(e.label)}"|` : ''} ${mmId(e.to)}`);
  }
  return `${lines.join('\n')}\n`;
}
export function fromMermaid(text, type) {
  const src = text.replace(/```mermaid|```/g, '').trim();
  const lines = src.split(/\r?\n/).map((l) => l.replace(/%%.*$/, '').trim()).filter(Boolean);
  const header = lines.shift() || '';
  if (/^sequenceDiagram/.test(header)) return sequenceFromMermaid(lines);
  const doc = { schema_version: 1, diagram_type: type && type !== 'sequence' ? type : 'architecture', meta: { title: 'Untitled (from Mermaid)', lang: 'en' }, nodes: [], edges: [] };
  const groups = [];
  let current = null;
  const nodeRe = /^([A-Za-z][\w-]*)\s*(\[\[.*?\]\]|\[\(.*?\)\]|\(\(.*?\)\)|\(\[.*?\]\)|\[.*?\]|\(.*?\)|\{.*?\}|>.*?\])?$/;
  const typeOf = (shape) => !shape ? 'backend' : shape.startsWith('[(') ? 'database' : shape.startsWith('([') ? 'actor' : shape.startsWith('[[') ? 'messagebus' : shape.startsWith('((') || shape.startsWith('>') ? 'external' : shape.startsWith('{') ? 'security' : 'backend';
  const labelOf = (shape, id) => shape ? shape.replace(/^[[({>]+|[\])}]+$/g, '').replace(/^"|"$/g, '').replace(/#quot;/g, '"') : id;
  const ensure = (token) => {
    const m = nodeRe.exec(token.trim()); if (!m) return null;
    let n = doc.nodes.find((x) => x.id === m[1]);
    if (!n) { n = { id: m[1], type: typeOf(m[2]), label: labelOf(m[2], m[1]), row: 0, col: 0 }; doc.nodes.push(n); }
    else if (m[2]) { n.type = typeOf(m[2]); n.label = labelOf(m[2], m[1]); }
    if (current && !current.wraps.includes(n.id)) current.wraps.push(n.id);
    return n;
  };
  const edgeRe = /\s*(==>|-\.->|-->|---|--\s*([^-]+?)\s*-->|-\.\s*([^.]+?)\s*\.->)\s*(?:\|([^|]*)\|)?\s*/;
  for (const line of lines) {
    if (/^subgraph\s/.test(line)) { const m = /^subgraph\s+([A-Za-z][\w-]*)\s*(?:\[(.*)\])?/.exec(line); current = { id: m ? m[1] : `g${groups.length}`, label: m && m[2] ? m[2].replace(/^"|"$/g, '') : (m ? m[1] : 'Group'), kind: 'boundary', wraps: [] }; groups.push(current); continue; }
    if (line === 'end') { current = null; continue; }
    if (/^(classDef|class|style|linkStyle|click|direction)\b/.test(line)) continue;
    const parts = line.split(edgeRe);
    if (parts.length === 1) { ensure(line); continue; }
    let prev = ensure(parts[0]);
    for (let i = 1; i < parts.length; i += 5) {
      const op = parts[i], inlineLabel = parts[i + 1] || parts[i + 2], pipeLabel = parts[i + 3], target = parts[i + 4];
      const next = target ? ensure(target) : null;
      if (prev && next) {
        const e = { from: prev.id, to: next.id };
        const label = (pipeLabel || inlineLabel || '').replace(/^"|"$/g, '').trim();
        if (label) e.label = label.slice(0, 40);
        if (op.startsWith('-.')) e.variant = 'dashed'; else if (op.startsWith('==')) e.variant = 'emphasis';
        doc.edges.push(e);
      }
      prev = next;
    }
  }
  // Grid skeleton: longest-path rank -> col, order within the rank -> row (the agent refines it).
  const rank = new Map(doc.nodes.map((n) => [n.id, 0]));
  for (let iter = 0; iter < doc.nodes.length; iter++) {
    let changed = false;
    for (const e of doc.edges) { const r = rank.get(e.from) + 1; if (r > rank.get(e.to) && r < doc.nodes.length) { rank.set(e.to, r); changed = true; } }
    if (!changed) break;
  }
  const perRank = new Map();
  for (const n of doc.nodes) { n.col = Math.min(rank.get(n.id), 11); n.row = perRank.get(n.col) || 0; perRank.set(n.col, n.row + 1); }
  if (groups.length) doc.groups = groups.filter((g) => g.wraps.length);
  doc.layout = { cols: Math.min(12, Math.max(1, ...doc.nodes.map((n) => n.col + 1))) };
  return doc;
}
function sequenceFromMermaid(lines) {
  const doc = { schema_version: 1, diagram_type: 'sequence', meta: { title: 'Untitled (from Mermaid)', lang: 'en' }, participants: [], messages: [] };
  const ensure = (id, label, type) => { let p = doc.participants.find((x) => x.id === id); if (!p) { p = { id, label: label || id, type: type || 'backend' }; doc.participants.push(p); } else if (label) { p.label = label; if (type) p.type = type; } return p; };
  for (const line of lines) {
    let m;
    if ((m = /^(participant|actor)\s+([A-Za-z][\w-]*)(?:\s+as\s+(.+))?$/.exec(line))) { ensure(m[2], m[3] && m[3].trim(), m[1] === 'actor' ? 'actor' : undefined); continue; }
    if ((m = /^Note\s+(?:over|right of|left of)\s+([^:]+):\s*(.+)$/i.exec(line))) { const last = doc.messages[doc.messages.length - 1]; if (last) last.note = m[2].trim().slice(0, 80); continue; }
    if ((m = /^([A-Za-z][\w]*(?:-[A-Za-z0-9_]+)*)\s*(-->>|->>|-\)|--\)|-x|--x|->|-->)\s*([A-Za-z][\w]*(?:-[A-Za-z0-9_]+)*)\s*:\s*(.+)$/.exec(line))) {
      ensure(m[1]); ensure(m[3]);
      const msg = { from: m[1], to: m[3], label: m[4].trim().slice(0, 60) };
      if (m[2].startsWith('--')) msg.variant = 'return'; else if (m[2].endsWith(')')) msg.variant = 'dashed';
      doc.messages.push(msg);
    }
  }
  return doc;
}

// ---- diagnostics
export function diag(code, severity, text, subject, evidence, supportedFixes) {
  const s = { collection: null, index: null, id: null, from: null, to: null, ...(subject || {}) };
  const ev = { px: null, points: null, bounds: null, ...(evidence || {}) };
  const where = s.collection !== null ? `${s.collection}[${s.index}]` : 'document';
  const idPart = s.id ? ` id "${s.id}"` : '';
  const ends = s.from ? ` "${s.from}" -> "${s.to}"` : '';
  const fixes = supportedFixes && supportedFixes.length ? supportedFixes : ['review the element'];
  return { code, severity, message: `[${code}] ${where}${idPart}${ends}: ${text} — fix: ${fixes[0]}`, subject: s, evidence: ev, supportedFixes: fixes };
}
const countBy = (r, sev) => r.diagnostics.filter((d) => d.severity === sev).length;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export function formatText(result) {
  const lines = result.diagnostics.map((d) => `${d.severity === 'error' ? '✗' : '!'} ${d.message}`);
  lines.push(`${plural(countBy(result, 'error'), 'error')}, ${plural(countBy(result, 'warning'), 'warning')}`);
  return `${lines.join('\n')}\n`;
}
export function formatJsonLines(result) {
  const lines = result.diagnostics.map((d) => JSON.stringify(d));
  lines.push(JSON.stringify({ summary: { errors: countBy(result, 'error'), warnings: countBy(result, 'warning') } }));
  return `${lines.join('\n')}\n`;
}

// ---- cli
const USAGE = `usage:
  diagram-check.mjs validate <ir.json> [--json]
  diagram-check.mjs render   <ir.json> [--out <dir>] [--svg]
  diagram-check.mjs mermaid  <ir.json> [--out <dir>]
  diagram-check.mjs from-mermaid <file.mmd> [--out <dir>] [--type architecture|flow|dataflow]
  diagram-check.mjs --self-test
`;
function parseOpts(rest) {
  const o = { json: false, svg: false, out: null, type: null };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--json') o.json = true;
    else if (a === '--svg') o.svg = true;
    else if (a === '--out') o.out = rest[++i];
    else if (a.startsWith('--out=')) o.out = a.slice(6);
    else if (a === '--type') o.type = rest[++i];
    else if (a.startsWith('--type=')) o.type = a.slice(7);
    else { process.stderr.write(`unknown option ${a}\n${USAGE}`); process.exit(2); }
  }
  return o;
}
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
  const opt = parseOpts(rest);
  const abs = path.resolve(file);
  const outDir = opt.out ? path.resolve(opt.out) : path.dirname(abs);
  const base = path.basename(abs).replace(/\.(json|mmd)$/i, '');
  const write = (name, content) => { fs.mkdirSync(outDir, { recursive: true }); const p = path.join(outDir, name); fs.writeFileSync(p, content); return p; };
  if (cmd === 'validate') {
    const r = validateDocument(readDoc(abs));
    process.stdout.write(opt.json ? formatJsonLines(r) : formatText(r));
    process.exit(countBy(r, 'error') ? 1 : 0);
  }
  if (cmd === 'render') {
    const doc = readDoc(abs);
    const out = renderHtml(doc);
    if (!out) { const r = validateDocument(doc); process.stdout.write(opt.json ? formatJsonLines(r) : formatText(r)); process.stdout.write('render: nothing written (fix the errors first)\n'); process.exit(1); }
    const p = write(`${base}.html`, out.html);
    process.stdout.write(`rendered ${p} (${Buffer.byteLength(out.html, 'utf8')} bytes)\n`);
    if (opt.svg) process.stdout.write(`rendered ${write(`${base}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${out.svg}\n`)}\n`);
    process.stdout.write(formatText(out.result));
    process.exit(0);
  }
  if (cmd === 'mermaid') {
    const doc = readDoc(abs);
    const r = validateDocument(doc);
    const schemaErrors = r.diagnostics.filter((d) => d.code.startsWith('schema/'));
    if (schemaErrors.length) { process.stdout.write(formatText({ diagnostics: schemaErrors })); process.exit(1); }
    const p = write(`${base}.mmd`, toMermaid(doc));
    process.stdout.write(`wrote ${p}\n`);
    process.exit(0);
  }
  if (cmd === 'from-mermaid') {
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch (e) { process.stderr.write(`cannot read ${abs}: ${e.message}\n`); process.exit(2); }
    const doc = fromMermaid(text, opt.type);
    const p = write(`${base}.json`, `${JSON.stringify(doc, null, 2)}\n`);
    process.stdout.write(`wrote ${p} — a skeleton: set meta.title/lang, types, sublabels and row/col by the authoring rules, then validate\n`);
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
  const errorsOf = (r) => r.diagnostics.filter((d) => d.severity === 'error');
  const find = (r, code) => r.diagnostics.find((d) => d.code === code);
  const EXAMPLE_NAMES = ['architecture', 'flow', 'sequence', 'dataflow', 'lifecycle'];
  const examples = EXAMPLE_NAMES.map((n) => [n, readJson(path.join(EXAMPLES_DIR, `${n}.json`))]);
  const node = (id, row, col, extra = {}) => ({ id, type: 'backend', label: id.toUpperCase(), row, col, ...extra });
  const arch = (over = {}) => ({
    schema_version: 1, diagram_type: 'architecture', meta: { title: 'Fixture', lang: 'en' },
    nodes: [node('a', 0, 0, { type: 'frontend' }), node('b', 0, 1)], edges: [{ from: 'a', to: 'b' }], ...over,
  });
  const expectShape = (d) => {
    assert(d && typeof d.code === 'string' && /^[a-z-]+\/[a-z-]+$/.test(d.code), `code shape: ${d && d.code}`);
    assert(d.severity === 'error' || d.severity === 'warning', 'severity enum');
    assert(typeof d.message === 'string' && d.message.length > 0, 'message');
    for (const k of ['collection', 'index', 'id', 'from', 'to']) assert(k in d.subject, `subject.${k}`);
    for (const k of ['px', 'points', 'bounds']) assert(k in d.evidence, `evidence.${k}`);
    assert(Array.isArray(d.supportedFixes) && d.supportedFixes.length > 0, 'supportedFixes non-empty');
  };

  // -- schema (TASK-001)
  test('schema: the five examples pass the schema check', () => {
    for (const [n, doc] of examples) {
      const r = validateDocument(doc);
      const s = r.diagnostics.filter((d) => d.code.startsWith('schema/'));
      assert(s.length === 0, `${n}: ${s.map((d) => d.message).join('; ')}`);
    }
  });
  test('schema/unknown-property names the property and the fix', () => {
    const r = validateDocument(arch({ extra: 1 }));
    const d = find(r, 'schema/unknown-property'); assert(d, 'missing code'); expectShape(d);
    assert(d.supportedFixes.some((f) => /remove unsupported property "extra"/.test(f)), d.supportedFixes.join());
  });
  test('schema/unknown-property on a node points at nodes[0] "a"', () => {
    const doc = arch(); doc.nodes[0].color = 'red';
    const d = find(validateDocument(doc), 'schema/unknown-property'); assert(d, 'missing');
    assert(d.subject.collection === 'nodes' && d.subject.index === 0 && d.subject.id === 'a', JSON.stringify(d.subject));
  });
  test('schema/id-pattern', () => {
    const doc = arch(); doc.nodes[0].id = '1bad'; doc.edges[0].from = '1bad';
    const d = find(validateDocument(doc), 'schema/id-pattern'); assert(d, 'missing'); expectShape(d);
  });
  test('schema/unknown-endpoint carries from/to', () => {
    const doc = arch(); doc.edges[0].to = 'zzz';
    const d = find(validateDocument(doc), 'schema/unknown-endpoint'); assert(d, 'missing'); expectShape(d);
    assert(d.subject.collection === 'edges' && d.subject.to === 'zzz', JSON.stringify(d.subject));
  });
  test('schema/duplicate-id', () => {
    const doc = arch(); doc.nodes.push(node('a', 1, 0));
    const d = find(validateDocument(doc), 'schema/duplicate-id'); assert(d, 'missing'); expectShape(d);
  });
  test('schema/enum lists the choices', () => {
    const doc = arch(); doc.nodes[1].type = 'server';
    const d = find(validateDocument(doc), 'schema/enum'); assert(d, 'missing');
    assert(d.supportedFixes.some((f) => /choose one of/.test(f) && /backend/.test(f)), d.supportedFixes.join());
  });
  test('schema/missing-property', () => {
    const doc = arch(); delete doc.nodes[1].label;
    const d = find(validateDocument(doc), 'schema/missing-property'); assert(d, 'missing'); expectShape(d);
  });
  test('schema/diagram-type rejects arrays that do not belong to the type', () => {
    const doc = arch({ diagram_type: 'sequence' });
    const d = find(validateDocument(doc), 'schema/diagram-type'); assert(d, 'missing'); expectShape(d);
  });
  test('schema/self-loop (v1 forbids from === to outside sequence)', () => {
    const doc = arch(); doc.edges.push({ from: 'a', to: 'a' });
    assert(find(validateDocument(doc), 'schema/self-loop'), 'missing');
  });
  test('schema errors stop before geometry (no layout codes alongside)', () => {
    const doc = arch({ extra: 1 }); doc.nodes[1].col = 0;
    const r = validateDocument(doc);
    assert(!r.diagnostics.some((d) => d.code.startsWith('layout/')), 'layout ran after schema failure');
  });

  // -- layout (TASK-002)
  test('layout/cell-collision names both ids and the cell', () => {
    const doc = arch(); doc.nodes[1].col = 0;
    const d = find(validateDocument(doc), 'layout/cell-collision'); assert(d, 'missing'); expectShape(d);
    assert(/"a"/.test(d.message) && /"b"/.test(d.message) && /row 0.*col 0/.test(d.message), d.message);
  });
  test('layout/out-of-grid', () => {
    const doc = arch({ layout: { cols: 1 } });
    const d = find(validateDocument(doc), 'layout/out-of-grid'); assert(d, 'missing'); expectShape(d);
    assert(d.subject.id === 'b', d.subject.id);
  });
  test('layout/node-overlap measures the gap in px', () => {
    const doc = arch(); doc.nodes[0].w = 300;
    const d = find(validateDocument(doc), 'layout/node-overlap'); assert(d, 'missing'); expectShape(d);
    assert(typeof d.evidence.px === 'number' && d.evidence.px < 8, JSON.stringify(d.evidence));
  });
  test('layout/text-fit measures required vs available width (0.6·font·units + 8)', () => {
    const doc = arch(); doc.nodes[1].label = 'A very long label that will never fit here';
    const d = find(validateDocument(doc), 'layout/text-fit'); assert(d, 'missing'); expectShape(d);
    const units = doc.nodes[1].label.length;
    assert(d.evidence.px.required === 0.6 * 11 * units + 8, `required ${d.evidence.px.required}`);
    assert(d.evidence.px.available === 140, `available ${d.evidence.px.available}`);
    assert(d.supportedFixes.some((f) => /widen to \d+ px or shorten label/.test(f)), d.supportedFixes.join());
  });
  test('layout/out-of-canvas for a via point outside the content box', () => {
    const doc = arch(); doc.edges[0].via = [[3000, 3000]];
    const d = find(validateDocument(doc), 'layout/out-of-canvas'); assert(d, 'missing'); expectShape(d);
  });

  // -- router + flow checks (TASK-004)
  test('clean-flow/edge-through-node with an authored via through a node', () => {
    const doc = arch({ nodes: [node('a', 0, 0), node('c', 0, 1), node('b', 0, 2)], edges: [{ from: 'a', to: 'b', via: [[346, 112]] }] });
    const d = find(validateDocument(doc), 'clean-flow/edge-through-node'); assert(d, 'missing'); expectShape(d);
    assert(d.subject.from === 'a' && d.subject.to === 'b' && /"c"/.test(d.message), d.message);
  });
  test('router: Dijkstra routes around an obstacle on the straight line (no through-node, segments >= 8)', () => {
    const doc = arch({ nodes: [node('a', 0, 0), node('c', 0, 1), node('b', 0, 2)], edges: [{ from: 'a', to: 'b' }] });
    const r = validateDocument(doc);
    assert(!find(r, 'clean-flow/edge-through-node'), 'edge still passes through c');
    const pts = r.model.edges[0].points;
    assert(pts.length >= 4, `expected a detour, got ${pts.length} points`);
    for (let i = 1; i < pts.length; i++) {
      const len = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
      assert(len >= 8, `segment ${i} is ${len}px`);
      assert(pts[i][0] === pts[i - 1][0] || pts[i][1] === pts[i - 1][1], 'diagonal segment');
    }
  });
  test('clean-flow/endpoint-side-direction when the first segment ignores fromSide', () => {
    const doc = arch(); doc.edges[0].fromSide = 'top'; doc.edges[0].via = [[200, 80]];
    const d = find(validateDocument(doc), 'clean-flow/endpoint-side-direction'); assert(d, 'missing'); expectShape(d);
    assert(d.supportedFixes.some((f) => /fromSide/.test(f)), d.supportedFixes.join());
  });
  test('composition/label-gap measures 6.5·units + 21 against the segment', () => {
    const doc = arch(); doc.edges[0].label = 'a very very long edge label!';
    const d = find(validateDocument(doc), 'composition/label-gap'); assert(d, 'missing'); expectShape(d);
    assert(d.evidence.px.required === 6.5 * 28 + 21 && d.evidence.px.available === 96, JSON.stringify(d.evidence.px));
  });
  test('composition/label-overlap when an authored labelAt puts a label on a neighbour node', () => {
    const doc = arch({ nodes: [node('a', 0, 0), node('c', 2, 0), node('b', 1, 1)], edges: [{ from: 'a', to: 'c', label: 'xxxxxxxxxxxxxxxxxxxxxxxx', labelAt: 0.5 }] });
    const d = find(validateDocument(doc), 'composition/label-overlap'); assert(d, 'missing'); expectShape(d);
    assert(/"b"/.test(d.message), d.message);
  });
  test('labels: without labelAt the label slides along the segment to avoid nodes and group titles', () => {
    const doc = arch({ nodes: [node('a', 0, 0), node('c', 2, 0), node('b', 1, 1)], edges: [{ from: 'a', to: 'c', label: 'xxxxxxxxxxxxxxxxxxxxxxxx' }] });
    const r = validateDocument(doc);
    assert(!find(r, 'composition/label-overlap'), 'label still overlaps');
    assert(r.model.edges[0].labelBox.t !== 0.5, 'label did not move');
  });
  test('composition/proper-crossing is a warning and does not fail validation', () => {
    const doc = arch({
      nodes: [node('a', 1, 0), node('b', 1, 2), node('c', 0, 1), node('d', 2, 1)],
      edges: [{ from: 'a', to: 'b' }, { from: 'c', to: 'd' }],
    });
    const r = validateDocument(doc);
    const d = find(r, 'composition/proper-crossing'); assert(d, 'missing'); expectShape(d);
    assert(d.severity === 'warning' && errorsOf(r).length === 0, 'should be a warning only');
  });
  test('router: a fan-out of three Z routes from one side does not cross itself', () => {
    const doc = arch({ nodes: [node('hub', 1, 0, { h: 96 }), node('t0', 0, 1), node('t1', 1, 1), node('t2', 2, 1), node('t3', 3, 1)],
      edges: [{ from: 'hub', to: 't0' }, { from: 'hub', to: 't1' }, { from: 'hub', to: 't2' }, { from: 'hub', to: 't3' }] });
    const r = validateDocument(doc);
    assert(!find(r, 'composition/proper-crossing'), 'fan-out edges cross');
    assert(errorsOf(r).length === 0, errorsOf(r).map((d) => d.message).join(' | '));
  });
  test('budget/too-many-nodes warns above 12 primary nodes', () => {
    const nodes = []; for (let i = 0; i < 14; i++) nodes.push(node(`n${i}`, Math.floor(i / 5), i % 5));
    const r = validateDocument(arch({ nodes, edges: [] }));
    const d = find(r, 'budget/too-many-nodes'); assert(d, 'missing'); expectShape(d);
    assert(d.severity === 'warning', 'warning');
  });
  test('readability/projected-text when the canvas is too wide for 1440 px', () => {
    const doc = arch({ layout: { cols: 12, cellW: 400, gapX: 200 }, nodes: [node('a', 0, 0), node('b', 0, 11)], edges: [] });
    const d = find(validateDocument(doc), 'readability/projected-text'); assert(d, 'missing'); expectShape(d);
  });
  test('examples: 0 errors each, every route has <= 2 bends', () => {
    for (const [n, doc] of examples) {
      const r = validateDocument(doc);
      assert(errorsOf(r).length === 0, `${n}: ${errorsOf(r).map((d) => d.message).join(' | ')}`);
      for (const e of r.model.edges) assert(e.points.length <= 4, `${n}: edge ${e.from}->${e.to} has ${e.points.length - 1} segments`);
    }
  });
  test('determinism: same IR gives the same routes and the same HTML bytes', () => {
    const doc = examples[0][1];
    const a = validateDocument(doc), b = validateDocument(doc);
    assert(JSON.stringify(a.model.edges.map((e) => e.points)) === JSON.stringify(b.model.edges.map((e) => e.points)), 'routes differ');
    assert(renderHtml(doc).html === renderHtml(doc).html, 'html differs');
  });
  test('performance: 40 nodes validate in < 1 s', () => {
    const nodes = []; const edges = [];
    for (let i = 0; i < 40; i++) nodes.push(node(`n${i}`, Math.floor(i / 8), i % 8));
    for (let i = 1; i < 40; i++) edges.push({ from: `n${i - 1}`, to: `n${i}` });
    const t0 = performance.now();
    validateDocument(arch({ layout: { cols: 8 }, nodes, edges }));
    const ms = performance.now() - t0;
    assert(ms < 1000, `${ms.toFixed(0)} ms`);
  });

  // -- render (TASK-005)
  test('render: five examples -> one <svg>, finite numbers, identical embedded IR, < 61440 bytes, no hex in the SVG', () => {
    for (const [n, doc] of examples) {
      const out = renderHtml(doc); assert(out && out.html, `${n}: no html`);
      const { html, svg } = out;
      assert((html.match(/<svg[\s>]/g) || []).length === 1, `${n}: svg count`);
      assert(!/="[^"]*(NaN|undefined|Infinity)[^"]*"/.test(svg), `${n}: non-finite attribute`);
      const m = html.match(/<script type="application\/json" id="diagram-ir">([\s\S]*?)<\/script>/);
      assert(m, `${n}: embedded IR missing`);
      assert(JSON.stringify(JSON.parse(m[1])) === JSON.stringify(doc), `${n}: embedded IR differs`);
      assert(Buffer.byteLength(html, 'utf8') < 61440, `${n}: ${Buffer.byteLength(html, 'utf8')} bytes`);
      assert(!/#[0-9a-fA-F]{6}\b/.test(svg), `${n}: literal hex colour in svg`);
      assert(/tabindex="0" role="button" aria-label="/.test(svg), `${n}: node a11y attributes`);
      assert(/data-edge-from="/.test(svg) || n === 'sequence', `${n}: edge facts`);
    }
  });
  test('render: an invalid IR yields null (fail-closed)', () => {
    assert(renderHtml(arch({ extra: 1 })) === null, 'rendered an invalid IR');
  });
  test('render: meta.tokens.accent lands in the token override block, never in the SVG', () => {
    const doc = arch({ meta: { title: 'T', lang: 'es', tokens: { accent: '#AB12CD' } } });
    const { html, svg } = renderHtml(doc);
    assert(/--accent:\s*#AB12CD/.test(html), 'override missing');
    assert(!/#AB12CD/.test(svg), 'hex leaked into svg');
    assert(/<html lang="es"/.test(html), 'lang');
  });
  test('render: authored strings are escaped', () => {
    const doc = arch(); doc.nodes[0].label = '<b>&"x"';
    const { svg } = renderHtml(doc);
    assert(!/<b>/.test(svg) && /&lt;b&gt;&amp;&quot;x&quot;/.test(svg), 'label not escaped');
  });

  // -- mermaid (TASK-006)
  test('mermaid: node and edge counts match the IR for every example', () => {
    for (const [n, doc] of examples) {
      const mmd = toMermaid(doc);
      if (doc.diagram_type === 'sequence') {
        assert(/^sequenceDiagram/.test(mmd), `${n}: header`);
        assert((mmd.match(/^\s+(participant|actor) /gm) || []).length === doc.participants.length, `${n}: participants`);
        assert((mmd.match(/^\s+\w+-[->)]+>?\w+: /gm) || []).length === doc.messages.length, `${n}: messages`);
      } else if (doc.diagram_type === 'lifecycle') {
        assert(/^stateDiagram-v2/.test(mmd), `${n}: header`);
        assert((mmd.match(/^\s+\w+: .+$/gm) || []).length === doc.states.length, `${n}: states`);
        assert((mmd.match(/^\s+\w+ --> \w+(: .+)?$/gm) || []).length === doc.transitions.length, `${n}: transitions`);
      } else {
        assert(/^flowchart LR/.test(mmd), `${n}: header`);
        assert((mmd.match(/^\s+\w+(\[|\(|>)/gm) || []).length === doc.nodes.length, `${n}: nodes`);
        assert((mmd.match(/(-->|-\.->|==>)/g) || []).length === doc.edges.length, `${n}: edges`);
        assert((mmd.match(/^\s*subgraph /gm) || []).length === (doc.groups || []).length, `${n}: subgraphs`);
      }
    }
  });
  test('mermaid: sequence keeps message order', () => {
    const doc = examples.find(([n]) => n === 'sequence')[1];
    const lines = toMermaid(doc).split('\n').filter((l) => /^\s+\w+-[->)]+>?\w+: /.test(l));
    doc.messages.forEach((m, i) => assert(lines[i].includes(`: ${m.label}`), `message ${i}`));
  });
  test('from-mermaid: a pasted flowchart with 4 nodes becomes an IR skeleton with 4 nodes and 4 edges', () => {
    const doc = fromMermaid('flowchart LR\n  A[Web] -->|REST| B(API)\n  B --> C[(DB)]\n  B -.-> D[[Queue]]\n  D --> C\n', 'architecture');
    assert(doc.nodes.length === 4 && doc.edges.length === 4, `${doc.nodes.length} nodes, ${doc.edges.length} edges`);
    assert(doc.nodes.find((n) => n.id === 'C').type === 'database', 'shape -> type');
    assert(doc.edges[0].label === 'REST' && doc.edges[2].variant === 'dashed', 'edge label/variant');
    assert(doc.nodes.every((n) => Number.isInteger(n.row) && Number.isInteger(n.col)), 'row/col assigned');
    const r = validateDocument(doc);
    assert(!r.diagnostics.some((d) => d.code.startsWith('schema/')), 'skeleton must pass the schema');
  });
  test('from-mermaid: a sequenceDiagram becomes participants + messages', () => {
    const doc = fromMermaid('sequenceDiagram\n  participant U as User\n  participant A as API\n  U->>A: hello\n  A-->>U: hi\n');
    assert(doc.diagram_type === 'sequence' && doc.participants.length === 2 && doc.messages.length === 2, 'shape');
    assert(doc.messages[1].variant === 'return', 'return variant');
  });

  // -- diagnostics output
  test('output: --json is one parseable JSON object per line and text ends with "N errors, M warnings"', () => {
    const r = validateDocument(arch({ extra: 1 }));
    const lines = formatJsonLines(r).trim().split('\n');
    for (const l of lines) JSON.parse(l);
    assert(/\d+ errors?, \d+ warnings?$/.test(formatText(r).trim()), formatText(r));
    assert(/0 errors/.test(formatText(validateDocument(examples[0][1]))), 'clean text summary');
  });

  const failed = results.filter((r) => !r.ok);
  for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : ` — ${r.error}`}`);
  console.log(`self-test: ${results.length - failed.length} passed, ${failed.length} failed`);
  return failed.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
