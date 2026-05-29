function continueFromSave() {
    if (!loadGame()) return false;
    showGameUI();
    render();
    updateLog('Welcome back, Don.');
    const saveInfo = $('#save-info');
    if (saveInfo) {
        try {
            const payload = JSON.parse(localStorage.getItem(GAME_CONFIG.SAVE_KEY));
            saveInfo.textContent = `Last saved: ${new Date(payload.savedAt).toLocaleString()}`;
        } catch (_) { /* ignore */ }
    }
    return true;
}

function bindGameControls() {
    streetCrimeBtn.onclick = openStreetCrimeModal;
    recruitBtn.onclick = recruitMember;
    bribeBtn.onclick = bribePolice;
    favorBtn.onclick = openFavorModal;
    launderBtn.onclick = openLaunderModal;
    oldCountryBtn.onclick = openOldCountryModal;
    estateBtn.onclick = openEstateModal;
    mapBtn.onclick = () => openMapModal();
    nationalBtn.onclick = openNationalMapModal;
    offshoreBtn.onclick = openOffshoreModal;
    commissionBtn.onclick = openCommissionModal;
    rivalIntelBtn.onclick = openRivalIntelModal;
    nextYearBtn.onclick = advanceYear;
    $('#help-btn').onclick = openHelpModal;

    $('#dismiss-tutorial').onclick = () => {
        $('#tutorial-banner').classList.add('hidden');
        gameState.tutorialSeen = true;
        saveGame();
    };

    document.addEventListener('keydown', (e) => {
        if (gameState.gameOver) return;
        if ($('#start-screen') && !$('#start-screen').classList.contains('hidden')) return;
        if (e.code === 'Space' || e.code === 'Enter') {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;
            if (!modalContainer.classList.contains('hidden')) return;
            e.preventDefault();
            advanceYear();
        }
    });
}

function exposeGlobals() {
    const fns = {
        closeModal, openRivalIntelModal, openHitModal, executeHit,
        claimBossOfBosses, openCommissionModal, openSitDownModal, handleDiplomacy,
        executeStreetCrime, manualLaunder, depositOffshore, withdrawOffshore,
        buyRacket, openAssignCrewModal, openModuleModal, buyModule, openAttackModal,
        openMapModal, buyEstate, buyEstateUpgrade, toggleParties,
        establishVegas, establishMiami, recallExpedition, greaseExpedition,
        sendRemittance, recruitImportedMuscle, fleeToSicily, useFavor,
        continueYear, makeMan, promoteToCapo, promoteToUnderboss, promoteToConsigliere,
        designateHeir, buyInfluence, buyBusiness, openAssembleCrewModal
    };
    Object.assign(window, fns);
}

function initStartScreen() {
    const btnContinue = $('#btn-continue');
    const btnNew = $('#btn-new-game');
    const btnRestart = $('#btn-restart');
    const saveInfo = $('#save-info');

    if (hasSaveGame()) {
        btnContinue.disabled = false;
        try {
            const payload = JSON.parse(localStorage.getItem(GAME_CONFIG.SAVE_KEY));
            saveInfo.textContent = `Saved game found (${new Date(payload.savedAt).toLocaleString()})`;
        } catch (_) {
            saveInfo.textContent = 'Saved game found';
        }
    }

    btnNew.onclick = () => {
        if (hasSaveGame() && !confirm('Start a new dynasty? This will overwrite your saved game.')) return;
        startNewGame();
        saveGame();
    };

    btnContinue.onclick = () => {
        if (continueFromSave()) return;
        alert('Could not load save.');
    };

    btnRestart.onclick = () => location.reload();
}

function init() {
    cacheDomRefs();
    exposeGlobals();
    initStartScreen();
    bindGameControls();
}

document.addEventListener('DOMContentLoaded', init);
