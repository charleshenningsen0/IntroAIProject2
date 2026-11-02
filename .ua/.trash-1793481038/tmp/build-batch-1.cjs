const fs = require('fs');
const OUT = "/Users/charleshenningsen/Desktop/Artificial Intelligence/project2-1/.ua/intermediate/batch-1.json";

const nodes = [];
const edges = [];
const F = (p) => `file:${p}`;
const C = (p, n) => `class:${p}:${n}`;
const FN = (p, n) => `function:${p}:${n}`;

function file(p, name, summary, tags, complexity, notes) {
  const n = { id: F(p), type: 'file', name, filePath: p, summary, tags, complexity };
  if (notes) n.languageNotes = notes;
  nodes.push(n);
}
function cls(p, name, lineRange, summary, tags, complexity) {
  nodes.push({ id: C(p, name), type: 'class', name, filePath: p, lineRange, summary, tags, complexity });
}
function fn(p, name, lineRange, summary, tags, complexity) {
  nodes.push({ id: FN(p, name), type: 'function', name, filePath: p, lineRange, summary, tags, complexity });
}
function edge(s, t, type, weight) {
  edges.push({ source: s, target: t, type, direction: 'forward', weight });
}

/* ---------------- game.py ---------------- */
file('game.py', 'game.py',
  'Core game engine for the Pacman AI projects: defines the Agent interface, direction constants, configurations, boolean grids, the game-state data packet, and the Game control loop that solicits actions from agents and applies rules.',
  ['game-engine', 'simulation', 'data-model', 'core'], 'complex',
  'Uses `from util import *` star-imports, so utility helpers (TimeoutFunction, nearestPoint, raiseNotDefined) are resolved at module scope rather than through explicit imports.');

cls('game.py', 'Agent', [35, 51],
  'Abstract base class every Pacman agent extends; stores the agent index and declares getAction, which raises until a subclass overrides it.',
  ['abstract-base', 'agent', 'interface'], 'simple');
cls('game.py', 'Directions', [54, 65],
  'Namespace of movement constants (North, South, East, West, Stop) plus LEFT/RIGHT/REVERSE lookup tables used to rotate and invert directions.',
  ['constants', 'direction', 'lookup-table'], 'simple');
cls('game.py', 'Configuration', [68, 117],
  'Immutable-style (x, y) position plus travel direction with hashing and equality so configurations can key dictionaries, and generateSuccessor to translate along a movement vector.',
  ['data-model', 'position', 'state'], 'simple');
cls('game.py', 'AgentState', [120, 165],
  "Tracks one agent's configuration, pacman/ghost flag, scared timer and contest counters, with copy support for cloning game states.",
  ['data-model', 'agent-state', 'copying'], 'simple');
cls('game.py', 'Grid', [168, 290],
  'Boolean 2D grid backed by a list of lists, indexed grid[x][y], offering copy/count/asList queries and bit-packing helpers used to serialize food and wall maps compactly.',
  ['data-structure', 'grid', 'bit-packing', 'serialization'], 'complex');
cls('game.py', 'Actions', [305, 405],
  'Static helper collection that converts between direction names and movement vectors and enumerates legal moves and neighbors given a wall grid.',
  ['utility', 'movement', 'static-methods'], 'moderate');
cls('game.py', 'GameStateData', [408, 558],
  'Mutable data packet holding food, capsules, agent states, layout and score for a single game state, supporting deep copy, hashing and ASCII rendering of the board.',
  ['data-model', 'game-state', 'serialization'], 'complex');
cls('game.py', 'Game', [569, 830],
  'Central control loop: registers agents, enforces per-agent startup/move timeouts and exception catching, solicits actions, applies successors, updates the display and lets rules detect wins and losses.',
  ['game-loop', 'orchestration', 'timeout-handling'], 'complex');
fn('game.py', 'reconstituteGrid', [293, 297],
  'Rebuilds a Grid from its packed (width, height, bits...) tuple representation and returns non-tuple input unchanged.',
  ['utility', 'deserialization', 'grid'], 'simple');

/* ---------------- keyboardAgents.py ---------------- */
file('keyboardAgents.py', 'keyboardAgents.py',
  'Provides human-controlled Pacman agents that translate keyboard input (WASD/arrow keys, or IJKL for the second player) into legal movement actions.',
  ['agent', 'input-handling', 'interactive'], 'moderate');
cls('keyboardAgents.py', 'KeyboardAgent', [20, 80],
  'Agent that reads waiting and pressed keys, maps them to a direction, then falls back to repeating the last legal move or a random legal action.',
  ['agent', 'keyboard', 'event-handler'], 'moderate');
cls('keyboardAgents.py', 'KeyboardAgent2', [83, 105],
  'Second keyboard-controlled agent using IJKL keys so two people can play interactively on one keyboard.',
  ['agent', 'keyboard', 'multiplayer'], 'simple');

