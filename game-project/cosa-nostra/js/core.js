function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function closeModal() {
    modalContainer.innerHTML = '';
    modalContainer.classList.add('hidden');
}

function updateLog(msg, isImportant = false) {
    if (!logMessage) return;
    logMessage.textContent = msg;
    logMessage.classList.toggle('log-important', !!isImportant);
}

function hasInstalledModule(modId) {
    return gameState.rackets.some(r => r.owner === 'player' && r.shutdown < gameState.year && r.modules && r.modules.includes(modId));
}

function hasFullInfluence(targetId) {
    const target = GAME_CONFIG.influenceTargets.find(t => t.id === targetId);
    return target && gameState.influence[targetId] >= target.totalCost;
}

function getInfluenceInvestmentCost() {
    let cost = GAME_CONFIG.INFLUENCE_INVESTMENT;
    if (gameState.unlockedLegacyPerks.includes('political_animal')) cost *= 0.9;
    if (hasFullInfluence('police')) cost *= 0.5;
    return Math.round(cost);
}

function calculateIncome(ownerFilter) {
    let dirty = 0, clean = 0, launderCap = 0;

    if (ownerFilter !== 'player') return { dirty: 0, clean: 0, launderCap: 0 };

    GAME_CONFIG.businessFronts.forEach(b => {
        if (gameState.ownedBusinesses.includes(b.id)) {
            clean += b.income;
            launderCap += b.launderCap;
        }
    });

    if (hasInstalledModule('gambling_perk')) launderCap += 10000;

    const mayorBonus = hasFullInfluence('mayor') ? 1.2 : 1;

    gameState.rackets.forEach(r => {
        if (r.owner !== 'player' || r.shutdown >= gameState.year) return;

        let income = r.baseIncome * mayorBonus;

        if (r.supplyRequired === 6) {
            const hasSmuggler = gameState.rackets.some(rack =>
                rack.id === 6 && rack.owner === 'player' && rack.shutdown < gameState.year
            );
            if (!hasSmuggler) income *= 0.5;
        }

        const hasCapoPlus = r.assignedMembers.some(mid => {
            const m = gameState.members.find(x => x.id === mid);
            return m && ['Capo', 'Underboss', 'Consigliere', 'Don'].includes(m.role);
        });
        if (r.modules && r.modules.includes('vip') && hasCapoPlus) income *= 2;

        if (r.id === 5 && r.modules && r.modules.includes('casino_perk')) {
            clean += income;
        } else {
            dirty += income;
        }

        if (r.id === 1 && r.modules && r.modules.includes('speakeasy_perk')) clean += 2000;
    });

    if (gameState.expeditions.vegas) {
        const boss = gameState.members.find(m => m.id === gameState.expeditions.vegas);
        if (boss && boss.stats.loyalty >= 30) clean += 50000;
    }
    if (gameState.expeditions.miami) {
        const boss = gameState.members.find(m => m.id === gameState.expeditions.miami);
        if (boss && boss.stats.loyalty >= 30) dirty += 75000;
    }

    return { dirty: Math.round(dirty), clean: Math.round(clean), launderCap: Math.round(launderCap) };
}

function getRacketDefense(r) {
    let defense = r.defense;
    if (hasInstalledModule('protection_perk')) defense += 200;
    if (r.modules && r.modules.includes('vault')) defense += 250;

    const rival = gameState.rivals.find(riv => riv.name === r.owner);
    if (rival && rival.successionCrisis > gameState.year) defense = Math.floor(defense * 0.5);

    r.assignedMembers.forEach(mid => {
        const m = gameState.members.find(x => x.id === mid);
        if (m) {
            let brawn = m.stats.brawn;
            if (r.modules && r.modules.includes('armory')) brawn += 20;
            defense += brawn * 5;
        }
    });

    return Math.round(defense);
}

