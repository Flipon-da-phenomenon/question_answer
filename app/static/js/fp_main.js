document.addEventListener('DOMContentLoaded', function () {
  window.FP = window.FP || {};
  window.FP.config = window.FP.config || {};
  window.FP.state = window.FP.state || window.FP.helpers.makeInitialState();
  window.FP.state.dispatch = window.FP.state.dispatch || function (action) {
    const next = window.FP.helpers ? window.FP.helpers.makeInitialState() : { screen: 'menu' };
    Object.assign(this, next);
    return this;
  };

  function syncCompletionFlags() {
    const state = window.FP.state;
    if (!state.activeTable || !state.tableData) {
      return;
    }
    const phase = state.tableData.phases[state.currentPhaseIndex];
    if (!phase) {
      return;
    }
    (phase.cards || []).forEach((card) => {
      const cardKey = `${state.activeTable}|${phase.phase}|${card.setId}`;
      const allAudioPlayed = (card.primary && card.primary.audio) || (card.secondary || []).some((group) => group.audio)
        ? [card.primary, ...(card.secondary || [])].every((group) => {
          if (!group || !group.audio) {
            return true;
          }
          const key = `${state.activeTable}|${phase.phase}|${card.setId}|${group.sectionIndex || 0}|${group.groupIndex || 0}`;
          return !!state.audioPlayed[key];
        })
        : true;
      if (allAudioPlayed) {
        state.cardsCompleted[cardKey] = true;
        state.nextCardUnlocked[cardKey] = true;
      }
      const phaseKey = `${state.activeTable}|${phase.phase}`;
      const phaseComplete = (phase.cards || []).every((item) => !!state.cardsCompleted[`${state.activeTable}|${phase.phase}|${item.setId}`]);
      if (phaseComplete) {
        state.phasesCompleted[phaseKey] = true;
        state.nextPhaseUnlocked[phaseKey] = true;
      }
    });
  }

  document.addEventListener('click', function (event) {
    const target = event.target.closest('[data-fp-action]');
    if (!target) {
      return;
    }

    const actionName = target.getAttribute('data-fp-action');
    if (actionName === 'select-table') {
      const tableName = target.getAttribute('data-fp-table');
      window.FP.navigation.selectTable(tableName);
      return;
    }

    if (actionName === 'retry-loading') {
      window.FP.navigation.retry();
      return;
    }

    if (actionName === 'play-audio') {
      window.FP.navigation.playCardAudio(target);
      return;
    }

    if (actionName === 'next-card') {
      const phase = window.FP.state.tableData && window.FP.state.tableData.phases[window.FP.state.currentPhaseIndex];
      const card = window.FP.render && typeof window.FP.render !== 'undefined' ? window.FP.helpers.makeCardKey(window.FP.state.activeTable, phase.phase, window.FP.state.cardOrder[window.FP.state.currentCardIndex]) : null;
      if (phase && window.FP.state.activeTable) {
        const currentSetId = window.FP.state.cardOrder[window.FP.state.currentCardIndex];
        const key = `${window.FP.state.activeTable}|${phase.phase}|${currentSetId}`;
        window.FP.state.nextCardUnlocked[key] = true;
      }
      window.FP.navigation.showNextCard();
      return;
    }

    if (actionName === 'next-phase') {
      window.FP.navigation.showNextPhase();
      return;
    }

    if (actionName === 'return-menu') {
      window.FP.state.dispatch({ type: 'RESET_VIEW_TO_MENU' });
      window.FP.render.renderApp();
      return;
    }

    if (actionName === 'continue-to-cards') {
      window.FP.state.dispatch({ type: 'SHOW_CARDS' });
      window.FP.render.renderApp();
      return;
    }

    if (actionName === 'skip-video') {
      window.FP.state.dispatch({ type: 'VIDEO_FINISHED' });
      window.FP.render.renderApp();
      return;
    }

    if (actionName === 'jump-phase') {
      const index = Number(target.getAttribute('data-fp-phase-index'));
      window.FP.navigation.jumpToPhase(index);
    }
  });

  function refreshProgressState() {
    syncCompletionFlags();
    const state = window.FP.state;
    if (!state.activeTable || !state.tableData) {
      return;
    }
    const phase = state.tableData.phases[state.currentPhaseIndex];
    if (!phase) {
      return;
    }
    const currentCard = window.FP.render && window.FP.render.renderApp ? getCurrentCardFromState() : null;
    if (currentCard) {
      const key = `${state.activeTable}|${phase.phase}|${currentCard.setId}`;
      const hasAudio = !!((currentCard.primary && currentCard.primary.audio) || (currentCard.secondary || []).some((group) => group.audio));
      if (!hasAudio) {
        state.cardsCompleted[key] = true;
        state.nextCardUnlocked[key] = true;
      }
    }
    const phaseKey = `${state.activeTable}|${phase.phase}`;
    const allCardsDone = (phase.cards || []).every((card) => !!state.cardsCompleted[`${state.activeTable}|${phase.phase}|${card.setId}`]);
    if (allCardsDone) {
      state.phasesCompleted[phaseKey] = true;
      state.nextPhaseUnlocked[phaseKey] = true;
    }
  }

  function getCurrentCardFromState() {
    const state = window.FP.state;
    if (!state.activeTable || !state.tableData) {
      return null;
    }
    const phase = state.tableData.phases[state.currentPhaseIndex];
    if (!phase) {
      return null;
    }
    const setId = state.cardOrder[state.currentCardIndex];
    return (phase.cards || []).find((card) => String(card.setId) === String(setId)) || null;
  }

  setInterval(function () {
    refreshProgressState();
  }, 200);

  window.FP.navigation.loadAllTables();
});