/* ---------------- layout.py ---------------- */
file('layout.py', 'layout.py',
  'Loads and parses .lay maze files into Layout objects that expose walls, food, capsules and agent start positions, plus the lookup helpers the game and agents use to find layouts.',
  ['layout', 'parsing', 'game-config'], 'moderate');
cls('layout.py', 'Layout', [25, 163],
  'Static description of a Pacman board: parses layout characters into wall and food grids, records capsule and agent positions, and offers corner, visibility and random-position helpers.',
  ['data-model', 'layout', 'parsing'], 'complex');
fn('layout.py', 'getLayout', [166, 180],
  'Locates and loads a named .lay layout file, searching the layouts directory and walking up parent directories when it is not found.',
  ['file-loading', 'utility', 'fallback-search'], 'simple');
fn('layout.py', 'tryToLoad', [183, 190],
  'Attempts to open and parse a layout file, returning None when the path does not exist.',
  ['file-loading', 'utility', 'error-handling'], 'simple');

/* ---------------- pacman.py ---------------- */
file('pacman.py', 'pacman.py',
  'Main entry point and rules layer for Pacman: defines the agent-facing GameState, the classic win/lose rules, pacman and ghost movement rules, and the CLI that wires layouts, agents and displays into games.',
  ['entry-point', 'game-rules', 'cli', 'game-state'], 'complex',
  'Agents are discovered dynamically at runtime by importing any *Agents.py module on PYTHONPATH and looking up the class by name, so agent files are not statically imported.');
cls('pacman.py', 'GameState', [58, 261],
  'Agent-facing view of the game: accessors for food, capsules, walls, pacman and ghost states and score, plus generateSuccessor which copies the state, applies an action and resolves collisions.',
  ['game-state', 'api-surface', 'search-state'], 'complex');
cls('pacman.py', 'ClassicGameRules', [276, 344],
  'Classic Pacman rule set that creates games, detects wins and losses, reports progress and supplies the per-agent timeout budget.',
  ['game-rules', 'control-flow', 'timeout-handling'], 'moderate');
cls('pacman.py', 'PacmanRules', [347, 409],
  "Static rules for Pacman's movement: enumerate legal actions, apply an action to move pacman, and consume food or capsules with the resulting score changes.",
  ['game-rules', 'movement', 'scoring'], 'moderate');
cls('pacman.py', 'GhostRules', [412, 496],
  'Static rules for ghost behavior: legal actions without stopping or reversing at intersections, movement with halved speed while scared, scared-timer decay and death collisions.',
  ['game-rules', 'ghost', 'collision'], 'moderate');
fn('pacman.py', 'parseAgentArgs', [508, 519],
  'Parses comma-separated key=value agent arguments from the command line into a dict, treating bare keys as the value 1.',
  ['cli', 'parsing', 'utility'], 'simple');
fn('pacman.py', 'readCommand', [522, 735],
  'Builds the option parser, resolves the layout, instantiates the pacman and ghost agents, selects a display backend and returns the keyword arguments used to run games.',
  ['cli', 'configuration', 'entry-point'], 'complex');
fn('pacman.py', 'loadAgent', [738, 762],
  'Dynamically imports *Agents.py modules found on PYTHONPATH entries and returns the requested agent class by name.',
  ['dynamic-import', 'plugin-loading', 'reflection'], 'moderate');
fn('pacman.py', 'replayGame', [765, 785],
  'Replays a recorded action list against a fresh game using a greedy pacman and random ghosts, updating the display frame by frame.',
  ['replay', 'simulation', 'utility'], 'moderate');
fn('pacman.py', 'runGames', [788, 845],
  'Runs a batch of games with the given agents and display, optionally suppressing training games and recording histories, then prints aggregate scores and win rate.',
  ['game-loop', 'batch-run', 'reporting'], 'complex');

/* ---------------- pacmanAgents.py ---------------- */
file('pacmanAgents.py', 'pacmanAgents.py',
  'Baseline Pacman agents: a left-turning agent and a greedy agent that one-step-looks-ahead over legal actions using a pluggable evaluation function.',
  ['agent', 'baseline', 'search'], 'simple');
cls('pacmanAgents.py', 'LeftTurnAgent', [23, 40],
  'Simple agent that prefers turning left, then continuing straight, then turning right, and reverses only as a last resort.',
  ['agent', 'baseline', 'heuristic'], 'simple');
cls('pacmanAgents.py', 'GreedyAgent', [43, 60],
  'One-ply greedy agent that scores every legal successor with an evaluation function resolved by name and randomly picks among the highest-scoring actions.',
  ['agent', 'greedy', 'evaluation'], 'simple');
fn('pacmanAgents.py', 'scoreEvaluation', [63, 64],
  "Default evaluation function returning the game state's current score.",
  ['evaluation', 'utility', 'baseline'], 'simple');

