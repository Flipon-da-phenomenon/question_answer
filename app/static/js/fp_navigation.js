(function () {
  function shuffleOrder(values) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    if (copy.length > 1) {
      const current = window.FP.state.cardOrder && window.FP.state.cardOrder.length ? window.FP.state.cardOrder[0] : null;
      const first = copy[0];
      if (current !== null && current !== undefined && first === current) {
        const swapIndex = Math.max(1, Math.floor(Math.random() * copy.length));
        [copy[0], copy[swapIndex]] = [copy[swapIndex], copy[0]];
      }
    }
    return copy;
  }

  function markCompletedCardsForCurrentPhase(state) {
    if (!state.activeTable || !state.tableData) {
      return;
    }
    const phase = state.tableData.phases[state.currentPhaseIndex];
    if (!phase) {
      return;
    }
    (phase.cards || []).forEach((card) => {
      const key = `${state.activeTable}|${phase.phase}|${card.setId}`;
      const current = state.cardsCompleted[key] || false;
      const hasAudio = !!((card.primary && card.primary.audio) || (card.secondary || []).some((group) => group.audio));
      if (!hasAudio) {
        state.cardsCompleted[key] = true;
      } else if (current) {
        state.cardsCompleted[key] = true;
      }
    });
  }

  function handleAudioCompleted(button, tableName, phase, card) {
    const groupIndex = Number(button.dataset.fpGroupIndex || 0);
    const sectionIndex = Number(button.dataset.fpSectionIndex || 0);
    const key = `${tableName}|${phase.phase}|${card.setId}|${sectionIndex}|${groupIndex}`;
    window.FP.state.dispatch({ type: 'AUDIO_PLAYED', key: key });
    button.classList.add('is-complete');
    button.setAttribute('aria-pressed', 'true');
    markCompletedCardsForCurrentPhase(window.FP.state);
  }

  window.FP = window.FP || {};
  window.FP.navigation = {
    shuffleOrder: shuffleOrder,
    selectTable: function (tableName) {
      const table = (window.FP.state.tables || []).find((item) => item.name === tableName);
      if (!table) {
        return Promise.resolve();
      }
      return window.FP.api.loadTable(tableName).then((payload) => {
        window.FP.state.dispatch({ type: 'SELECT_TABLE', tableName: tableName, tableData: payload });
        window.FP.render.renderApp();
      }).catch((error) => {
        window.FP.state.dispatch({ type: 'LOAD_TABLES', tables: window.FP.state.tables, errors: [error.message] });
        window.FP.render.renderApp();
        return null;
      });
    },
    loadAllTables: function () {
      return window.FP.api.loadTables().then((payload) => {
        window.FP.state.dispatch({ type: 'LOAD_TABLES', tables: payload.tables || [], errors: payload.errors || [] });
        window.FP.render.renderApp();
      }).catch((error) => {
        window.FP.state.dispatch({ type: 'LOAD_TABLES', tables: [], errors: [error.message] });
        window.FP.render.renderApp();
      });
    },
    showNextCard: function () {
      if (!window.FP.state.activeTable || !window.FP.state.tableData) {
        return;
      }
      window.FP.state.dispatch({ type: 'ADVANCE_CARD' });
      window.FP.render.renderApp();
    },
    showNextPhase: function () {
      const state = window.FP.state;
      if (!state.tableData || !window.FP.helpers.isPhaseComplete(state, state.currentPhaseIndex)
        || !state.tableData.phases[state.currentPhaseIndex + 1]) {
        return;
      }
      state.dispatch({ type: 'ADVANCE_PHASE' });
      window.FP.render.renderApp();
    },
    jumpToPhase: function (phaseIndex) {
      const state = window.FP.state;
      if (!window.FP.helpers.canAccessPhase(state, phaseIndex)) {
        return;
      }
      state.currentPhaseIndex = phaseIndex;
      state.currentCardIndex = 0;
      const phase = state.tableData.phases[phaseIndex];
      state.cardOrder = phase.cardIds ? phase.cardIds.slice() : [];
      if ((phase.sequence || 'in order') === 'random') {
        state.cardOrder = shuffleOrder(state.cardOrder);
      }
      if (phase.videoUrl) {
        state.dispatch({ type: 'SHOW_VIDEO', phaseKey: `${state.activeTable}|${phase.phase}` });
      } else {
        state.dispatch({ type: 'SHOW_CARDS' });
      }
      window.FP.render.renderApp();
    },
    retry: function () {
      window.FP.navigation.loadAllTables();
    },
    playCardAudio: function (button) {
      const url = button.dataset.fpAudio;
      const tableName = button.dataset.fpTable;
      const phaseNumber = Number(button.dataset.fpPhase || 0);
      const cardSetId = Number(button.dataset.fpSetId || 0);
      const sectionIndex = Number(button.dataset.fpSectionIndex || 0);
      const groupIndex = Number(button.dataset.fpGroupIndex || 0);
      const phase = window.FP.state.tableData.phases[window.FP.state.currentPhaseIndex];
      if (!url || !phase) {
        return;
      }
      const card = (phase.cards || []).find((item) => String(item.setId) === String(cardSetId));
      const key = `${tableName}|${phase.phase}|${cardSetId}|${sectionIndex}|${groupIndex}`;
      button.classList.add('is-processing');
      window.FP.audio.playOnce(url).then(() => {
        window.FP.state.dispatch({ type: 'AUDIO_PLAYED', key: key });
        button.classList.remove('is-processing');
        button.classList.add('is-complete');
        button.setAttribute('aria-pressed', 'true');
        if (card) {
          const cardKey = `${tableName}|${phase.phase}|${cardSetId}`;
          const hasAudio = !!((card.primary && card.primary.audio) || (card.secondary || []).some((group) => group.audio));
          if (!hasAudio) {
            window.FP.state.dispatch({ type: 'CARD_AUTOCOMPLETE', cardKey: cardKey });
          }
        }
        window.FP.render.renderApp();
      }).catch(() => {
        button.classList.add('is-error');
        setTimeout(() => button.classList.remove('is-error'), 350);
        window.FP.state.dispatch({ type: 'AUDIO_PLAYED', key: key });
        window.FP.render.renderApp();
      });
    },
    checkForPhaseCompletion: function () {
      const state = window.FP.state;
      if (!state.activeTable || !state.tableData) {
        return;
      }
      const phase = state.tableData.phases[state.currentPhaseIndex];
      if (!phase) {
        return;
      }
      const allReady = (phase.cards || []).every((card) => {
        const key = `${state.activeTable}|${phase.phase}|${card.setId}`;
        return !!state.cardsCompleted[key];
      });
      state.phasesCompleted[`${state.activeTable}|${phase.phase}`] = allReady;
      state.nextPhaseUnlocked[`${state.activeTable}|${phase.phase}`] = allReady || !!state.nextPhaseUnlocked[`${state.activeTable}|${phase.phase}`];
      return allReady;
    }
  };
})();
