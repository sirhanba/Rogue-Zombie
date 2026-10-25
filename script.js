let tg = window.Telegram.WebApp;
if (tg) { tg.expand(); }

let metaData = JSON.parse(localStorage.getItem('zombie_meta')) || {
    points: 0,
    skills: {
        startAmmo: 0, 
        maxHp: 0, 
        widerGreen: 0 
    }
};

const skillConfig = {
    startAmmo: { name: "Pente Extra", desc: "Começa com +3 munições iniciais.", cost: 10, max: 3 },
    maxHp: { name: "Resistência Física", desc: "Aumenta o HP máximo em +25.", cost: 15, max: 3 },
    widerGreen: { name: "Mira Estável", desc: "Alarga a zona verde do QTE em 8%.", cost: 20, max: 2 }
};

const weaponsDatabase = {
    knife: { name: "Faca Tática", damage: 1, ammoCost: 0, speed: 0.035, greenWidth: 1.2 },
    pistol: { name: "Pistola 9mm", damage: 2, ammoCost: 1, speed: 0.045, greenWidth: 0.8 },
    shotgun: { name: "Escopeta 12", damage: 4, ammoCost: 1, speed: 0.03, greenWidth: 0.5 }
};

let run = {
    hp: 100,
    maxHp: 100,
    ammo: 8,
    scrap: 0,
    currentTier: 0,
    map: [],
    activeWeapon: 'pistol',
    equippedWeapons: ['pistol', 'knife'],
    inventory: [
        { id: 'bandage', name: 'Bandagem', icon: '🩹', type: 'item', count: 2 },
        { id: 'ammo_box', name: 'Caixa de Munição', icon: '📦', type: 'item', count: 1 }
    ]
};

const TOTAL_TIERS = 20;

function saveMeta() {
    localStorage.setItem('zombie_meta', JSON.stringify(metaData));
}

function showScreen(screenId) {
    stopAllLoops();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    if(screenId === 'screen-menu') updateMenu();
    if(screenId === 'screen-skills') renderSkillTree();
    if(screenId === 'screen-map') {
        setTimeout(drawMapConnections, 50);
    }
    if(screenId === 'screen-backpack') {
        renderBackpack();
    }
}

function stopAllLoops() {
    if (combatInterval) {
        clearInterval(combatInterval);
        combatInterval = null;
    }
    if (qteAnimation) {
        cancelAnimationFrame(qteAnimation);
        qteAnimation = null;
    }
}

function updateMenu() {
    document.getElementById('meta-points').innerText = metaData.points;
}

function startRun() {
    stopAllLoops();
    run.maxHp = 100 + (metaData.skills.maxHp * 25);
    run.hp = run.maxHp;
    run.ammo = 8 + (metaData.skills.startAmmo * 3);
    run.scrap = 15;
    run.currentTier = 0;
    run.activeWeapon = 'pistol';
    run.equippedWeapons = ['pistol', 'knife'];
    run.inventory = [
        { id: 'bandage', name: 'Bandagem', icon: '🩹', type: 'item', count: 2 },
        { id: 'ammo_box', name: 'Caixa de Munição', icon: '📦', type: 'item', count: 1 }
    ];
    generateMap();
    showScreen('screen-map');
    renderMap();
    updateHud();
}

function generateMap() {
    run.map = [];
    for (let t = 0; t < TOTAL_TIERS; t++) {
        let tierNodes = [];
        let nodeCount = (t == 0 || t == TOTAL_TIERS - 1) ? 1 : (Math.floor(Math.random() * 3) + 2);
        for (let i = 0; i < nodeCount; i++) {
            let type = 'combat';
            if (t == 0) type = 'combat';
            else if (t == TOTAL_TIERS - 1) type = 'shelter';
            else {
                const types = ['combat', 'combat', 'loot', 'event', 'rest', 'shop'];
                type = types[Math.floor(Math.random() * types.length)];
            }
            tierNodes.push({
                id: t * 10 + i,
                tier: t,
                type: type, 
                visited: false,
                available: t == 0,
                connections: []
            });
        }
        run.map.push(tierNodes);
    }

    for (let t = 0; t < TOTAL_TIERS - 1; t++) {
        let currentTierNodes = run.map[t];
        let nextTierNodes = run.map[t + 1];
        currentTierNodes.forEach(node => {
            nextTierNodes.forEach(nextNode => {
                node.connections.push(nextNode.id);
            });
        });
    }
}

