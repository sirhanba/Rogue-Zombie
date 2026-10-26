/**
 * Rogue Zombie - App Principal
 * Fase 1: Mecânicas + Combate QTE
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

  // ===== TELAS =====
  const screens = {
    menu: document.getElementById("screen-menu"),
    run: document.getElementById("screen-run"),
    combat: document.getElementById("screen-combat"),
    skills: document.getElementById("screen-skills"),
  };

  const ICONS = {
    start: "🚶", battle: "💀", elite: "🔥", event: "❓",
    recovery: "❤️", shop: "🛒", chest: "📦", shelter: "🏠"
  };

  let currentRun = null;

  // ===== DADOS DO JOGADOR (temporário) =====
  let player = {
    hp: 100,
    maxHp: 100,
    ammo: 30,
  };

  // ===== ARMAS =====
  const WEAPONS = [
    {
      id: "knife",
      name: "Faca",
      icon: "🔪",
      damage: 12,
      ammoCost: 0,
      // ângulos da zona verde (em graus, 0 = topo)
      greenStart: 200,
      greenEnd: 340,       // zona grande
      goldStart: null,
      goldEnd: null,
      pointerSpeed: 2.2,   // graus por frame
    },
    {
      id: "pistol",
      name: "9mm",
      icon: "🔫",
      damage: 28,
      ammoCost: 1,
      greenStart: 240,
      greenEnd: 300,
      goldStart: null,
      goldEnd: null,
      pointerSpeed: 2.8,
    },
    {
      id: "shotgun",
      name: "Escopeta",
      icon: "💥",
      damage: 55,
      ammoCost: 2,
      greenStart: 255,
      greenEnd: 285,       // zona menor
      goldStart: null,
      goldEnd: null,
      pointerSpeed: 3.4,
    },
  ];

  let selectedWeapon = WEAPONS[0];

  // ===== ESTADO DO COMBATE =====
  let combat = null;
  let pointerAngle = 0;
  let gaugeRaf = null;
  let zombieAttackTimer = null;

  function showScreen(name) {
    Object.values(screens).forEach(el => el.classList.remove("active"));
    if (screens[name]) screens[name].classList.add("active");
  }

  // ===== MENU =====
  document.getElementById("btn-new-run").addEventListener("click", startNewRun);
  document.getElementById("btn-skill-tree").addEventListener("click", () => showScreen("skills"));
  document.getElementById("btn-back-menu").addEventListener("click", () => {
    stopCombat();
    showScreen("menu");
  });

  document.querySelectorAll("[data-back]").forEach(btn => {
    btn.addEventListener("click", () => showScreen(btn.getAttribute("data-back")));
  });

  // ===== NOVA RUN =====
  function startNewRun() {
    const generator = new MapGenerator({ totalLevels: 15 });
    const map = generator.generate();

    player = { hp: 100, maxHp: 100, ammo: 30 };

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
    setTimeout(() => drawConnections(map), 80);
  }

  // ===== MAPA =====
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

  function drawConnections(map) {
    const svg = document.getElementById("map-connections");
    const wrapper = document.getElementById("map-wrapper");
    const container = document.getElementById("map-container");
    if (!svg || !wrapper || !container) return;

    svg.innerHTML = "";
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

  function selectNode(nodeId) {
    const map = currentRun.map;
    const node = map.getNode(nodeId);
    if (!node) return;

    currentRun.currentNodeId = nodeId;
    node.visited = true;

    if (node.type === "shelter") {
      alert("Você chegou ao Abrigo Seguro! 🎉");
      showScreen("menu");
      return;
    }

    if (node.type === "battle" || node.type === "elite") {
      startCombat(node);
      return;
    }

    // Outros tipos (por enquanto só avança)
    node.completed = true;
    renderMap();
    setTimeout(() => drawConnections(map), 50);
  }

  // =====================================================
  //                    COMBATE QTE
  // =====================================================

  function startCombat(node) {
    const isElite = node.type === "elite";
    const level = node.level;

    const zombieHp = isElite ? 80 + level * 12 : 35 + level * 8;
    const zombieDamage = isElite ? 14 + Math.floor(level * 1.2) : 8 + Math.floor(level * 0.8);

    combat = {
      node,
      zombie: {
        name: isElite ? `Zumbi Elite Nv.\( {level}` : `Zumbi Nv. \){level}`,
        hp: zombieHp,
        maxHp: zombieHp,
        damage: zombieDamage,
      },
      finished: false,
    };

    // Atualiza UI
    document.getElementById("player-hp").textContent = player.hp;
    document.getElementById("player-ammo").textContent = player.ammo;
    document.getElementById("zombie-name").textContent = combat.zombie.name;
    updateZombieHpBar();
    document.getElementById("combat-log").textContent = "";

    renderWeapons();
    showScreen("combat");

    // Inicia a rosquinha
    pointerAngle = 0;
    startGauge();

    // Zumbi ataca a cada 5 segundos
    zombieAttackTimer = setInterval(() => {
      if (combat && !combat.finished) {
        zombieAttack();
      }
    }, 5000);
  }

  function stopCombat() {
    if (gaugeRaf) cancelAnimationFrame(gaugeRaf);
    gaugeRaf = null;
    if (zombieAttackTimer) clearInterval(zombieAttackTimer);
    zombieAttackTimer = null;
    combat = null;
  }

  function renderWeapons() {
    const list = document.getElementById("weapon-list");
    list.innerHTML = "";

    WEAPONS.forEach(w => {
      const btn = document.createElement("button");
      btn.className = "weapon-btn" + (w.id === selectedWeapon.id ? " selected" : "");
      btn.innerHTML = `
        ${w.icon} ${w.name}
        <div class="ammo-cost">${w.ammoCost === 0 ? "Infinito" : w.ammoCost + " munição"}</div>
      `;
      btn.addEventListener("click", () => {
        selectedWeapon = w;
        renderWeapons();
      });
      list.appendChild(btn);
    });
  }

  // ===== ROSQUINHA (Canvas) =====
  function startGauge() {
    const canvas = document.getElementById("gauge-canvas");
    const ctx = canvas.getContext("2d");
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = 90;
    const lineWidth = 22;

    function draw() {
      if (!combat || combat.finished) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fundo da rosquinha
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#222";
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      const w = selectedWeapon;

      // Zona vermelha (tudo)
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#8B1A1A";
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Zona verde
      const greenStart = (w.greenStart - 90) * Math.PI / 180;
      const greenEnd = (w.greenEnd - 90) * Math.PI / 180;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, greenStart, greenEnd);
      ctx.strokeStyle = "#1e8449";
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Zona dourada (headshot) se existir
      if (w.goldStart !== null) {
        const goldStart = (w.goldStart - 90) * Math.PI / 180;
        const goldEnd = (w.goldEnd - 90) * Math.PI / 180;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, goldStart, goldEnd);
        ctx.strokeStyle = "#f1c40f";
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      // Ponteiro
      const rad = (pointerAngle - 90) * Math.PI / 180;
      const px = cx + Math.cos(rad) * (radius - 4);
      const py = cy + Math.sin(rad) * (radius - 4);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();

      // Centro
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      // Gira o ponteiro
      pointerAngle += w.pointerSpeed;
      if (pointerAngle >= 360) pointerAngle -= 360;

      gaugeRaf = requestAnimationFrame(draw);
    }

    draw();
  }

  function isInZone(angle, start, end) {
    // Normaliza
    angle = (angle + 360) % 360;
    start = (start + 360) % 360;
    end = (end + 360) % 360;

    if (start < end) {
      return angle >= start && angle <= end;
    } else {
      // Zona que cruza o 0
      return angle >= start || angle <= end;
    }
  }

  // ===== BOTÃO ATACAR =====
  document.getElementById("btn-attack").addEventListener("click", () => {
    if (!combat || combat.finished) return;

    const w = selectedWeapon;

    // Verifica munição
    if (w.ammoCost > 0 && player.ammo < w.ammoCost) {
      log("Sem munição!");
      return;
    }

    // Consome munição
    if (w.ammoCost > 0) {
      player.ammo -= w.ammoCost;
      document.getElementById("player-ammo").textContent = player.ammo;
    }

    // Verifica zona
    const angle = pointerAngle;
    let hit = false;
    let crit = false;

    if (w.goldStart !== null && isInZone(angle, w.goldStart, w.goldEnd)) {
      hit = true;
      crit = true;
    } else if (isInZone(angle, w.greenStart, w.greenEnd)) {
      hit = true;
    }

    if (hit) {
      let dmg = w.damage;
      if (crit) dmg = Math.floor(dmg * 1.8);

      combat.zombie.hp -= dmg;
      updateZombieHpBar();

      log(crit ? `HEADSHOT! -\( {dmg}` : `Acertou! - \){dmg}`);

      if (combat.zombie.hp <= 0) {
        winCombat();
      }
    } else {
      log("Errou!");
    }
  });

  function zombieAttack() {
    if (!combat || combat.finished) return;

    player.hp -= combat.zombie.damage;
    if (player.hp < 0) player.hp = 0;
    document.getElementById("player-hp").textContent = player.hp;

    log(`Zumbi atacou! -${combat.zombie.damage}`);

    if (player.hp <= 0) {
      loseCombat();
    }
  }

  function updateZombieHpBar() {
    const pct = Math.max(0, (combat.zombie.hp / combat.zombie.maxHp) * 100);
    document.getElementById("zombie-hp-fill").style.width = pct + "%";
    document.getElementById("zombie-hp-text").textContent = `HP: ${Math.max(0, Math.ceil(combat.zombie.hp))}`;
  }

  function log(msg) {
    document.getElementById("combat-log").textContent = msg;
  }

  function winCombat() {
    combat.finished = true;
    stopCombat();
    log("Zumbi eliminado!");

    combat.node.completed = true;

    setTimeout(() => {
      renderMap();
      showScreen("run");
      setTimeout(() => drawConnections(currentRun.map), 50);
    }, 900);
  }

  function loseCombat() {
    combat.finished = true;
    stopCombat();
    log("Você morreu...");

    setTimeout(() => {
      alert("Game Over! Você foi devorado.");
      showScreen("menu");
    }, 1000);
  }

  // Scroll do mapa redesenha linhas
  document.getElementById("map-wrapper")?.addEventListener("scroll", () => {
    if (currentRun) {
      clearTimeout(window._scrollTimer);
      window._scrollTimer = setTimeout(() => drawConnections(currentRun.map), 30);
    }
  });

  window.RogueZombie = { showScreen, startNewRun };
  console.log("Rogue Zombie — Combate QTE carregado");
})();
