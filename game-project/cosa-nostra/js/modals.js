function triggerCivilWar(traitor) {
    gameState.members = gameState.members.filter(m => m.id !== traitor.id);

    const sympathizers = gameState.members.filter(m =>
        m.stats.loyalty < 40 && !m.isBoss && m.role !== 'Vegas Boss' && m.role !== 'Miami Boss'
    );
    const defectors = sympathizers.filter(() => Math.random() < 0.6);
    defectors.forEach(d => { gameState.members = gameState.members.filter(m => m.id !== d.id); });

    const factionName = `${traitor.name.split(' ').pop()} Crew`;
    traitor.role = 'Don';
    traitor.name = `Don ${traitor.name.replace(/^Don /, '')}`;
    const rivalMembers = [traitor, ...defectors.map(d => ({ ...d, role: 'Capo' }))];

    gameState.rivals.push({
        name: factionName,
        color: 'border-orange-500',
        textColor: 'text-orange-400',
        personality: 'Vengeful',
        territoryColor: 'rgba(249, 115, 22, 0.4)',
        treasury: 15000,
        strength: 50 + traitor.stats.brawn,
        relationship: 'War',
        standing: 0,
        members: rivalMembers,
        successionCrisis: 0
    });

    const stolenRackets = [];
    gameState.rackets.forEach(r => {
        if (r.assignedMembers.includes(traitor.id)) {
            r.owner = factionName;
            r.assignedMembers = [];
            stolenRackets.push(r.name);
        }
    });

    gameState.lastYearEvents.unshift({ type: 'civil_war', data: { traitor: traitor.name, faction: factionName } });

    setTimeout(() => {
        showEventModal({
            title: 'CIVIL WAR!',
            description: `${traitor.name} has betrayed the family and formed the ${factionName}!` +
                (stolenRackets.length ? ` Lost: ${stolenRackets.join(', ')}.` : ''),
            choices: [{ text: 'Death to traitors.', effect: () => {} }]
        });
    }, 600);
}

function openRivalIntelModal() {
    const content = gameState.rivals.map(rival => {
        const isCrisis = rival.successionCrisis > gameState.year;
        return `
        <div class="bg-gray-800 p-4 rounded border ${rival.color}">
            <h3 class="text-lg font-cinzel ${rival.textColor}">${rival.name}</h3>
            <p class="text-xs text-gray-400 mb-2">${rival.relationship} | Standing: ${rival.standing}</p>
            ${isCrisis ? `<p class="text-xs text-red-500 font-bold mb-2">SUCCESSION CRISIS (${rival.successionCrisis - gameState.year} yr)</p>` : ''}
            <div class="space-y-2">
                ${rival.members.map(m => `
                    <div class="flex justify-between items-center bg-gray-900 p-2 rounded gap-2">
                        <div>
                            <p class="text-sm font-bold text-white">${m.name}</p>
                            <p class="text-[10px] text-gray-500">${m.role} | B:${m.stats.brawn} R:${m.stats.brains}</p>
                        </div>
                        <button class="btn btn-danger text-[10px] py-1 px-2 shrink-0" onclick="openHitModal('${rival.name.replace(/'/g, "\\'")}', ${m.id})" ${gameState.dirtyMoney < 25000 ? 'disabled' : ''}>Hit ($25k)</button>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }).join('');

    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
            <div class="card max-w-5xl w-full p-6 rounded-lg border-t-4 border-red-600 max-h-[90vh] flex flex-col">
                <h2 class="text-2xl font-cinzel text-red-400 mb-4">Rival Intelligence</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar pr-2 flex-1">${content}</div>
                <div class="flex justify-end mt-4"><button class="btn btn-secondary py-2 px-6 rounded-lg" onclick="closeModal()">Close</button></div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');
}

function openHitModal(rivalName, targetId) {
    const rival = gameState.rivals.find(r => r.name === rivalName);
    const target = rival.members.find(m => m.id === targetId);
    const operatives = gameState.members.filter(m =>
        !m.isBoss && m.age >= 18 && m.unavailableUntil <= gameState.year &&
        ['Idle', 'Working'].includes(m.role)
    );

    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-[60]">
            <div class="card max-w-xl w-full p-6 rounded border-t-4 border-red-600">
                <h3 class="text-xl font-cinzel text-red-400 mb-2">Contract: ${target.name}</h3>
                <p class="text-gray-400 text-sm mb-4">Cost: $25,000 Dirty Cash</p>
                <div class="space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
                    ${operatives.length ? operatives.map(m => {
                        const chance = Math.min(95, Math.max(10, m.stats.brawn + Math.floor(m.stats.guts / 2) - target.stats.brawn - Math.floor(target.stats.brains / 2) + 50));
                        return `<div class="flex justify-between items-center bg-gray-800 p-2 rounded gap-2">
                            <div><p class="text-white font-bold text-sm">${m.name}</p><p class="text-[10px] text-gray-400">Brawn ${m.stats.brawn} | Guts ${m.stats.guts}</p></div>
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold ${chance > 60 ? 'text-green-400' : 'text-red-400'}">${chance}%</span>
                                <button class="btn btn-danger py-1 px-2 text-xs" onclick="executeHit('${rivalName.replace(/'/g, "\\'")}', ${target.id}, ${m.id}, ${chance})">Send</button>
                            </div>
                        </div>`;
                    }).join('') : '<p class="text-gray-500 text-center py-4">No available operatives.</p>'}
                </div>
                <button class="btn btn-secondary py-2 px-6" onclick="openRivalIntelModal()">Back</button>
            </div>
        </div>`;
}

function executeHit(rivalName, targetId, operativeId, chance) {
    gameState.dirtyMoney -= 25000;
    const rival = gameState.rivals.find(r => r.name === rivalName);
    const target = rival.members.find(m => m.id === targetId);
    const operative = gameState.members.find(m => m.id === operativeId);

    rival.relationship = 'War';
    rival.standing = 0;

    if (Math.random() * 100 <= chance) {
        updateLog(`SUCCESS! ${operative.name} eliminated ${target.name}.`, true);
        rival.members = rival.members.filter(m => m.id !== targetId);
        gameState.heat += 15;
        if (target.role === 'Don') {
            rival.successionCrisis = gameState.year + 2;
            updateLog(`${rivalName} in succession crisis!`, true);
        } else {
            rival.strength = Math.max(10, rival.strength - 15);
        }
    } else {
        updateLog(`FAILURE! Hit on ${target.name} botched.`, true);
        gameState.heat += 30;
        if (Math.random() < 0.5) {
            gameState.members = gameState.members.filter(m => m.id !== operativeId);
            updateLog(`${operative.name} was killed!`, true);
        }
    }
    closeModal();
    render();
    saveGame();
}

function claimBossOfBosses() {
    const playerStr = gameState.members.reduce((s, m) => s + m.stats.brawn, 0);
    const rivalStr = gameState.rivals.reduce((s, r) => s + r.strength, 0);
    if (playerStr > rivalStr && gameState.cleanMoney >= 100000) {
        gameState.cleanMoney -= 100000;
        gameState.isBossOfBosses = true;
        updateLog('Crowned Capo di tutti i capi!', true);
        openCommissionModal();
        render();
    }
}

function openCommissionModal() {
    const playerStr = gameState.members.reduce((s, m) => s + m.stats.brawn, 0);
    const rivalStr = gameState.rivals.reduce((s, r) => s + r.strength, 0);
    const activeLawObj = gameState.activeLaw ? GAME_CONFIG.laws.find(l => l.id === gameState.activeLaw) : null;
    const lawText = activeLawObj
        ? `<span class="text-amber-400 font-bold">${activeLawObj.name}</span> — <span class="text-gray-400 text-xs">${activeLawObj.desc}</span>`
        : '<span class="text-gray-500 italic">No active laws.</span>';

    const bossUI = gameState.isBossOfBosses
        ? `<div class="bg-amber-900 bg-opacity-30 border border-amber-500 p-4 rounded mb-4 text-center">
            <h3 class="text-xl font-cinzel text-amber-400">CAPO DI TUTTI CAPI</h3>
            <p class="text-sm text-amber-200">+$10k tax from each rival yearly</p></div>`
        : `<div class="bg-gray-800 border border-gray-600 p-4 rounded mb-4 flex flex-wrap justify-between items-center gap-3">
            <div><h3 class="font-cinzel text-gray-300">Claim Boss of Bosses</h3>
            <p class="text-xs text-gray-500">Brawn ${playerStr} vs rivals ${rivalStr} + $100k Clean</p></div>
            <button class="btn btn-primary text-xs py-2 px-4" onclick="claimBossOfBosses()" ${playerStr <= rivalStr || gameState.cleanMoney < 100000 ? 'disabled' : ''}>Claim</button></div>`;

    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div class="card max-w-4xl w-full p-6 rounded-lg border-t-4 border-amber-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <h2 class="text-2xl font-cinzel text-amber-300 mb-4">The Commission</h2>
                <div class="mb-4 bg-gray-900 p-3 rounded text-sm"><span class="font-bold uppercase">Active Law:</span> ${lawText}</div>
                ${bossUI}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${gameState.rivals.map(rival => `
                        <div class="p-4 border border-gray-700 bg-black bg-opacity-30 rounded">
                            <h3 class="text-lg font-bold ${rival.textColor}">${rival.name}</h3>
                            <p class="text-sm text-gray-400">${rival.relationship} (${rival.standing}) · Str ${rival.strength}</p>
                            <div class="flex flex-wrap gap-2 mt-3">
                                <button class="btn btn-secondary text-xs py-1 px-3" onclick="openSitDownModal('${rival.name.replace(/'/g, "\\'")}')">Sit Down</button>
                                <button class="btn btn-primary text-xs py-1 px-3" onclick="handleDiplomacy('tribute', '${rival.name.replace(/'/g, "\\'")}')">Tribute ($20k)</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="flex justify-end mt-6"><button class="btn btn-secondary py-2 px-6" onclick="closeModal()">Close</button></div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');
}

