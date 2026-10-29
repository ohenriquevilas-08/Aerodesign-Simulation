(() => {
  const game = globalThis.AeroDesign ||= {};
  const { attributes, fundraisers, prizes, prestigeAwards, placementReputation, scoutingCost, weeksPerSeason, skillNodes } = game.Content;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function failure(state, message, kind = "warning") {
    return { state, notice: { text: message, kind } };
  }

  function pushLog(state, week, text) {
    state.log.unshift({ week, text });
    state.log = state.log.slice(0, 8);
  }

  function advancePreparation(state, weeks, action, message, mutation) {
    if (state.phase !== "preparation") return failure(state, "A preparação desta temporada já terminou.");
    if (!Number.isInteger(weeks) || weeks < 1 || state.week + weeks > weeksPerSeason) {
      return failure(state, "Não há semanas suficientes para essa ação.");
    }

    const next = clone(state);
    mutation(next);
    for (let turn = 0; turn < weeks; turn += 1) {
      const progress = game.Rivals.advance(next.rivals, next.rngState, next.difficulty);
      next.rivals = progress.rivals;
      next.rngState = progress.seed;
      next.week += 1;
      next.rivalNews = { week: next.week, activities: progress.activities };
      const teamProgress = game.Team.advance(next.team, next.attributes, next.cash, next.year, next.week);
      next.team = teamProgress.team;
      next.attributes = teamProgress.attributes;
      next.cash = teamProgress.cash;
      const rivalSummary = progress.activities.map(({ name, text }) => `${name} ${text}`).join("; ");
      pushLog(next, next.week, `${action}: ${message} Equipe delegada: ${teamProgress.team.weekReport.contributions.length} contribuição(ões). Rivais: ${rivalSummary}.`);
    }
    if (next.week === weeksPerSeason) {
      const event = game.Competition.create(next);
      next.phase = "event-report";
      next.event = event.event;
      next.rngState = event.seed;
      next.eventStrategies = ["balanced", "balanced", "balanced"];
      pushLog(next, next.week, "Preparação encerrada. A equipe entrou no campeonato contra quatro rivais.");
    }
    return { state: next, notice: { text: message, kind: "success" } };
  }

  function finalizeCompetition(state) {
    const next = state;
    const standings = game.Competition.orderedStandings(next.event);
    next.phase = "results";
    next.event.standings = standings;
    const player = standings.find((team) => team.isPlayer);
    const reward = prizes[player.position - 1] || 0;
    const prestige = prestigeAwards[player.position - 1] || 0;
    const technicalMet = next.attributes[next.annualGoals.technical.attribute] >= next.annualGoals.technical.target;
    const placementMet = player.position <= next.annualGoals.placement.targetPosition;
    const reputationBefore = next.reputation;
    const baseReputation = placementReputation[player.position - 1] || 0;
    const goalReputation = (technicalMet ? next.annualGoals.technical.reputationReward : 0) +
      (placementMet ? next.annualGoals.placement.reputationReward : 0);
    next.reputation = Math.min(100, reputationBefore + baseReputation + goalReputation);
    const reputationGained = next.reputation - reputationBefore;
    next.annualGoals.result = { technicalMet, placementMet, reputationGained };
    next.cash += reward;
    next.prestige += prestige;
    next.eventResult = { standings, winner: standings[0].name };
    next.history.unshift({
      year: next.year,
      position: player.position,
      score: player.total,
      winner: standings[0].name,
      reputation: next.reputation,
      reputationGained,
      goals: { technicalMet, placementMet },
      standings: standings.map(({ name, position, total }) => ({ name, position, score: total }))
    });
    const goalSummary = `Metas: projeto ${technicalMet ? "atingida" : "não atingida"}, colocação ${placementMet ? "atingida" : "não atingida"}. Reputação +${reputationGained}.`;
    const outcome = player.position === 1
      ? `Campeões! ${next.teamName} levou o título, +${reward} créditos e ${prestige} de prestígio. ${goalSummary}`
      : `${next.teamName} terminou em ${player.position}º lugar. Prêmio: ${reward} créditos${prestige ? ` e ${prestige} de prestígio` : ""}. ${goalSummary}`;
    pushLog(next, weeksPerSeason, outcome);
    return outcome;
  }

  game.Game = Object.freeze({
    apply(state, action) {
      if (!action || typeof action.type !== "string") return failure(state, "Ação inválida.", "error");
      switch (action.type) {
        case "upgrade": {
          const attribute = attributes.find((entry) => entry.key === action.key);
          if (!attribute) return failure(state, "Área de engenharia desconhecida.", "error");
          const level = state.attributes[attribute.key];
          const cost = game.Aircraft.upgradeCost(attribute, level, state.skills);
          const gain = game.Aircraft.upgradeGain(attribute, level, state.skills);
          if (state.cash < cost) return failure(state, "Créditos insuficientes para essa melhoria.");
          if (gain <= 0) return failure(state, "Essa área já atingiu o nível máximo.");
          return advancePreparation(state, 1, "Engenharia", `${attribute.name} evoluiu ${gain.toFixed(1).replace(".", ",")} pontos por ${cost.toLocaleString("pt-BR")} créditos.`, (next) => {
            next.cash -= cost;
            next.attributes[attribute.key] = Math.min(100, level + gain);
          });
        }
        case "fundraise": {
          const option = fundraisers.find((entry) => entry.id === action.id);
          if (!option) return failure(state, "Ação de captação desconhecida.", "error");
          if (state.reputation < option.reputationRequired) {
            return failure(state, `Esta oportunidade exige ${option.reputationRequired} de reputação.`);
          }
          return advancePreparation(state, option.weeks, "Captação", `${option.name} rendeu ${option.reward.toLocaleString("pt-BR")} créditos.`, (next) => {
            next.cash += option.reward;
          });
        }
        case "scout": {
          const rival = state.rivals[action.index];
          if (!rival) return failure(state, "Equipe rival não encontrada.", "error");
          if (state.phase !== "preparation") return failure(state, "O scouting só está disponível durante a preparação.");
          if (state.scouted[action.index]) return failure(state, "Esta equipe já foi analisada nesta temporada.");
          if (state.cash < scoutingCost) return failure(state, "Créditos insuficientes para contratar esta análise.");
          const next = clone(state);
          const scope = game.Content.seasonScopes.find((entry) => entry.id === next.seasonScope);
          const analysis = game.Rivals.analyze(rival, action.index, next.year, scope);
          analysis.week = next.week;
          next.cash -= scoutingCost;
          next.scouted[action.index] = analysis;
          pushLog(next, next.week, `Scouting: relatório tático de ${rival.name} concluído; o calendário não avançou.`);
          return {
            state: next,
            notice: { text: `Análise de ${rival.name} concluída por ${scoutingCost} créditos, sem consumir a semana.`, kind: "success" }
          };
        }
        case "recruit-member": {
          if (state.phase !== "preparation") return failure(state, "O processo seletivo está fechado durante a competição.");
          const result = game.Team.recruit(
            state.team,
            action.candidateId,
            state.year,
            state.reputation,
            state.cash
          );
          if (!result.ok) return failure(state, result.message);
          const next = clone(state);
          next.team = result.team;
          next.cash = result.cash;
          pushLog(next, next.week, `${result.member.label} integrou a equipe como ${game.Content.teamCandidates.find((candidate) => candidate.specialty === result.member.specialty).label}.`);
          return {
            state: next,
            notice: { text: `${result.member.label} integrou a equipe. A contratação não consome semana.`, kind: "success" }
          };
        }
        case "assign-member": {
          if (state.phase !== "preparation") return failure(state, "A alocação só pode ser alterada durante a preparação.");
          const member = state.team.members.find((entry) => entry.id === action.memberId);
          const assignment = game.Content.teamAssignments.find((entry) => entry.id === action.assignment);
          if (!member || member.role === "president") return failure(state, "Integrante indisponível para esta alocação.", "error");
          if (!assignment) return failure(state, "Área de trabalho desconhecida.", "error");
          if (member.assignment === assignment.id) return failure(state, "Esta pessoa já está alocada a essa frente.");
          const next = clone(state);
          const updatedMember = next.team.members.find((entry) => entry.id === action.memberId);
          updatedMember.assignment = assignment.id;
          return {
            state: next,
            notice: { text: `${updatedMember.label} agora trabalha em ${assignment.label}.`, kind: "success" }
          };
        }
        case "nominate-captain": {
          if (state.phase !== "preparation" && state.phase !== "results") {
            return failure(state, "Indicações de capitania são definidas entre temporadas.");
          }
          if (state.year < 2) return failure(state, "A preparação de sucessores começa no Ano 2.");
          if (!game.Content.teamRoles.includes(action.area)) return failure(state, "Capitania desconhecida.", "error");
          const member = state.team.members.find((entry) => entry.id === action.memberId);
          if (!member || member.role !== "member" || member.specialty !== action.area) {
            return failure(state, "Indique um integrante da especialidade correspondente.", "error");
          }
          if (state.team.nominations[action.area] === member.id) {
            return failure(state, "Esta pessoa já está indicada para a capitania.");
          }
          if (Object.entries(state.team.nominations).some(([area, memberId]) =>
            area !== action.area && memberId === member.id
          )) return failure(state, "Uma pessoa só pode ser indicada para uma capitania.");
          const next = clone(state);
          next.team.nominations[action.area] = member.id;
          return {
            state: next,
            notice: {
              text: `${member.label} foi indicado para suceder a capitania de ${action.area === "aerodynamics" ? "Aerodinâmica" : "Estruturas"}.`,
              kind: "success"
            }
          };
        }
        case "research-skill": {
          const node = skillNodes.find((entry) => entry.id === action.id);
          if (!node) return failure(state, "Pesquisa desconhecida.", "error");
          if (state.skills.includes(node.id)) return failure(state, "Esta habilidade já foi pesquisada.");
          if ((node.requires || []).some((required) => !state.skills.includes(required)) ||
            (node.requiresAny && !node.requiresAny.some((required) => state.skills.includes(required)))) {
            return failure(state, "Pesquise os pré-requisitos antes de avançar nesta trilha.");
          }
          if (node.concept && state.skills.some((skill) =>
            skillNodes.find((entry) => entry.id === skill)?.concept
          )) {
            return failure(state, "A equipe já escolheu um conceito de avião. Essa decisão define a arquitetura do projeto.");
          }
          const cost = game.Aircraft.researchCost(node, state.skills);
          if (state.cash < cost) return failure(state, "Créditos insuficientes para esta pesquisa.");
          return advancePreparation(state, node.weeks, "Pesquisa", `${node.title} concluída.`, (next) => {
            next.cash -= cost;
            next.skills.push(node.id);
          });
        }
        case "advance-week":
          return advancePreparation(state, 1, "Semana encerrada", "O calendário avançou; as equipes rivais também trabalharam.", () => {});
        case "reveal-reports": {
          if (state.phase !== "event-report") return failure(state, "A arbitragem não está avaliando relatórios.");
          const next = clone(state);
          next.event = game.Competition.revealReports(next.event);
          next.phase = "event-flight";
          const player = next.event.standings.find((team) => team.isPlayer);
          pushLog(next, weeksPerSeason, `Relatório avaliado: ${next.teamName} marcou ${player.report} pontos.`);
          return { state: next, notice: { text: "Relatórios avaliados. A primeira bateria está pronta.", kind: "success" } };
        }
        case "choose-strategy": {
          if (state.phase !== "event-flight") return failure(state, "A estratégia só pode ser alterada antes de uma bateria.");
          if (action.round !== state.event.round || !game.Content.strategies[action.strategy]) {
            return failure(state, "Estratégia ou bateria inválida.", "error");
          }
          const next = clone(state);
          next.eventStrategies[action.round] = action.strategy;
          return { state: next, notice: { text: `${game.Content.strategies[action.strategy].label} definida para a bateria ${action.round + 1}.`, kind: "success" } };
        }
        case "run-flight": {
          if (state.phase !== "event-flight" || state.event.round >= 3) return failure(state, "Não há bateria de voo disponível.");
          const next = clone(state);
          const result = game.Competition.runFlight(next.event, next.eventStrategies[next.event.round], next.rngState);
          next.event = result.event;
          next.rngState = result.seed;
          const currentRound = next.event.round;
          const player = next.event.standings.find((team) => team.isPlayer);
          const outcome = player.flights[currentRound - 1];
          pushLog(next, weeksPerSeason, outcome.crashed
            ? `Bateria ${currentRound}: ${next.teamName} sofreu uma queda.`
            : `Bateria ${currentRound}: ${next.teamName} marcou ${outcome.score} pontos${outcome.partial ? " em pouso parcial" : ""}.`);
          if (currentRound === 3) {
            const rewardMessage = finalizeCompetition(next);
            return { state: next, notice: { text: rewardMessage, kind: "success" } };
          }
          return { state: next, notice: { text: `Bateria ${currentRound} concluída. A classificação provisória foi atualizada.`, kind: "success" } };
        }
        case "next-season": {
          if (state.phase !== "results") return failure(state, "A próxima temporada só começa após o resultado final.");
          const next = clone(state);
          next.year += 1;
          next.week = 0;
          const legacyBonus = Math.min(2, Math.floor(next.prestige / 25));
          next.attributes = Object.fromEntries(Object.entries(next.attributes).map(([key, value]) =>
            [key, Math.min(100, value + legacyBonus)]
          ));
          next.seasonScope = game.Content.seasonScopeForYear(next.year).id;
          next.rivals = next.rivals.map((rival) => ({
            ...rival,
            lastAction: { type: "opening", text: "iniciou o novo ciclo mantendo o projeto acumulado" }
          }));
          next.scouted = {};
          next.rivalNews = { week: 0, activities: [] };
          next.annualGoals = game.Content.seasonGoalsForYear(next.year, next.attributes);
          const teamTransition = game.Team.nextSeason(next.team, next.year, next.reputation);
          next.team = teamTransition.team;
          next.phase = "preparation";
          next.event = null;
          next.eventResult = null;
          next.eventStrategies = ["balanced", "balanced", "balanced"];
          const campaignMessage = next.year === game.Content.campaignSeasons + 1
            ? "A campanha de cinco anos foi concluída; a carreira continua em modo livre."
            : `Campanha: ano ${Math.min(next.year, game.Content.campaignSeasons)} de ${game.Content.campaignSeasons}.`;
          const teamMessage = [
            ...teamTransition.departures.map((member) => `${member.label} deixou a equipe conforme o ciclo planejado`),
            ...teamTransition.promotions
          ].join("; ");
          pushLog(next, 0, `Temporada ${next.year} iniciada. O avião e as rivais preservaram sua evolução${legacyBonus ? `; a experiência da equipe concedeu +${legacyBonus} níveis` : ""}. ${teamMessage || "A equipe manteve sua composição."} Novo regulamento: ${game.Content.seasonScopeForYear(next.year).title}. ${campaignMessage}`);
          return { state: next, notice: { text: `Temporada ${next.year} iniciada. ${teamMessage || "Equipe mantida."} ${campaignMessage}`, kind: "success" } };
        }
        default:
          return failure(state, `Ação não reconhecida: ${action.type}.`, "error");
      }
    }
  });
})();
