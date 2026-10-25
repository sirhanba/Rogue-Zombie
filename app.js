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

    const startNode = map.getStartNode();
    startNode.visited = true;
    startNode.completed = true;

    document.getElementById("map-seed").textContent = `Seed: ${map.seed}`;
    renderMap();
    showScreen("run");

    // Desenha as linhas depois que a tela estabilizar
    setTimeout(() => drawConnections(map), 80);
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

        if (availableIds.has(node.id)) {
          el.addEventListener("click", () => selectNode(node.id));
        }

        row.appendChild(el);
      });

      container.appendChild(row);
    });
  }

  // ===== DESENHA AS LINHAS (versão mais robusta) =====
  function drawConnections(map) {
    const svg = document.getElementById("map-connections");
    const wrapper = document.getElementById("map-wrapper");
    const container = document.getElementById("map-container");

    if (!svg || !wrapper || !container) return;

    // Limpa
    svg.innerHTML = "";

    // Ajusta o tamanho do SVG para cobrir todo o conteúdo
    const width = container.scrollWidth;
    const height = container.scrollHeight;
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.style.width = width + "px";
    svg.style.height = height + "px";

    const wrapperRect = wrapper.getBoundingClientRect();

    map.levels.forEach(levelData => {
      levelData.nodes.forEach(node => {
        const fromEl = document.getElementById(node.id);
        if (!fromEl) return;

        const fromRect = fromEl.getBoundingClientRect();

        // Posição relativa ao wrapper + scroll
        const fromX = fromRect.left - wrapperRect.left + wrapper.scrollLeft + fromRect.width / 2;
        const fromY = fromRect.top - wrapperRect.top + wrapper.scrollTop + fromRect.height / 2;

        node.connections.forEach(targetId => {
          const toEl = document.getElementById(targetId);
          if (!toEl) return;

          const toRect = toEl.getBoundingClientRect();
          const toX = toRect.left - wrapperRect.left + wrapper.scrollLeft + toRect.width / 2;
          const toY = toRect.top - wrapperRect.top + wrapper.scrollTop + toRect.height / 2;

          const midY = (fromY + toY) / 2;

          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", `M\( {fromX}, \){fromY} C\( {fromX}, \){midY} \( {toX}, \){midY} \( {toX}, \){toY}`);
          path.setAttribute("stroke", "#555");
          path.setAttribute("stroke-width", "2");
          path.setAttribute("fill", "none");
          path.setAttribute("stroke-dasharray", "6 4");
          svg.appendChild(path);
        });
      });
    });
  }

  // ===== SELECIONAR NÓ =====
  function selectNode(nodeId) {
    const map = currentRun.map;
    const node = map.getNode(nodeId);
    if (!node) return;

    currentRun.currentNodeId = nodeId;
    node.visited = true;
    node.completed = true;

    console.log(`Entrou no nó: \( {node.id} ( \){node.type})`);

    if (node.type === "shelter") {
      alert("Você chegou ao Abrigo Seguro! 🎉");
      showScreen("menu");
      return;
    }

    renderMap();

    // Redesenha as linhas após a atualização
    setTimeout(() => drawConnections(map), 50);
  }

  // Redesenha as linhas se o usuário rolar o mapa
  document.getElementById("map-wrapper")?.addEventListener("scroll", () => {
    if (currentRun) {
      clearTimeout(window._scrollTimer);
      window._scrollTimer = setTimeout(() => {
        drawConnections(currentRun.map);
      }, 30);
    }
  });

  window.RogueZombie = { showScreen, startNewRun };
  console.log("Rogue Zombie — Mapa corrigido");
})();