function openSitDownModal(rivalName) {
    const rival = gameState.rivals.find(r => r.name === rivalName);
    const safeName = rivalName.replace(/'/g, "\\'");
    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-[60]">
            <div class="card max-w-xl w-full p-6 rounded border-t-4 border-amber-600">
                <h3 class="text-xl font-cinzel text-amber-200 mb-4">Meeting: ${rivalName}</h3>
                <div class="space-y-3">
                    ${rival.relationship === 'War'
                        ? `<button class="btn btn-primary w-full py-2" onclick="handleDiplomacy('peace', '${safeName}')">Offer Peace ($50k Clean)</button>`
                        : `<button class="btn btn-danger w-full py-2" onclick="handleDiplomacy('declare_war', '${safeName}')">Declare War</button>`}
                    <button class="btn btn-secondary w-full py-2" onclick="openCommissionModal()">Back</button>
                </div>
            </div>
        </div>`;
}

function handleDiplomacy(action, rivalName) {
    const rival = gameState.rivals.find(r => r.name === rivalName);
    if (!rival) return;

    if (action === 'tribute') {
        if (gameState.dirtyMoney >= 20000) {
            gameState.dirtyMoney -= 20000;
            rival.standing = Math.min(100, rival.standing + 25);
            updateRelationship(rival);
            updateLog(`Tribute sent to ${rivalName}.`);
        } else updateLog('Not enough Dirty Cash.');
    } else if (action === 'peace') {
        if (gameState.cleanMoney >= 50000) {
            gameState.cleanMoney -= 50000;
            rival.relationship = 'Neutral';
            rival.standing = 40;
            updateLog(`Peace with ${rivalName}.`);
        } else updateLog('Not enough Clean Cash.');
    } else if (action === 'declare_war') {
        const warTax = gameState.activeLaw === 'war_tax' ? 10000 : 0;
        if (gameState.dirtyMoney >= warTax) {
            gameState.dirtyMoney -= warTax;
            rival.relationship = 'War';
            rival.standing = 0;
            updateLog(`War on ${rivalName}!${warTax ? ' Paid War Tax.' : ''}`);
        } else updateLog('Cannot pay War Tax.');
    }
    closeModal();
    render();
    saveGame();
}

function triggerCommissionVote() {
    const potentialLaws = [...GAME_CONFIG.laws].sort(() => Math.random() - 0.5).slice(0, 2);
    if (gameState.activeLaw) {
        potentialLaws.push({ id: 'repeal', name: 'Repeal Current Law', desc: 'Abolish the active underworld law.' });
    }
    showEventModal({
        title: 'COMMISSION VOTE',
        description: 'The Five Families vote on a new underworld law for the next era.',
        choices: potentialLaws.map(law => ({
            text: `Vote: ${law.name}`,
            effect: () => {
                if (law.id === 'repeal') gameState.activeLaw = null;
                else gameState.activeLaw = law.id;
                updateLog(`Commission enacted: ${law.name}`, true);
            }
        }))
    });
}

function openStreetCrimeModal() {
    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div class="card max-w-lg w-full p-6 rounded border-t-4 border-red-600">
                <h2 class="text-xl font-cinzel text-red-400 mb-2">Street Crimes</h2>
                <p class="text-gray-400 text-sm mb-4">Quick cash with immediate heat. Does not advance the year.</p>
                <div class="space-y-3">
                    <button class="btn btn-secondary w-full py-3 text-left px-4 flex justify-between" onclick="executeStreetCrime('shakedown')">
                        <span>Shake Down Locals</span><span class="text-xs text-red-400">+$5k / +10 Heat</span>
                    </button>
                    <button class="btn btn-secondary w-full py-3 text-left px-4 flex justify-between" onclick="executeStreetCrime('hijack')">
                        <span>Hijack Truck</span><span class="text-xs text-red-400">+$25k / +25 Heat / 20% fail</span>
                    </button>
                    <button class="btn btn-secondary w-full py-3 text-left px-4 flex justify-between" onclick="executeStreetCrime('gamble')" ${gameState.dirtyMoney < 5000 ? 'disabled' : ''}>
                        <span>High-Stakes Game</span><span class="text-xs text-amber-500">Risk $5k → 40% +$30k</span>
                    </button>
                </div>
                <div class="mt-4 flex justify-end"><button class="btn btn-secondary py-2 px-6" onclick="closeModal()">Close</button></div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');
}

function executeStreetCrime(type) {
    if (type === 'shakedown') {
        gameState.dirtyMoney += 5000;
        gameState.heat += 10;
        updateLog('Shakedown complete. +$5k Dirty, +10 Heat.');
    } else if (type === 'hijack') {
        gameState.heat += 25;
        if (Math.random() < 0.8) {
            gameState.dirtyMoney += 25000;
            updateLog('Hijack succeeded! +$25k Dirty.');
        } else {
            updateLog('Hijack was a trap!', true);
            const available = gameState.members.filter(m => !m.isBoss);
            if (available.length) {
                const casualty = available[getRandomInt(0, available.length - 1)];
                gameState.members = gameState.members.filter(m => m.id !== casualty.id);
                updateLog(`${casualty.name} was killed.`, true);
            }
        }
    } else if (type === 'gamble' && gameState.dirtyMoney >= 5000) {
        gameState.dirtyMoney -= 5000;
        if (Math.random() < 0.4) {
            gameState.dirtyMoney += 30000;
            updateLog('Jackpot! +$25k profit.');
        } else updateLog('Lost $5k at the tables.');
    }
    if (gameState.era === 'The RICO Era' && gameState.heat > 50) gameState.caseFile += 5;
    render();
    saveGame();
}

function openAssembleCrewModal(opUid) {
    const op = gameState.currentOpportunities.find(o => o.uid === opUid);
    if (!op) return;
    const statKey = op.requirements.stat.toLowerCase();

    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div class="card max-w-2xl w-full p-6 rounded border-t-4 border-red-500">
                <h2 class="text-xl font-cinzel text-red-400 mb-2">${op.name}</h2>
                <p class="text-gray-400 text-sm mb-4">${op.description} · Cost $${op.cost.toLocaleString()} Dirty</p>
                <div id="crew-selection-list" class="space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
                    ${gameState.members.filter(m => m.role === 'Idle' && m.age >= 18).map(m => `
                        <label class="flex justify-between items-center p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
                            <span>${m.name} (${op.requirements.stat}: ${m.stats[statKey]})</span>
                            <input type="checkbox" class="crew-check" data-id="${m.id}" data-stat="${m.stats[statKey]}">
                        </label>
                    `).join('') || '<p class="text-gray-500 text-center">No idle crew available.</p>'}
                </div>
                <div class="flex justify-between items-end">
                    <div class="text-sm">
                        <p>Required: <span class="text-amber-400">${op.requirements.total}</span></p>
                        <p>Selected: <span id="current-crew-total" class="text-white">0</span></p>
                    </div>
                    <div class="flex gap-3">
                        <button class="btn btn-secondary py-2 px-4" onclick="closeModal()">Cancel</button>
                        <button id="execute-op-btn" class="btn btn-danger py-2 px-4" disabled>Execute</button>
                    </div>
                </div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');

    const executeBtn = $('#execute-op-btn');
    const totalDisp = $('#current-crew-total');

    $('#crew-selection-list').addEventListener('change', () => {
        let total = 0;
        $$('.crew-check:checked').forEach(c => { total += parseInt(c.dataset.stat, 10); });
        totalDisp.textContent = total;
        executeBtn.disabled = total < op.requirements.total || gameState.dirtyMoney < op.cost;
    });

    executeBtn.onclick = () => {
        const ids = Array.from($$('.crew-check:checked')).map(c => parseFloat(c.dataset.id));
        attemptOperation(op, ids);
    };
}

function attemptOperation(op, crewIds) {
    if (gameState.dirtyMoney < op.cost) return;
    gameState.dirtyMoney -= op.cost;
    gameState.heat += op.heat;
    gameState.caseFile += op.caseFile;

    if (Math.random() * 100 > op.risk) {
        updateLog(`SUCCESS! ${op.name} completed.`, true);
        if (op.reward.cash) gameState.dirtyMoney += op.reward.cash;
        if (op.reward.influence) gameState.influence[op.reward.target] += op.reward.influence;
        if (op.reward.favors) gameState.favors += op.reward.favors;
    } else {
        updateLog(`FAILURE! ${op.name} went south.`, true);
        const casualties = Math.floor(crewIds.length * Math.random());
        for (let i = 0; i < casualties && crewIds.length; i++) {
            const targetId = crewIds.pop();
            gameState.members = gameState.members.filter(m => m.id !== targetId);
            updateLog('A crew member did not return.', true);
        }
    }
    gameState.currentOpportunities = gameState.currentOpportunities.filter(o => o.uid !== op.uid);
    closeModal();
    render();
    saveGame();
}

function openLaunderModal() {
    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div class="card max-w-md w-full p-6 rounded border-t-4 border-green-500">
                <h2 class="text-xl font-cinzel text-green-400 mb-2">Street Laundering</h2>
                <p class="text-gray-400 text-sm mb-4">50% cut via shady accountants. Buy fronts for better rates.</p>
                <p class="text-red-400 font-bold mb-4">Dirty: $${Math.floor(gameState.dirtyMoney).toLocaleString()}</p>
                <div class="space-y-2">
                    <button class="btn btn-secondary w-full py-2" onclick="manualLaunder(10000)" ${gameState.dirtyMoney < 10000 ? 'disabled' : ''}>$10k → $5k Clean</button>
                    <button class="btn btn-secondary w-full py-2" onclick="manualLaunder(50000)" ${gameState.dirtyMoney < 50000 ? 'disabled' : ''}>$50k → $25k Clean</button>
                </div>
                <div class="mt-4 flex justify-end"><button class="btn btn-secondary py-2 px-6" onclick="closeModal()">Close</button></div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');
}

function manualLaunder(amount) {
    if (gameState.dirtyMoney >= amount) {
        gameState.dirtyMoney -= amount;
        gameState.cleanMoney += amount / 2;
        updateLog(`Washed $${amount.toLocaleString()}.`);
        openLaunderModal();
        render();
        saveGame();
    }
}

function openOffshoreModal() {
    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div class="card max-w-md w-full p-6 rounded border-t-4 border-blue-500">
                <h2 class="text-xl font-cinzel text-blue-400 mb-2">Swiss Bank</h2>
                <p class="text-gray-400 text-sm mb-4">Protect clean cash. Withdrawals arrive next year.</p>
                <div class="bg-gray-800 p-4 rounded mb-4">
                    <p class="text-xs text-gray-400">Offshore Balance</p>
                    <p class="text-2xl font-bold text-green-400">$${gameState.offshore.toLocaleString()}</p>
                    ${gameState.pendingWithdrawal > 0 ? `<p class="text-xs text-amber-400 mt-2">Pending: $${gameState.pendingWithdrawal.toLocaleString()}</p>` : ''}
                </div>
                <p class="text-sm mb-2">Clean: $${Math.floor(gameState.cleanMoney).toLocaleString()}</p>
                <div class="flex gap-2 mb-2">
                    <button class="btn btn-primary flex-1 py-2 text-xs" onclick="depositOffshore(50000)" ${gameState.cleanMoney < 50000 ? 'disabled' : ''}>Deposit $50k</button>
                    <button class="btn btn-primary flex-1 py-2 text-xs" onclick="depositOffshore(100000)" ${gameState.cleanMoney < 100000 ? 'disabled' : ''}>$100k</button>
                </div>
                <button class="btn btn-secondary w-full py-2 text-xs mb-4" onclick="depositOffshore(gameState.cleanMoney)" ${gameState.cleanMoney <= 0 ? 'disabled' : ''}>Deposit All</button>
                <div class="flex gap-2">
                    <button class="btn btn-secondary flex-1 py-2 text-xs" onclick="withdrawOffshore(50000)" ${gameState.offshore < 50000 ? 'disabled' : ''}>Withdraw $50k</button>
                    <button class="btn btn-secondary flex-1 py-2 text-xs" onclick="withdrawOffshore(gameState.offshore)" ${gameState.offshore <= 0 ? 'disabled' : ''}>Withdraw All</button>
                </div>
                <div class="mt-4 flex justify-end"><button class="btn btn-secondary py-2 px-6" onclick="closeModal()">Close</button></div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');
}

function depositOffshore(amount) {
    const actual = Math.floor(Math.min(amount, gameState.cleanMoney));
    if (actual > 0) {
        gameState.cleanMoney -= actual;
        gameState.offshore += actual;
        updateLog(`Deposited $${actual.toLocaleString()} offshore.`);
        openOffshoreModal();
        render();
        saveGame();
    }
}

function withdrawOffshore(amount) {
    const actual = Math.floor(Math.min(amount, gameState.offshore));
    if (actual > 0) {
        gameState.offshore -= actual;
        gameState.pendingWithdrawal += actual;
        updateLog(`Withdrawal of $${actual.toLocaleString()} processing...`);
        openOffshoreModal();
        render();
        saveGame();
    }
}

function openMapModal(selectedRacketId = null) {
    modalContainer.innerHTML = `
        <div id="map-modal" class="modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-2 md:p-4 z-50">
            <div id="map-modal-content" class="card relative w-full max-w-5xl h-[75vh] rounded-lg border-t-4 border-amber-500 overflow-hidden">
                <button class="absolute top-3 right-4 text-white text-3xl font-bold z-50 hover:text-amber-300" onclick="closeModal()">&times;</button>
                <div class="absolute top-3 left-4 z-50 bg-black bg-opacity-60 px-3 py-1 rounded text-xs font-cinzel text-amber-200">City Map — click rackets</div>
                <div id="map-racket-container" class="relative w-full h-full"></div>
                <div id="map-info-panel" class="p-4"></div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');

    const container = $('#map-racket-container');
    gameState.rackets.forEach(r => {
        const icon = document.createElement('div');
        const ownerSlug = r.owner ? r.owner.toLowerCase().replace(/ /g, '-') : 'uncontrolled';
        icon.className = `racket-icon owner-${ownerSlug}${selectedRacketId == r.id ? ' active-icon' : ''}`;
        icon.style.left = r.mapCoordinates.x;
        icon.style.top = r.mapCoordinates.y;
        icon.title = r.name;
        icon.textContent = r.id;

        const rival = gameState.rivals.find(riv => riv.name === r.owner);
        if (rival && !GAME_CONFIG.rivalFamilies.some(f => f.name === rival.name)) {
            icon.style.backgroundColor = '#f97316';
        }
        icon.onclick = () => showRacketInfoPanel(r.id, icon);
        container.appendChild(icon);
    });

    if (selectedRacketId) {
        const r = gameState.rackets.find(x => x.id === selectedRacketId);
        const icons = $$('.racket-icon');
        const match = Array.from(icons).find(i => i.style.left === r.mapCoordinates.x && i.style.top === r.mapCoordinates.y);
        if (match) showRacketInfoPanel(selectedRacketId, match);
    }
}

function showRacketInfoPanel(rid, icon) {
    $$('.racket-icon').forEach(i => i.classList.remove('active-icon'));
    if (icon) icon.classList.add('active-icon');
    const r = gameState.rackets.find(rack => rack.id === rid);
    const panel = $('#map-info-panel');
    panel.classList.add('visible');

    let ui = `<h3 class="text-xl font-cinzel text-amber-200 mb-1">${r.name}</h3>`;

    if (r.owner === 'player') {
        if (r.supplyRequired === 6) {
            const hasSmuggler = gameState.rackets.some(rack => rack.id === 6 && rack.owner === 'player' && rack.shutdown < gameState.year);
            ui += hasSmuggler
                ? '<p class="text-[10px] text-blue-400 font-bold mb-2">Supply: Active</p>'
                : '<p class="text-[10px] text-red-500 font-bold mb-2">Supply: Cut (−50% income)</p>';
        }
        ui += `<p class="text-green-400 text-sm font-bold">CONTROLLED</p>
            <p class="text-xs text-gray-400 mt-1">Defense: ${getRacketDefense(r)}</p>
            <button class="btn btn-secondary w-full mt-3 py-2 text-xs" onclick="openAssignCrewModal(${r.id})">Manage Guards</button>
            <div class="mt-3 p-2 bg-gray-800 rounded text-xs border border-gray-700">
            <p class="font-bold text-amber-300 mb-2">Modules (${r.modules.length}/3)</p>`;
        r.modules.forEach(modId => {
            const mod = GAME_CONFIG.genericModules.find(m => m.id === modId) || GAME_CONFIG.uniqueModules[r.id];
            if (mod) ui += `<p class="text-green-400 mt-1">✓ ${mod.name}</p>`;
        });
        if (r.modules.length < 3) {
            ui += `<button class="btn btn-primary w-full mt-2 py-1 text-xs" onclick="openModuleModal(${r.id})">+ Install Module</button>`;
        }
        ui += '</div>';
    } else if (!r.owner) {
        ui += `<p class="text-gray-400 text-sm italic mb-2">Unclaimed</p>
            <button class="btn btn-primary w-full py-2" onclick="buyRacket(${r.id})" ${gameState.dirtyMoney < r.cost ? 'disabled' : ''}>Buy ($${(r.cost / 1000).toFixed(0)}k)</button>`;
    } else {
        ui += `<p class="text-red-400 text-sm mb-2">Owner: ${r.owner}</p>
            <button class="btn btn-danger w-full py-2" onclick="openAttackModal(${r.id})">Raid Turf</button>`;
    }
    panel.innerHTML = ui;
}

function openModuleModal(rid) {
    const r = gameState.rackets.find(rack => rack.id === rid);
    let available = [...GAME_CONFIG.genericModules];
    if (GAME_CONFIG.uniqueModules[r.id]) available.push(GAME_CONFIG.uniqueModules[r.id]);
    available = available.filter(m => !r.modules.includes(m.id));

    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-[60]">
            <div class="card max-w-lg w-full p-6 rounded border-t-4 border-amber-500 max-h-[80vh] overflow-y-auto custom-scrollbar">
                <h2 class="text-xl font-cinzel text-amber-300 mb-2">Modules: ${r.name}</h2>
                <div class="space-y-3">
                    ${available.length ? available.map(mod => `
                        <div class="bg-gray-800 p-3 rounded border border-gray-700">
                            <div class="flex justify-between mb-1"><span class="font-bold">${mod.name}</span><span class="text-red-400">$${(mod.cost / 1000).toFixed(0)}k</span></div>
                            <p class="text-xs text-gray-400 mb-2">${mod.desc}</p>
                            <button class="btn btn-primary w-full py-1 text-xs" onclick="buyModule(${r.id}, '${mod.id}')" ${gameState.dirtyMoney < mod.cost ? 'disabled' : ''}>Install</button>
                        </div>
                    `).join('') : '<p class="text-gray-500">No modules available.</p>'}
                </div>
                <button class="btn btn-secondary mt-4 py-2 px-6" onclick="closeModal(); openMapModal(${rid})">Back</button>
            </div>
        </div>`;
}

function buyModule(rid, modId) {
    const r = gameState.rackets.find(rack => rack.id === rid);
    const mod = GAME_CONFIG.genericModules.find(m => m.id === modId) || GAME_CONFIG.uniqueModules[rid];
    if (r && r.modules.length < 3 && mod && gameState.dirtyMoney >= mod.cost) {
        gameState.dirtyMoney -= mod.cost;
        r.modules.push(modId);
        updateLog(`Installed ${mod.name} at ${r.name}.`);
        closeModal();
        openMapModal(rid);
        render();
        saveGame();
    }
}

function openAssignCrewModal(id) {
    const racket = gameState.rackets.find(r => r.id === id);
    const eligible = gameState.members.filter(m =>
        !m.isBoss && m.age >= 18 && m.unavailableUntil <= gameState.year &&
        (m.role === 'Idle' || m.assignedRacketId === id || m.role === 'Working') &&
        !['Vegas Boss', 'Miami Boss'].includes(m.role)
    );

    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-[60]">
            <div class="card max-w-2xl w-full p-6 rounded border-t-4 border-blue-500">
                <h2 class="text-xl font-cinzel text-blue-400 mb-2">Guards: ${racket.name}</h2>
                <div id="racket-crew-list" class="space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
                    ${eligible.map(m => {
                        const buff = (racket.modules && racket.modules.includes('armory')) ? 20 : 0;
                        return `<label class="flex justify-between items-center p-2 rounded cursor-pointer ${m.assignedRacketId === id ? 'bg-blue-900 border border-blue-500' : 'bg-gray-800'}">
                            <div><span class="font-bold text-sm">${m.name}</span>
                            <span class="text-xs text-gray-400 block">Brawn ${m.stats.brawn + buff}${buff ? ' (+Armory)' : ''}</span></div>
                            <input type="checkbox" class="racket-crew-check" data-id="${m.id}" ${m.assignedRacketId === id ? 'checked' : ''}>
                        </label>`;
                    }).join('') || '<p class="text-gray-500 text-center py-4">No crew available.</p>'}
                </div>
                <div class="flex justify-end gap-3">
                    <button class="btn btn-secondary py-2 px-4" onclick="closeModal(); openMapModal(${id})">Cancel</button>
                    <button id="save-crew-btn" class="btn btn-primary py-2 px-4">Save</button>
                </div>
            </div>
        </div>`;

    $('#save-crew-btn').onclick = () => {
        const selectedIds = Array.from($$('.racket-crew-check:checked')).map(c => parseFloat(c.dataset.id));
        racket.assignedMembers.forEach(mid => {
            const m = gameState.members.find(x => x.id === mid);
            if (m) { m.assignedRacketId = null; if (m.role === 'Working') m.role = 'Idle'; }
        });
        racket.assignedMembers = [];
        selectedIds.forEach(mid => {
            const m = gameState.members.find(x => x.id === mid);
            if (!m) return;
            if (m.assignedRacketId && m.assignedRacketId !== id) {
                const old = gameState.rackets.find(r => r.id === m.assignedRacketId);
                if (old) old.assignedMembers = old.assignedMembers.filter(x => x !== mid);
            }
            m.assignedRacketId = id;
            if (m.role === 'Idle') m.role = 'Working';
            racket.assignedMembers.push(mid);
        });
        updateLog(`Crew updated at ${racket.name}.`);
        closeModal();
        openMapModal(id);
        render();
        saveGame();
    };
}

function openAttackModal(rid) {
    const r = gameState.rackets.find(rack => rack.id === rid);
    const warTax = gameState.activeLaw === 'war_tax' ? 10000 : 0;
    const raiders = gameState.members.filter(m =>
        ['Idle', 'Working'].includes(m.role) && m.age >= 18 && m.unavailableUntil <= gameState.year &&
        !['Vegas Boss', 'Miami Boss'].includes(m.role)
    );

    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-[60]">
            <div class="card max-w-lg w-full p-6 rounded border-t-4 border-red-600">
                <h3 class="text-lg font-cinzel text-red-400 mb-2">Raid: ${r.name}</h3>
                <p class="text-xs text-gray-400 mb-3">Defense: ${getRacketDefense(r)}${warTax ? ' · War Tax $10k' : ''}</p>
                <div class="space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
                    ${raiders.map(m => `
                        <label class="flex justify-between items-center p-2 bg-gray-800 rounded cursor-pointer">
                            <span class="text-sm">${m.name} (Brawn ${m.stats.brawn})</span>
                            <input type="checkbox" class="raid-check" data-id="${m.id}">
                        </label>
                    `).join('') || '<p class="text-gray-500 text-center">No raiders available.</p>'}
                </div>
                <div class="flex gap-3">
                    <button class="btn btn-secondary flex-1 py-2" onclick="openMapModal(${rid})">Cancel</button>
                    <button id="launch-raid-btn" class="btn btn-danger flex-1 py-2" ${gameState.dirtyMoney < warTax ? 'disabled' : ''}>Attack</button>
                </div>
            </div>
        </div>`;

    $('#launch-raid-btn').onclick = () => {
        const ids = Array.from($$('.raid-check:checked')).map(c => parseFloat(c.dataset.id));
        if (!ids.length) return;
        if (gameState.dirtyMoney < warTax) { updateLog('Cannot pay War Tax.'); return; }
        gameState.dirtyMoney -= warTax;

        let playerBrawn = 0;
        ids.forEach(id => { playerBrawn += gameState.members.find(m => m.id === id).stats.brawn; });

        const rival = gameState.rivals.find(riv => riv.name === r.owner);
        if (rival) { rival.standing -= 30; rival.relationship = 'War'; }

        if (playerBrawn + getRandomInt(0, 50) > getRacketDefense(r)) {
            r.owner = 'player';
            r.modules = r.modules || [];
            updateLog(`Victory! ${r.name} is yours.`, true);
        } else {
            updateLog(`Raid on ${r.name} failed.`, true);
            if (Math.random() < 0.5 && ids.length) {
                const deadId = ids[getRandomInt(0, ids.length - 1)];
                gameState.members = gameState.members.filter(m => m.id !== deadId);
                updateLog('A soldier was killed.', true);
            }
        }
        closeModal();
        render();
        saveGame();
    };
}

function openEstateModal() {
    let content;
    if (!gameState.estate.owned) {
        content = `
            <h2 class="text-xl font-cinzel text-amber-300 mb-2">The Don's Estate</h2>
            <p class="text-gray-400 text-sm mb-4">A fortified compound outside the city.</p>
            <button class="btn btn-primary w-full py-3 flex justify-between px-4" onclick="buyEstate()" ${gameState.cleanMoney < 250000 ? 'disabled' : ''}>
                <span>Purchase Estate</span><span class="text-xs text-green-400">$250k Clean</span>
            </button>`;
    } else {
        content = `
            <h2 class="text-xl font-cinzel text-amber-300 mb-2">The Estate</h2>
            <div class="space-y-2">
                <button class="btn w-full py-2 flex justify-between px-4 ${gameState.estate.walls ? 'btn-secondary' : 'btn-primary'}" onclick="buyEstateUpgrade('walls')" ${gameState.estate.walls || gameState.cleanMoney < 100000 ? 'disabled' : ''}>
                    <span>High Walls</span><span class="text-xs">${gameState.estate.walls ? 'Owned' : '$100k'}</span>
                </button>
                <button class="btn w-full py-2 flex justify-between px-4 ${gameState.estate.safe ? 'btn-secondary' : 'btn-primary'}" onclick="buyEstateUpgrade('safe')" ${gameState.estate.safe || gameState.cleanMoney < 50000 ? 'disabled' : ''}>
                    <span>Hidden Safe</span><span class="text-xs">${gameState.estate.safe ? 'Owned' : '$50k'}</span>
                </button>
                <button class="btn btn-primary w-full py-2" onclick="toggleParties()">Parties: ${gameState.estate.parties ? 'ON' : 'OFF'} ($20k/yr)</button>
            </div>`;
    }
    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div class="card max-w-lg w-full p-6 rounded border-t-4 border-amber-500">${content}
                <div class="mt-4 flex justify-end"><button class="btn btn-secondary py-2 px-6" onclick="closeModal()">Close</button></div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');
}

function buyEstate() {
    if (gameState.cleanMoney >= 250000) {
        gameState.cleanMoney -= 250000;
        gameState.estate.owned = true;
        updateLog('Estate purchased.');
        openEstateModal();
        render();
        saveGame();
    }
}

function buyEstateUpgrade(type) {
    if (type === 'walls' && gameState.cleanMoney >= 100000) {
        gameState.cleanMoney -= 100000;
        gameState.estate.walls = true;
        updateLog('Estate walls fortified.');
    } else if (type === 'safe' && gameState.cleanMoney >= 50000) {
        gameState.cleanMoney -= 50000;
        gameState.estate.safe = true;
        updateLog('Hidden safe installed.');
    }
    openEstateModal();
    render();
    saveGame();
}

function toggleParties() {
    gameState.estate.parties = !gameState.estate.parties;
    openEstateModal();
}

function openNationalMapModal() {
    const capos = gameState.members.filter(m => !m.isBoss && m.role === 'Capo' && m.unavailableUntil <= gameState.year);

    function expeditionCard(city, title, costLabel, costCheck, rewardText, isClean, selectId, establishFn) {
        const expId = gameState.expeditions[city];
        if (expId) {
            const boss = gameState.members.find(m => m.id === expId);
            const rogue = boss.stats.loyalty < 30;
            return `<div class="bg-gray-800 p-4 rounded border ${rogue ? 'border-red-500' : 'border-green-500'}">
                <h3 class="font-cinzel text-amber-300">${title}</h3>
                <p class="text-sm text-gray-400">Boss: ${boss.name} · Loyalty ${boss.stats.loyalty}</p>
                <p class="text-xs ${rogue ? 'text-red-500' : 'text-green-400'} mb-3">${rogue ? 'ROGUE — no income' : rewardText}</p>
                <button class="btn btn-secondary w-full text-xs py-2 mb-2" onclick="greaseExpedition('${boss.id}')" ${gameState.dirtyMoney < 15000 ? 'disabled' : ''}>Bribe (+20 Loyalty) $15k</button>
                <button class="btn btn-danger w-full text-xs py-2" onclick="recallExpedition('${city}')">Recall</button>
            </div>`;
        }
        return `<div class="bg-gray-800 p-4 rounded border border-gray-600">
            <h3 class="font-cinzel text-gray-400">${title}</h3>
            <p class="text-xs text-gray-500 mb-3">${costLabel}<br>${rewardText}</p>
            <select id="${selectId}" class="bg-gray-700 text-white w-full p-2 text-xs mb-2 rounded">
                <option value="">Select Capo...</option>
                ${capos.map(c => `<option value="${c.id}">${c.name} (Loyalty ${c.stats.loyalty})</option>`).join('')}
            </select>
            <button class="btn ${isClean ? 'btn-primary' : 'btn-danger'} w-full text-xs py-2" onclick="${establishFn}()" ${costCheck ? 'disabled' : ''}>Establish</button>
        </div>`;
    }

    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
            <div class="card max-w-4xl w-full p-6 rounded-lg border-t-4 border-blue-500">
                <h2 class="text-2xl font-cinzel text-blue-400 mb-4">National Operations</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    ${expeditionCard('vegas', 'Las Vegas Casino', '$250k Clean · Capo required', gameState.cleanMoney < 250000, '+$50k Clean/yr', true, 'vegas-capo-select', 'establishVegas')}
                    ${expeditionCard('miami', 'Miami Smuggling', '$150k Dirty · Capo required', gameState.dirtyMoney < 150000, '+$75k Dirty/yr', false, 'miami-capo-select', 'establishMiami')}
                </div>
                <button class="btn btn-secondary py-2 px-6" onclick="closeModal()">Close</button>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');
}

function establishVegas() {
    const capoId = parseFloat($('#vegas-capo-select').value);
    if (!capoId) { updateLog('Select a Capo.'); return; }
    const capo = gameState.members.find(m => m.id === capoId);
    if (gameState.cleanMoney >= 250000) {
        gameState.cleanMoney -= 250000;
        unassignMember(capoId, false);
        capo.role = 'Vegas Boss';
        gameState.expeditions.vegas = capoId;
        updateLog(`${capo.name} sent to Vegas.`);
        openNationalMapModal();
        render();
        saveGame();
    }
}

function establishMiami() {
    const capoId = parseFloat($('#miami-capo-select').value);
    if (!capoId) { updateLog('Select a Capo.'); return; }
    const capo = gameState.members.find(m => m.id === capoId);
    if (gameState.dirtyMoney >= 150000) {
        gameState.dirtyMoney -= 150000;
        unassignMember(capoId, false);
        capo.role = 'Miami Boss';
        gameState.expeditions.miami = capoId;
        updateLog(`${capo.name} sent to Miami.`);
        openNationalMapModal();
        render();
        saveGame();
    }
}

function recallExpedition(city) {
    const bossId = gameState.expeditions[city];
    const boss = gameState.members.find(m => m.id === bossId);
    if (boss) {
        boss.role = 'Capo';
        boss.stats.loyalty = Math.max(0, boss.stats.loyalty - 30);
        updateLog(`${boss.name} recalled, furious.`);
    }
    gameState.expeditions[city] = null;
    openNationalMapModal();
    render();
    saveGame();
}

function greaseExpedition(bossId) {
    if (gameState.dirtyMoney >= 15000) {
        gameState.dirtyMoney -= 15000;
        const boss = gameState.members.find(m => m.id === parseFloat(bossId));
        if (boss) boss.stats.loyalty = Math.min(100, boss.stats.loyalty + 20);
        updateLog('Care package sent.');
        openNationalMapModal();
        render();
        saveGame();
    }
}

function openOldCountryModal() {
    const standingBonus = hasInstalledModule('narco_perk') ? 20 : 10;
    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div class="card max-w-lg w-full p-6 rounded border-t-4 border-amber-600">
                <h2 class="text-xl font-cinzel text-amber-300 mb-2">The Old Country</h2>
                <div class="mb-4">
                    <div class="flex justify-between text-xs mb-1"><span>Standing with Sicily</span><span class="text-amber-400">${gameState.oldCountryStanding}/100</span></div>
                    <div class="h-2 bg-gray-900 rounded"><div class="bg-amber-500 h-2 rounded" style="width:${gameState.oldCountryStanding}%"></div></div>
                </div>
                <div class="space-y-2">
                    <button class="btn btn-secondary w-full py-2" onclick="sendRemittance()" ${gameState.dirtyMoney < 10000 ? 'disabled' : ''}>Remittance ($10k) +${standingBonus} Standing</button>
                    <button class="btn btn-primary w-full py-2" onclick="recruitImportedMuscle()" ${gameState.dirtyMoney < 25000 || gameState.oldCountryStanding < 50 ? 'disabled' : ''}>Imported Muscle ($25k) — 50 Standing</button>
                    <button class="btn btn-danger w-full py-2" onclick="fleeToSicily()" ${gameState.cleanMoney < 100000 || gameState.caseFile < 80 ? 'disabled' : ''}>Flee to Sicily (Win) — 80% Case</button>
                </div>
                <div class="mt-4 flex justify-end"><button class="btn btn-secondary py-2 px-6" onclick="closeModal()">Close</button></div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');
}

function sendRemittance() {
    if (gameState.dirtyMoney >= 10000) {
        gameState.dirtyMoney -= 10000;
        gameState.oldCountryStanding = Math.min(100, gameState.oldCountryStanding + (hasInstalledModule('narco_perk') ? 20 : 10));
        updateLog('Remittance sent to Sicily.');
        openOldCountryModal();
        render();
        saveGame();
    }
}

function recruitImportedMuscle() {
    if (gameState.dirtyMoney >= 25000 && gameState.oldCountryStanding >= 50) {
        gameState.dirtyMoney -= 25000;
        const m = createMember(false, true);
        m.name = `"${m.name.split(' ')[0]}" The Sicilian`;
        m.stats.brawn = getRandomInt(85, 100);
        m.stats.guts = getRandomInt(85, 100);
        m.stats.loyalty = 100;
        m.trait = 'Legend';
        gameState.members.push(m);
        updateLog('Legendary enforcer arrived from Sicily.', true);
        openOldCountryModal();
        render();
        saveGame();
    }
}

function openFavorModal() {
    if (gameState.favors < 1) return;
    const incarcerated = gameState.members.filter(m => m.unavailableUntil > gameState.year);
    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-[60]">
            <div class="card max-w-lg w-full p-6 rounded border-t-4 border-amber-400">
                <h2 class="text-xl font-cinzel text-amber-200 mb-2">Call in a Favor</h2>
                <div class="space-y-3">
                    <button class="btn btn-primary w-full py-2" onclick="useFavor('heat')">Erase All Heat</button>
                    <button class="btn btn-primary w-full py-2" onclick="useFavor('case')">Wipe Case File</button>
                    <button class="btn btn-primary w-full py-2" onclick="useFavor('prison')" ${incarcerated.length === 0 ? 'disabled' : ''}>Pardon Made Man</button>
                </div>
                <div class="mt-4 flex justify-end"><button class="btn btn-secondary py-2 px-6" onclick="closeModal()">Close</button></div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');
}

function useFavor(action) {
    if (gameState.favors < 1) return;
    if (action === 'heat') { gameState.heat = 0; gameState.favors--; updateLog('Heat erased.'); }
    else if (action === 'case') { gameState.caseFile = 0; gameState.favors--; updateLog('Case file wiped.'); }
    else if (action === 'prison') {
        const incarcerated = gameState.members.filter(m => m.unavailableUntil > gameState.year);
        if (incarcerated.length) {
            incarcerated.sort((a, b) => (b.stats.brawn + b.stats.brains) - (a.stats.brawn + a.stats.brains));
            const p = incarcerated[0];
            p.unavailableUntil = 0;
            p.role = 'Idle';
            gameState.favors--;
            updateLog(`${p.name} pardoned.`);
        }
    }
    closeModal();
    render();
    saveGame();
}

function fleeToSicily() {
    if (gameState.cleanMoney >= 100000 && gameState.caseFile >= 80) {
        gameState.cleanMoney -= 100000;
        closeModal();
        showEventModal({
            title: 'ESCAPE TO SICILY',
            description: 'You flee to the homeland with your fortune. Untouchable in exile. YOU WIN.',
            choices: [{ text: 'Play Again', effect: () => { location.reload(); } }]
        });
    }
}

function openHelpModal() {
    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
            <div class="card max-w-lg w-full p-6 rounded border-t-4 border-amber-500 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <h2 class="text-xl font-cinzel text-amber-300 mb-4">How to Play</h2>
                <ul class="text-sm text-gray-300 space-y-2 list-disc pl-5">
                    <li><strong>City Map</strong> — Buy unclaimed rackets, assign guards, install modules, raid rivals.</li>
                    <li><strong>Next Year</strong> — Collect income, pay upkeep, age crew, face events. Auto-saves.</li>
                    <li><strong>Dirty vs Clean</strong> — Rackets earn dirty cash. Front businesses launder it yearly.</li>
                    <li><strong>Heat & RICO</strong> — Heat rises from crime. After 1970, high heat builds a federal case.</li>
                    <li><strong>Family</strong> — Recruit, make men (10 yrs), promote Capos, designate an heir.</li>
                    <li><strong>Commission</strong> — Diplomacy, laws every 5 years, become Boss of Bosses.</li>
                </ul>
                <p class="text-xs text-gray-500 mt-4">Keyboard: press <kbd class="bg-gray-700 px-1 rounded">Space</kbd> or <kbd class="bg-gray-700 px-1 rounded">Enter</kbd> for Next Year.</p>
                <button class="btn btn-secondary mt-4 py-2 px-6" onclick="closeModal()">Close</button>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');
}
