function render() {
    if (!yearDisplay) return;

    yearDisplay.textContent = gameState.year;
    $('#era-display').textContent = gameState.era;
    familySizeDisplay.textContent = gameState.members.length;

    dirtyDisplay.textContent = `$${Math.round(gameState.dirtyMoney).toLocaleString()}`;
    cleanDisplay.textContent = `$${Math.round(gameState.cleanMoney).toLocaleString()}`;
    favorsDisplay.textContent = gameState.favors;

    const inc = calculateIncome('player');
    incomeDisplay.innerHTML = `<span class="text-red-400">+$${inc.dirty.toLocaleString()}</span> | <span class="text-green-400">+$${inc.clean.toLocaleString()}</span>`;

    heatDisplay.textContent = Math.round(gameState.heat);
    heatDisplay.classList.toggle('heat-high', gameState.heat >= 50);

    caseFileDisplay.textContent = `${Math.round(gameState.caseFile)}%`;
    caseFileDisplay.classList.toggle('case-high', gameState.caseFile >= 60);

    const bribeCost = (() => {
        let c = GAME_CONFIG.BRIBE_BASE_COST;
        if (hasInstalledModule('smuggling_perk')) c *= 0.75;
        if (hasFullInfluence('police')) c *= 0.5;
        return c;
    })();

    let recruitCost = GAME_CONFIG.RECRUIT_COST;
    if (hasInstalledModule('loanshark_perk')) recruitCost *= 0.75;

    favorBtn.disabled = gameState.favors < 1;
    bribeBtn.disabled = gameState.cleanMoney < bribeCost;
    recruitBtn.disabled = gameState.dirtyMoney < recruitCost;

    bribeBtn.textContent = `Bribe ($${(bribeCost / 1000).toFixed(1)}k)`;
    recruitBtn.textContent = `Recruit ($${(recruitCost / 1000).toFixed(1)}k)`;

    nationalBtn.classList.toggle('hidden', !(gameState.year >= 1960 || gameState.cleanMoney >= 500000));
    offshoreBtn.classList.toggle('hidden', gameState.year < 1970);

    renderFamilyRoster();
    renderInfluenceGrid();
    renderBusinessFronts();
    renderOpportunities();
    renderLegacySection();
}

function renderFamilyRoster() {
    if (!familyRoster) return;

    familyRoster.innerHTML = gameState.members.map(m => {
        const unavailable = m.unavailableUntil > gameState.year;
        const roleBadge = m.role === 'Don' ? 'text-amber-400' : m.role === 'Capo' ? 'text-blue-400' : 'text-gray-400';

        let actions = '';
        if (!unavailable && !m.isBoss) {
            if (!m.isMadeMan && m.yearsInFamily >= GAME_CONFIG.MADE_MAN_YEARS_REQ) {
                actions += `<button class="btn-action" onclick="makeMan(${m.id})">Make Man</button>`;
            }
            if (m.isMadeMan && m.role !== 'Capo' && m.role !== 'Underboss' && m.role !== 'Consigliere') {
                actions += `<button class="btn-action" onclick="promoteToCapo(${m.id})">→ Capo</button>`;
            }
            if (m.role === 'Capo') {
                actions += `<button class="btn-action" onclick="promoteToUnderboss(${m.id})">Underboss</button>`;
                actions += `<button class="btn-action" onclick="promoteToConsigliere(${m.id})">Consigliere</button>`;
            }
            if (!m.isHeir && m.age >= 18) {
                actions += `<button class="btn-action btn-heir" onclick="designateHeir(${m.id})">Heir</button>`;
            }
        }

        const assigned = m.assignedRacketId
            ? gameState.rackets.find(r => r.id === m.assignedRacketId)?.name || 'Assigned'
            : '';

        return `
        <div class="card member-card p-4 rounded-lg border border-gray-600 ${m.isHeir ? 'is-heir' : ''} ${m.isBoss ? 'is-boss' : ''}">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h3 class="font-bold text-white text-sm">${m.name}</h3>
                    <p class="text-[10px] ${roleBadge} uppercase font-bold">${m.role} · Age ${m.age}${unavailable ? ' · AWOL' : ''}</p>
                </div>
                <span class="text-[10px] text-gray-500">${m.trait}</span>
            </div>
            ${statBar('Loyalty', m.stats.loyalty, 'stat-bar-loyalty')}
            ${statBar('Brawn', m.stats.brawn, 'stat-bar-brawn')}
            ${statBar('Brains', m.stats.brains, 'stat-bar-brains')}
            ${statBar('Guts', m.stats.guts, 'stat-bar-guts')}
            ${assigned ? `<p class="text-[10px] text-blue-400 mt-2">Guarding: ${assigned}</p>` : ''}
            <p class="text-[10px] text-gray-500 mt-1" title="${GAME_CONFIG.traits[m.trait]?.description || ''}">${GAME_CONFIG.traits[m.trait]?.description || ''}</p>
            <div class="flex flex-wrap gap-1 mt-3">${actions}</div>
        </div>`;
    }).join('');
}

