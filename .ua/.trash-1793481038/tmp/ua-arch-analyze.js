#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function main() {
  const inPath = process.argv[2];
  const outPath = process.argv[3];
  if (!inPath || !outPath) {
    console.error('usage: node ua-arch-analyze.js <input.json> <output.json>');
    process.exit(1);
  }
  const input = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const fileNodes = input.fileNodes || [];
  const importEdges = input.importEdges || [];
  const allEdges = input.allEdges || [];

  const byId = new Map(fileNodes.map((n) => [n.id, n]));
  const ids = fileNodes.map((n) => n.id);

  // ---- A. Directory grouping -------------------------------------------------
  const paths = fileNodes.map((n) => n.filePath || n.name || '');
  const splitPaths = paths.map((p) => p.split('/').filter(Boolean));
  let commonPrefix = [];
  if (splitPaths.length) {
    const first = splitPaths[0];
    for (let i = 0; i < first.length - 1; i++) {
      const seg = first[i];
      if (splitPaths.every((sp) => sp.length > i + 1 && sp[i] === seg)) commonPrefix.push(seg);
      else break;
    }
  }
  const directoryGroups = {};
  const flat = splitPaths.every((sp) => sp.length <= commonPrefix.length + 1);
  for (let i = 0; i < fileNodes.length; i++) {
    const sp = splitPaths[i];
    let group;
    if (flat) {
      const base = sp[sp.length - 1] || '';
      const ext = path.extname(base).toLowerCase();
      group = ext ? ext.replace(/^\./, '') : 'text';
    } else {
      const rest = sp.slice(commonPrefix.length);
      group = rest.length > 1 ? rest[0] : 'root';
    }
    (directoryGroups[group] = directoryGroups[group] || []).push(fileNodes[i].id);
  }

  // ---- B. Node type grouping -------------------------------------------------
  const nodeTypeGroups = {};
  for (const n of fileNodes) {
    (nodeTypeGroups[n.type] = nodeTypeGroups[n.type] || []).push(n.id);
  }

  // ---- C. Import adjacency ---------------------------------------------------
  const fanOut = {};
  const fanIn = {};
  for (const id of ids) {
    fanOut[id] = 0;
    fanIn[id] = 0;
  }
  const adjacency = {};
  const groupOf = new Map();
  for (const [g, members] of Object.entries(directoryGroups)) for (const m of members) groupOf.set(m, g);

  const interGroupCounts = new Map();
  const intraCounts = new Map();
  for (const e of importEdges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    fanOut[e.source] = (fanOut[e.source] || 0) + 1;
    fanIn[e.target] = (fanIn[e.target] || 0) + 1;
    (adjacency[e.source] = adjacency[e.source] || []).push(e.target);
    const gs = groupOf.get(e.source);
    const gt = groupOf.get(e.target);
    if (gs === gt) {
      intraCounts.set(gs, (intraCounts.get(gs) || 0) + 1);
    } else {
      const k = gs + '\u0000' + gt;
      interGroupCounts.set(k, (interGroupCounts.get(k) || 0) + 1);
    }
  }
  const interGroupImports = [...interGroupCounts.entries()]
    .map(([k, count]) => {
      const [from, to] = k.split('\u0000');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count);

  // ---- D. Cross-category edges ----------------------------------------------
  const typeOf = (id) => {
    const idx = id.indexOf(':');
    return idx > 0 ? id.slice(0, idx) : 'unknown';
  };
  const crossMap = new Map();
  for (const e of allEdges) {
    const ft = typeOf(e.source);
    const tt = typeOf(e.target);
    if (ft === tt) continue;
    const k = ft + '|' + tt + '|' + e.type;
    crossMap.set(k, (crossMap.get(k) || 0) + 1);
  }
  const crossCategoryEdges = [...crossMap.entries()].map(([k, count]) => {
    const [fromType, toType, edgeType] = k.split('|');
    return { fromType, toType, edgeType, count };
  });

  // ---- F. Intra-group density -----------------------------------------------
  const intraGroupDensity = {};
  for (const [g, members] of Object.entries(directoryGroups)) {
    let total = 0;
    for (const e of importEdges) {
      if (!byId.has(e.source) || !byId.has(e.target)) continue;
      if (groupOf.get(e.source) === g || groupOf.get(e.target) === g) total++;
    }
    const internalEdges = intraCounts.get(g) || 0;
    intraGroupDensity[g] = {
      internalEdges,
      totalEdges: total,
      density: total === 0 ? 0 : Number((internalEdges / total).toFixed(3)),
    };
  }

  // ---- G. Pattern matching ---------------------------------------------------
  const dirPatterns = {
    routes: 'api', api: 'api', controllers: 'api', endpoints: 'api', handlers: 'api',
    services: 'service', core: 'service', lib: 'service', domain: 'service', logic: 'service',
    models: 'data', db: 'data', data: 'data', persistence: 'data', repository: 'data', entities: 'data',
    components: 'ui', views: 'ui', pages: 'ui', ui: 'ui', layouts: 'ui', screens: 'ui',
    middleware: 'middleware', plugins: 'middleware', interceptors: 'middleware', guards: 'middleware',
    utils: 'utility', helpers: 'utility', common: 'utility', shared: 'utility', tools: 'utility',
    config: 'config', constants: 'config', env: 'config', settings: 'config',
    __tests__: 'test', test: 'test', tests: 'test', spec: 'test', specs: 'test',
    types: 'types', interfaces: 'types', schemas: 'types', contracts: 'types', dtos: 'types',
    hooks: 'hooks', store: 'state', state: 'state', reducers: 'state', actions: 'state', slices: 'state',
    assets: 'assets', static: 'assets', public: 'assets', migrations: 'data',
  };
  const patternMatches = {};
  for (const g of Object.keys(directoryGroups)) {
    if (dirPatterns[g]) patternMatches[g] = dirPatterns[g];
  }
  for (const n of fileNodes) {
    const base = (n.filePath || n.name || '').split('/').pop();
    if (/^(test_.*|.*_test)\.py$/.test(base) || /\.(test|spec)\./.test(base)) {
      patternMatches[groupOf.get(n.id)] = patternMatches[groupOf.get(n.id)] || 'test';
    }
    if (base === '__init__.py') patternMatches[groupOf.get(n.id)] = 'entry';
  }

  // ---- H. Deployment topology ------------------------------------------------
  const infraFiles = fileNodes
    .filter((n) => /(^|\/)(Dockerfile|docker-compose[^/]*|Jenkinsfile|Makefile)$/.test(n.filePath || ''))
    .map((n) => n.filePath);
  const deploymentTopology = {
    hasDockerfile: infraFiles.some((f) => /Dockerfile/.test(f)),
    hasCompose: infraFiles.some((f) => /docker-compose/.test(f)),
    hasK8s: false,
    hasTerraform: false,
    hasCI: fileNodes.some((n) => /(^|\/)\.github\/workflows\//.test(n.filePath || '')),
    infraFiles,
  };

  // ---- I. Data pipeline ------------------------------------------------------
  const dataPipeline = {
    schemaFiles: fileNodes.filter((n) => /\.(sql|graphql|proto|prisma)$/.test(n.filePath || '')).map((n) => n.filePath),
    migrationFiles: fileNodes.filter((n) => /migrations?\//.test(n.filePath || '')).map((n) => n.filePath),
    dataModelFiles: fileNodes.filter((n) => (n.tags || []).some((t) => /data-model|game-state/.test(t))).map((n) => n.filePath),
    apiHandlerFiles: fileNodes.filter((n) => (n.tags || []).some((t) => /entry-point|cli/.test(t))).map((n) => n.filePath),
  };

  // ---- J. Documentation coverage --------------------------------------------
  const docNodes = fileNodes.filter((n) => n.type === 'document' || /\.(md|rst)$/.test(n.filePath || ''));
  const groupsWithDocs = new Set(docNodes.map((n) => groupOf.get(n.id)));
  const totalGroups = Object.keys(directoryGroups).length;
  const docCoverage = {
    groupsWithDocs: groupsWithDocs.size,
    totalGroups,
    coverageRatio: totalGroups === 0 ? 0 : Number((groupsWithDocs.size / totalGroups).toFixed(2)),
    undocumentedGroups: Object.keys(directoryGroups).filter((g) => !groupsWithDocs.has(g)),
  };

  // ---- K. Dependency direction ----------------------------------------------
  const pairNet = new Map();
  for (const { from, to, count } of interGroupImports) {
    const key = [from, to].sort().join('\u0000');
    const rec = pairNet.get(key) || { a: from, b: to, ab: 0, ba: 0 };
    if (from === rec.a) rec.ab += count;
    else rec.ba += count;
    pairNet.set(key, rec);
  }
  const dependencyDirection = [];
  for (const { a, b, ab, ba } of pairNet.values()) {
    if (ab === 0 && ba === 0) continue;
    if (ab >= ba) dependencyDirection.push({ dependent: a, dependsOn: b });
    else dependencyDirection.push({ dependent: b, dependsOn: a });
  }

  // ---- Stats -----------------------------------------------------------------
  const filesPerGroup = {};
  for (const [g, m] of Object.entries(directoryGroups)) filesPerGroup[g] = m.length;
  const nodeTypeCounts = {};
  for (const [t, m] of Object.entries(nodeTypeGroups)) nodeTypeCounts[t] = m.length;

  const results = {
    scriptCompleted: true,
    commonPrefix: commonPrefix.join('/'),
    directoryGroups,
    nodeTypeGroups,
    crossCategoryEdges,
    interGroupImports,
    intraGroupDensity,
    patternMatches,
    deploymentTopology,
    dataPipeline,
    docCoverage,
    dependencyDirection,
    fileStats: {
      totalFileNodes: fileNodes.length,
      filesPerGroup,
      nodeTypeCounts,
    },
    fileFanIn: fanIn,
    fileFanOut: fanOut,
    adjacency,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
}
