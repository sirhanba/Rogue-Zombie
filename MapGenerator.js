/**
 * MapGenerator.js
 * Geração procedural de mapa vertical - 15 níveis
 */

class MapGenerator {
  constructor(options = {}) {
    this.totalLevels = options.totalLevels || 15;
    this.minNodesPerLevel = options.minNodesPerLevel || 2;
    this.maxNodesPerLevel = options.maxNodesPerLevel || 4;
    this.seed = options.seed || Date.now();
    this.rng = this.createRNG(this.seed);
  }

  createRNG(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  randomInt(min, max) {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  getNodeType(level) {
    if (level === 1) return "start";
    if (level === this.totalLevels) return "shelter";

    if (level >= 5 && this.rng() < 0.12 + level * 0.008) return "elite";
    if (this.rng() < 0.08) return "recovery";
    if (this.rng() < 0.07) return "shop";
    if (this.rng() < 0.18) return "chest";
    if (this.rng() < 0.22) return "event";
    return "battle";
  }

  generate() {
    const levels = [];
    let nodeIdCounter = 0;

    for (let level = 1; level <= this.totalLevels; level++) {
      let nodeCount;

      if (level === 1 || level === this.totalLevels) {
        nodeCount = 1;
      } else {
        const progress = level / this.totalLevels;
        if (progress < 0.3) nodeCount = this.randomInt(2, 3);
        else if (progress < 0.7) nodeCount = this.randomInt(3, 4);
        else nodeCount = this.randomInt(2, 3);
      }

      const nodes = [];
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          id: `n${nodeIdCounter++}`,
          level,
          index: i,
          type: this.getNodeType(level),
          connections: [],
          visited: false,
          completed: false,
        });
      }
      levels.push({ level, nodes });
    }

    // Conexões entre níveis
    for (let l = 0; l < levels.length - 1; l++) {
      const currentNodes = levels[l].nodes;
      const nextNodes = levels[l + 1].nodes;

      currentNodes.forEach((node, idx) => {
        const connectionsCount = this.randomInt(1, Math.min(2, nextNodes.length));
        const possibleTargets = [...nextNodes].sort((a, b) => {
          return Math.abs(a.index - idx) - Math.abs(b.index - idx);
        });

        const chosen = [];
        for (let c = 0; c < connectionsCount; c++) {
          if (possibleTargets.length === 0) break;
          const pickIndex = this.rng() < 0.7 ? 0 : this.randomInt(0, Math.min(2, possibleTargets.length - 1));
          const target = possibleTargets.splice(pickIndex, 1)[0];
          chosen.push(target.id);
        }
        node.connections = chosen;
      });

      // Evita nós isolados
      const connectedIds = new Set();
      currentNodes.forEach(n => n.connections.forEach(id => connectedIds.add(id)));

      nextNodes.forEach(nextNode => {
        if (!connectedIds.has(nextNode.id)) {
          const closest = currentNodes.reduce((best, n) => {
            return Math.abs(n.index - nextNode.index) < Math.abs(best.index - nextNode.index) ? n : best;
          }, currentNodes[0]);
          closest.connections.push(nextNode.id);
        }
      });
    }

    // Garante recoveries mínimas
    for (let i = 3; i < levels.length - 1; i += 5) {
      const lvl = levels[i];
      if (!lvl.nodes.some(n => n.type === "recovery")) {
        const battleNode = lvl.nodes.find(n => n.type === "battle");
        if (battleNode) battleNode.type = "recovery";
      }
    }

    // Remove elites muito cedo
    levels.forEach(lvl => {
      if (lvl.level <= 3) {
        lvl.nodes.forEach(n => {
          if (n.type === "elite") n.type = "battle";
        });
      }
    });

    return {
      seed: this.seed,
      totalLevels: this.totalLevels,
      levels,
      getNode: (id) => {
        for (const lvl of levels) {
          const found = lvl.nodes.find(n => n.id === id);
          if (found) return found;
        }
        return null;
      },
      getStartNode: () => levels[0].nodes[0],
      getShelterNode: () => levels[levels.length - 1].nodes[0],
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = MapGenerator;
} else {
  window.MapGenerator = MapGenerator;
}