function createMember(isBoss = false, isSpecialist = false, father = null) {
    const lastName = father ? father.name.split(' ').pop() : GAME_CONFIG.lastNames[getRandomInt(0, GAME_CONFIG.lastNames.length - 1)];
    const firstName = GAME_CONFIG.firstNames[getRandomInt(0, GAME_CONFIG.firstNames.length - 1)];
    const name = `${firstName} ${lastName}`;

    const traitKeys = Object.keys(GAME_CONFIG.traits).filter(t => t !== 'Leader' && t !== 'Legend');
    const trait = traitKeys[getRandomInt(0, traitKeys.length - 1)];

    const member = {
        id: Date.now() + Math.random(),
        name: isBoss ? `Don ${name}` : name,
        age: isBoss ? 45 : (father ? 0 : getRandomInt(18, 30)),
        isBoss,
        isMadeMan: isSpecialist || isBoss,
        isInformant: false,
        yearsInFamily: isBoss ? 20 : 0,
        upkeep: isBoss ? 0 : GAME_CONFIG.UPKEEP_COST_PER_MEMBER,
        role: isBoss ? 'Don' : (father ? 'Youth' : 'Idle'),
        assignedRacketId: null,
        unavailableUntil: father ? gameState.year + 18 : 0,
        stats: {
            brawn: getRandomInt(30, 70),
            brains: getRandomInt(30, 70),
            guts: getRandomInt(30, 70),
            loyalty: getRandomInt(60, 95)
        },
        trait: isBoss ? 'Leader' : trait,
        fatherId: father ? father.id : null,
        isHeir: false,
        greasedCount: 0
    };

    if (father && gameState.unlockedLegacyPerks.includes('blood_of_the_don')) {
        Object.keys(member.stats).forEach(stat => { member.stats[stat] += 5; });
    }
    if (member.trait === 'Brute') {
        member.stats.brawn = Math.min(100, member.stats.brawn + 30);
        member.stats.brains = Math.max(10, member.stats.brains - 20);
    } else if (member.trait === 'Loyal') {
        member.stats.loyalty = Math.min(100, member.stats.loyalty + 25);
    } else if (member.trait === 'Deceitful') {
        member.stats.loyalty = Math.max(20, member.stats.loyalty - 20);
    }

    return member;
}

function makeMan(id) {
    const member = gameState.members.find(m => m.id === id);
    if (member && !member.isMadeMan && member.yearsInFamily >= GAME_CONFIG.MADE_MAN_YEARS_REQ) {
        member.isMadeMan = true;
        member.upkeep = GAME_CONFIG.MADE_MAN_UPKEEP_COST;
        Object.keys(member.stats).forEach(stat => { member.stats[stat] = Math.min(100, member.stats[stat] + 10); });
        updateLog(`${member.name} has been made.`);
        render();
    }
}

function promoteToCapo(id) {
    const member = gameState.members.find(m => m.id === id);
    if (member && member.isMadeMan && member.role !== 'Capo') {
        member.role = 'Capo';
        member.upkeep = GAME_CONFIG.CAPO_UPKEEP_COST;
        updateLog(`${member.name} promoted to Capo.`);
        render();
    }
}

function promoteToUnderboss(id) {
    const member = gameState.members.find(m => m.id === id);
    if (!member || member.role !== 'Capo') return;

    const currentUnderboss = gameState.members.find(m => m.role === 'Underboss');
    if (currentUnderboss) {
        currentUnderboss.role = 'Capo';
        currentUnderboss.upkeep = GAME_CONFIG.CAPO_UPKEEP_COST;
    }

    member.role = 'Underboss';
    unassignMember(member.id, false);
    gameState.members.forEach(m => {
        if (m.role === 'Capo' && m.id !== member.id) m.stats.loyalty = Math.max(0, m.stats.loyalty - 20);
    });
    updateLog(`${member.name} is the new Underboss.`);
    render();
}

function promoteToConsigliere(memberId) {
    const member = gameState.members.find(m => m.id === memberId);
    if (!member || !member.isMadeMan) return;

    const current = gameState.members.find(m => m.role === 'Consigliere');
    if (current) { current.role = 'Capo'; current.upkeep = GAME_CONFIG.CAPO_UPKEEP_COST; }

    member.role = 'Consigliere';
    member.upkeep = GAME_CONFIG.CONSIGLIERE_UPKEEP_COST;
    unassignMember(member.id, false);
    updateLog(`${member.name} named Consigliere.`);
    render();
}

function designateHeir(memberId) {
    gameState.members.forEach(m => { m.isHeir = false; });
    const newHeir = gameState.members.find(m => m.id === memberId);
    if (newHeir) {
        newHeir.isHeir = true;
        updateLog(`${newHeir.name} is heir apparent.`);
    }
    render();
}

function handleSuccession(oldName) {
    const heir = gameState.members.find(m => m.isHeir);
    let newDon = heir || gameState.members.find(m => m.role === 'Underboss');

    if (!newDon) {
        const adults = gameState.members.filter(m =>
            m.age >= 18 && !['Vegas Boss', 'Miami Boss'].includes(m.role)
        );
        if (adults.length > 0) {
            adults.sort((a, b) => b.stats.guts - a.stats.guts);
            newDon = adults[0];
        }
    }

    if (newDon) {
        gameState.members.forEach(m => { if (m.isBoss) m.isBoss = false; });
        newDon.isBoss = true;
        newDon.role = 'Don';
        newDon.isHeir = false;
        newDon.name = `Don ${newDon.name.replace(/^Don /, '')}`;
        gameState.generation++;
        updateLog(`${oldName} has passed. Long live ${newDon.name}!`, true);
        gameState.lastYearEvents.push({ type: 'succession', data: { oldDon: oldName, newDon: newDon.name } });
        unlockLegacyPerks();
    } else {
        endGame('The Family Has Fallen', 'The bloodline ended with no successor. The empire crumbles.');
    }
}

