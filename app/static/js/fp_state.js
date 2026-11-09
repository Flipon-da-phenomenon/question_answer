(function () {
  function makePhaseKey(tableName, phaseNumber) {
    return `${tableName}|${phaseNumber}`;
  }

  function makeCardKey(tableName, phaseNumber, setId) {
    return `${tableName}|${phaseNumber}|${setId}`;
  }

  function isPhaseComplete(state, phaseIndex) {
    if (!state || !state.tableData || !state.tableData.phases || !state.tableData.phases[phaseIndex]) {
      return false;
    }
    const phase = state.tableData.phases[phaseIndex];
    return (phase.cards || []).every((card) => !!state.cardsCompleted[makeCardKey(state.activeTable, phase.phase, card.setId)]);
  }

  function canAccessPhase(state, phaseIndex) {
    const phases = state && state.tableData && state.tableData.phases;
    if (!phases || !Number.isInteger(phaseIndex) || phaseIndex < 0 || phaseIndex >= phases.length) {
      return false;
    }
    if (phaseIndex === state.currentPhaseIndex || isPhaseComplete(state, phaseIndex)) {
      return true;
    }
    return phaseIndex === state.currentPhaseIndex + 1 && isPhaseComplete(state, state.currentPhaseIndex);
  }

  function makeAudioKey(tableName, phaseNumber, setId, sectionIndex, groupIndex) {
    return `${tableName}|${phaseNumber}|${setId}|${sectionIndex}|${groupIndex}`;
  }

  function makeInitialState() {
    return {
      screen: 'menu',
      tables: [],
      activeTable: null,
      tableData: null,
      currentPhaseIndex: 0,
      currentCardIndex: 0,
      cardOrder: [],
      currentCycle: 0,
      video: {
        active: false,
        phaseKey: null,
        playing: false,
        error: null,
        transitionFired: false,
      },
      audioPlayed: {},
      revealedAudioTexts: {},
      cardsCompleted: {},
      nextCardUnlocked: {},
      phasesCompleted: {},
      nextPhaseUnlocked: {},
      tableCompleted: {},
      errors: []
    };
  }

  function updateProgressState(state) {
    if (!state.activeTable || !state.tableData) {
      return state;
    }

    const phase = state.tableData.phases[state.currentPhaseIndex];
    if (!phase) {
      return state;
    }

    const phaseKey = makePhaseKey(state.activeTable, phase.phase);
    const cardList = phase.cards || [];

    for (const card of cardList) {
      const cardKey = makeCardKey(state.activeTable, phase.phase, card.setId);
      const hasAudio = (card.primary && card.primary.audio) || (card.secondary || []).some((group) => group.audio);
      let complete = true;
      if (hasAudio) {
        const audioKeys = [];
        if (card.primary && card.primary.audio) {
          audioKeys.push(['primary', 0, 0]);
        }
        (card.secondary || []).forEach((group, idx) => {
          if (group.audio) {
            audioKeys.push(['secondary', idx + 1, idx]);
          }
        });
        complete = audioKeys.length > 0 && audioKeys.every(([sectionType, sectionPosition, groupIndex]) => {
          const key = makeAudioKey(state.activeTable, phase.phase, card.setId, sectionPosition, groupIndex);
          return !!state.audioPlayed[key];
        });
      }
      state.cardsCompleted[cardKey] = complete;
    }

    const phaseComplete = (phase.cards || []).every((card) => !!state.cardsCompleted[makeCardKey(state.activeTable, phase.phase, card.setId)]);
    if (phaseComplete) {
      state.phasesCompleted[phaseKey] = true;
    }

    const finalPhase = state.tableData.phases[state.tableData.phases.length - 1];
    if (finalPhase && state.phasesCompleted[makePhaseKey(state.activeTable, finalPhase.phase)]) {
      state.tableCompleted[state.activeTable] = true;
    }

    return state;
  }

  function reducer(state, action) {
    const next = Object.assign({}, state);
    const table = next.activeTable;
    switch (action.type) {
      case 'LOAD_TABLES':
        next.revealedAudioTexts = {};
        next.tables = action.tables || [];
        next.errors = action.errors || [];
        next.screen = 'menu';
        next.activeTable = null;
        next.tableData = null;
        next.currentPhaseIndex = 0;
        next.currentCardIndex = 0;
        next.cardOrder = [];
        next.currentCycle = 0;
        next.video = { active: false, phaseKey: null, playing: false, error: null, transitionFired: false };
        return next;

      case 'SELECT_TABLE': {
        next.revealedAudioTexts = {};
        next.activeTable = action.tableName;
        next.tableData = action.tableData;
        next.currentPhaseIndex = 0;
        next.currentCardIndex = 0;
        next.currentCycle = 0;
        next.cardOrder = [];
        next.video = { active: false, phaseKey: null, playing: false, error: null, transitionFired: false };
        const firstPhase = action.tableData && action.tableData.phases && action.tableData.phases[0];
        if (firstPhase && firstPhase.videoUrl) {
          next.screen = 'video';
          next.video.active = true;
          next.video.phaseKey = makePhaseKey(action.tableName, firstPhase.phase);
        } else {
          next.screen = 'cards';
          const phaseData = firstPhase || { phase: 0, cards: [], cardIds: [] };
          next.cardOrder = phaseData.cardIds ? phaseData.cardIds.slice() : [];
          const sequence = phaseData.sequence || 'in order';
          if (sequence === 'random') {
            next.cardOrder = FP.navigation.shuffleOrder(next.cardOrder);
          }
          next.currentCardIndex = 0;
        }
        return updateProgressState(next);
      }

      case 'SHOW_VIDEO': {
        next.screen = 'video';
        next.video.active = true;
        next.video.phaseKey = action.phaseKey || next.video.phaseKey;
        next.video.playing = true;
        next.video.error = null;
        next.video.transitionFired = false;
        return next;
      }

      case 'SHOW_CARDS': {
        next.revealedAudioTexts = {};
        next.screen = 'cards';
        next.video.active = false;
        next.video.playing = false;
        next.video.error = null;
        next.video.transitionFired = false;
        const phase = next.tableData && next.tableData.phases[next.currentPhaseIndex];
        if (phase) {
          next.cardOrder = phase.cardIds ? phase.cardIds.slice() : [];
          if ((phase.sequence || 'in order') === 'random') {
            next.cardOrder = FP.navigation.shuffleOrder(next.cardOrder);
          }
          next.currentCardIndex = 0;
        }
        return updateProgressState(next);
      }

      case 'VIDEO_FINISHED': {
        next.revealedAudioTexts = {};
        next.screen = 'cards';
        next.video.active = false;
        next.video.playing = false;
        next.video.transitionFired = true;
        if (next.tableData && next.tableData.phases[next.currentPhaseIndex]) {
          const phase = next.tableData.phases[next.currentPhaseIndex];
          next.cardOrder = phase.cardIds ? phase.cardIds.slice() : [];
          if ((phase.sequence || 'in order') === 'random') {
            next.cardOrder = FP.navigation.shuffleOrder(next.cardOrder);
          }
          next.currentCardIndex = 0;
        }
        return updateProgressState(next);
      }

      case 'AUDIO_PLAYED': {
        const key = action.key;
        if (key) {
          next.audioPlayed[key] = true;
        }
        if (table && next.tableData) {
          const phase = next.tableData.phases[next.currentPhaseIndex];
          if (phase) {
            const currentSetId = next.cardOrder[next.currentCardIndex];
            const currentCard = (phase.cards || []).find((card) => String(card.setId) === String(currentSetId));
            if (currentCard) {
              const cardKey = makeCardKey(table, phase.phase, currentCard.setId);
              const hasAudio = (currentCard.primary && currentCard.primary.audio) || (currentCard.secondary || []).some((group) => group.audio);
              if (!hasAudio) {
                next.cardsCompleted[cardKey] = true;
              }
            }
          }
        }
        return updateProgressState(next);
      }

      case 'REVEAL_AUDIO_TEXT': {
        if (action.key) {
          next.revealedAudioTexts = Object.assign({}, next.revealedAudioTexts, {
            [action.key]: action.text || '',
          });
        }
        return next;
      }

      case 'CARD_AUTOCOMPLETE': {
        if (action.cardKey) {
          next.cardsCompleted[action.cardKey] = true;
        }
        return updateProgressState(next);
      }

      case 'ADVANCE_CARD': {
        next.revealedAudioTexts = {};
        if (!next.tableData) {
          return next;
        }
        const phase = next.tableData.phases[next.currentPhaseIndex];
        if (!phase) {
          return next;
        }
        next.currentCardIndex += 1;
        if (next.currentCardIndex >= next.cardOrder.length) {
          next.currentCycle += 1;
          next.currentCardIndex = 0;
          next.cardOrder = phase.cardIds ? phase.cardIds.slice() : [];
          if ((phase.sequence || 'in order') === 'random') {
            next.cardOrder = FP.navigation.shuffleOrder(next.cardOrder);
          }
        }
        return updateProgressState(next);
      }

      case 'ADVANCE_PHASE': {
        next.revealedAudioTexts = {};
        if (!next.tableData) {
          return next;
        }
        if (!isPhaseComplete(next, next.currentPhaseIndex) || !next.tableData.phases[next.currentPhaseIndex + 1]) {
          return next;
        }
        const currentPhase = next.tableData.phases[next.currentPhaseIndex];
        const phaseKey = currentPhase ? makePhaseKey(table, currentPhase.phase) : null;
        if (phaseKey) {
          next.phasesCompleted[phaseKey] = true;
          next.nextPhaseUnlocked[phaseKey] = true;
        }
        next.currentPhaseIndex += 1;
        next.currentCardIndex = 0;
        const nextPhase = next.tableData.phases[next.currentPhaseIndex];
        if (nextPhase) {
          next.cardOrder = nextPhase.cardIds ? nextPhase.cardIds.slice() : [];
          if ((nextPhase.sequence || 'in order') === 'random') {
            next.cardOrder = FP.navigation.shuffleOrder(next.cardOrder);
          }
          next.video = { active: false, phaseKey: null, playing: false, error: null, transitionFired: false };
          if (nextPhase.videoUrl) {
            next.screen = 'video';
            next.video.active = true;
            next.video.phaseKey = makePhaseKey(table, nextPhase.phase);
          } else {
            next.screen = 'cards';
          }
        }
        return updateProgressState(next);
      }

      case 'RESET_VIEW_TO_MENU': {
        next.revealedAudioTexts = {};
        next.screen = 'menu';
        next.activeTable = null;
        next.tableData = null;
        next.currentPhaseIndex = 0;
        next.currentCardIndex = 0;
        next.cardOrder = [];
        next.currentCycle = 0;
        next.video = { active: false, phaseKey: null, playing: false, error: null, transitionFired: false };
        return next;
      }

      default:
        return state;
    }
  }

  if (!window.FP) {
    window.FP = {};
  }

  window.FP.helpers = {
    makePhaseKey,
    makeCardKey,
    makeAudioKey,
    isPhaseComplete,
    canAccessPhase,
    makeInitialState,
  };

  window.FP.state = makeInitialState();
  window.FP.state.dispatch = function (action) {
    const result = reducer(this, action);
    Object.keys(this).forEach((key) => delete this[key]);
    Object.assign(this, result);
    return this;
  };
})();
