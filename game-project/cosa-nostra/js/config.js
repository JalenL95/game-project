const GAME_CONFIG = {
    firstNames: ["Vito", "Sonny", "Michael", "Fredo", "Tom", "Luca", "Peter", "Sal", "Paulie", "Rocco", "Gino", "Marco", "Angelo", "Nico", "Carmine", "Dante", "Enzo", "Tony", "Carlo"],
    lastNames: ["Corleone", "Tattaglia", "Barzini", "Stracci", "Cuneo", "Brasi", "Clemenza", "Tessio", "Gatto", "Lampone", "Cicci", "Neri", "Hagen", "Soprano"],
    traits: {
        Ambitious: { description: "Gains stats faster, but loses loyalty if Idle." },
        Loyal: { description: "Loyalty is high and decays very slowly." },
        Gambler: { description: "May lose family money each year." },
        Deceitful: { description: "Low starting loyalty, may steal from rackets." },
        Brute: { description: "High Brawn, but very low Brains." },
        Legend: { description: "An underworld legend. Supremely skilled." },
        Leader: { description: "Inspires the crew. Provides a boost to morale." }
    },
    rivalFamilies: [
        { name: "Tattaglia Family", color: "border-red-700", textColor: "text-red-400", personality: 'Aggressive', territoryColor: 'rgba(185, 28, 28, 0.4)' },
        { name: "Barzini Family", color: "border-blue-700", textColor: "text-blue-400", personality: 'Cunning', territoryColor: 'rgba(29, 78, 216, 0.4)' },
        { name: "Stracci Family", color: "border-emerald-700", textColor: "text-emerald-400", personality: 'Defensive', territoryColor: 'rgba(4, 120, 87, 0.4)' },
        { name: "Cuneo Family", color: "border-purple-700", textColor: "text-purple-400", personality: 'Opportunist', territoryColor: 'rgba(126, 34, 206, 0.4)' }
    ],
    neighborhoods: [
        { id: 'little-italy', name: 'Little Italy' },
        { id: 'docks', name: 'The Docks' },
        { id: 'midtown', name: 'Midtown' }
    ],
    availableRackets: [
        { id: 1, name: "Speakeasy", neighborhoodId: 'little-italy', cost: 10000, baseIncome: 3500, defense: 200, requires: { type: 'Brains', stat: 40 }, mapCoordinates: { x: '15%', y: '15%' }, supplyRequired: 6 },
        { id: 4, name: "Loan Sharking", neighborhoodId: 'little-italy', cost: 15000, baseIncome: 5000, defense: 300, requires: { type: 'Brains', stat: 50 }, mapCoordinates: { x: '35%', y: '25%' }, supplyRequired: null },
        { id: 3, name: "Protection Racket", neighborhoodId: 'docks', cost: 50000, baseIncome: 15000, defense: 1000, requires: { type: 'Brawn', stat: 60 }, mapCoordinates: { x: '10%', y: '75%' }, supplyRequired: null },
        { id: 6, name: "Smuggling Ring", neighborhoodId: 'docks', cost: 80000, baseIncome: 22000, defense: 1200, requires: { type: 'Brawn', stat: 70 }, mapCoordinates: { x: '30%', y: '85%' }, supplyRequired: null },
        { id: 2, name: "Gambling Den", neighborhoodId: 'midtown', cost: 25000, baseIncome: 8000, defense: 500, requires: { type: 'Brains', stat: 55 }, mapCoordinates: { x: '65%', y: '30%' }, supplyRequired: null },
        { id: 5, name: "Casino Front", neighborhoodId: 'midtown', cost: 100000, baseIncome: 25000, defense: 1500, requires: { type: 'Brains', stat: 75 }, mapCoordinates: { x: '85%', y: '60%' }, supplyRequired: null },
        { id: 7, name: "Narcotics Trade", neighborhoodId: 'midtown', cost: 150000, baseIncome: 50000, defense: 800, requires: { type: 'Brains', stat: 60 }, mapCoordinates: { x: '50%', y: '45%' }, supplyRequired: 6, unlockYear: 1960 }
    ],
    genericModules: [
        { id: 'vault', name: 'Secret Vault', desc: '+250 Defense against rival raids.', cost: 30000 },
        { id: 'vip', name: 'VIP Lounge', desc: '+100% Base Income (Requires Capo+ assigned).', cost: 40000 },
        { id: 'tunnel', name: 'Escape Tunnel', desc: 'Guards survive cleanly if racket is stolen.', cost: 20000 },
        { id: 'armory', name: 'The Armory', desc: 'All assigned guards gain +20 Brawn.', cost: 35000 }
    ],
    uniqueModules: {
        1: { id: 'speakeasy_perk', name: 'High Society', desc: 'Generates $2,000 extra Clean Cash yearly.', cost: 25000 },
        4: { id: 'loanshark_perk', name: 'Predatory Lending', desc: 'Recruiting new members is 25% cheaper.', cost: 25000 },
        3: { id: 'protection_perk', name: 'Garrison', desc: 'All player rackets gain +200 Defense globally.', cost: 50000 },
        6: { id: 'smuggling_perk', name: 'Ghost Ships', desc: 'Bribing the Police costs 25% less Clean Cash.', cost: 40000 },
        2: { id: 'gambling_perk', name: 'Backroom Wash', desc: 'Increases laundering cap by $10,000 yearly.', cost: 30000 },
        5: { id: 'casino_perk', name: 'The Vault', desc: '100% of Casino income becomes Clean Cash.', cost: 75000 },
        7: { id: 'narco_perk', name: 'Cartel Connections', desc: 'Old Country Remittances grant +20 Standing.', cost: 50000 }
    },
    laws: [
        { id: 'narcotics_ban', name: "The Narcotics Ban", desc: "Owning a Narcotics Trade drastically reduces standing with all families each year." },
        { id: 'omerta_pact', name: "Pact of Omertà", desc: "RICO Case File builds 50% slower, but Informant events are more likely." },
        { id: 'war_tax', name: "The War Tax", desc: "Declaring war or launching raids costs an additional $10k Dirty Cash to the Commission." },
        { id: 'mandatory_tribute', name: "Mandatory Tribute", desc: "All families passively gain +5 Standing with each other, but Heat decays 50% slower." }
    ],
    influenceTargets: [
        { id: 'mayor', name: "The Mayor's Office", totalCost: 500000, bonus: 'All racket income +20%.' },
        { id: 'police', name: "The Police Chief", totalCost: 350000, bonus: 'Rackets generate no Heat. Bribes are 50% cheaper.' },
        { id: 'union', name: "The Union Boss", totalCost: 400000, bonus: 'Unlock "Call a Strike" ability to shut down a rival family\'s rackets for one year.' }
    ],
    legacyPerks: [
        { id: 'blood_of_the_don', generation: 2, name: 'Blood of the Don', description: 'Children born into the family have higher potential (+5 to all base stats).' },
        { id: 'political_animal', generation: 3, name: 'Political Animal', description: 'Your family is adept at manipulation. All influence investments are 10% cheaper.' }
    ],
    businessFronts: [
        { id: 'bakery', name: 'La Bella Bakery', cost: 15000, income: 1000, launderCap: 5000 },
        { id: 'olive_oil', name: 'Genco Olive Oil', cost: 25000, income: 2000, launderCap: 10000 },
        { id: 'construction', name: 'Corleone Construction', cost: 75000, income: 5000, launderCap: 25000 },
        { id: 'import_export', name: 'Oceanic Import/Export', cost: 200000, income: 15000, launderCap: 60000 }
    ],
    specialOperations: [
        { id: 'bank_heist', name: 'Bank Heist', description: 'A daring raid on the First National Bank. High reward, extreme risk.', cost: 25000, risk: 40, reward: { cash: 200000 }, heat: 80, caseFile: 20, requirements: { stat: 'Guts', total: 200 } },
        { id: 'warehouse_raid', name: 'Raid Rival Warehouse', description: 'Hit a rival stash house for raw cash.', cost: 5000, risk: 30, reward: { cash: 40000 }, heat: 40, caseFile: 10, requirements: { stat: 'Brawn', total: 120 } },
        { id: 'art_theft', name: 'Museum Art Theft', description: 'Steal priceless art for the black market.', cost: 15000, risk: 35, reward: { cash: 100000 }, heat: 50, caseFile: 15, requirements: { stat: 'Brains', total: 180 } },
        { id: 'political_blackmail', name: 'Blackmail Politician', description: 'Dig up dirt on a city councilman.', cost: 10000, risk: 20, reward: { influence: 50000, target: 'mayor' }, heat: 30, caseFile: 10, requirements: { stat: 'Brains', total: 150 } },
        { id: 'mayor_dirty_work', name: "Mayor's Dirty Work", description: 'Silence a reporter investigating the Mayor.', cost: 5000, risk: 25, reward: { favors: 1 }, heat: 20, caseFile: 5, requirements: { stat: 'Brawn', total: 150 } },
        { id: 'union_busting', name: 'Union Busting', description: 'Break up a dock strike for the local Baron.', cost: 2000, risk: 15, reward: { favors: 1 }, heat: 15, caseFile: 5, requirements: { stat: 'Brawn', total: 100 } }
    ],
    events: [
        { title: "The Informant", description: "A low-level associate is talking to the Feds. How should we handle it?", choices: [
            { text: "Bury him ($5k Dirty)", effect: () => { gameState.dirtyMoney -= 5000; updateLog("Problem solved."); } },
            { text: "Ignore it (Heat +20)", effect: () => { gameState.heat += 20; updateLog("The Feds are watching closer now."); } }
        ]},
        { title: "Prohibition Ending", description: "Rumors suggest prohibition is nearing an end. Market prices are volatile.", choices: [
            { text: "Stockpile Goods ($20k Dirty)", effect: () => { gameState.dirtyMoney -= 20000; gameState.rackets.forEach(r => { if (r.owner === 'player') r.baseIncome *= 1.2; }); updateLog("Market secured."); } },
            { text: "Liquidate Assets", effect: () => { gameState.dirtyMoney += 15000; updateLog("Quick dirty cash, but potential lost."); } }
        ]},
        { title: "Internal Dispute", description: "Two Capos are arguing over a cut from the docks.", choices: [
            { text: "Demand peace, evenly split it.", effect: () => { gameState.members.forEach(m => { if (m.role === 'Capo') m.stats.loyalty = Math.max(0, m.stats.loyalty - 5); }); updateLog("Neither is happy, but blood was spared."); } },
            { text: "Pay them off ($15k Dirty)", effect: () => {
                if (gameState.dirtyMoney >= 15000) { gameState.dirtyMoney -= 15000; updateLog("Money solves all problems."); }
                else { updateLog("You couldn't afford to pay them off."); gameState.members.forEach(m => { if (m.role === 'Capo') m.stats.loyalty -= 10; }); }
            }},
            { text: "Tell them to shut up.", effect: () => { gameState.members.forEach(m => { if (m.role === 'Capo') m.stats.loyalty = Math.max(0, m.stats.loyalty - 15); }); updateLog("The Capos lose respect for your dismissal."); } }
        ]}
    ],
    RECRUIT_COST: 2500,
    UPKEEP_COST_PER_MEMBER: 200,
    MADE_MAN_UPKEEP_COST: 600,
    CAPO_UPKEEP_COST: 1200,
    CONSIGLIERE_UPKEEP_COST: 2500,
    MADE_MAN_YEARS_REQ: 10,
    EVENT_CHANCE_PER_YEAR: 0.3,
    HEAT_DECAY: 5,
    HEAT_PER_RACKET: 1,
    BRIBE_BASE_COST: 15000,
    INFLUENCE_INVESTMENT: 30000,
    MAX_CASE_FILE: 100,
    CHANCE_OF_CHILD: 0.15,
    SAVE_KEY: 'cosaNostraSave_v1'
};