/* ---------------- imports (1:1 with batchImportData) ---------------- */
edge(F('game.py'), F('util.py'), 'imports', 0.7);
edge(F('keyboardAgents.py'), F('game.py'), 'imports', 0.7);
edge(F('layout.py'), F('game.py'), 'imports', 0.7);
edge(F('layout.py'), F('util.py'), 'imports', 0.7);
edge(F('pacman.py'), F('game.py'), 'imports', 0.7);
edge(F('pacman.py'), F('layout.py'), 'imports', 0.7);
edge(F('pacman.py'), F('util.py'), 'imports', 0.7);
edge(F('pacmanAgents.py'), F('game.py'), 'imports', 0.7);
edge(F('pacmanAgents.py'), F('pacman.py'), 'imports', 0.7);
edge(F('pacmanAgents.py'), F('util.py'), 'imports', 0.7);

/* ---------------- contains ---------------- */
for (const n of nodes.filter((x) => x.type !== 'file')) {
  edge(F(n.filePath), n.id, 'contains', 1.0);
}

/* ---------------- exports ---------------- */
const exported = {
  'game.py': ['Agent', 'Directions', 'Configuration', 'AgentState', 'Grid', 'reconstituteGrid', 'Actions', 'GameStateData', 'Game'],
  'keyboardAgents.py': ['KeyboardAgent', 'KeyboardAgent2'],
  'layout.py': ['Layout', 'getLayout', 'tryToLoad'],
  'pacman.py': ['GameState', 'ClassicGameRules', 'PacmanRules', 'GhostRules', 'parseAgentArgs', 'readCommand', 'loadAgent', 'replayGame', 'runGames'],
  'pacmanAgents.py': ['LeftTurnAgent', 'GreedyAgent', 'scoreEvaluation'],
};
for (const [p, names] of Object.entries(exported)) {
  for (const nm of names) {
    const isClass = nodes.some((x) => x.id === C(p, nm));
    edge(F(p), isClass ? C(p, nm) : FN(p, nm), 'exports', 0.8);
  }
}

/* ---------------- inherits ---------------- */
edge(C('keyboardAgents.py', 'KeyboardAgent'), C('game.py', 'Agent'), 'inherits', 0.9);
edge(C('keyboardAgents.py', 'KeyboardAgent2'), C('keyboardAgents.py', 'KeyboardAgent'), 'inherits', 0.9);
edge(C('pacmanAgents.py', 'LeftTurnAgent'), C('game.py', 'Agent'), 'inherits', 0.9);
edge(C('pacmanAgents.py', 'GreedyAgent'), C('game.py', 'Agent'), 'inherits', 0.9);

/* ---------------- calls (cross-file) ---------------- */
edge(C('game.py', 'Agent'), FN('util.py', 'raiseNotDefined'), 'calls', 0.8);
edge(C('game.py', 'GameStateData'), FN('util.py', 'nearestPoint'), 'calls', 0.8);
edge(C('game.py', 'Game'), FN('util.py', 'TimeoutFunction'), 'calls', 0.8);
edge(C('game.py', 'Game'), FN('util.py', 'TimeoutFunctionException'), 'calls', 0.8);
edge(C('layout.py', 'Layout'), C('game.py', 'Grid'), 'calls', 0.8);
edge(C('layout.py', 'Layout'), FN('util.py', 'manhattanDistance'), 'calls', 0.8);
edge(C('pacman.py', 'GameState'), C('game.py', 'GameStateData'), 'calls', 0.8);
edge(C('pacman.py', 'PacmanRules'), C('game.py', 'Actions'), 'calls', 0.8);
edge(C('pacman.py', 'GhostRules'), C('game.py', 'Actions'), 'calls', 0.8);
edge(C('pacman.py', 'ClassicGameRules'), C('game.py', 'Game'), 'calls', 0.8);
edge(FN('pacman.py', 'readCommand'), FN('layout.py', 'getLayout'), 'calls', 0.8);
edge(C('pacmanAgents.py', 'GreedyAgent'), FN('util.py', 'lookup'), 'calls', 0.8);

const ids = new Set(nodes.map((n) => n.id));
const problems = [];
for (const e of edges) {
  if (e.source === e.target) problems.push('self-edge: ' + e.source);
  if (!ids.has(e.source)) problems.push('missing source: ' + e.source);
}
const dup = nodes.map((n) => n.id).filter((id, i, a) => a.indexOf(id) !== i);
fs.writeFileSync(OUT, JSON.stringify({ nodes, edges }, null, 2));
console.log(JSON.stringify({
  nodes: nodes.length,
  edges: edges.length,
  imports: edges.filter((e) => e.type === 'imports').length,
  problems,
  dup,
  targetsOutsideBatch: [...new Set(edges.map((e) => e.target).filter((t) => !ids.has(t)))],
}, null, 2));
