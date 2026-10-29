(() => {
  const game = globalThis.AeroDesign ||= {};
  const { strategies, weather } = game.Content;
  const { Random, Aircraft, Rivals } = game;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function standingsByScore(standings) {
    return [...standings].sort((left, right) =>
      right.total - left.total || Number(right.isPlayer) - Number(left.isPlayer) || left.name.localeCompare(right.name)
    );
  }

  function addCommentary(event, text, kind = "info") {
    event.commentary.push({ text, kind });
    event.commentary = event.commentary.slice(-8);
  }

  game.Competition = Object.freeze({
    create(state) {
      const scope = game.Content.seasonScopes.find((option) => option.id === state.seasonScope) ||
        game.Content.seasonScopeForYear(state.year);
      let seed = state.rngState;
      const forecast = [];
      for (let index = 0; index < 3; index += 1) {
        const result = Random.integer(seed, weather.length);
        seed = result.seed;
        forecast.push({ ...weather[result.value] });
      }

      const teams = [
        { name: state.teamName, isPlayer: true, attributes: { ...state.attributes } },
        ...state.rivals.map((rival) => ({
          name: rival.name,
          isPlayer: false,
          philosophy: rival.philosophy,
          weights: { ...rival.weights },
          attributes: { ...rival.attributes }
        }))
      ];
      const standings = teams.map((team) => ({
        ...team,
        report: Aircraft.reportScore(team.attributes.report, scope.reportMultiplier),
        flights: [],
        total: 0
      }));

      return {
        seed,
        event: {
          round: 0,
          scope: { ...scope },
          weather: forecast,
          standings,
          commentary: [{ text: "Os projetos foram lacrados. A arbitragem prepara a avaliação dos relatórios.", kind: "info" }]
        }
      };
    },
    revealReports(event) {
      event.standings.forEach((team) => { team.total = team.report; });
      const leader = standingsByScore(event.standings)[0];
      addCommentary(event, `Relatórios avaliados: ${leader.name} assume a liderança provisória com ${leader.report} pontos.`, "report");
      return event;
    },
    runFlight(event, playerStrategyId, seed) {
      const round = event.round;
      const roundWeather = event.weather[round];
      const scope = event.scope || game.Content.seasonScopeForYear(1);
      const previousLeader = standingsByScore(event.standings)[0];
      const nextStandings = event.standings.map((team) => {
        const strategyId = team.isPlayer
          ? playerStrategyId
          : Rivals.flightStrategy(team, roundWeather);
        const strategy = strategies[strategyId];
        const design = Aircraft.derive(team.attributes);
        const effectiveReliability = clamp(
          design.reliability + roundWeather.reliabilityModifier + strategy.reliabilityModifier + scope.reliabilityModifier,
          0.35,
          0.98
        );
        const crashChance = clamp(0.04 + (1 - effectiveReliability) * 0.45, 0.04, 0.36);
        const potential = design.payloadPotential * strategy.loadMultiplier * roundWeather.payloadMultiplier * scope.flightMultiplier;
        let rng = Random.next(seed);
        seed = rng.seed;
        const failureRoll = rng.value;
        rng = Random.next(seed);
        seed = rng.seed;
        const variance = (rng.value - 0.5) * 12;

        let crashed = false;
        let partial = false;
        let score;
        if (failureRoll < crashChance * 0.7) {
          score = 0;
          crashed = true;
        } else if (failureRoll < crashChance) {
          score = Math.round(clamp(potential * 0.5 + variance, 0, 100));
          partial = true;
        } else {
          score = Math.round(clamp(potential + variance, 0, 100));
        }

        const flight = {
          score,
          crashed,
          partial,
          weather: roundWeather.label,
          strategy: strategy.label,
          strategyId
        };
        return {
          ...team,
          flights: [...team.flights, flight],
          total: team.total + score
        };
      });

      const nextRound = round + 1;
      const leader = standingsByScore(nextStandings)[0];
      const playerFlight = nextStandings.find((team) => team.isPlayer).flights[round];
      const eventCopy = {
        ...event,
        round: nextRound,
        standings: nextStandings,
        commentary: [...event.commentary]
      };
      const outcome = playerFlight.crashed
        ? "queda na bateria"
        : playerFlight.partial ? "pouso parcial após danos" : `voo validado com ${playerFlight.score} pontos`;
      addCommentary(eventCopy, `Bateria ${nextRound}: ${playerFlight.strategy} no ${roundWeather.label.toLowerCase()}; ${outcome}. ${leader.name} lidera com ${leader.total} pontos.`, playerFlight.crashed ? "danger" : "flight");

      if (leader.name !== previousLeader.name) {
        addCommentary(eventCopy, `${leader.name} assume a ponta e ultrapassa ${previousLeader.name}.`, "lead");
      }
      const rivalOutcome = nextStandings
        .filter((team) => !team.isPlayer)
        .find((team) => team.flights[round].crashed);
      if (rivalOutcome) {
        addCommentary(eventCopy, `${rivalOutcome.name} sofreu uma queda. A classificação pode mudar nesta bateria.`, "danger");
      } else if (leader.name === previousLeader.name) {
        addCommentary(eventCopy, `${leader.name} sustenta a liderança após a bateria ${nextRound}.`, "lead");
      }

      return { event: eventCopy, seed };
    },
    orderedStandings(event) {
      return standingsByScore(event.standings).map((team, index) => ({ ...team, position: index + 1 }));
    },
    strategyOptions() {
      return Object.entries(strategies).map(([id, strategy]) => ({ id, ...strategy }));
    }
  });
})();