function renderInfluenceGrid() {
    if (!influenceGrid) return;

    influenceGrid.innerHTML = GAME_CONFIG.influenceTargets.map(t => {
        const current = gameState.influence[t.id];
        const pct = Math.min(100, (current / t.totalCost) * 100);
        const complete = current >= t.totalCost;
        const cost = getInfluenceInvestmentCost();

        return `
        <div class="card p-4 rounded-lg border ${complete ? 'border-green-600' : 'border-gray-600'}">
            <h3 class="font-cinzel text-amber-200 text-sm mb-1">${t.name}</h3>
            <p class="text-[10px] text-gray-400 mb-3">${t.bonus}</p>
            <div class="stat-bar-bg mb-2"><div class="stat-bar bg-amber-500" style="width:${pct}%"></div></div>
            <p class="text-xs text-gray-500 mb-3">$${current.toLocaleString()} / $${t.totalCost.toLocaleString()}</p>
            ${complete
                ? '<p class="text-green-400 text-xs font-bold">FULL CONTROL</p>'
                : `<button class="btn btn-primary w-full py-1 text-xs" onclick="buyInfluence('${t.id}')" ${gameState.cleanMoney < cost ? 'disabled' : ''}>Invest $${cost.toLocaleString()}</button>`}
        </div>`;
    }).join('');
}

function renderBusinessFronts() {
    if (!businessGrid) return;

    businessGrid.innerHTML = GAME_CONFIG.businessFronts.map(b => {
        const owned = gameState.ownedBusinesses.includes(b.id);
        return `
        <div class="card p-4 rounded-lg border ${owned ? 'border-green-700' : 'border-gray-600'}">
            <h3 class="font-bold text-white text-sm">${b.name}</h3>
            <p class="text-[10px] text-gray-400 mt-1">+$${b.income.toLocaleString()} Clean/yr · Launder $${b.launderCap.toLocaleString()}</p>
            ${owned
                ? '<p class="text-green-400 text-xs font-bold mt-2">OWNED</p>'
                : `<button class="btn btn-primary w-full mt-3 py-1 text-xs" onclick="buyBusiness('${b.id}')" ${gameState.cleanMoney < b.cost ? 'disabled' : ''}>Buy $${b.cost.toLocaleString()}</button>`}
        </div>`;
    }).join('');
}

function renderOpportunities() {
    if (!opportunitiesGrid) return;

    if (!gameState.currentOpportunities.length) {
        opportunitiesGrid.innerHTML = '<p class="text-gray-500 col-span-full text-center italic">No operations this year. Advance time for new leads.</p>';
        return;
    }

    opportunitiesGrid.innerHTML = gameState.currentOpportunities.map(op => `
        <div class="card p-4 rounded-lg border border-red-900">
            <h3 class="font-cinzel text-red-400 text-sm mb-1">${op.name}</h3>
            <p class="text-[10px] text-gray-400 mb-3">${op.description}</p>
            <p class="text-xs text-gray-500 mb-2">Cost $${op.cost.toLocaleString()} · Risk ${op.risk}% · ${op.requirements.stat} ${op.requirements.total}+</p>
            <button class="btn btn-danger w-full py-2 text-xs" onclick="openAssembleCrewModal('${op.uid}')">Assemble Crew</button>
        </div>
    `).join('');
}

function renderLegacySection() {
    if (!legacyGrid) return;

    const cards = GAME_CONFIG.legacyPerks.map(perk => {
        const unlocked = gameState.unlockedLegacyPerks.includes(perk.id);
        const available = gameState.generation >= perk.generation;
        return `
        <div class="card p-4 rounded-lg border ${unlocked ? 'border-amber-500' : 'border-gray-700 opacity-70'}">
            <h3 class="font-cinzel text-sm ${unlocked ? 'text-amber-300' : 'text-gray-500'}">${perk.name}</h3>
            <p class="text-[10px] text-gray-400 mt-1">Gen ${perk.generation}+ · ${perk.description}</p>
            <p class="text-xs mt-2 ${unlocked ? 'text-green-400' : available ? 'text-amber-500' : 'text-gray-600'}">
                ${unlocked ? 'ACTIVE' : available ? 'Unlock on next succession' : 'Locked'}
            </p>
        </div>`;
    }).join('');

    legacyGrid.innerHTML = `
        <div class="col-span-full mb-2">
            <p class="text-sm text-amber-400 font-cinzel">Generation ${gameState.generation}</p>
        </div>
        ${cards}`;
}
