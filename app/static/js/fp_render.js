(function () {
  function getCurrentPhase() {
    const state = window.FP.state;
    if (!state.activeTable || !state.tableData) {
      return null;
    }
    const phases = state.tableData.phases || [];
    return phases[state.currentPhaseIndex] || null;
  }

  function getCurrentCard() {
    const phase = getCurrentPhase();
    if (!phase) {
      return null;
    }
    const order = window.FP.state.cardOrder || [];
    const currentSetId = order[window.FP.state.currentCardIndex];
    return (phase.cards || []).find((card) => String(card.setId) === String(currentSetId)) || null;
  }

  function renderMenu() {
    const state = window.FP.state;
    const root = document.getElementById('fp-root');
    root.innerHTML = `
      <div class="fp-shell">
        <div class="fp-header">
          <div class="fp-brand">Feliponetica</div>
        </div>
        <div class="fp-menu-grid">
          ${(state.tables || []).map((table) => `
            <button class="fp-table-button" data-fp-action="select-table" data-fp-table="${table.name}">
              ${table.name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderErrorState() {
    const root = document.getElementById('fp-root');
    const state = window.FP.state;
    root.innerHTML = `
      <div class="fp-shell">
        <div class="fp-error-box">
          <div>
            <h2>Something went wrong</h2>
            <p>${(state.errors || []).join(' ') || 'Unable to load this lesson.'}</p>
            <button class="fp-button" data-fp-action="retry-loading">RETRY</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderSidebar() {
    const state = window.FP.state;
    if (!state.activeTable || !state.tableData) {
      return '';
    }

    const phases = state.tableData.phases || [];
    const phaseHtml = phases.map((phase, index) => {
      const key = `${state.activeTable}|${phase.phase}`;
      const isCurrent = index === state.currentPhaseIndex;
      const isComplete = !!state.phasesCompleted[key];
      const canAccess = window.FP.helpers.canAccessPhase(state, index);
      return `
        <button class="fp-phase-chip ${isCurrent ? 'is-current' : ''} ${isComplete ? 'is-complete' : ''} ${!canAccess ? 'is-locked' : ''}" data-fp-action="jump-phase" data-fp-phase-index="${index}" ${!canAccess ? 'disabled' : ''}>
          ${isComplete ? '✓ ' : ''}Phase ${phase.phase}
        </button>
      `;
    }).join('');

    return `
      <aside class="fp-sidebar">
        <div class="fp-brand" style="font-size:1.2rem; margin-bottom:8px;">${state.activeTable.replace(/[-_]+/g, ' ')}</div>
        <div class="fp-phase-list">${phaseHtml}</div>
      </aside>
    `;
  }

  function renderAudioButton(card, tableName, phase, sectionType, sectionIndex, groupIndex, item) {
    const key = `${tableName}|${phase.phase}|${card.setId}|${sectionIndex}|${groupIndex}`;
    const completed = !!window.FP.state.audioPlayed[key];
    const label = sectionType === 'primary' ? `Listen ${groupIndex + 1}` : `Extra ${groupIndex + 1}`;
    return `
      <button class="fp-audio-button ${completed ? 'is-complete' : ''}"
        data-fp-action="play-audio"
        data-fp-audio="${(item && item.audio) || ''}"
        data-fp-table="${tableName}"
        data-fp-phase="${phase.phase}"
        data-fp-set-id="${card.setId}"
        data-fp-section-index="${sectionIndex}"
        data-fp-group-index="${groupIndex}"
        ${!item || !item.audio ? 'disabled' : ''}>
        ▶ ${label}
      </button>
    `;
  }

  function renderCard() {
    const state = window.FP.state;
    const phase = getCurrentPhase();
    const card = getCurrentCard();
    if (!phase || !card) {
      return '<div class="fp-main-panel">No cards available.</div>';
    }

    const cardKey = `${state.activeTable}|${phase.phase}|${card.setId}`;
    const phaseComplete = !!state.phasesCompleted[`${state.activeTable}|${phase.phase}`];
    const allCardsDone = (phase.cards || []).every((item) => !!state.cardsCompleted[`${state.activeTable}|${phase.phase}|${item.setId}`]);

    const primaryHtml = card.primary ? `
      <div class="fp-card-group">
        <div class="fp-primary-block">
          ${card.primary.text ? `<h3 class="fp-card-title">${card.primary.text}</h3>` : ''}
          ${card.primary.image ? `<img class="fp-card-media" src="${card.primary.image}" alt="${card.primary.text || 'Image'}">` : ''}
          ${card.primary.audio ? `<div class="fp-audio-row">${renderAudioButton(card, state.activeTable, phase, 'primary', 0, 0, card.primary)}</div>` : ''}
        </div>
      </div>
    ` : '';

    const secondaryItems = (card.secondary || []).map((group, idx) => {
      const sectionIndex = idx + 1;
      return `
        <div class="fp-card-group secondary">
          <div class="fp-secondary-row">
            <div class="fp-secondary-body">
              ${group.text ? `<p class="fp-secondary-text">${group.text}</p>` : ''}
              ${group.audio ? `<div class="fp-audio-row">${renderAudioButton(card, state.activeTable, phase, 'secondary', sectionIndex, idx, group)}</div>` : ''}
            </div>
            ${group.image ? `<img class="fp-secondary-image" src="${group.image}" alt="${group.text || 'Extra image'}">` : ''}
          </div>
        </div>
      `;
    }).join('');

    const nextCardUnlocked = !!state.nextCardUnlocked[cardKey];
    const finalPhase = state.tableData && state.tableData.phases[state.tableData.phases.length - 1];
    const finalPhaseKey = finalPhase ? `${state.activeTable}|${finalPhase.phase}` : null;
    const onFinalPhase = finalPhase && finalPhase.phase === phase.phase;

    const navButtons = [];
    if (allCardsDone && state.currentPhaseIndex < state.tableData.phases.length - 1) {
      navButtons.push(`<button class="fp-nav-button" data-fp-action="next-phase">NEXT PHASE →</button>`);
    }
    if (onFinalPhase && phaseComplete) {
      navButtons.push(`<button class="fp-nav-button" data-fp-action="return-menu">RETURN TO MAIN MENU</button>`);
    }
    if (nextCardUnlocked || state.cardsCompleted[cardKey]) {
      navButtons.push(`<button class="fp-nav-button" data-fp-action="next-card">NEXT CARD →</button>`);
    }

    return `
      <div class="fp-main-panel">
        <div class="fp-card">
          ${primaryHtml}
          ${secondaryItems}
          <div class="fp-stepper">
            ${navButtons.join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderVideoScreen() {
    const state = window.FP.state;
    const phase = getCurrentPhase();
    const root = document.getElementById('fp-root');
    if (!phase) {
      return;
    }
    root.innerHTML = `
      <div class="fp-shell">
        <div class="fp-layout">
          ${renderSidebar()}
          <div class="fp-main-panel">
            <div class="fp-video-panel">
              <div id="fp-video-stage" class="fp-video-stage"></div>
              <div class="fp-video-meta">
                <button class="fp-continue-button" data-fp-action="continue-to-cards">CONTINUE TO CARDS →</button>
                <button class="fp-skip-button" data-fp-action="skip-video">SKIP VIDEO →</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    window.FP.video.render(phase, () => {
      window.FP.state.dispatch({ type: 'VIDEO_FINISHED' });
      window.FP.render.renderApp();
    }, () => {
      window.FP.state.dispatch({ type: 'SHOW_CARDS' });
      window.FP.render.renderApp();
    });
  }

  function renderCurrentScreen() {
    const state = window.FP.state;
    if (state.screen === 'menu') {
      renderMenu();
      return;
    }

    if (state.errors && state.errors.length && !state.activeTable) {
      renderErrorState();
      return;
    }

    if (state.screen === 'error') {
      renderErrorState();
      return;
    }

    const phase = getCurrentPhase();
    const root = document.getElementById('fp-root');
    if (!state.activeTable || !state.tableData || !phase) {
      root.innerHTML = '<div class="fp-shell"><div class="fp-error-box"><div>No lesson loaded.</div></div></div>';
      return;
    }

    root.innerHTML = `
      <div class="fp-shell">
        <div class="fp-layout">
          ${renderSidebar()}
          ${state.screen === 'video' ? `<div class="fp-main-panel"><div class="fp-video-panel"><div id="fp-video-stage"></div><div class="fp-video-meta"><button class="fp-continue-button" data-fp-action="continue-to-cards">CONTINUE TO CARDS →</button><button class="fp-skip-button" data-fp-action="skip-video">SKIP VIDEO →</button></div></div></div>` : renderCard()}
        </div>
      </div>
    `;
    if (state.screen === 'video') {
      const stage = document.getElementById('fp-video-stage');
      if (stage) {
        stage.innerHTML = '';
        window.FP.video.render(phase, () => {
          window.FP.state.dispatch({ type: 'VIDEO_FINISHED' });
          window.FP.render.renderApp();
        }, () => {
          window.FP.state.dispatch({ type: 'SHOW_CARDS' });
          window.FP.render.renderApp();
        });
      }
    }
  }

  window.FP = window.FP || {};
  window.FP.render = {
    renderApp: function () {
      const state = window.FP.state || { screen: 'menu', tables: [] };
      if (state.screen === 'menu' || !state.activeTable) {
        renderMenu();
        return;
      }
      if (state.errors && state.errors.length && !state.activeTable) {
        renderErrorState();
        return;
      }
      renderCurrentScreen();
    }
  };
})();