function unlockLegacyPerks() {
    GAME_CONFIG.legacyPerks.forEach(perk => {
        if (gameState.generation >= perk.generation && !gameState.unlockedLegacyPerks.includes(perk.id)) {
            gameState.unlockedLegacyPerks.push(perk.id);
            updateLog(`Legacy Unlocked: ${perk.name}!`, true);
        }
    });
}

function initializeRivals() {
    gameState.rivals = GAME_CONFIG.rivalFamilies.map(r => {
        const familyName = r.name.split(' ')[0];
        const members = [
            { id: Math.random(), name: `Don ${GAME_CONFIG.firstNames[getRandomInt(0, GAME_CONFIG.firstNames.length - 1)]} ${familyName}`, role: 'Don', stats: { brawn: getRandomInt(60, 90), brains: getRandomInt(60, 90), guts: getRandomInt(60, 90) } },
            { id: Math.random(), name: `${GAME_CONFIG.firstNames[getRandomInt(0, GAME_CONFIG.firstNames.length - 1)]} ${familyName}`, role: 'Underboss', stats: { brawn: getRandomInt(50, 80), brains: getRandomInt(50, 80), guts: getRandomInt(50, 80) } }
        ];
        for (let i = 0; i < 2; i++) {
            members.push({ id: Math.random(), name: `${GAME_CONFIG.firstNames[getRandomInt(0, GAME_CONFIG.firstNames.length - 1)]} ${familyName}`, role: 'Capo', stats: { brawn: getRandomInt(40, 70), brains: getRandomInt(40, 70), guts: getRandomInt(40, 70) } });
        }
        return { ...r, treasury: 20000, strength: 50, relationship: 'Neutral', standing: 50, members, successionCrisis: 0 };
    });
}

function initializeRackets() {
    gameState.rackets = GAME_CONFIG.availableRackets
        .filter(r => !r.unlockYear || r.unlockYear <= gameState.year)
        .map(r => {
            const rival = GAME_CONFIG.rivalFamilies[getRandomInt(0, GAME_CONFIG.rivalFamilies.length - 1)];
            return {
                ...r,
                owner: Math.random() > 0.4 ? rival.name : null,
                assignedMembers: [],
                shutdown: 0,
                intelRevealedUntil: 0,
                modules: []
            };
        });
}

function buyRacket(id) {
    const racket = gameState.rackets.find(r => r.id === id);
    if (racket && !racket.owner && gameState.dirtyMoney >= racket.cost) {
        gameState.dirtyMoney -= racket.cost;
        racket.owner = 'player';
        updateLog(`You acquired the ${racket.name}.`);
        render();
        openMapModal(id);
    }
}

function unassignMember(id, log = true) {
    const member = gameState.members.find(m => m.id === id);
    if (member && member.assignedRacketId) {
        const racket = gameState.rackets.find(r => r.id === member.assignedRacketId);
        if (racket) racket.assignedMembers = racket.assignedMembers.filter(mid => mid !== id);
        member.assignedRacketId = null;
        if (member.role === 'Working') member.role = 'Idle';
        if (log) updateLog(`${member.name} is now available.`);
    }
}

function generateNewOpportunities() {
    const pool = [...GAME_CONFIG.specialOperations];
    gameState.currentOpportunities = [];
    while (gameState.currentOpportunities.length < 3 && pool.length > 0) {
        const idx = getRandomInt(0, pool.length - 1);
        const op = pool.splice(idx, 1)[0];
        gameState.currentOpportunities.push({ ...op, uid: `op-${Date.now()}-${Math.random()}` });
    }
}

function buyInfluence(targetId) {
    const target = GAME_CONFIG.influenceTargets.find(t => t.id === targetId);
    const cost = getInfluenceInvestmentCost();
    if (!target || gameState.cleanMoney < cost) {
        updateLog('Not enough Clean Cash for this investment.');
        return;
    }
    gameState.cleanMoney -= cost;
    gameState.influence[targetId] = Math.min(target.totalCost, gameState.influence[targetId] + cost);
    updateLog(`Invested in ${target.name}.`);
    render();
}

