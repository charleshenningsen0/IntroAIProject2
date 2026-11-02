#!/usr/bin/env node
'use strict';
const fs = require('fs');

function fail(msg) { console.error('ERROR: ' + msg); process.exit(1); }

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) fail('usage: node ua-tour-analyze.js <input.json> <output.json>');

let data;
try { data = JSON.parse(fs.readFileSync(inPath, 'utf8')); }
catch (e) { fail('cannot read input: ' + e.message); }

const nodes = Array.isArray(data.nodes) ? data.nodes : [];
const edges = Array.isArray(data.edges) ? data.edges : [];
const layers = Array.isArray(data.layers) ? data.layers : [];

const byId = new Map();
for (const n of nodes) byId.set(n.id, n);
const nameOf = (id) => (byId.get(id) || {}).name || id;
const typeOf = (id) => (byId.get(id) || {}).type || 'unknown';
const summaryOf = (id) => (byId.get(id) || {}).summary || '';

// ---- A/B fan-in / fan-out ----
const fanIn = new Map(), fanOut = new Map();
for (const n of nodes) { fanIn.set(n.id, 0); fanOut.set(n.id, 0); }
for (const e of edges) {
  if (!byId.has(e.source) || !byId.has(e.target)) continue;
  fanIn.set(e.target, (fanIn.get(e.target) || 0) + 1);
  fanOut.set(e.source, (fanOut.get(e.source) || 0) + 1);
}
const rank = (m) => nodes
  .map(n => ({ id: n.id, name: n.name, value: m.get(n.id) || 0 }))
  .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

const fanInRanking = rank(fanIn).slice(0, 20).map(r => ({ id: r.id, fanIn: r.value, name: r.name }));
const fanOutRanking = rank(fanOut).slice(0, 20).map(r => ({ id: r.id, fanOut: r.value, name: r.name }));

// ---- C entry points ----
const ENTRY_NAMES = new Set(['index.ts','index.js','main.ts','main.js','app.ts','app.js','server.ts','server.js','mod.rs','main.go','main.py','main.rs','manage.py','app.py','wsgi.py','asgi.py','run.py','__main__.py','Application.java','Main.java','Program.cs','config.ru','index.php','App.swift','Application.kt','main.cpp','main.c']);
const fanOutVals = nodes.map(n => fanOut.get(n.id) || 0).sort((a,b)=>a-b);
const p90 = fanOutVals.length ? fanOutVals[Math.floor(fanOutVals.length * 0.9)] : 0;
const p25 = fanInRanking.length ? 0 : 0;
const fanInVals = nodes.map(n => fanIn.get(n.id) || 0).sort((a,b)=>a-b);
const fanInP25 = fanInVals.length ? fanInVals[Math.floor(fanInVals.length * 0.25)] : 0;

const entryScores = [];
for (const n of nodes) {
  let score = 0;
  const base = (n.filePath || n.name || '').split('/').pop();
  if (n.type === 'document') {
    if ((n.filePath || n.name) === 'README.md') score += 5;
    else if (/\.md$/i.test(base) && !(n.filePath || '').includes('/')) score += 2;
  } else {
    if (ENTRY_NAMES.has(base)) score += 3;
    const fp = n.filePath || n.name || '';
    const depth = fp.split('/').length - 1;
    if (depth <= 1) score += 1;
    if ((fanOut.get(n.id) || 0) >= p90 && p90 > 0) score += 1;
    if ((fanIn.get(n.id) || 0) <= fanInP25) score += 1;
  }
  entryScores.push({ id: n.id, score, name: n.name, type: n.type, summary: summaryOf(n.id) });
}
entryScores.sort((a,b) => b.score - a.score || (fanOut.get(b.id)||0) - (fanOut.get(a.id)||0));
const entryPointCandidates = entryScores.slice(0, 5);

// ---- D BFS ----
const adj = new Map();
for (const n of nodes) adj.set(n.id, []);
for (const e of edges) {
  if (!byId.has(e.source) || !byId.has(e.target)) continue;
  if (e.type === 'imports' || e.type === 'calls') adj.get(e.source).push(e.target);
}
let start = entryPointCandidates.find(c => byId.get(c.id) && byId.get(c.id).type !== 'document');
if (!start) start = entryPointCandidates[0];
let bfs = { startNode: null, order: [], depthMap: {}, byDepth: {} };
if (start) {
  const order = [], depthMap = {};
  const q = [start.id];
  depthMap[start.id] = 0;
  while (q.length) {
    const cur = q.shift();
    order.push(cur);
    for (const nxt of adj.get(cur) || []) {
      if (!(nxt in depthMap)) { depthMap[nxt] = depthMap[cur] + 1; q.push(nxt); }
    }
  }
  const byDepth = {};
  for (const [id, d] of Object.entries(depthMap)) {
    (byDepth[d] = byDepth[d] || []).push(id);
  }
  bfs = { startNode: start.id, order, depthMap, byDepth };
}

