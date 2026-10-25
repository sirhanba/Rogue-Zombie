/**
 * Rogue Zombie - App Principal
 * Fase 1: Mecânicas e Sistemas
 */

(function () {
  "use strict";

  // Telegram WebApp
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor("#0f0f0f");
    tg.setBackgroundColor("#0f0f0f");
  }

  // Elementos das telas
  const screens = {
    menu: document.getElementById("screen-menu"),
    run: document.getElementById("screen-run"),
    skills: document.getElementById("screen-skills"),
  };

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove("active"));
    if (screens[name]) {
      screens[name].classList.add("active");
    }
  }

  // Botões do Menu
  document.getElementById("btn-new-run").addEventListener("click", () => {
    startNewRun();
  });

  document.getElementById("btn-skill-tree").addEventListener("click", () => {
    showScreen("skills");
  });

  // Botões de voltar
  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-back");
      showScreen(target);
    });
  });

  // Iniciar Nova Run
  function startNewRun() {
    const generator = new MapGenerator({ totalLevels: 15 });
    const map = generator.generate();

    console.log("Nova Run iniciada!");
    console.log("Seed do mapa:", map.seed);

    window.currentRun = {
      map,
      player: null,
      currentNodeId: map.getStartNode().id,
    };

    showScreen("run");
  }

  window.RogueZombie = {
    showScreen,
    startNewRun,
  };

  console.log("Rogue Zombie carregado. Menu principal pronto.");
})();
