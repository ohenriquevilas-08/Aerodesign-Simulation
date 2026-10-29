(() => {
  const game = globalThis.AeroDesign ||= {};
  const { attributes, fundraisers, milestones, milestoneLevel, strategies, weeksPerSeason } = game.Content;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
  const credits = (amount) => `${Math.round(amount).toLocaleString("pt-BR")} cr`;
  const signedPercent = (value) => `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;

  function scopeImpact(scope) {
    const impacts = [];
    if (scope.flightMultiplier !== 1) impacts.push(`potencial de voo ${signedPercent(scope.flightMultiplier - 1)}`);
    if (scope.reportMultiplier !== 1) impacts.push(`relatório ${signedPercent(scope.reportMultiplier - 1)}`);
    if (scope.reliabilityModifier !== 0) impacts.push(`confiabilidade +${Math.round(scope.reliabilityModifier * 100)} p.p.`);
    return `Impacto: ${impacts.join(" · ") || "critérios equilibrados"}.`;
  }

  function setNotice(notice) {
    const node = document.getElementById("actionNotice");
    if (!node) return;
    node.textContent = notice.text || "";
    node.dataset.kind = notice.kind || "";
  }

  const careerScreens = Object.freeze([
    { id: "overview", title: "Visão geral", subtitle: "Acompanhe o momento da equipe e a temporada." },
    { id: "engineering", title: "Desenvolvimento do projeto", subtitle: "Transforme tempo e créditos em desempenho para o campeonato." },
    { id: "skills", title: "Árvore de habilidades", subtitle: "Defina o conceito do avião e desenvolva engenharia e gestão da equipe." },
    { id: "fundraising", title: "Finanças da equipe", subtitle: "Escolha como financiar o projeto sem perder semanas de preparação." },
    { id: "rivals", title: "Central de rivais", subtitle: "Analise as equipes e descubra como pretendem disputar o título." },
    { id: "team", title: "Gestão da equipe", subtitle: "Desenvolva integrantes, delegue trabalho e prepare a sucessão." },
    { id: "championship", title: "Campeonato", subtitle: "Acompanhe a abertura, as baterias e a classificação da temporada." }
  ]);
  function renderHeader(state, activeScreen) {
    const remaining = weeksPerSeason - state.week;
    document.getElementById("teamNameHeader").textContent = state.teamName;
    document.getElementById("weekLabel").textContent = `Semana ${state.week} / ${weeksPerSeason}`;
    document.getElementById("yearLabel").textContent = `Ano ${state.year}`;
    document.getElementById("designYear").textContent = `· Ano ${state.year}`;
    document.getElementById("aircraftName").textContent = state.aircraftName;
    document.getElementById("cashLabel").textContent = credits(state.cash);
    document.getElementById("careerCashLabel").textContent = credits(state.cash);
    document.getElementById("careerReputationLabel").textContent = `Reputação ${state.reputation}`;
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
    const scope = game.Content.seasonScopes.find((option) => option.id === state.seasonScope) ||
      game.Content.seasonScopeForYear(state.year);
    document.getElementById("scopeTitle").textContent = `Ano ${state.year} · ${scope.title}`;
    document.getElementById("scopeCriteria").textContent = scope.criteria;
    document.getElementById("scopeImpact").textContent = scopeImpact(scope);
    const active = careerScreens.find(({ id }) => id === activeScreen) || careerScreens[0];
    document.getElementById("mainTitle").textContent = active.title;
    document.getElementById("mainSubtitle").textContent = activeScreen === "championship" && state.phase !== "preparation"
      ? state.phase === "event-report" ? "Cinco equipes, um título. Os relatórios estão com a arbitragem."
        : state.phase === "event-flight" ? "Cada bateria muda as chances. Escolha sua carga e acompanhe o placar."
          : `Temporada ${state.year} encerrada. Confira a classificação e prepare o próximo ciclo.`
      : active.subtitle;
    document.getElementById("championshipCountdown").textContent =
      `Semana ${state.week} de ${weeksPerSeason} · ${remaining} ${remaining === 1 ? "ação restante" : "ações restantes"} até a competição`;
    document.getElementById("weekFooter").hidden = state.phase !== "preparation";
  }

  function renderCareerNavigation(activeScreen, state) {
    const eventAvailable = state.phase !== "preparation";
    const screens = eventAvailable ? careerScreens : careerScreens.filter(({ id }) => id !== "championship");
    const currentScreen = screens.some(({ id }) => id === activeScreen) ? activeScreen : "overview";
    const activeIndex = screens.findIndex(({ id }) => id === currentScreen);
    const panels = [...document.querySelectorAll(".career-screen")];
    const navButtons = [...document.querySelectorAll(".career-nav-button")];
    panels.forEach((panel) => {
      const available = eventAvailable || panel.dataset.screenPanel !== "championship";
      panel.hidden = !available;
      if (!available) {
        panel.setAttribute("aria-hidden", "true");
        panel.inert = true;
      }
    });
    navButtons.forEach((button) => {
      button.hidden = !eventAvailable && button.dataset.screen === "championship";
    });
    const visiblePanels = panels.filter((panel) => !panel.hidden);
    const visibleScreenWidth = 100 / visiblePanels.length;
    document.getElementById("careerTrack").style.width = `${visiblePanels.length * 100}%`;
    panels.forEach((panel) => { panel.style.flexBasis = `${visibleScreenWidth}%`; });
    navButtons.forEach((button) => {
      const selected = button.dataset.screen === screens[activeIndex].id;
      if (selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    visiblePanels.forEach((panel) => {
      const selected = panel.dataset.screenPanel === screens[activeIndex].id;
      panel.setAttribute("aria-hidden", String(!selected));
      panel.inert = !selected;
    });
    document.getElementById("careerTrack").style.transform = activeIndex === 0
      ? "translateX(0%)"
      : `translateX(-${activeIndex * visibleScreenWidth}%)`;
    document.getElementById("careerPosition").textContent =
      `${String(activeIndex + 1).padStart(2, "0")} / ${String(visiblePanels.length).padStart(2, "0")}`;
    document.querySelector('[data-action="previous-screen"]').disabled = activeIndex === 0;
    document.querySelector('[data-action="next-screen"]').disabled = activeIndex === screens.length - 1;
  }

  function renderSkillTree(state) {
    const selectedConcept = state.skills.find((id) =>
      game.Content.skillNodes.find((node) => node.id === id)?.concept
    );
    const groups = game.Content.skillBranches.map((branch) => {
      const nodes = game.Content.skillNodes.filter((node) => node.branch === branch.id);
      return `
        <section class="skill-branch">
          <div class="skill-branch-heading"><h4>${escapeHtml(branch.title)}</h4><p>${escapeHtml(branch.description)}</p></div>
          <div class="skill-node-list">${nodes.map((node) => {
            const unlocked = state.skills.includes(node.id);
            const prerequisites = [
              ...(node.requires || []),
              ...(node.requiresAny && !node.requiresAny.some((required) => state.skills.includes(required))
                ? [node.requiresAny.map((id) => game.Content.skillNodes.find((entry) => entry.id === id)?.title).join(" ou ")]
                : [])
            ];
            const missingPrerequisite = prerequisites.some((id) =>
              !state.skills.includes(id) && !id.includes(" ou ")
            );
            const conceptLocked = node.concept && selectedConcept && selectedConcept !== node.id;
            const cost = game.Aircraft.researchCost(node, state.skills);
            const weeksUnavailable = state.week + node.weeks > weeksPerSeason;
            const disabled = unlocked || missingPrerequisite || conceptLocked ||
              state.phase !== "preparation" || weeksUnavailable || state.cash < cost;
            const prerequisiteLabel = prerequisites.length
              ? `Pré-requisito: ${prerequisites.map((id) =>
                id.includes(" ou ")
                  ? id
                  : escapeHtml(game.Content.skillNodes.find((entry) => entry.id === id)?.title || id)
              ).join(" · ")}`
              : node.concept ? "Escolha exclusiva de conceito" : "Disponível desde o início";
            const effects = Object.entries(node.effects).map(([key, value]) => {
              const labels = {
                payloadMultiplier: `Carga ${signedPercent(value - 1)}`,
                reliabilityModifier: `Confiabilidade ${value > 0 ? "+" : ""}${Math.round(value * 100)} p.p.`,
                emptyWeightReduction: `Peso vazio −${value.toFixed(1).replace(".", ",")} kg`,
                upgradeGainMultiplier: `Melhorias +${Math.round((value - 1) * 100)}%`,
                upgradeCostMultiplier: `Custo das melhorias ${signedPercent(value - 1)}`,
                researchCostMultiplier: `Pesquisas ${signedPercent(value - 1)}`,
                reportBonus: `Relatório +${value} pontos`
              };
              return labels[key];
            }).join(" · ");
            const stateLabel = unlocked ? "PESQUISADA"
              : conceptLocked ? "CONCEITO DEFINIDO"
                : missingPrerequisite ? "BLOQUEADA"
                  : weeksUnavailable ? "SEM SEMANAS"
                    : state.cash < cost ? "SEM CRÉDITOS" : "DISPONÍVEL";
            return `
              <article class="skill-node ${unlocked ? "skill-unlocked" : ""} ${disabled ? "skill-disabled" : ""}">
                <div class="skill-node-heading"><strong>${escapeHtml(node.title)}</strong><span>${stateLabel}</span></div>
                <p>${escapeHtml(node.description)}</p>
                <div class="skill-node-effects">${escapeHtml(effects)}</div>
                <div class="skill-node-footer"><span>${prerequisiteLabel}</span><strong>${node.weeks} sem. · ${credits(cost)}</strong></div>
                <button class="button button-subtle" type="button" data-action="research-skill" data-skill="${node.id}" ${disabled ? "disabled" : ""}>${unlocked ? "Pesquisada" : "Pesquisar"}</button>
              </article>`;
          }).join("")}</div>
        </section>`;
    }).join("");
    const selected = selectedConcept
      ? game.Content.skillNodes.find((node) => node.id === selectedConcept)?.title
      : "Ainda não definido";
    document.getElementById("skillTreeSummary").textContent =
      `Conceito atual: ${selected}. Habilidades pesquisadas: ${state.skills.length}/${game.Content.skillNodes.length}.`;
    document.getElementById("skillTree").innerHTML = groups;
  }

  function renderEngineering(state) {
    document.getElementById("engineeringList").innerHTML = attributes.map((attribute) => {
      const level = state.attributes[attribute.key];
      const gain = game.Aircraft.upgradeGain(attribute, level, state.skills);
      const cost = game.Aircraft.upgradeCost(attribute, level, state.skills);
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
    document.getElementById("fundraisingList").innerHTML = fundraisers.map((option) => {
      const reputationLocked = state.reputation < option.reputationRequired;
      const weeksUnavailable = state.week + option.weeks > weeksPerSeason;
      return `
      <article class="fundraising-item ${reputationLocked ? "fundraising-locked" : ""}">
        <div class="fundraising-copy">
          <strong>${option.name}</strong>
          <p>${option.description}${reputationLocked ? ` Desbloqueia com ${option.reputationRequired} de reputação.` : ""}</p>
        </div>
        <div class="fundraising-actions">
          <div class="cost-line">${option.weeks} ${option.weeks === 1 ? "semana" : "semanas"} · <strong>+${credits(option.reward)}</strong></div>
          <button class="button button-subtle" type="button" data-action="fundraise" data-fundraiser="${option.id}" ${reputationLocked || weeksUnavailable ? "disabled" : ""}>${reputationLocked ? `Reputação ${option.reputationRequired}` : "Iniciar captação"}</button>
        </div>
      </article>`;
    }).join("");
  }

  function renderScouting(state) {
    const showDisclaimer = Object.keys(state.scouted).length > 0;
    const rivalCards = state.rivals.map((rival, index) => {
      const analysis = state.scouted[index];
      const revealed = analysis?.legacy
        ? `<div class="scouting-reveal">${attributes.map(({ key, name }) => `<span>${name}: ~${analysis.estimate[key]}</span>`).join("")}<span>Relatório antigo</span></div>`
        : analysis
          ? `<div class="scouting-intel">
              <div><strong>Força</strong> ${escapeHtml(analysis.strength)} · <strong>Fragilidade</strong> ${escapeHtml(analysis.vulnerability)}</div>
              <div><strong>Regulamento</strong> ${escapeHtml(analysis.scopeFit)}</div>
              <div><strong>Clima</strong> ${analysis.weatherStrategies.map(({ weather, strategy }) => {
                const shortWeather = { "Céu limpo": "Calmo", "Rajadas de vento": "Rajadas", Turbulência: "Turbulência" }[weather] || weather;
                return `${escapeHtml(shortWeather)}: ${escapeHtml(game.Content.strategies[strategy]?.label || strategy)}`;
              }).join(" · ")}</div>
            </div>`
          : "";
      const disabled = analysis || state.phase !== "preparation" || state.cash < game.Content.scoutingCost;
      return `
          <article class="scouting-item">
            <div class="scouting-copy">
              <strong>${escapeHtml(rival.name)}</strong>
              ${revealed}
            </div>
          <button class="button button-subtle" type="button" data-action="scout" data-rival="${index}" ${disabled ? "disabled" : ""}>${analysis ? "Analisada" : `Analisar · ${credits(game.Content.scoutingCost)}`}</button>
        </article>`;
    }).join("");
    const disclaimer = showDisclaimer
      ? '<p class="scouting-confidence">Tendências aproximadas; não são valores oficiais.</p>'
      : "";
    document.getElementById("scoutingList").innerHTML = `${disclaimer}${rivalCards}`;
  }

  function renderAircraft(state) {
    const fields = [
      { key: "aerodynamics", label: "Aerodinâmica" },
      { key: "structures", label: "Estruturas" },
      { key: "systems", label: "Sistemas" },
      { key: "report", label: "Relatório" }
    ];
    const center = { x: 130, y: 100 };
    const radius = 68;
    const axisColors = ["#70a9ff", "#52d3a2", "#f0bd68", "#c79cff"];
    const axes = [
      { x: center.x, y: center.y - radius },
      { x: center.x + radius, y: center.y },
      { x: center.x, y: center.y + radius },
      { x: center.x - radius, y: center.y }
    ];
    const pointAt = (scale) => axes
      .map(({ x, y }) => `${(center.x + (x - center.x) * scale).toFixed(1)},${(center.y + (y - center.y) * scale).toFixed(1)}`)
      .join(" ");
    const values = fields.map(({ key, label }, index) => ({
      label,
      value: Math.max(0, Math.min(100, Math.round(state.attributes[key]))),
      color: axisColors[index]
    }));
    const dataPoints = values.map(({ value }, index) => {
      const axis = axes[index];
      return `${(center.x + (axis.x - center.x) * value / 100).toFixed(1)},${(center.y + (axis.y - center.y) * value / 100).toFixed(1)}`;
    }).join(" ");
    document.getElementById("aircraftStats").innerHTML = `
      <div class="aircraft-radar-wrap">
        <svg class="aircraft-radar" viewBox="0 0 260 200" role="img" aria-label="Gráfico de radar dos atributos do avião, em escala de zero a cem">
          <title>Atributos do avião</title>
          <g class="aircraft-radar-grid">
            ${[0.25, 0.5, 0.75, 1].map((scale) => `<polygon points="${pointAt(scale)}"></polygon>`).join("")}
            ${axes.map(({ x, y }) => `<line x1="${center.x}" y1="${center.y}" x2="${x}" y2="${y}"></line>`).join("")}
          </g>
          <polygon class="aircraft-radar-area" points="${dataPoints}"></polygon>
          ${dataPoints.split(" ").map((point, index) => {
            const [x, y] = point.split(",");
            return `<circle class="aircraft-radar-point" cx="${x}" cy="${y}" r="3" fill="${values[index].color}"></circle>`;
          }).join("")}
        </svg>
        <div class="aircraft-radar-legend" aria-label="Valores dos atributos">
          ${values.map(({ label, value, color }) => `<div><span class="aircraft-radar-key" style="--radar-axis-color:${color}" aria-hidden="true"></span><span>${label}</span><strong>${value}</strong></div>`).join("")}
        </div>
      </div>`;
    const design = game.Aircraft.derive(state.attributes, state.skills);
    const concept = state.skills
      .map((id) => game.Content.skillNodes.find((node) => node.id === id))
      .find((node) => node?.concept);
    document.getElementById("aircraftConcept").textContent = concept
      ? `Conceito: ${concept.title.replace("Conceito · ", "")}`
      : "Conceito: ainda não escolhido";
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
      const activity = state.rivalNews.activities.find((entry) => entry.name === rival.name);
      const isChampion = recentChampion === rival.name;
      return `
        <article class="rival-item">
          <div class="rival-heading"><strong>${escapeHtml(rival.name)}</strong><span class="rival-tag">${isChampion ? "CAMPEÃ DEFENSORA" : "BOT ATIVO"}</span></div>
          <div class="rival-detail">${escapeHtml(rival.philosophy)} · ${escapeHtml(activity?.text || rival.lastAction.text)}${state.rivalNews.week ? ` · Sem. ${state.rivalNews.week}` : ""}</div>
        </article>`;
    }).join("");
  }

  function renderAnnualGoals(state) {
    const goals = state.annualGoals;
    const technical = goals.technical;
    const attribute = attributes.find(({ key }) => key === technical.attribute);
    const current = Math.round(state.attributes[technical.attribute]);
    const technicalStatus = goals.result
      ? goals.result.technicalMet ? "Atingida" : "Não atingida"
      : state.phase === "results" ? "Não registrada no save anterior"
        : technical.target === technical.baseline ? "Nível máximo mantido"
          : `${Math.min(current, technical.target)} / ${technical.target}`;
    const placementStatus = goals.result
      ? goals.result.placementMet ? "Atingida" : "Não atingida"
      : `Meta: ${goals.placement.targetPosition}º lugar ou melhor`;
    const campaignStatus = state.year <= game.Content.campaignSeasons
      ? `Campanha principal · Ano ${state.year} de ${game.Content.campaignSeasons}`
      : `Campanha concluída · Ano ${state.year} em modo livre`;
    document.getElementById("campaignGoals").innerHTML = `
      <div class="campaign-label">${campaignStatus} · Reputação ${state.reputation}/100</div>
      <div class="campaign-goal"><strong>Projeto</strong><span>${escapeHtml(attribute.name)} · ${escapeHtml(technicalStatus)}${technical.target === technical.baseline ? "" : ` (meta ${technical.target})`}</span></div>
      <div class="campaign-goal"><strong>Competição</strong><span>${escapeHtml(placementStatus)}</span></div>`;
  }

  function renderTeam(state) {
    const team = state.team;
    const capacity = game.Content.teamCapacityForReputation(state.reputation);
    const specialtyLabels = Object.fromEntries(game.Content.teamCandidates.map(({ specialty, label }) => [specialty, label]));
    const assignmentOptions = game.Content.teamAssignments;
    const captainNames = Object.fromEntries(team.members
      .filter((member) => member.captainArea)
      .map((member) => [member.captainArea, member.label]));
    const departures = team.members
      .filter((member) => member.role !== "president" && member.leaveYear !== null)
      .sort((first, second) => first.leaveYear - second.leaveYear);
    document.getElementById("teamSummary").innerHTML = `
      <strong>${team.members.length}/${capacity} integrantes</strong>
      <span>Delegações rendem melhorias e créditos a cada semana sem gastar sua ação.</span>
      ${departures.length
        ? `<span>Próxima saída prevista: ${escapeHtml(departures[0].label)} · início do Ano ${departures[0].leaveYear}</span>`
        : ""}`;
    document.getElementById("teamRoster").innerHTML = team.members.map((member) => {
      const roleLabel = member.role === "president" ? "PRESIDENTE"
        : member.role === "founder-captain" ? "CAPITÃO FUNDADOR"
          : member.role === "captain" ? "CAPITÃO · 1 TEMPORADA" : "INTEGRANTE";
      const specialty = member.specialty === "management" ? "Gestão" : specialtyLabels[member.specialty];
      const assignment = assignmentOptions.find(({ id }) => id === member.assignment);
      const departure = member.leaveYear === null ? "Permanente"
        : `Saída prevista no Ano ${member.leaveYear}`;
      const assignControl = member.role === "president"
        ? `<div class="team-assignment-label">${escapeHtml(assignment.label)}</div>`
        : `<label class="team-assignment">
            <span>Alocação</span>
            <select data-member-assignment="${escapeHtml(member.id)}" aria-label="Alocação de ${escapeHtml(member.label)}">
              ${assignmentOptions.map((option) => `<option value="${option.id}" ${option.id === member.assignment ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
            </select>
          </label>`;
      return `
        <article class="team-member">
          <div class="team-member-heading">
            <strong>${escapeHtml(member.label)}</strong>
            <span class="team-role-tag">${roleLabel}</span>
          </div>
          <div class="team-member-meta">${escapeHtml(specialty)} · Exp. ${member.experience.toFixed(1)} · Motivação ${Math.round(member.motivation)}%</div>
          <div class="team-motivation-track"><span style="width:${member.motivation}%"></span></div>
          ${assignControl}
          <div class="team-tenure">${departure}${member.captainArea ? ` · ${escapeHtml(specialtyLabels[member.captainArea])}` : ""}</div>
        </article>`;
    }).join("");

    const canNominate = state.year >= 2 && (state.phase === "preparation" || state.phase === "results");
    const nominations = game.Content.teamRoles.map((area) => {
      const candidates = team.members.filter((member) =>
        member.role === "member" && member.specialty === area &&
        !(member.leaveYear !== null && member.leaveYear <= state.year + 1) &&
        !team.captainHistory.some((entry) => entry.memberId === member.id && entry.year === state.year)
      );
      const nominatedId = team.nominations[area];
      const activeCaptain = captainNames[area];
      const areaLabel = specialtyLabels[area];
      return `
        <div class="succession-row">
          <div><strong>${areaLabel}</strong><span>${activeCaptain ? `Atual: ${escapeHtml(activeCaptain)}` : "Capitania sem titular"}</span></div>
          <select id="captainNominee-${area}" aria-label="Sucessor para ${areaLabel}" ${!canNominate || !candidates.length ? "disabled" : ""}>
            <option value="">Escolher sucessor</option>
            ${candidates.map((member) => `<option value="${escapeHtml(member.id)}" ${member.id === nominatedId ? "selected" : ""}>${escapeHtml(member.label)} · exp. ${member.experience.toFixed(1)}</option>`).join("")}
          </select>
          <button class="button button-subtle" type="button" data-action="nominate-captain" data-area="${area}" ${!canNominate || !candidates.length ? "disabled" : ""}>Indicar</button>
        </div>`;
    }).join("");
    document.getElementById("teamSuccession").innerHTML = state.year < 2
      ? `<p class="team-guidance">No Ano 2, indique integrantes de Aerodinâmica e Estruturas para suceder os fundadores. Capitanias posteriores duram uma temporada.</p>`
      : `<p class="team-guidance">${state.year === 2
        ? "Prepare dois sucessores antes da saída dos fundadores no Ano 3."
        : "Capitães servem por uma temporada. Prepare nomes diferentes para o próximo ciclo."}</p>${nominations}`;

    document.getElementById("teamCandidates").innerHTML = game.Team.candidateOffers(state.year).map((candidate) => {
      const offered = team.candidates.some((entry) => entry.id === candidate.id);
      const hired = team.members.some((member) => member.id === `member-${candidate.id}`);
      const lockedByReputation = state.reputation < candidate.reputationRequired;
      const full = team.members.length >= capacity;
      const unaffordable = state.cash < candidate.cost;
      const disabled = state.phase !== "preparation" || !offered || hired ||
        lockedByReputation || full || unaffordable;
      const status = hired ? "INTEGRANTE"
        : lockedByReputation ? `REPUTAÇÃO ${candidate.reputationRequired}`
          : !offered ? "INDISPONÍVEL"
            : full ? "EQUIPE COMPLETA"
              : unaffordable ? "SEM CRÉDITOS" : `EXP. ${candidate.experience.toFixed(1)}`;
      return `
        <article class="team-candidate ${disabled ? "candidate-disabled" : ""}">
          <div><strong>${escapeHtml(candidate.label)}</strong><span>${status}</span></div>
          <p>Motivação inicial 76% · entrada prevista até o fim do terceiro ano na equipe.</p>
          <button class="button button-subtle" type="button" data-action="recruit-member" data-candidate="${candidate.id}" ${disabled ? "disabled" : ""}>${hired ? "Integrada" : `Integrar · ${credits(candidate.cost)}`}</button>
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
            <td>${escapeHtml(team.name)}${team.isPlayer ? " · Você" : ""}
              <span class="score-cell-compact">${revealReports
                ? `R ${team.report} · ${team.flights.map((flight, index) =>
                  `B${index + 1} ${flight ? `${flight.score}${flight.crashed ? "Q" : flight.partial ? "P" : ""}` : "—"}`
                ).join(" · ")}`
                : "Notas ainda não reveladas"}</span>
            </td>
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

  function renderScopeBanner(scope) {
    return `<div class="event-scope"><strong>Regulamento · ${escapeHtml(scope.title)}:</strong> ${escapeHtml(scope.criteria)} ${escapeHtml(scopeImpact(scope))}</div>`;
  }

  function renderFlightCircuit(aircraftName, round) {
    const path = "M 90 170 C 90 95 190 55 400 55 C 610 55 710 95 710 170 C 710 245 610 275 400 275 C 190 275 90 245 90 170 Z";
    return `
      <div class="flight-circuit">
        <div class="circuit-caption"><strong>Pista 2D · ${escapeHtml(aircraftName)}</strong><span>Bateria ${round + 1} · percurso da equipe</span></div>
        <svg viewBox="0 0 800 330" role="img" aria-label="${escapeHtml(aircraftName)} completando o circuito; equipes rivais são simuladas automaticamente">
          <defs>
            <path id="circuitPath" d="${path}"></path>
          </defs>
          <path class="circuit-track" d="${path}"></path>
          <path class="circuit-centerline" d="${path}"></path>
          <circle class="circuit-pylon" cx="90" cy="170" r="8"></circle>
          <circle class="circuit-pylon" cx="710" cy="170" r="8"></circle>
          <g class="circuit-plane" id="flightPlane" transform="translate(90 170)" aria-hidden="true">
            <path d="M 28 0 L 10 -4 L 13 -1 L -12 -1 L -23 -7 L -27 -5 L -20 0 L -27 5 L -23 7 L -12 1 L 13 1 L 10 4 Z"></path>
          </g>
        </svg>
      </div>`;
  }

  function renderReportPhase(state) {
    return `
      <div class="event-content event-summary-content">
        <section class="event-hero">
          <div class="event-header">
            <div><h3>Campeonato · Ano ${state.year}</h3><p>${escapeHtml(state.teamName)} enfrenta quatro rivais em três baterias.</p></div>
            <span class="rival-tag">ABERTURA</span>
          </div>
        </section>
        ${renderScopeBanner(state.event.scope)}
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
      <div class="event-content event-flight-content">
        <section class="event-hero">
          <div class="event-header">
            <div><h3>Bateria ${round + 1} · ${escapeHtml(weather.label)}</h3><p>${escapeHtml(weather.effect)}. Escolha sua estratégia; os BOTs decidem conforme a própria filosofia.</p></div>
            <span class="rival-tag">AO VIVO · ${round + 1}/3</span>
          </div>
        </section>
        ${renderScopeBanner(state.event.scope)}
        ${renderStageTiles(state, "flight", true)}
        <div class="flight-display">
          <div class="flight-primary">
            <div class="flight-primary-display">
              ${renderFlightCircuit(state.aircraftName, round)}
              <div class="event-actions flight-launch-actions"><button class="button button-primary" type="button" data-action="run-flight">Largar bateria ${round + 1} <span aria-hidden="true">→</span></button></div>
              ${renderCommentary(state.event)}
            </div>
            <aside class="flight-standings">
              <div class="competition-lead"><h4>Classificação parcial</h4><span>Atualiza depois de cada bateria</span></div>
              ${renderLeaderboard(state, true)}
            </aside>
          </div>
        </div>
      </div>`;
  }

  function renderResults(state) {
    const standings = orderedStandings(state);
    const player = standings.find((team) => team.isPlayer);
    const champion = standings[0];
    return `
      <div class="event-content event-summary-content">
        <section class="event-hero">
          <div class="event-header">
            <div><h3>${escapeHtml(champion.name)} conquista o título</h3><p>${escapeHtml(state.teamName)} terminou em ${player.position}º lugar, com ${player.total} pontos.</p></div>
            <span class="rival-tag">RESULTADO FINAL</span>
          </div>
        </section>
        ${renderScopeBanner(state.event.scope)}
        ${renderStageTiles(state, "results", false)}
        ${renderCommentary(state.event)}
        <div class="competition-lead"><h4>Classificação final</h4><span>Prestígio e premiação registrados no caixa</span></div>
        ${renderLeaderboard(state, true)}
        <div class="event-actions"><button class="button button-primary" type="button" data-action="next-season">Iniciar próxima temporada <span aria-hidden="true">→</span></button></div>
      </div>`;
  }

  function renderEvent(state) {
    const host = document.getElementById("eventView");
    const preview = document.getElementById("championshipPreparation");
    const inPreparation = state.phase === "preparation";
    preview.hidden = !inPreparation;
    host.hidden = inPreparation;
    if (inPreparation) return;
    host.innerHTML = state.phase === "event-report" ? renderReportPhase(state)
      : state.phase === "event-flight" ? renderFlightPhase(state) : renderResults(state);
  }

  game.UI = Object.freeze({
    render(state, activeScreen, notice) {
      renderHeader(state, activeScreen);
      renderEngineering(state);
      renderSkillTree(state);
      renderFundraising(state);
      renderScouting(state);
      renderAircraft(state);
      renderRivals(state);
      renderRivalry(state);
      renderAnnualGoals(state);
      renderTeam(state);
      renderLog(state);
      renderEvent(state);
      renderCareerNavigation(activeScreen, state);
      setNotice(notice);
    }
  });
})();
