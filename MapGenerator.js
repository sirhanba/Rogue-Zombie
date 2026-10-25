/**
 * MapGenerator.js
 * Geração procedural de mapa vertical para Rogue Zombie
 * 15 níveis + Abrigo Seguro no topo
 * 
 * Uso:
 *   const generator = new MapGenerator();
 *   const map = generator.generate();
 */

class MapGenerator {
  constructor(options = {}) {
    this.totalLevels = options.totalLevels || 15;
    this.minNodesPerLevel = options.minNodesPerLevel || 2;
    this.maxNodesPerLevel = options.maxNodesPerLevel || 4;
    this.seed = options.seed || Date.now();
    this.rng = this.createRNG(this.seed);
  }

  // Gerador de números pseudo-aleatórios (mulberry32) para seed consistente
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

  pick(array) {
    return array[Math.floor(this.rng() * array.length)];
  }

  /**
   * Distribuição de tipos por nível
   * Quanto mais alto o nível, mais perigoso
   */
  getNodeType(level, isFirstOfLevel = false) {
    // Nível 1 = início
    if (level === 1) return "start";

    // Último nível = Abrigo Seguro
    if (level === this.totalLevels) return "shelter";

    // Chance de Elite (a partir do nível 5)
    if (level >= 5 && this.rng() < 0.12 + level * 0.008) {
      return "elite";
    }

    // Recuperação (rara)
    if (this.rng() < 0.08) return "recovery";

    // Loja (rara)
    if (this.rng() < 0.07) return "shop";

    // Baú
    if (this.rng() < 0.18) return "chest";

    // Evento especial
    if (this.rng() < 0.22) return "event";

    // Padrão = batalha
    return "battle";
  }

  /**
   * Gera o mapa completo
   */
  generate() {
    const levels = [];
    let nodeIdCounter = 0;

    // ========== 1. Criar nós por nível ==========
    for (let level = 1; level <= this.totalLevels; level++) {
      let nodeCount;

      if (level === 1) {
        nodeCount = 1; // Só o ponto de partida
      } else if (level === this.totalLevels) {
        nodeCount = 1; // Só o Abrigo
      } else {
        // Varia a quantidade de nós (mais no meio, menos no final)
        const progress = level / this.totalLevels;
        if (progress < 0.3) {
          nodeCount = this.randomInt(2, 3);
        } else if (progress < 0.7) {
          nodeCount = this.randomInt(3, 4);
        } else {
          nodeCount = this.randomInt(2, 3);
        }
      }

      const nodes = [];

      for (let i = 0; i < nodeCount; i++) {
        const id = `n${nodeIdCounter++}`;
        const type = this.getNodeType(level, i === 0);

        nodes.push({
          id,
          level,
          index: i, // posição horizontal no nível
          type,
          connections: [], // será preenchido depois
          // Dados extras que o jogo pode usar depois
          visited: false,
          completed: false,
        });
      }

      levels.push({
        level,
        nodes,
      });
    }

    // ========== 2. Criar conexões entre níveis ==========
    for (let l = 0; l < levels.length - 1; l++) {
      const currentLevel = levels[l];
      const nextLevel = levels[l + 1];

      const currentNodes = currentLevel.nodes;
      const nextNodes = nextLevel.nodes;

      // Cada nó do nível atual se conecta a 1 ou 2 nós do próximo
      currentNodes.forEach((node, idx) => {
        const connectionsCount = this.randomInt(1, Math.min(2, nextNodes.length));

        // Preferência por nós próximos horizontalmente
        const possibleTargets = [...nextNodes];
        // Ordena por proximidade de index
        possibleTargets.sort((a, b) => {
          const distA = Math.abs(a.index - idx);
          const distB = Math.abs(b.index - idx);
          return distA - distB;
        });

        const chosen = [];
        for (let c = 0; c < connectionsCount; c++) {
          if (possibleTargets.length === 0) break;
          // Pega o mais próximo com alguma randomização
          const pickIndex = this.rng() < 0.7 ? 0 : this.randomInt(0, Math.min(2, possibleTargets.length - 1));
          const target = possibleTargets.splice(pickIndex, 1)[0];
          chosen.push(target.id);
        }

        node.connections = chosen;
      });

      // Garante que nenhum nó do próximo nível fique isolado
      const connectedIds = new Set();
      currentNodes.forEach((n) => n.connections.forEach((id) => connectedIds.add(id)));

      nextNodes.forEach((nextNode) => {
        if (!connectedIds.has(nextNode.id)) {
          // Conecta o nó isolado ao nó mais próximo do nível anterior
          const closest = currentNodes.reduce((best, n) => {
            const dist = Math.abs(n.index - nextNode.index);
            const bestDist = Math.abs(best.index - nextNode.index);
            return dist < bestDist ? n : best;
          }, currentNodes[0]);

          closest.connections.push(nextNode.id);
        }
      });
    }

    // ========== 3. Ajustes finais de tipos ==========
    // Garante pelo menos 1 recovery a cada ~5 níveis
    this.ensureMinimumRecoveries(levels);

    // Garante que não tenha elite no nível 2 e 3
    levels.forEach((lvl) => {
      if (lvl.level <= 3) {
        lvl.nodes.forEach((n) => {
          if (n.type === "elite") n.type = "battle";
        });
      }
    });

    return {
      seed: this.seed,
      totalLevels: this.totalLevels,
      levels,
      // Helper para o jogo
      getNode: (id) => {
        for (const lvl of levels) {
          const found = lvl.nodes.find((n) => n.id === id);
          if (found) return found;
        }
        return null;
      },
      getStartNode: () => levels[0].nodes[0],
      getShelterNode: () => levels[levels.length - 1].nodes[0],
    };
  }

  ensureMinimumRecoveries(levels) {
    for (let i = 3; i < levels.length - 1; i += 5) {
      const lvl = levels[i];
      const hasRecovery = lvl.nodes.some((n) => n.type === "recovery");
      if (!hasRecovery && lvl.nodes.length > 0) {
        // Transforma um nó de batalha em recovery
        const battleNode = lvl.nodes.find((n) => n.type === "battle");
        if (battleNode) battleNode.type = "recovery";
      }
    }
  }
}

// Export para diferentes ambientes
if (typeof module !== "undefined" && module.exports) {
  module.exports = MapGenerator;
} else {
  window.MapGenerator = MapGenerator;
}
