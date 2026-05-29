function runRivalFamilyTurns() {
    gameState.rivals.forEach(rival => {
        if (rival.successionCrisis > gameState.year) return;

        if (Math.random() < 0.2) {
            const unclaimed = gameState.rackets.filter(r => !r.owner);
            if (unclaimed.length > 0) {
                unclaimed[0].owner = rival.name;
                unclaimed[0].modules = [];
                unclaimed[0].assignedMembers = [];
            }
        }

        if (rival.relationship === 'War' && Math.random() < 0.05) {
            if (gameState.estate.walls) {
                updateLog(`${rival.name} repelled at the Estate!`, true);
            } else {
                const don = gameState.members.find(m => m.isBoss);
                if (don && Math.random() < 0.3) {
                    gameState.members = gameState.members.filter(m => m.id !== don.id);
                    updateLog(`${rival.name} assassinated ${don.name}!`, true);
                    handleSuccession(don.name);
                } else {
                    updateLog(`${rival.name} attempted a hit on the Don — he escaped!`, true);
                }
            }
        }

        if (rival.relationship === 'War' || (rival.relationship === 'Hostile' && Math.random() < 0.1)) {
            const playerRackets = gameState.rackets.filter(r => r.owner === 'player');
            if (playerRackets.length > 0) {
                const target = playerRackets[getRandomInt(0, playerRackets.length - 1)];
                const attackPower = rival.strength + getRandomInt(0, 100);
                const defensePower = getRacketDefense(target);

                if (attackPower > defensePower) {
                    const casualties = [];
                    const hasTunnel = target.modules && target.modules.includes('tunnel');

                    target.assignedMembers.forEach(mid => {
                        if (!hasTunnel && Math.random() < 0.4) casualties.push(mid);
                        const m = gameState.members.find(x => x.id === mid);
                        if (m) {
                            m.assignedRacketId = null;
                            if (m.role === 'Working') m.role = 'Idle';
                        }
                    });
                    gameState.members = gameState.members.filter(m => !casualties.includes(m.id));

                    target.owner = rival.name;
                    target.modules = [];
                    target.assignedMembers = [];

                    let msg = `${rival.name} seized your ${target.name}!`;
                    if (casualties.length) msg += ` ${casualties.length} guards killed.`;
                    else if (hasTunnel) msg += ' Guards escaped via tunnel.';
                    updateLog(msg, true);
                } else {
                    updateLog(`Repelled ${rival.name}'s attack on ${target.name}.`, true);
                }
            }
        }
    });
}

function triggerRicoTrial() {
    if (gameState.caseFile < GAME_CONFIG.MAX_CASE_FILE) return;

    gameState.lastYearEvents.unshift({ type: 'rico', data: {} });
    const don = gameState.members.find(m => m.isBoss);

    showEventModal({
        title: 'RICO TRIAL',
        description: 'Federal prosecutors have enough evidence. The Don faces life in prison unless you spend influence and cash.',
        choices: [
            {
                text: 'Fight in court ($100k Clean, 50% acquittal)',
                effect: () => {
                    if (gameState.cleanMoney >= 100000) {
                        gameState.cleanMoney -= 100000;
                        if (Math.random() < 0.5) {
                            gameState.caseFile = 40;
                            updateLog('Acquitted on a technicality!', true);
                        } else if (don) {
                            don.unavailableUntil = gameState.year + 5;
                            don.role = 'Idle';
                            gameState.caseFile = 60;
                            updateLog(`${don.name} convicted — 5 years.`, true);
                        }
                    } else updateLog('Not enough clean cash for lawyers.');
                }
            },
            {
                text: 'Sacrifice the Don (Game continues under successor)',
                effect: () => {
                    if (don) {
                        const name = don.name;
                        gameState.members = gameState.members.filter(m => m.id !== don.id);
                        gameState.caseFile = 30;
                        handleSuccession(name);
                    }
                }
            }
        ]
    });
}

