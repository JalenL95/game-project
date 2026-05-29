function getFreshGameState() {
    return {
        year: 1946,
        era: 'The Golden Age',
        dirtyMoney: 10000,
        cleanMoney: 20000,
        favors: 0,
        offshore: 0,
        pendingWithdrawal: 0,
        members: [],
        rackets: [],
        rivals: [],
        heat: 0,
        caseFile: 0,
        influence: { mayor: 0, police: 0, union: 0 },
        activeBonuses: { 'little-italy': false, 'midtown': false, 'docks': false },
        generation: 1,
        unlockedLegacyPerks: [],
        ownedBusinesses: [],
        currentOpportunities: [],
        lastYearEvents: [],
        oldCountryStanding: 0,
        estate: { owned: false, walls: false, parties: false, safe: false },
        expeditions: { vegas: null, miami: null },
        activeLaw: null,
        isBossOfBosses: false,
        gameOver: false,
        tutorialSeen: false
    };
}

let gameState = getFreshGameState();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

let yearDisplay, familySizeDisplay, dirtyDisplay, cleanDisplay, favorsDisplay;
let incomeDisplay, heatDisplay, caseFileDisplay, logMessage, modalContainer;
let familyRoster, influenceGrid, legacyGrid, businessGrid, opportunitiesGrid;
let recruitBtn, nextYearBtn, bribeBtn, favorBtn, launderBtn, mapBtn;
let commissionBtn, oldCountryBtn, streetCrimeBtn, estateBtn, nationalBtn, offshoreBtn, rivalIntelBtn;

function cacheDomRefs() {
    yearDisplay = $('#year-display');
    familySizeDisplay = $('#family-size-display');
    dirtyDisplay = $('#dirty-display');
    cleanDisplay = $('#clean-display');
    favorsDisplay = $('#favors-display');
    incomeDisplay = $('#income-display');
    heatDisplay = $('#heat-display');
    caseFileDisplay = $('#case-file-display');
    logMessage = $('#log-message');
    modalContainer = $('#modal-container');
    familyRoster = $('#family-roster');
    influenceGrid = $('#influence-grid');
    legacyGrid = $('#legacy-grid');
    businessGrid = $('#business-grid');
    opportunitiesGrid = $('#opportunities-grid');
    recruitBtn = $('#recruit-btn');
    nextYearBtn = $('#next-year-btn');
    bribeBtn = $('#bribe-btn');
    favorBtn = $('#favor-btn');
    launderBtn = $('#launder-btn');
    mapBtn = $('#map-btn');
    commissionBtn = $('#commission-btn');
    oldCountryBtn = $('#old-country-btn');
    streetCrimeBtn = $('#street-crime-btn');
    estateBtn = $('#estate-btn');
    nationalBtn = $('#national-btn');
    offshoreBtn = $('#offshore-btn');
    rivalIntelBtn = $('#rival-intel-btn');
}