function buyBusiness(id) {
    const biz = GAME_CONFIG.businessFronts.find(b => b.id === id);
    if (!biz || gameState.ownedBusinesses.includes(id)) return;
    if (gameState.cleanMoney >= biz.cost) {
        gameState.cleanMoney -= biz.cost;
        gameState.ownedBusinesses.push(id);
        updateLog(`Purchased ${biz.name}.`);
        render();
    } else {
        updateLog('Need more Clean Cash for legitimate fronts.');
    }
}

function recruitMember() {
    let cost = GAME_CONFIG.RECRUIT_COST;
    if (hasInstalledModule('loanshark_perk')) cost *= 0.75;
    if (gameState.dirtyMoney < cost) {
        updateLog('Not enough Dirty Cash to recruit.');
        return;
    }
    gameState.dirtyMoney -= cost;
    const member = createMember();
    gameState.members.push(member);
    updateLog(`${member.name} joined the family.`);
    render();
}

function bribePolice() {
    let cost = GAME_CONFIG.BRIBE_BASE_COST;
    if (hasInstalledModule('smuggling_perk')) cost *= 0.75;
    if (hasFullInfluence('police')) cost *= 0.5;

    if (gameState.cleanMoney < cost) {
        updateLog('Not enough Clean Cash to bribe the police.');
        return;
    }
    gameState.cleanMoney -= cost;
    gameState.heat = Math.max(0, gameState.heat - 25);
    gameState.caseFile = Math.max(0, gameState.caseFile - 5);
    updateLog('The police look the other way. Heat reduced.');
    render();
}

function saveGame() {
    try {
        const payload = { version: 1, savedAt: new Date().toISOString(), gameState };
        localStorage.setItem(GAME_CONFIG.SAVE_KEY, JSON.stringify(payload));
        const el = $('#last-saved');
        if (el) el.textContent = `Saved ${new Date().toLocaleTimeString()}`;
        return true;
    } catch (e) {
        console.warn('Save failed', e);
        return false;
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem(GAME_CONFIG.SAVE_KEY);
        if (!raw) return false;
        const payload = JSON.parse(raw);
        if (!payload || !payload.gameState) return false;
        gameState = payload.gameState;
        return true;
    } catch (e) {
        console.warn('Load failed', e);
        return false;
    }
}

function hasSaveGame() {
    return !!localStorage.getItem(GAME_CONFIG.SAVE_KEY);
}

function startNewGame() {
    gameState = getFreshGameState();
    const don = createMember(true);
    gameState.members.push(don);
    initializeRackets();
    initializeRivals();
    generateNewOpportunities();
    gameState.tutorialSeen = false;
    showGameUI();
    render();
    if (!gameState.tutorialSeen) {
        $('#tutorial-banner').classList.remove('hidden');
    }
    updateLog('Welcome, Don. The city awaits your command.');
}

function showGameUI() {
    $('#start-screen').classList.add('hidden');
    $('#game-container').classList.remove('hidden');
}

function endGame(title, desc) {
    gameState.gameOver = true;
    $('#end-title').textContent = title;
    $('#end-desc').textContent = desc;
    $('#end-screen').classList.remove('hidden');
    localStorage.removeItem(GAME_CONFIG.SAVE_KEY);
}

function showEventModal(event) {
    const choicesHtml = event.choices.map((c, i) =>
        `<button class="btn btn-primary w-full py-2 mb-2 text-left px-4" data-choice="${i}">${c.text}</button>`
    ).join('');

    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
            <div class="card max-w-lg w-full p-8 rounded-lg border-t-4 border-amber-500">
                <h2 class="text-2xl font-cinzel text-amber-300 mb-2">${event.title}</h2>
                <p class="text-gray-300 mb-6">${event.description}</p>
                <div id="event-choices">${choicesHtml}</div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');

    $$('#event-choices button').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.choice, 10);
            event.choices[idx].effect();
            closeModal();
            render();
            saveGame();
        };
    });
}

function statBar(label, value, cssClass) {
    return `<div class="mb-2">
        <div class="flex justify-between text-[10px] text-gray-400 mb-0.5"><span>${label}</span><span>${value}</span></div>
        <div class="stat-bar-bg"><div class="stat-bar ${cssClass}" style="width:${value}%"></div></div>
    </div>`;
}

function updateRelationship(rival) {
    if (rival.standing > 75) rival.relationship = 'Friendly';
    else if (rival.standing > 30) rival.relationship = 'Neutral';
    else if (rival.standing > 0) rival.relationship = 'Hostile';
    else rival.relationship = 'War';
}