function triggerHeatEvents() {
    if (gameState.heat < 60) return;

    if (Math.random() < 0.25) {
        let stolen = 0;
        if (gameState.estate.safe) {
            const unprotected = Math.max(0, gameState.dirtyMoney - 100000);
            stolen = Math.floor(unprotected * 0.3);
            gameState.dirtyMoney -= stolen;
        } else {
            stolen = Math.floor(gameState.dirtyMoney * 0.3);
            gameState.dirtyMoney -= stolen;
        }
        if (stolen > 0) updateLog(`Police shakedown! Lost $${Math.round(stolen).toLocaleString()} dirty cash.`, true);
        gameState.heat = Math.max(0, gameState.heat - 10);
    }

    if (gameState.heat >= 80 && Math.random() < 0.15) {
        const idle = gameState.members.filter(m => m.role === 'Idle' && !m.isBoss && m.age >= 18);
        if (idle.length) {
            const busted = idle[getRandomInt(0, idle.length - 1)];
            busted.unavailableUntil = gameState.year + 3;
            busted.role = 'Idle';
            updateLog(`${busted.name} arrested! Out 3 years.`, true);
            gameState.caseFile += 8;
        }
    }
}

function advanceYear() {
    if (gameState.gameOver) return;
    if (!modalContainer.classList.contains('hidden')) return;
    showNewspaper();
}

function showNewspaper() {
    let headline = 'Quiet Streets in the Big Apple';
    let subtitle = 'Police report crime at an all-time low.';
    let imageUrl = 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=800';

    const major = gameState.lastYearEvents[0];
    if (major) {
        if (major.type === 'succession') {
            headline = `A New Era: ${major.data.newDon}`;
            subtitle = 'Leadership changes hands in the underworld.';
            imageUrl = 'https://images.unsplash.com/photo-1572947650440-e8a97ef053b2?q=80&w=800';
        } else if (major.type === 'rico') {
            headline = 'MOB BOSSES INDICTED!';
            subtitle = 'Federal RICO charges shake the Five Families.';
            imageUrl = 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=800';
        } else if (major.type === 'civil_war') {
            headline = 'MOB WAR ERUPTS FROM WITHIN!';
            subtitle = `${major.data.traitor} forms the ${major.data.faction}.`;
            imageUrl = 'https://images.unsplash.com/photo-1596241319213-2348b3bf2877?q=80&w=800';
        }
    }

    modalContainer.innerHTML = `
        <div class="modal fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
            <div id="newspaper-modal-content" class="max-w-3xl w-full p-6 md:p-8 rounded shadow-2xl">
                <div class="text-center border-b-4 border-black mb-4">
                    <h2 id="newspaper-masthead" class="text-3xl italic">THE DAILY GAZETTE</h2>
                    <p class="text-xs font-bold uppercase py-1">New York, ${gameState.year} | Final Edition</p>
                </div>
                <h3 id="newspaper-headline">${headline}</h3>
                <p id="newspaper-subtitle" class="italic text-gray-600 mb-4">${subtitle}</p>
                <div class="flex flex-col md:flex-row gap-4">
                    <div class="md:w-1/2">
                        <img src="${imageUrl}" alt="" class="w-full grayscale border-2 border-black mb-2">
                        <p class="text-[10px] italic">Authorities urge citizens to report suspicious activity.</p>
                    </div>
                    <div id="newspaper-body" class="md:w-1/2">
                        The city braces for another year of intrigue. Rackets flourish in the shadows while legitimate fronts open on every corner. The Commission meets in secret as federal agents tighten their grip...
                    </div>
                </div>
                <div class="flex justify-end mt-6">
                    <button class="btn btn-secondary text-black font-bold px-8 py-2 border-2 border-black" onclick="continueYear()">CONTINUE →</button>
                </div>
            </div>
        </div>`;
    modalContainer.classList.remove('hidden');
}