function renderMap() {
    const container = document.getElementById('map-container');
    container.innerHTML = '';
    run.map.forEach((tier, tIndex) => {
        const tierDiv = document.createElement('div');
        tierDiv.className = 'map-tier';
        tierDiv.dataset.tier = tIndex;
        tier.forEach(node => {
            const btn = document.createElement('div');
            btn.className = `map-node ${node.available ? 'available' : ''} ${node.visited ? 'visited' : ''}`;
            btn.id = `node-${node.id}`;
            let icon = '💀';
            if (node.type === 'loot') icon = '📦';
            if (node.type === 'event') icon = '❓';
            if (node.type === 'rest') icon = '🔥';
            if (node.type === 'shop') icon = '🛒';
            if (node.type === 'shelter') icon = '🚇';
            btn.innerText = icon;
            if (node.available && !node.visited) {
                btn.onclick = () => selectNode(node);
            }
            tierDiv.appendChild(btn);
        });
        container.appendChild(tierDiv);
    });
    document.getElementById('player-floor').innerText = run.currentTier + 1;
    setTimeout(drawMapConnections, 50);
}

function drawMapConnections() {
    const canvas = document.getElementById('map-canvas');
    const wrapper = document.getElementById('map-wrapper');
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext('2d');
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.scrollHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#57606f';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    run.map.forEach(tier => {
        tier.forEach(node => {
            const elFrom = document.getElementById(`node-${node.id}`);
            if (!elFrom) return;
            const rectFrom = elFrom.getBoundingClientRect();
            const wrapperRect = wrapper.getBoundingClientRect();
            let x1 = rectFrom.left + rectFrom.width / 2 - wrapperRect.left + wrapper.scrollLeft;
            let y1 = rectFrom.top + rectFrom.height / 2 - wrapperRect.top + wrapper.scrollTop;
            node.connections.forEach(targetId => {
                const elTo = document.getElementById(`node-${targetId}`);
                if (!elTo) return;
                const rectTo = elTo.getBoundingClientRect();
                let x2 = rectTo.left + rectTo.width / 2 - wrapperRect.left + wrapper.scrollLeft;
                let y2 = rectTo.top + rectTo.height / 2 - wrapperRect.top + wrapper.scrollTop;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            });
        });
    });
}

function selectNode(node) {
    node.visited = true;
    if (node.tier + 1 < TOTAL_TIERS) {
        run.map[node.tier + 1].forEach(n => {
            if (node.connections.includes(n.id)) {
                n.available = true;
            }
        });
    }
    run.map[node.tier].forEach(n => n.available = false);
    run.currentTier = node.tier;
    renderMap();
    if (node.type === 'combat') {
        startCombat();
    } else if (node.type === 'loot') {
        triggerLoot();
    } else if (node.type === 'event') {
        triggerEvent();
    } else if (node.type === 'rest') {
        triggerRest();
    } else if (node.type === 'shop') {
        triggerShop();
    } else if (node.type === 'shelter') {
        winGame();
    }
}

function updateHud() {
    document.getElementById('player-hp').innerText = run.hp;
    document.getElementById('player-scrap').innerText = run.scrap;
}

function updateEventHud() {
    let hpEl = document.getElementById('event-hp');
    let scrapEl = document.getElementById('event-scrap');
    if (hpEl) hpEl.innerText = run.hp;
    if (scrapEl) scrapEl.innerText = run.scrap;
}

