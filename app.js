/**
 * Rogue Zombie - App Principal
 * Fase 1: Mecânicas e Sistemas
 */

(function () {
  "use strict";

  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor("#0f0f0f");
    tg.setBackgroundColor("#0f0f0f");
  }

  const screens = {
    menu: document.getElementById("screen-menu"),
    run: document.getElementById("screen-run"),
    skills: document.getElementById("screen-skills"),
  };

  const ICONS = {
    start: "🚶",
    battle: "💀",
    elite: "🔥",
    event: "❓",
    recovery: "❤️",
    shop: "🛒",
    chest: "📦",
    shelter: "🏠"
  };

  let currentRun = null;

  function showScreen(name) {
    Object.values(screens).forEach(el => el.classList.remove("active"));
    if (screens[name]) screens[name].classList.add("active");
  }

  // ===== MENU =====
  document.getElementById("btn-new-run").addEventListener("click", startNewRun);
  document.getElementById("btn-skill-tree").addEventListener("click", () => showScreen("skills"));
  document.getElementById("btn-back-menu").addEventListener("click", () => showScreen("menu"));

  document.querySelectorAll("[data-back]").forEach(btn => {
    btn.addEventListener("click", () => showScreen(btn.getAttribute("data-back")));
  });

  // ===== NOVA RUN =====
  function startNewRun() {
    const generator = new MapGenerator({ totalLevels: 15 });
    const map = generator.generate();

    currentRun = {
      map,
      currentNodeId: map.getStartNode().id,
    };

    // Marca o início como visitado
    const startNode = map.getStartNode();
    startNode.visited = true;
    startNode.completed = true;

    document.getElementById("map-seed").textContent = `Seed: ${map.seed}`;
    renderMap();
    showScreen("run");
  }

  // ===== RENDER DO MAPA =====
  function renderMap() {
    const container = document.getElementById("map-container");
    const svg = document.getElementById("map-connections");
    container.innerHTML = "";
    svg.innerHTML = "";

    const map = currentRun.map;
    const currentId = currentRun.currentNodeId;
    const currentNode = map.getNode(currentId);

    // Descobre quais nós estão disponíveis (conexões do nó atual)
    const availableIds = new Set(currentNode.connections);

    map.levels.forEach(levelData => {
      const row = document.createElement("div");
      row.className = "level-row";

      const label = document.createElement("div");
      label.className = "level-label";
      label.textContent = levelData.level;
      row.appendChild(label);

      levelData.nodes.forEach(node => {
        const el = document.createElement("div");
        el.className = `node ${node.type}`;
        el.id = node.id;
        el.textContent = ICONS[node.type] || "?";

        if (node.id === currentId) el.classList.add("current");
        if (node.visited) el.classList.add("visited");
        if (availableIds.has(node.id)) el.classList.add("available");

        // Clique só nos disponíveis
        if (availableIds.has(node.id)) {
          el.addEventListener("click", () => selectNode(node.id));
        }

        row.appendChild(el);
      });

      container.appendChild(row);
    });

    // Desenha as linhas depois do layout
    requestAnimationFrame(() => drawConnections(map));
  }

  function drawConnections(map) {
    const svg = document.getElementById("map-connections");
    const wrapper = document.getElementById("map-wrapper");
    const container = document.getElementById("map-container");

    const wrapperRect = wrapper.getBoundingClientRect();

    svg.setAttribute("width", container.scrollWidth);
    svg.setAttribute("height", container.scrollHeight);

    let paths = "";

    map.levels.forEach(levelData => {
      levelData.nodes.forEach(node => {
        const fromEl = document.getElementById(node.id);
        if (!fromEl) return;

        const fromRect = fromEl.getBoundingClientRect();
        const fromX = fromRect.left + fromRect.width / 2 - wrapperRect.left + wrapper.scrollLeft;
        const fromY = fromRect.top + fromRect.height / 2 - wrapperRect.top + wrapper.scrollTop;

        node.connections.forEach(targetId => {
          const toEl = document.getElementById(targetId);
          if (!toEl) return;

          const toRect = toEl.getBoundingClientRect();
          const toX = toRect.left + toRect.width / 2 - wrapperRect.left + wrapper.scrollLeft;
          const toY = toRect.top + toRect.height / 2 - wrapperRect.top + wrapper.scrollTop;

          const midY = (fromY + toY) / 2;
          paths += `<path d="M\( {fromX}, \){fromY} C\( {fromX}, \){midY} \( {toX}, \){midY} \( {toX}, \){toY}" 
                     stroke="#444" stroke-width="2" fill="none" stroke-dasharray="5 4"/>`;
        });
      });
    });

    svg.innerHTML = paths;
  }

  // ===== SELECIONAR NÓ =====
  function selectNode(nodeId) {
    const map = currentRun.map;
    const node = map.getNode(nodeId);
    if (!node) return;

    // Marca como atual e visitado
    currentRun.currentNodeId = nodeId;
    node.visited = true;

    // Por enquanto só avança no mapa.
    // Depois aqui vamos chamar a batalha / evento / etc.
    console.log(`Entrou no nó: \( {node.id} ( \){node.type})`);

    // Se for o abrigo → vitória (placeholder)
    if (node.type === "shelter") {
      alert("Você chegou ao Abrigo Seguro! 🎉");
      showScreen("menu");
      return;
    }

    // Marca como completado (temporário até termos os sistemas)
    node.completed = true;

    renderMap();
  }

  window.RogueZombie = { showScreen, startNewRun };
  console.log("Rogue Zombie — Mapa carregado");
})();
