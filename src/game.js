(() => {
  const game = globalThis.AeroDesign ||= {};
  const { baseStats, attributes, fundraisers, prizes, prestigeAwards, weeksPerSeason } = game.Content;
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
      pushLog(next, next.week, `${action}: ${message}`);
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
    next.cash += reward;
    next.prestige += prestige;
    next.eventResult = { standings, winner: standings[0].name };
    next.history.unshift({
      year: next.year,
      position: player.position,
      score: player.total,
      winner: standings[0].name,
      standings: standings.map(({ name, position, total }) => ({ name, position, score: total }))
    });
    const outcome = player.position === 1
      ? `Campeões! ${next.teamName} levou o título, +${reward} créditos e ${prestige} de prestígio.`
      : `${next.teamName} terminou em ${player.position}º lugar. Prêmio: ${reward} créditos${prestige ? ` e ${prestige} de prestígio` : ""}.`;
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
          const cost = game.Aircraft.upgradeCost(attribute, level);
          const gain = game.Aircraft.upgradeGain(attribute, level);
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
          return advancePreparation(state, option.weeks, "Captação", `${option.name} rendeu ${option.reward.toLocaleString("pt-BR")} créditos.`, (next) => {
            next.cash += option.reward;
          });
        }
        case "scout": {
          const rival = state.rivals[action.index];
          if (!rival) return failure(state, "Equipe rival não encontrada.", "error");
          if (state.scouted[action.index]) return failure(state, "Esta equipe já foi analisada nesta temporada.");
          return advancePreparation(state, 1, "Scouting", `Estimativas de ${rival.name} foram adicionadas ao relatório.`, (next) => {
            const estimate = {};
            attributes.forEach(({ key }) => {
              const draw = game.Random.next(next.rngState);
              next.rngState = draw.seed;
              const noisyValue = rival.attributes[key] + (draw.value - 0.5) * 14;
              estimate[key] = Math.max(0, Math.min(100, Math.round(noisyValue / 10) * 10));
            });
            next.scouted[action.index] = estimate;
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
          next.rivals = game.Rivals.create(next.year);
          next.scouted = {};
          next.phase = "preparation";
          next.event = null;
          next.eventResult = null;
          next.eventStrategies = ["balanced", "balanced", "balanced"];
          pushLog(next, 0, `Temporada ${next.year} iniciada. O avião preservou seus níveis${legacyBonus ? ` e a experiência da equipe concedeu +${legacyBonus} níveis` : ""}. Novo regulamento: ${game.Content.seasonScopeForYear(next.year).title}.`);
          return { state: next, notice: { text: `Temporada ${next.year} iniciada.`, kind: "success" } };
        }
        default:
          return failure(state, `Ação não reconhecida: ${action.type}.`, "error");
      }
    }
  });
})();
