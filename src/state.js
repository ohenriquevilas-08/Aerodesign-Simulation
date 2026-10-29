(() => {
  const game = globalThis.AeroDesign ||= {};
  const { baseStats, rivalBlueprints, saveVersion, weeksPerSeason, attributes, weather, strategies, difficulties, seasonScopes, seasonScopeForYear } = game.Content;
  const strategyIds = Object.keys(strategies);

  function isNumber(value) {
    return Number.isFinite(value);
  }

  game.State = Object.freeze({
    create(options = {}) {
      const difficulty = Object.hasOwn(difficulties, options.difficulty) ? options.difficulty : "standard";
      const teamName = typeof options.teamName === "string" ? options.teamName.trim().slice(0, 32) : "";
      const aircraftName = typeof options.aircraftName === "string" ? options.aircraftName.trim().slice(0, 24) : "";
      return {
        version: saveVersion,
        teamName: teamName || "Projeto Aurora",
        aircraftName: aircraftName || "Aurora",
        difficulty,
        seasonScope: seasonScopeForYear(1).id,
        year: 1,
        week: 0,
        cash: difficulties[difficulty].startingCash,
        prestige: 0,
        attributes: { ...baseStats },
        rivals: game.Rivals.create(1),
        scouted: {},
        history: [],
        log: [{ week: 0, text: "A temporada começou. Defina uma estratégia para a equipe." }],
        phase: "preparation",
        rngState: game.Random.seed(),
        event: null,
        eventStrategies: ["balanced", "balanced", "balanced"],
        eventResult: null
      };
    },
    validate(candidate) {
      if (!candidate || typeof candidate !== "object") return false;
      const validPhases = ["preparation", "event-report", "event-flight", "results"];
      const validAttributes = candidate.attributes && attributes.every(({ key }) =>
        isNumber(candidate.attributes[key]) && candidate.attributes[key] >= 0 && candidate.attributes[key] <= 100
      );
      const validRivals = Array.isArray(candidate.rivals) && candidate.rivals.length === rivalBlueprints.length &&
        candidate.rivals.every((rival) => rival && typeof rival.name === "string" &&
          rival.attributes && attributes.every(({ key }) => isNumber(rival.attributes[key])) &&
          rival.weights && Object.keys(rival.weights).length === 5);
      const validStrategies = Array.isArray(candidate.eventStrategies) && candidate.eventStrategies.length === 3 &&
        candidate.eventStrategies.every((strategy) => strategyIds.includes(strategy));
      const validIdentity = typeof candidate.teamName === "string" && candidate.teamName.trim().length > 0 &&
        candidate.teamName.length <= 32 && typeof candidate.aircraftName === "string" &&
        candidate.aircraftName.trim().length > 0 && candidate.aircraftName.length <= 24 &&
        Object.hasOwn(difficulties, candidate.difficulty) &&
        seasonScopes.some((scope) => scope.id === candidate.seasonScope);
      const validEvent = candidate.event === null || (
        candidate.event && Number.isInteger(candidate.event.round) &&
        candidate.event.round >= 0 && candidate.event.round <= 3 &&
        candidate.event.scope && seasonScopes.some((scope) => scope.id === candidate.event.scope.id) &&
        Array.isArray(candidate.event.weather) && candidate.event.weather.length === 3 &&
        candidate.event.weather.every((entry) => entry && weather.some((option) => option.id === entry.id)) &&
        Array.isArray(candidate.event.standings) && candidate.event.standings.length === rivalBlueprints.length + 1 &&
        candidate.event.standings.filter((team) => team?.isPlayer).length === 1 &&
        candidate.event.standings.every((team) => team && typeof team.name === "string" &&
          typeof team.isPlayer === "boolean" && isNumber(team.report) && isNumber(team.total) &&
          team.attributes && attributes.every(({ key }) => isNumber(team.attributes[key])) &&
          Array.isArray(team.flights) && team.flights.length <= 3 &&
          team.flights.every((flight) => flight && isNumber(flight.score) && typeof flight.crashed === "boolean")) &&
        Array.isArray(candidate.event.commentary) &&
        candidate.event.commentary.every((entry) => entry && typeof entry.text === "string")
      );
      const validEventPhase = candidate.phase === "preparation" ? candidate.event === null
        : candidate.phase === "event-report" ? candidate.event?.round === 0
          : candidate.phase === "event-flight" ? candidate.event?.round < 3
            : candidate.phase === "results" ? candidate.event?.round === 3
              : false;
      return candidate.version === saveVersion && validIdentity &&
        Number.isInteger(candidate.year) && candidate.year >= 1 &&
        Number.isInteger(candidate.week) && candidate.week >= 0 && candidate.week <= weeksPerSeason &&
        (candidate.phase !== "preparation" || candidate.week < weeksPerSeason) &&
        isNumber(candidate.cash) && candidate.cash >= 0 &&
        isNumber(candidate.prestige) && candidate.prestige >= 0 &&
        Number.isInteger(candidate.rngState) && candidate.rngState >= 0 && candidate.rngState <= 0xffffffff &&
        validAttributes && validRivals &&
        Array.isArray(candidate.history) && Array.isArray(candidate.log) &&
        candidate.scouted && typeof candidate.scouted === "object" &&
        validStrategies && validEvent &&
        validPhases.includes(candidate.phase) &&
        validEventPhase;
    },
    migrate(candidate) {
      if (!candidate || ![1, 2, 3].includes(candidate.version)) return candidate;
      let migrated = { ...candidate };

      if (candidate.version === 1) {
        migrated = {
          ...migrated,
          teamName: typeof candidate.teamName === "string" && candidate.teamName.trim()
            ? candidate.teamName.trim()
            : "Projeto Aurora",
          aircraftName: typeof candidate.aircraftName === "string" && candidate.aircraftName.trim()
            ? candidate.aircraftName.trim()
            : "Aurora",
          difficulty: Object.hasOwn(difficulties, candidate.difficulty) ? candidate.difficulty : "standard",
          rngState: Number.isInteger(candidate.rngState) ? candidate.rngState >>> 0 : game.Random.seed(),
          event: null,
          eventStrategies: Array.isArray(candidate.eventStrategies) && candidate.eventStrategies.length === 3
            ? candidate.eventStrategies
            : ["balanced", "balanced", "balanced"]
        };
        migrated.history = (candidate.history || []).map((entry) => ({
          ...entry,
          standings: Array.isArray(entry.standings) ? entry.standings : []
        }));

        if (candidate.phase === "event" && candidate.week === weeksPerSeason) {
          const eventPlan = game.Competition.create(migrated);
          migrated.rngState = eventPlan.seed;
          if (Array.isArray(candidate.eventWeather) && candidate.eventWeather.length === 3) {
            eventPlan.event.weather = candidate.eventWeather.map((savedWeather) =>
              weather.find((option) => option.id === savedWeather.id) || { ...weather[0] }
            );
          }
          migrated.event = eventPlan.event;
          migrated.phase = "event-report";
        } else if (candidate.phase === "results" && candidate.eventResult?.standings) {
          const standings = candidate.eventResult.standings.map((team) => {
            const sourceAttributes = team.isPlayer
              ? candidate.attributes
              : candidate.rivals.find((rival) => rival.name === team.name)?.attributes || baseStats;
            const flights = (team.flights || []).map((flight) => ({
              ...flight,
              partial: Boolean(flight.partial),
              weather: flight.weather || "Clima variável",
              strategy: flight.strategy || "Equilibrada",
              strategyId: flight.strategyId || "balanced"
            }));
            return {
              ...team,
              attributes: { ...sourceAttributes },
              report: Number.isFinite(team.report) ? team.report : 0,
              flights,
              total: Number.isFinite(team.total) ? team.total : Number(team.score) || 0
            };
          });
          const weatherPlan = Array.isArray(candidate.eventWeather) && candidate.eventWeather.length === 3
            ? candidate.eventWeather.map((entry) => weather.find((option) => option.id === entry.id) || { ...weather[0] })
            : [{ ...weather[0] }, { ...weather[0] }, { ...weather[0] }];
          migrated.event = {
            round: 3,
            weather: weatherPlan,
            standings,
            commentary: [{ text: "Resultado migrado de uma versão anterior do jogo.", kind: "info" }]
          };
          migrated.phase = "results";
          migrated.eventResult = { standings, winner: candidate.eventResult.winner };
        }

        if (migrated.phase === "preparation") migrated.event = null;
      }

      migrated = {
        ...migrated,
        version: saveVersion,
        teamName: typeof migrated.teamName === "string" && migrated.teamName.trim()
          ? migrated.teamName.trim()
          : "Projeto Aurora",
        aircraftName: typeof migrated.aircraftName === "string" && migrated.aircraftName.trim()
          ? migrated.aircraftName.trim()
          : "Aurora",
        difficulty: Object.hasOwn(difficulties, migrated.difficulty) ? migrated.difficulty : "standard",
        seasonScope: seasonScopes.some((scope) => scope.id === migrated.seasonScope)
          ? migrated.seasonScope
          : seasonScopeForYear(migrated.year || 1).id
      };
      if (migrated.event && !migrated.event.scope) {
        migrated.event.scope = { ...seasonScopes.find((scope) => scope.id === migrated.seasonScope) };
      }
      return migrated;
    }
  });
})();