function triggerShop() {
    showScreen('screen-event');
    document.getElementById('event-title').innerText = "MERCADO NEGRO NA ESTRADA";
    document.getElementById('event-desc').innerText = "Um negociante misterioso instalou uma banca. Troque sua sucata por suprimentos:";
    updateEventHud();
    renderShopItems();
}

function renderShopItems() {
    let actions = document.getElementById('event-actions');
    actions.innerHTML = '';

    let shopItems = [
        { 
            name: '🩹 Bandagem (+25 HP)', cost: 10, 
            action: () => {
                if (run.scrap >= 10) {
                    run.scrap -= 10;
                    run.hp = Math.min(run.maxHp, run.hp + 25);
                    addToInventory({ id: 'bandage', name: 'Bandagem', icon: '🩹', type: 'item', count: 1 });
                    updateHud();
                    updateEventHud();
                    renderShopItems();
                } else {
                    alert("Sucata insuficiente!");
                }
            } 
        },
        { 
            name: '📦 Caixa de Munição (+4 Munição)', cost: 15, 
            action: () => {
                if (run.scrap >= 15) {
                    run.scrap -= 15;
                    run.ammo += 4;
                    addToInventory({ id: 'ammo_box', name: 'Caixa de Munição', icon: '📦', type: 'item', count: 1 });
                    updateHud();
                    updateEventHud();
                    renderShopItems();
                } else {
                    alert("Sucata insuficiente!");
                }
            } 
        },
        { 
            name: '💉 Kit Médico (Cura Total)', cost: 30, 
            action: () => {
                if (run.scrap >= 30) {
                    run.scrap -= 30;
                    run.hp = run.maxHp;
                    addToInventory({ id: 'medkit', name: 'Kit Médico', icon: '💉', type: 'item', count: 1 });
                    updateHud();
                    updateEventHud();
                    renderShopItems();
                } else {
                    alert("Sucata insuficiente!");
                }
            } 
        }
    ];

    shopItems.forEach(item => {
        let btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.marginBottom = '6px';
        btn.innerHTML = `${item.name} <span style="color:var(--accent-yellow);">(${item.cost} Sucata)</span>`;
        btn.onclick = item.action;
        actions.appendChild(btn);
    });

    let leaveBtn = document.createElement('button');
    leaveBtn.className = 'btn btn-secondary';
    leaveBtn.innerText = "Continuar Viagem";
    leaveBtn.onclick = () => showScreen('screen-map');
    actions.appendChild(leaveBtn);
}

function renderBackpack() {
    document.getElementById('bp-hp').innerText = `${run.hp} / ${run.maxHp}`;
    
    const eqContainer = document.getElementById('bp-equipped-weapons');
    eqContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        let wKey = run.equippedWeapons[i];
        let slotDiv = document.createElement('div');
        slotDiv.style.background = '#121214';
        slotDiv.style.border = '1px solid #333';
        slotDiv.style.borderRadius = '8px';
        slotDiv.style.padding = '8px';
        slotDiv.style.textAlign = 'center';
        slotDiv.style.fontSize = '12px';
        slotDiv.style.flex = '1';
        
        if (wKey && weaponsDatabase[wKey]) {
            let weapon = weaponsDatabase[wKey];
            slotDiv.innerHTML = `<strong>Slot ${i+1}</strong><br><span style="color:var(--accent-green);">${weapon.name}</span>`;
        } else {
            slotDiv.innerHTML = `<strong>Slot ${i+1}</strong><br><span style="color:var(--text-muted);">Vazio</span>`;
        }
        eqContainer.appendChild(slotDiv);
    }

    const gridContainer = document.getElementById('bp-inventory-grid');
    gridContainer.innerHTML = '';
    
    for (let i = 0; i < 10; i++) {
        let itemSlot = document.createElement('div');
        itemSlot.style.background = '#121214';
        itemSlot.style.border = '1px solid #333';
        itemSlot.style.borderRadius = '8px';
        itemSlot.style.minHeight = '65px';
        itemSlot.style.display = 'flex';
        itemSlot.style.flexDirection = 'column';
        itemSlot.style.alignItems = 'center';
        itemSlot.style.justifyContent = 'center';
        itemSlot.style.fontSize = '11px';
        itemSlot.style.padding = '4px';
        itemSlot.style.textAlign = 'center';

        if (run.inventory[i]) {
            let item = run.inventory[i];
            itemSlot.innerHTML = `<span style="font-size: 18px;">${item.icon || '📦'}</span><span style="margin-top: 2px;">${item.name}</span>`;
            if (item.count && item.count > 1) {
                itemSlot.innerHTML += `<span style="font-size: 9px; color: var(--accent-yellow);">x${item.count}</span>`;
            }
        } else {
            itemSlot.innerHTML = `<span style="color: #333; font-size: 10px;">Vazio</span>`;
        }
        gridContainer.appendChild(itemSlot);
    }
}

