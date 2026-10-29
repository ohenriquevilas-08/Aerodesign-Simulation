(() => {
  const game = globalThis.AeroDesign ||= {};
  const { attributes, fundraisers, prizes, prestigeAwards, placementReputation, scoutingCost, weeksPerSeason, seasonPhases, reusablePartTypes, skillNodes } = game.Content;
  const emptyStats = Object.fromEntries(attributes.map(({ key }) => [key, 0]));
  const designAttributes = attributes.filter(({ key }) => key !== "report");
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
      const teamProgress = game.Team.advance(
        next.team,
        next.attributes,
        next.cash,
        next.year,
        next.week,
        game.Content.seasonPhaseForWeek(next.week).id
      );
      next.team = teamProgress.team;
      next.attributes = teamProgress.attributes;
      next.cash = teamProgress.cash;
      if (next.project.finalAircraft) {
        next.project.finalAircraft.attributes.report = next.attributes.report;
      }
      const rivalSummary = progress.activities.map(({ name, text }) => `${name} ${text}`).join("; ");
      pushLog(next, next.week, `${action}: ${message} Equipe delegada: ${teamProgress.team.weekReport.contributions.length} contribuição(ões). Rivais: ${rivalSummary}.`);
    }
    if (next.week === weeksPerSeason) {
      if (!next.project.finalAircraft) {
        return failure(state, "Monte a versão final do avião antes de encerrar a temporada.");
      }
      if (next.attributes.report <= 0) {
        return failure(state, "Finalize ao menos uma etapa do relatório antes de encerrar a temporada.");
      }
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
    const aircraftAttributes = next.project.finalAircraft.attributes;
    const technicalMet = aircraftAttributes[next.annualGoals.technical.attribute] >= next.annualGoals.technical.target;
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
    const playerFlights = player.flights;
    const damage = playerFlights.reduce((total, flight) =>
      total + (flight.crashed ? 25 : flight.partial ? 8 : 0), 0);
    for (const component of Object.values(next.project.finalAircraft.components)) {
      next.parts.push({
        ...component,
        condition: Math.max(20, component.condition - damage)
      });
    }
    next.parts = reusablePartTypes.flatMap((type) =>
      next.parts.filter((part) => part.type === type).slice(-5)
    );
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
          if (game.Content.seasonPhaseForWeek(state.week).id !== "project" || attribute.key === "report") {
            return failure(state, "O projeto de engenharia está encerrado. O relatório é produzido na etapa final.");
          }
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
            return failure(state, "A equipe já definiu o conceito deste projeto.");
          }
          if (node.concept && game.Content.seasonPhaseForWeek(state.week).id !== "project") {
            return failure(state, "O conceito do avião deve ser definido durante a etapa de projeto.");
          }
          const cost = game.Aircraft.researchCost(node, state.skills);
          if (state.cash < cost) return failure(state, "Créditos insuficientes para esta pesquisa.");
          return advancePreparation(state, node.weeks, "Pesquisa", `${node.title} concluída.`, (next) => {
            next.cash -= cost;
            next.skills.push(node.id);
          });
        }
        case "toggle-part-reuse": {
          if (state.phase !== "preparation" || game.Content.seasonPhaseForWeek(state.week).id !== "final") {
            return failure(state, "A escolha de reaproveitamento acontece na etapa da versão final.");
          }
          const part = state.parts.find((entry) => entry.id === action.partId);
          const scope = game.Content.seasonScopes.find((entry) => entry.id === state.seasonScope);
          if (!part || !scope.reusableParts.includes(part.type)) {
            return failure(state, "Essa peça não pode ser reaproveitada neste regulamento.");
          }
          if (state.project.finalAircraft) return failure(state, "A aeronave final já foi montada.");
          const next = clone(state);
          const selected = next.project.reusedPartIds.includes(part.id);
          next.project.reusedPartIds = selected
            ? next.project.reusedPartIds.filter((id) => id !== part.id)
            : [
              ...next.project.reusedPartIds.filter((id) =>
                next.parts.find((entry) => entry.id === id)?.type !== part.type
              ),
              part.id
            ];
          return {
            state: next,
            notice: {
              text: selected ? "Peça removida da lista de reaproveitamento." : "Peça reservada para o avião desta temporada.",
              kind: "success"
            }
          };
        }
        case "build-prototype": {
          if (state.phase !== "preparation" || game.Content.seasonPhaseForWeek(state.week).id !== "prototype") {
            return failure(state, "O protótipo só pode ser construído na segunda etapa da temporada.");
          }
          if (state.project.prototypeBuilt) return failure(state, "O protótipo desta temporada já foi construído.");
          const cost = 280;
          if (state.cash < cost) return failure(state, "Créditos insuficientes para construir o protótipo.");
          return advancePreparation(state, 1, "Protótipo", `Protótipo construído por ${cost.toLocaleString("pt-BR")} créditos.`, (next) => {
            next.cash -= cost;
            next.project.prototypeBuilt = true;
          });
        }
        case "test-prototype": {
          if (state.phase !== "preparation" || game.Content.seasonPhaseForWeek(state.week).id !== "prototype") {
            return failure(state, "Os ensaios de protótipo pertencem à segunda etapa.");
          }
          if (!state.project.prototypeBuilt) return failure(state, "Construa um protótipo antes de iniciar os ensaios.");
          if (state.project.prototypeTests >= 3) return failure(state, "O protótipo já realizou os três ensaios disponíveis.");
          if (!designAttributes.some(({ key }) => key === action.key)) return failure(state, "Tipo de ensaio desconhecido.", "error");
          const attribute = designAttributes.find(({ key }) => key === action.key);
          return advancePreparation(state, 1, "Ensaio de protótipo", `${attribute.name} validada; o projeto recebeu dados de ensaio.`, (next) => {
            next.project.prototypeTests += 1;
            next.attributes[action.key] = Math.min(100, next.attributes[action.key] + 3);
          });
        }
        case "build-final-aircraft": {
          if (state.phase !== "preparation" || game.Content.seasonPhaseForWeek(state.week).id !== "final") {
            return failure(state, "A versão final só pode ser montada na terceira etapa.");
          }
          if (!state.project.prototypeBuilt) return failure(state, "Construa e ensaie um protótipo antes da versão final.");
          if (state.project.finalAircraft) return failure(state, "A aeronave final já foi montada.");
          const cost = 500;
          if (state.cash < cost) return failure(state, "Créditos insuficientes para montar a versão final.");
          const scope = game.Content.seasonScopes.find((entry) => entry.id === state.seasonScope);
          const selectedParts = state.project.reusedPartIds.map((id) => state.parts.find((part) => part.id === id));
          if (selectedParts.some((part) => !part || !scope.reusableParts.includes(part.type)) ||
            new Set(selectedParts.map((part) => part.type)).size !== selectedParts.length) {
            return failure(state, "A lista de peças reaproveitadas não corresponde ao regulamento.");
          }
          return advancePreparation(state, 1, "Versão final", `Aeronave ${state.aircraftName} montada.`, (next) => {
            const reusedByType = new Map(selectedParts.map((part) => [part.type, part]));
            const components = Object.fromEntries(reusablePartTypes.map((type) => {
              const reused = reusedByType.get(type);
              const component = reused ? { ...reused } : {
                id: `ano-${next.year}-${type}`,
                type,
                quality: next.attributes[type],
                condition: 100,
                builtYear: next.year
              };
              return [type, component];
            }));
            const aircraftAttributes = { ...next.attributes };
            for (const part of selectedParts) {
              aircraftAttributes[part.type] = Math.round(part.quality * part.condition / 100);
            }
            next.cash -= cost;
            next.parts = next.parts.filter((part) => !next.project.reusedPartIds.includes(part.id));
            next.project.finalAircraft = {
              name: next.aircraftName,
              year: next.year,
              attributes: aircraftAttributes,
              components,
              reliabilityBonus: 0
            };
            next.project.reusedPartIds = [];
          });
        }
        case "test-final-aircraft": {
          if (state.phase !== "preparation" || game.Content.seasonPhaseForWeek(state.week).id !== "final") {
            return failure(state, "Os ensaios da versão final pertencem à terceira etapa.");
          }
          if (!state.project.finalAircraft) return failure(state, "Monte a versão final antes de ensaiá-la.");
          if (state.project.finalTests >= 2) return failure(state, "A versão final já realizou os dois ensaios disponíveis.");
          return advancePreparation(state, 1, "Ensaio final", "Ensaio concluído; a confiabilidade estimada da aeronave melhorou.", (next) => {
            next.project.finalTests += 1;
            next.project.finalAircraft.reliabilityBonus = Math.min(0.1, next.project.finalTests * 0.02);
          });
        }
        case "write-report": {
          if (state.phase !== "preparation" || game.Content.seasonPhaseForWeek(state.week).id !== "final") {
            return failure(state, "O relatório só pode ser produzido na etapa final.");
          }
          if (!state.project.finalAircraft) return failure(state, "Monte a versão final antes de redigir o relatório.");
          if (state.attributes.report >= 100) return failure(state, "O relatório desta temporada já está concluído.");
          return advancePreparation(state, 1, "Relatório", "O relatório técnico foi desenvolvido.", (next) => {
            next.attributes.report = Math.min(100, next.attributes.report + 35);
            next.project.finalAircraft.attributes.report = next.attributes.report;
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
          next.aircraftName = next.year === 2
            ? `${next.aircraftBaseName} 2`
            : `${next.aircraftBaseName} ${next.year}`;
          next.attributes = { ...emptyStats };
          next.skills = next.skills.filter((skill) =>
            !skillNodes.find((node) => node.id === skill)?.concept
          );
          next.project = {
            prototypeBuilt: false,
            prototypeTests: 0,
            finalTests: 0,
            finalAircraft: null,
            reusedPartIds: []
          };
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
          const nextScope = game.Content.seasonScopeForYear(next.year);
          pushLog(next, 0, `Temporada ${next.year} iniciada com um projeto novo. A equipe, as pesquisas e as peças armazenadas foram preservadas; o regulamento define o reaproveitamento. ${teamMessage || "A equipe manteve sua composição."} Novo regulamento: ${nextScope.title}. ${campaignMessage}`);
          return { state: next, notice: { text: `Projeto do Ano ${next.year} iniciado. ${teamMessage || "Equipe mantida."} ${campaignMessage}`, kind: "success" } };
        }
        default:
          return failure(state, `Ação não reconhecida: ${action.type}.`, "error");
      }
    }
  });
})();