function continueYear() {
    closeModal();
    gameState.year++;
    gameState.lastYearEvents = [];

    if (gameState.pendingWithdrawal > 0) {
        gameState.cleanMoney += gameState.pendingWithdrawal;
        updateLog(`Swiss wire cleared: +$${gameState.pendingWithdrawal.toLocaleString()} Clean.`, true);
        gameState.pendingWithdrawal = 0;
    }

    generateNewOpportunities();

    let eraChanged = null;
    if (gameState.year === 1960) {
        gameState.era = 'The Narcotics Boom';
        const narco = GAME_CONFIG.availableRackets.find(r => r.id === 7);
        if (narco && !gameState.rackets.some(r => r.id === 7)) {
            const rival = GAME_CONFIG.rivalFamilies[getRandomInt(0, GAME_CONFIG.rivalFamilies.length - 1)];
            gameState.rackets.push({ ...narco, owner: rival.name, assignedMembers: [], shutdown: 0, intelRevealedUntil: 0, modules: [] });
        }
        eraChanged = { title: 'The 1960s: Narcotics Boom', description: 'The Narcotics Trade unlocks in Midtown — lucrative but destroys crew loyalty.' };
    } else if (gameState.year === 1970) {
        gameState.era = 'The RICO Era';
        eraChanged = { title: 'The 1970s: RICO Era', description: 'Federal RICO laws activate. Case file builds faster. Swiss Bank unlocks.' };
    }

    if (gameState.estate.parties) {
        if (gameState.cleanMoney >= 20000) gameState.cleanMoney -= 20000;
        else { gameState.estate.parties = false; updateLog('Estate parties canceled — insufficient funds.'); }
    }

    if (gameState.activeLaw === 'narcotics_ban' && gameState.rackets.some(r => r.id === 7 && r.owner === 'player')) {
        gameState.rivals.forEach(riv => { riv.standing = Math.max(0, riv.standing - 20); });
        updateLog('Commission sanctions you for the Narcotics Ban!', true);
    }
    if (gameState.activeLaw === 'mandatory_tribute') {
        gameState.rivals.forEach(riv => { riv.standing = Math.min(100, riv.standing + 5); });
    }

    if (gameState.isBossOfBosses) {
        const tribute = gameState.rivals.length * 10000;
        gameState.dirtyMoney += tribute;
        updateLog(`Boss of Bosses tax: +$${tribute.toLocaleString()}.`);
    }

    const inc = calculateIncome('player');
    const upkeep = gameState.members.reduce((t, m) => t + m.upkeep, 0);

    gameState.dirtyMoney += inc.dirty;
    gameState.cleanMoney += inc.clean;

    if (gameState.dirtyMoney >= upkeep) {
        gameState.dirtyMoney -= upkeep;
    } else {
        const remainder = upkeep - gameState.dirtyMoney;
        gameState.dirtyMoney = 0;
        gameState.cleanMoney = Math.max(0, gameState.cleanMoney - remainder);
        if (gameState.cleanMoney === 0 && gameState.members.length <= 1) {
            endGame('Bankrupt', 'The family could not pay upkeep. The empire collapses.');
            return;
        }
    }

    const toLaunder = Math.min(gameState.dirtyMoney, inc.launderCap);
    if (toLaunder > 0) {
        gameState.dirtyMoney -= toLaunder;
        gameState.cleanMoney += toLaunder;
        updateLog(`Fronts laundered $${Math.round(toLaunder).toLocaleString()}.`);
    }

    let civilWarTriggered = false;

    gameState.members.forEach(m => {
        m.age++;
        if (m.age > 18 && m.role === 'Youth') m.role = 'Idle';
        m.yearsInFamily++;

        if (m.role !== 'Idle') {
            m.stats.brawn = Math.min(100, m.stats.brawn + getRandomInt(0, 2));
            m.stats.brains = Math.min(100, m.stats.brains + getRandomInt(0, 2));
        }
        if (m.trait === 'Ambitious' && m.role === 'Idle') {
            m.stats.loyalty = Math.max(0, m.stats.loyalty - 10);
        }
        if (m.trait === 'Gambler' && Math.random() < 0.2) {
            const loss = getRandomInt(500, 3000);
            gameState.dirtyMoney = Math.max(0, gameState.dirtyMoney - loss);
            updateLog(`${m.name} lost $${loss} gambling.`);
        }
        if (m.assignedRacketId === 7) {
            m.stats.loyalty = Math.max(0, m.stats.loyalty - getRandomInt(5, 12));
        }
        if (gameState.estate.parties && m.stats.loyalty < 40 && !['Vegas Boss', 'Miami Boss'].includes(m.role)) {
            m.stats.loyalty = 40;
        }
        if (['Vegas Boss', 'Miami Boss'].includes(m.role)) {
            m.stats.loyalty = Math.max(0, m.stats.loyalty - getRandomInt(5, 15));
            if (m.stats.loyalty < 30 && Math.random() < 0.3) {
                updateLog(`${m.name} went rogue — profits withheld!`, true);
            }
        }
        if (!civilWarTriggered && !m.isBoss && m.stats.loyalty < 20 &&
            ['Capo', 'Underboss', 'Consigliere'].includes(m.role)) {
            triggerCivilWar(m);
            civilWarTriggered = true;
        }
    });

    // Children
    const don = gameState.members.find(m => m.isBoss);
    if (don && don.age >= 25 && don.age < 65 && Math.random() < GAME_CONFIG.CHANCE_OF_CHILD) {
        const child = createMember(false, false, don);
        gameState.members.push(child);
        updateLog(`A child was born to the family: ${child.name}.`, true);
    }

    const deaths = [];
    gameState.members = gameState.members.filter(m => {
        const deathChance = Math.pow(m.age / 90, 4);
        if (Math.random() < deathChance) {
            deaths.push(m.name);
            if (m.isBoss) handleSuccession(m.name);
            if (gameState.expeditions.vegas === m.id) gameState.expeditions.vegas = null;
            if (gameState.expeditions.miami === m.id) gameState.expeditions.miami = null;
            return false;
        }
        return true;
    });

    if (!gameState.members.some(m => m.isBoss) && gameState.members.length > 0) {
        handleSuccession('The Don');
    }

    gameState.rivals.forEach(rival => {
        if (!rival.members.some(m => m.role === 'Don')) {
            const heir = rival.members.find(m => m.role === 'Underboss') || rival.members.find(m => m.role === 'Capo');
            if (heir) {
                heir.role = 'Don';
                heir.name = `Don ${heir.name.replace(/^Don /, '')}`;
            } else {
                const familyName = rival.name.split(' ')[0];
                rival.members.push({
                    id: Math.random(),
                    name: `Don ${GAME_CONFIG.firstNames[getRandomInt(0, GAME_CONFIG.firstNames.length - 1)]} ${familyName}`,
                    role: 'Don',
                    stats: { brawn: getRandomInt(60, 90), brains: getRandomInt(60, 90), guts: getRandomInt(60, 90) }
                });
            }
        }
        while (rival.members.length < 3) {
            const familyName = rival.name.split(' ')[0];
            rival.members.push({
                id: Math.random(),
                name: `${GAME_CONFIG.firstNames[getRandomInt(0, GAME_CONFIG.firstNames.length - 1)]} ${familyName}`,
                role: 'Capo',
                stats: { brawn: getRandomInt(40, 70), brains: getRandomInt(40, 70), guts: getRandomInt(40, 70) }
            });
        }
    });

    let heatDecay = GAME_CONFIG.HEAT_DECAY;
    if (gameState.activeLaw === 'mandatory_tribute') heatDecay = Math.floor(heatDecay * 0.5);

    const playerRacketCount = gameState.rackets.filter(r => r.owner === 'player').length;
    if (!hasFullInfluence('police')) {
        gameState.heat += playerRacketCount * (GAME_CONFIG.HEAT_PER_RACKET || 1);
    }
    gameState.heat = Math.max(0, gameState.heat - heatDecay);

    if (gameState.era === 'The RICO Era') {
        const mult = gameState.activeLaw === 'omerta_pact' ? 0.5 : 1;
        gameState.caseFile += ((gameState.heat / 15) + (playerRacketCount * 1.5)) * mult;
        if (Math.random() < 0.2 && gameState.heat > 25) {
            gameState.caseFile += 10;
            updateLog('FBI wiretap! Case file spiked.', true);
        }
    }
    gameState.caseFile = Math.min(100, gameState.caseFile);

    triggerRicoTrial();
    triggerHeatEvents();

    const hasMajorEvent = gameState.lastYearEvents.length > 0 || eraChanged;

    if (gameState.year > 1946 && gameState.year % 5 === 0) {
        triggerCommissionVote();
    } else if (!hasMajorEvent && Math.random() < GAME_CONFIG.EVENT_CHANCE_PER_YEAR) {
        const ev = GAME_CONFIG.events[getRandomInt(0, GAME_CONFIG.events.length - 1)];
        setTimeout(() => showEventModal(ev), 400);
    }

    runRivalFamilyTurns();
    render();
    saveGame();

    if (deaths.length) updateLog(`${deaths.join(', ')} passed away.`);

    if (eraChanged) {
        setTimeout(() => showEventModal({
            title: eraChanged.title,
            description: eraChanged.description,
            choices: [{ text: 'Understood', effect: () => {} }]
        }), 500);
    }
}