function addToInventory(itemObj) {
    let existing = run.inventory.find(i => i.id === itemObj.id);
    if (existing && existing.count) {
        existing.count += (itemObj.count || 1);
        return true;
    }
    if (run.inventory.length < 10) {
        run.inventory.push({ ...itemObj, count: itemObj.count || 1 });
        return true;
    }
    return false;
}

let combatInterval = null;
let qteAnimation = null;
let combatData = {
    enemyHp: 3,
    maxEnemyHp: 3,
    attackTimer: 0,
    angle: 0
};

function switchWeapon(wKey) {
    run.activeWeapon = wKey;
    document.querySelectorAll('.weapon-slot-btn').forEach(b => b.classList.remove('active'));
    let selectedSlot = document.getElementById(`slot-${wKey}`);
    if (selectedSlot) selectedSlot.classList.add('active');
}

function startCombat() {
    showScreen('screen-combat');
    combatData.enemyHp = 3 + Math.floor(run.currentTier / 2);
    combatData.maxEnemyHp = combatData.enemyHp;
    combatData.attackTimer = 100;
    combatData.angle = 0;
    document.getElementById('enemy-name').innerText = `Infectado (Etapa ${run.currentTier + 1})`;
    document.getElementById('combat-hp').innerText = run.hp;
    document.getElementById('combat-ammo').innerText = run.ammo;
    document.getElementById('enemy-hp').innerText = combatData.enemyHp;
    switchWeapon('pistol');
    initQTECanvas();
}

function initQTECanvas() {
    const canvas = document.getElementById('qteCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Limpa qualquer loop anterior antes de iniciar um novo combate
    stopAllLoops();

    combatInterval = setInterval(() => {
        combatData.attackTimer -= 2.5;
        let pct = Math.max(0, (combatData.attackTimer / 100) * 100);
        let fillEl = document.getElementById('zombie-fill');
        if (fillEl) fillEl.style.width = pct + '%';
        
        if (combatData.attackTimer <= 0) {
            run.hp -= (10 + Math.floor(run.currentTier / 2));
            let combatHpEl = document.getElementById('combat-hp');
            if (combatHpEl) combatHpEl.innerText = run.hp;
            combatData.attackTimer = 100; 
            if (run.hp <= 0) {
                endGame(false);
            }
        }
    }, 100);

    function drawRing() {
        if (!canvas || !document.getElementById('screen-combat').classList.contains('active')) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let centerX = canvas.width / 2;
        let centerY = canvas.height / 2;
        let radius = 60;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#ff4757';
        ctx.stroke();
        
        let weapon = weaponsDatabase[run.activeWeapon];
        let bonusGreen = metaData.skills.widerGreen * 0.08;
        let greenLimit = Math.PI * (weapon.greenWidth + bonusGreen);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, greenLimit);
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#2ed573';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        let pointerX = centerX + Math.cos(combatData.angle) * radius;
        let pointerY = centerY + Math.sin(combatData.angle) * radius;
        ctx.lineTo(pointerX, pointerY);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        combatData.angle += weapon.speed;
        qteAnimation = requestAnimationFrame(drawRing);
    }
    
    drawRing();
}

