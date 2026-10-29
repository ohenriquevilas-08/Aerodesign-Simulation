(() => {
  const game = globalThis.AeroDesign ||= {};
  const { attributes, fundraisers, milestones, milestoneLevel, strategies, weeksPerSeason } = game.Content;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
  const credits = (amount) => `${Math.round(amount).toLocaleString("pt-BR")} cr`;

  function setNotice(notice) {
    const node = document.getElementById("actionNotice");
    if (!node) return;
    node.textContent = notice.text || "";
    node.dataset.kind = notice.kind || "";
  }

  function renderHeader(state) {
    const remaining = weeksPerSeason - state.week;
    document.getElementById("teamNameHeader").textContent = state.teamName;
    document.getElementById("weekLabel").textContent = `Semana ${state.week} / ${weeksPerSeason}`;
    document.getElementById("yearLabel").textContent = `Ano ${state.year}`;
    document.getElementById("designYear").textContent = `· Ano ${state.year}`;
    document.getElementById("aircraftName").textContent = state.aircraftName;
    document.getElementById("cashLabel").textContent = credits(state.cash);
    document.getElementById("prestigeLabel").textContent = state.prestige;
    document.getElementById("weekProgress").style.width = `${(state.week / weeksPerSeason) * 100}%`;
    document.querySelector('[role="progressbar"]').setAttribute("aria-valuenow", String(state.week));
    document.getElementById("turnIndicator").textContent = state.phase === "preparation"
      ? `${remaining} ${remaining === 1 ? "ação restante" : "ações restantes"}`
      : state.phase === "event-report" ? "Avaliação de relatório"
        : state.phase === "event-flight" ? `Bateria ${state.event.round + 1} de 3` : "Temporada concluída";
    document.getElementById("seasonCaption").textContent = state.phase === "preparation"
      ? "Preparação para a competição"
      : state.phase === "event-report" ? "Abertura do campeonato"
        : state.phase === "event-flight" ? "Competição em andamento" : "Resultado oficial";
    document.getElementById("mainTitle").textContent = state.phase === "preparation" ? "Centro de operações" : "Campeonato";
    document.getElementById("mainSubtitle").textContent = state.phase === "preparation"
      ? "Uma decisão por semana. Prepare o projeto para o dia da competição."
      : state.phase === "event-report" ? "Cinco equipes, um título. Os relatórios estão com a arbitragem."
        : state.phase === "event-flight" ? "Cada bateria muda as chances. Escolha sua carga e acompanhe o placar."
          : `Temporada ${state.year} encerrada. Confira a classificação e prepare o próximo ciclo.`;
    document.getElementById("weekFooter").hidden = state.phase !== "preparation";
  }

  function renderTabs(activeTab) {
    document.querySelectorAll(".tab").forEach((tab) => {
      const selected = tab.dataset.tab === activeTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll(".tab-pane").forEach((pane) => {
      pane.hidden = pane.id !== `pane-${activeTab}`;
    });
  }

  function renderEngineering(state) {
    document.getElementById("engineeringList").innerHTML = attributes.map((attribute) => {
      const level = state.attributes[attribute.key];
      const gain = game.Aircraft.upgradeGain(attribute, level);
      const cost = game.Aircraft.upgradeCost(attribute, level);
      const disabled = state.week >= weeksPerSeason || state.cash < cost || gain <= 0;
      return `
        <article class="engineering-item">
          <div class="engineering-copy">
            <div class="engineering-name"><span class="engineering-icon" aria-hidden="true">${attribute.icon}</span>${attribute.name}</div>
            <p>${attribute.description}</p>
            <div class="engineering-progress">
              <div class="aircraft-stat-top"><span>Nível atual</span><strong>${Math.round(level)} / 100</strong></div>
              <div class="mini-track"><div class="mini-fill" style="width:${level}%;background:var(--blue)"></div></div>
            </div>
          </div>
          <div class="engineering-actions">
            <div class="cost-line">+${gain.toFixed(1).replace(".", ",")} pts · <strong>${credits(cost)}</strong></div>
            <button class="button button-subtle" type="button" data-action="upgrade" data-attribute="${attribute.key}" ${disabled ? "disabled" : ""}>Investir · 1 sem.</button>
          </div>
        </article>`;
    }).join("");
  }

  function renderFundraising(state) {
    document.getElementById("fundraisingList").innerHTML = fundraisers.map((option) => `
      <article class="fundraising-item">
        <div class="fundraising-copy">
          <strong>${option.name}</strong>
          <p>${option.description}</p>
        </div>
        <div class="fundraising-actions">
          <div class="cost-line">${option.weeks} ${option.weeks === 1 ? "semana" : "semanas"} · <strong>+${credits(option.reward)}</strong></div>
          <button class="button button-subtle" type="button" data-action="fundraise" data-fundraiser="${option.id}" ${state.week + option.weeks > weeksPerSeason ? "disabled" : ""}>Iniciar captação</button>
        </div>
      </article>`).join("");
  }

  function renderScouting(state) {
    document.getElementById("scoutingList").innerHTML = state.rivals.map((rival, index) => {
      const estimate = state.scouted[index];
      const revealed = estimate
        ? `<div class="scouting-reveal">${attributes.map(({ key, name }) => `<span>${name}: ~${estimate[key]}</span>`).join("")}</div>`
        : "";
      return `
        <article class="scouting-item">
          <div class="scouting-copy">
            <strong>${escapeHtml(rival.name)}</strong>
            <p>${estimate ? "Estimativa aproximada registrada nesta temporada." : `Filosofia: ${escapeHtml(rival.philosophy)}. Atributos não revelados.`}</p>
            ${revealed}
          </div>
          <button class="button button-subtle" type="button" data-action="scout" data-rival="${index}" ${estimate || state.week >= weeksPerSeason ? "disabled" : ""}>${estimate ? "Analisada" : "Analisar · 1 sem."}</button>
        </article>`;
    }).join("");
  }

  function renderAircraft(state) {
    const fields = [
      { key: "aerodynamics", label: "Aerodinâmica" },
      { key: "structures", label: "Estruturas" },
      { key: "systems", label: "Sistemas" },
      { key: "report", label: "Relatório" }
    ];
    document.getElementById("aircraftStats").innerHTML = fields.map(({ key, label }) => `
      <div class="aircraft-stat">
        <div class="aircraft-stat-top"><span>${label}</span><strong>${Math.round(state.attributes[key])}</strong></div>
        <div class="mini-track"><div class="mini-fill" style="width:${state.attributes[key]}%"></div></div>
      </div>`).join("");
    const design = game.Aircraft.derive(state.attributes);
    document.getElementById("derivedStats").innerHTML = `
      <div class="derived-stat"><span>Peso vazio</span><strong>${design.emptyWeight.toFixed(1).replace(".", ",")} kg</strong></div>
      <div class="derived-stat"><span>Carga estimada</span><strong>${design.payload.toFixed(1).replace(".", ",")} kg</strong></div>
      <div class="derived-stat"><span>Confiabilidade</span><strong>${Math.round(design.reliability * 100)}%</strong></div>
      <div class="derived-stat"><span>Potencial de voo</span><strong>${Math.round(design.payloadPotential)} / 100</strong></div>`;
    document.getElementById("milestoneList").innerHTML = milestones.map((milestone) => `
      <div class="milestone ${design.milestones[milestone.key] ? "unlocked" : ""}">
        <strong>${milestone.label}</strong><span>${design.milestones[milestone.key] ? milestone.effect : `Nível ${milestoneLevel}`}</span>
      </div>`).join("");
  }

  function lastSeason(state) {
    return state.history[0] || null;
  }

  function renderRivals(state) {
    const recentChampion = lastSeason(state)?.winner;
    document.getElementById("rivalList").innerHTML = state.rivals.map((rival, index) => {
      const average = state.scouted[index]
        ? Math.round(Object.values(state.scouted[index]).reduce((sum, value) => sum + value, 0) / 4)
        : null;
      const isChampion = recentChampion === rival.name;
      return `
        <article class="rival-item">
          <div class="rival-heading"><strong>${escapeHtml(rival.name)}</strong><span class="rival-tag">${isChampion ? "CAMPEÃ DEFENSORA" : state.scouted[index] ? "ANALISADA" : "NÃO ANALISADA"}</span></div>
          <div class="rival-detail">${escapeHtml(rival.philosophy)}${average === null ? "" : ` · Média estimada ${average}`}</div>
        </article>`;
    }).join("");
  }

  function renderRivalry(state) {
    const previous = lastSeason(state);
    const container = document.getElementById("rivalryScore");
    if (!previous) {
      container.innerHTML = "<p>Esta é a primeira disputa pelo título. Um campeão será lembrado na próxima temporada.</p>";
      return;
    }

    const champion = previous.winner;
    const playerName = state.teamName;
    const previousPlayer = previous.standings?.find((team) => team.name === playerName);
    const previousChampion = champion === playerName ? null : previous.standings?.find((team) => team.name === champion);
    const rival = champion === playerName
      ? previous.standings?.find((team) => team.name !== playerName)
      : previousChampion;
    const olderMeetings = state.history.filter((entry) =>
      entry.standings?.some((team) => team.name === playerName) &&
      entry.standings?.some((team) => team.name === rival?.name)
    );
    const headToHeadWins = rival
      ? olderMeetings.filter((entry) => entry.standings.find((team) => team.name === playerName).position <
        entry.standings.find((team) => team.name === rival.name).position).length
      : 0;
    const encounterCount = olderMeetings.length;
    const championLabel = champion === playerName ? `${escapeHtml(playerName)} (defensora)` : escapeHtml(champion);
    const playerLabel = previousPlayer ? `${previousPlayer.position}º lugar · ${previousPlayer.score} pts` : "Resultado registrado";
    const rivalLabel = previousChampion ? `${previousChampion.position}º lugar · ${previousChampion.score} pts` : "Título da equipe";
    container.innerHTML = `
      <p>Campeã defensora: <strong>${championLabel}</strong></p>
      <p>${escapeHtml(playerName)} no último ano: <strong>${playerLabel}</strong></p>
      ${champion === playerName
        ? `<p>Defesas de título: <strong>${state.history.filter((entry) => entry.winner === playerName).length}</strong></p>`
        : `<p>Confronto histórico contra a campeã: <strong>${headToHeadWins} vitória(s) ${escapeHtml(playerName)} em ${encounterCount} temporada(s)</strong></p><p>Último resultado da rival: <strong>${rivalLabel}</strong></p>`}
      ${champion === playerName && rival ? `<p>Vice-campeã anterior: <strong>${escapeHtml(rival.name)}</strong> · ${headToHeadWins} vitória(s) ${escapeHtml(playerName)} em ${encounterCount} encontro(s)</p>` : ""}`;
  }

  function renderLog(state) {
    document.getElementById("logList").innerHTML = state.log.length
      ? state.log.map((entry) => `<div class="log-entry"><span class="log-week">${entry.week === 0 ? "INÍCIO" : `SEM. ${entry.week}`}</span><span>${escapeHtml(entry.text)}</span></div>`).join("")
      : '<div class="empty-log">Ainda não há acontecimentos registrados.</div>';
  }

  function orderedStandings(state) {
    if (!state.event) return [];
    return game.Competition.orderedStandings(state.event);
  }

  function renderLeaderboard(state, revealReports) {
    const teams = orderedStandings(state);
    return `
      <div class="leaderboard-region" role="region" aria-live="polite" aria-label="Classificação do campeonato" tabindex="0">
      <table class="score-table">
        <thead><tr><th>Posição</th><th>Equipe</th><th>Relatório</th><th>Bateria 1</th><th>Bateria 2</th><th>Bateria 3</th><th>Total</th></tr></thead>
        <tbody>${teams.map((team) => `
          <tr class="${revealReports && team.position === 1 ? "leader-row" : ""}">
            <td>${revealReports ? `${team.position}º` : "—"}</td>
            <td>${escapeHtml(team.name)}${team.isPlayer ? " · Você" : ""}</td>
            <td>${revealReports ? team.report : "—"}</td>
            ${[0, 1, 2].map((index) => {
              const flight = team.flights[index];
              return `<td>${flight
                ? `${flight.score}${flight.crashed ? " · Queda" : flight.partial ? " · Parcial" : ""}<span class="score-cell-strategy">${escapeHtml(flight.strategy)}</span>`
                : "—"}</td>`;
            }).join("")}
            <td>${revealReports ? team.total : "—"}</td>
          </tr>`).join("")}</tbody>
      </table>
      </div>`;
  }

  function renderStageTiles(state, stage, allowChoice) {
    const event = state.event;
    return `
      <div class="event-stages">
        <div class="event-stage ${stage === "report" ? "stage-current" : ""}">
          <span>01 · Relatório</span>
          <strong>${stage === "report" ? "Em avaliação" : `${event.standings.find((team) => team.isPlayer).report} pts`}</strong>
        </div>
        ${event.weather.map((weather, index) => {
          const completed = index < event.round;
          const current = allowChoice && index === event.round;
          const selected = state.eventStrategies[index];
          const flight = event.standings.find((team) => team.isPlayer).flights[index];
          return `
            <div class="event-stage flight-stage ${current ? "stage-current" : ""}">
              <span>0${index + 2} · Bateria ${index + 1}</span>
              <span class="flight-weather">${escapeHtml(weather.label)} · ${escapeHtml(weather.effect)}</span>
              ${completed
                ? `<strong>${flight.score} pts</strong><span class="strategy-detail">${escapeHtml(flight.strategy)}${flight.crashed ? " · Queda" : flight.partial ? " · Pouso parcial" : ""}</span>`
                : current
                  ? `<div class="strategy-options" role="group" aria-label="Estratégia da bateria ${index + 1}">
                    ${game.Competition.strategyOptions().map((option) => `
                      <button class="strategy-option" type="button" data-action="choose-strategy" data-round="${index}" data-strategy="${option.id}" aria-pressed="${selected === option.id}">
                        ${escapeHtml(option.label)}
                      </button>`).join("")}
                    </div>
                    <span class="strategy-detail">Bot escolhe conforme sua filosofia</span>`
                  : `<strong>${index > event.round ? "Na sequência" : "Aguardando"}</strong>`}
            </div>`;
        }).join("")}
      </div>`;
  }

  function renderCommentary(event) {
    return `<div class="competition-commentary" aria-live="polite">${event.commentary.slice(-3).reverse().map((entry) =>
      `<div>${escapeHtml(entry.text)}</div>`).join("")}</div>`;
  }

  function renderReportPhase(state) {
    return `
      <div class="event-content">
        <section class="event-hero">
          <div class="event-header">
            <div><h3>Campeonato · Ano ${state.year}</h3><p>${escapeHtml(state.teamName)} enfrenta quatro rivais em três baterias.</p></div>
            <span class="rival-tag">ABERTURA</span>
          </div>
        </section>
        ${renderStageTiles(state, "report", false)}
        ${renderCommentary(state.event)}
        <div class="competition-lead"><h4>Equipes na disputa</h4><span>As notas são reveladas ao encerrar a avaliação</span></div>
        ${renderLeaderboard(state, false)}
        <div class="event-actions"><button class="button button-primary" type="button" data-action="reveal-reports">Revelar notas do relatório <span aria-hidden="true">→</span></button></div>
      </div>`;
  }

  function renderFlightPhase(state) {
    const round = state.event.round;
    const weather = state.event.weather[round];
    return `
      <div class="event-content">
        <section class="event-hero">
          <div class="event-header">
            <div><h3>Bateria ${round + 1} · ${escapeHtml(weather.label)}</h3><p>${escapeHtml(weather.effect)}. Escolha sua estratégia; os BOTs decidem conforme a própria filosofia.</p></div>
            <span class="rival-tag">AO VIVO · ${round + 1}/3</span>
          </div>
        </section>
        ${renderStageTiles(state, "flight", true)}
        ${renderCommentary(state.event)}
        <div class="competition-lead"><h4>Classificação parcial</h4><span>Atualiza depois de cada bateria</span></div>
        ${renderLeaderboard(state, true)}
        <div class="event-actions"><button class="button button-primary" type="button" data-action="run-flight">Largar bateria ${round + 1} <span aria-hidden="true">→</span></button></div>
      </div>`;
  }

  function renderResults(state) {
    const standings = orderedStandings(state);
    const player = standings.find((team) => team.isPlayer);
    const champion = standings[0];
    return `
      <div class="event-content">
        <section class="event-hero">
          <div class="event-header">
            <div><h3>${escapeHtml(champion.name)} conquista o título</h3><p>${escapeHtml(state.teamName)} terminou em ${player.position}º lugar, com ${player.total} pontos.</p></div>
            <span class="rival-tag">RESULTADO FINAL</span>
          </div>
        </section>
        ${renderStageTiles(state, "results", false)}
        ${renderCommentary(state.event)}
        <div class="competition-lead"><h4>Classificação final</h4><span>Prestígio e premiação registrados no caixa</span></div>
        ${renderLeaderboard(state, true)}
        <div class="event-actions"><button class="button button-primary" type="button" data-action="next-season">Iniciar próxima temporada <span aria-hidden="true">→</span></button></div>
      </div>`;
  }

  function renderEvent(state) {
    const preparation = document.getElementById("preparationView");
    const host = document.getElementById("eventView");
    preparation.hidden = state.phase !== "preparation";
    host.hidden = state.phase === "preparation";
    if (state.phase === "preparation") return;
    host.innerHTML = state.phase === "event-report" ? renderReportPhase(state)
      : state.phase === "event-flight" ? renderFlightPhase(state) : renderResults(state);
  }

  game.UI = Object.freeze({
    render(state, activeTab, notice) {
      renderHeader(state);
      renderEngineering(state);
      renderFundraising(state);
      renderScouting(state);
      renderAircraft(state);
      renderRivals(state);
      renderRivalry(state);
      renderLog(state);
      renderEvent(state);
      renderTabs(activeTab);
      setNotice(notice);
    }
  });
})();