// ---- E non-code inventory ----
const nonCodeFiles = { documentation: [], infrastructure: [], data: [], config: [] };
for (const n of nodes) {
  const item = { id: n.id, name: n.name, summary: summaryOf(n.id) };
  if (n.type === 'document') nonCodeFiles.documentation.push(item);
  else if (['service','pipeline','resource'].includes(n.type)) nonCodeFiles.infrastructure.push(item);
  else if (['table','schema','endpoint'].includes(n.type)) nonCodeFiles.data.push(item);
  else if (n.type === 'config') nonCodeFiles.config.push(item);
}
// treat VERSION-like files with no standard type as config-ish only if not already listed
for (const n of nodes) {
  const known = ['file','document','service','pipeline','resource','table','schema','endpoint','config'];
  if (!known.includes(n.type)) nonCodeFiles.config.push({ id: n.id, name: n.name, summary: summaryOf(n.id) });
}

// ---- F clusters ----
const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const dirEdges = new Map(); // key -> count both directions
const neighbours = new Map();
for (const n of nodes) neighbours.set(n.id, new Set());
for (const e of edges) {
  if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target) continue;
  const k = pairKey(e.source, e.target);
  dirEdges.set(k, (dirEdges.get(k) || 0) + 1);
  neighbours.get(e.source).add(e.target);
  neighbours.get(e.target).add(e.source);
}
const clusters = [];
const seenCluster = new Set();
const seedPairs = [...dirEdges.entries()].filter(([k, c]) => c >= 2).sort((a,b)=>b[1]-a[1]);
for (const [k, count] of seedPairs) {
  const [a, b] = k.split('|');
  if (seenCluster.has(a) || seenCluster.has(b)) continue;
  const cluster = new Set([a, b]);
  let grew = true;
  while (grew && cluster.size < 5) {
    grew = false;
    for (const cand of nodes.map(n => n.id)) {
      if (cluster.has(cand)) continue;
      let links = 0;
      for (const m of cluster) if (neighbours.get(cand).has(m)) links++;
      if (links >= 2) { cluster.add(cand); grew = true; if (cluster.size >= 5) break; }
    }
  }
  const arr = [...cluster];
  arr.forEach(id => seenCluster.add(id));
  let edgeCount = 0;
  for (let i = 0; i < arr.length; i++) for (let j = i+1; j < arr.length; j++) edgeCount += dirEdges.get(pairKey(arr[i], arr[j])) || 0;
  clusters.push({ nodes: arr, edgeCount });
}
// fallback: pair clusters by single bidirectional edges
if (clusters.length === 0) {
  const bidir = new Map();
  for (const e of edges) {
    if (e.type !== 'imports' && e.type !== 'calls') continue;
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    const k = pairKey(e.source, e.target);
    bidir.set(k, (bidir.get(k) || 0) + 1);
  }
  for (const [k, c] of [...bidir.entries()].filter(([,c])=>c>=2).sort((a,b)=>b[1]-a[1]).slice(0,10)) {
    clusters.push({ nodes: k.split('|'), edgeCount: c });
  }
}

// ---- H node summary index ----
const nodeSummaryIndex = {};
for (const n of nodes) nodeSummaryIndex[n.id] = { name: n.name, type: n.type, summary: summaryOf(n.id) };

const out = {
  scriptCompleted: true,
  entryPointCandidates,
  fanInRanking,
  fanOutRanking,
  bfsTraversal: bfs,
  nonCodeFiles,
  clusters: clusters.slice(0, 10),
  layers: { count: layers.length, list: layers.map(l => ({ id: l.id, name: l.name, description: l.description })) },
  nodeSummaryIndex,
  totalNodes: nodes.length,
  totalEdges: edges.length,
};

try { fs.writeFileSync(outPath, JSON.stringify(out, null, 2)); }
catch (e) { fail('cannot write output: ' + e.message); }
console.log('ok: ' + nodes.length + ' nodes, ' + edges.length + ' edges, ' + out.clusters.length + ' clusters');
process.exit(0);