function showCombatToast(text) {
    let existing = document.getElementById('combat-toast');
    if (existing) existing.remove();
    let toast = document.createElement('div');
    toast.id = 'combat-toast';
    toast.innerText = text;
    toast.style.position = 'absolute';
    toast.style.top = '10px';
    toast.style.background = 'rgba(255, 71, 87, 0.95)';
    toast.style.color = '#fff';
    toast.style.padding = '6px 14px';
    toast.style.borderRadius = '6px';
    toast.style.fontWeight = 'bold';
    toast.style.fontSize = '13px';
    toast.style.zIndex = '100';
    toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
    toast.style.transition = 'opacity 0.3s';
    let arena = document.querySelector('.combat-arena');
    if (arena) {
        arena.style.position = 'relative';
        arena.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 1200);
    }
}

function triggerShoot() {
    let weapon = weaponsDatabase[run.activeWeapon];
    if (weapon.ammoCost > 0 && run.ammo <= 0) {
        showCombatToast("SEM MUNIÇÃO!");
        return;
    }
    if (weapon.ammoCost > 0) {
        run.ammo -= 1;
        document.getElementById('combat-ammo').innerText = run.ammo;
    }
    let normalizedAngle = combatData.angle % (2 * Math.PI);
    let bonusGreen = metaData.skills.widerGreen * 0.08;
    let greenLimit = Math.PI * (weapon.greenWidth + bonusGreen);
    
    if (normalizedAngle >= 0 && normalizedAngle <= greenLimit) {
        combatData.enemyHp -= weapon.damage;
        if (combatData.enemyHp <= 0) {
            endCombat(true);
            return;
        }
    }
    document.getElementById('enemy-hp').innerText = Math.max(0, combatData.enemyHp);
}

function endCombat(victory) {
    stopAllLoops();
    if (victory) {
        run.scrap += 12;
        updateHud();
        showScreen('screen-map');
    } else {
        endGame(false);
    }
}

function triggerLoot() {
    showScreen('screen-event');
    document.getElementById('event-title').innerText = "CAIXA DE SUPRIMENTOS";
    document.getElementById('event-desc').innerText = "Você vasculhou os escombros na estrada e encontrou munição e suprimentos.";
    run.scrap += 20;
    run.ammo += 4;
    addToInventory({ id: 'ammo_box', name: 'Caixa de Munição', icon: '📦', type: 'item', count: 1 });
    updateHud();
    updateEventHud();
    let actions = document.getElementById('event-actions');
    actions.innerHTML = `<button class="btn" onclick="showScreen('screen-map')">Continuar Viagem</button>`;
}

function triggerEvent() {
    showScreen('screen-event');
    document.getElementById('event-title').innerText = "ENCONTRO NA ESTRADA";
    document.getElementById('event-desc').innerText = "Um comboio militar abandonado bloqueia o caminho com suprimentos trancados.";
    updateEventHud();
    let actions = document.getElementById('event-actions');
    actions.innerHTML = `
        <button class="btn" onclick="run.scrap += 15; run.ammo += 2; addToInventory({id: 'shotgun', name: 'Escopeta', icon: '💣', type: 'weapon'}); showScreen('screen-map'); updateHud();">Forçar Fechadura (+Sucata/+Munição/Arma)</button>
        <button class="btn btn-secondary" onclick="showScreen('screen-map')">Desviar Caminho</button>
    `;
}

function triggerRest() {
    showScreen('screen-event');
    document.getElementById('event-title').innerText = "ÁREA SEGURA PA
