(() => {
  const game = globalThis.AeroDesign ||= {};
  const { baseStats, rivalBlueprints, saveVersion, weeksPerSeason, attributes, weather, strategies, difficulties, seasonScopes, seasonScopeForYear, seasonGoalsForYear, seasonPhases, reusablePartTypes, skillNodes } = game.Content;
  const strategyIds = Object.keys(strategies);
  const skillNodeIds = skillNodes.map((node) => node.id);
  const conceptSkillIds = skillNodes.filter((node) => node.concept).map((node) => node.id);
  const emptyStats = Object.fromEntries(attributes.map(({ key }) => [key, 0]));

  function validPart(part) {
    return part && typeof part.id === "string" && part.id.length > 0 &&
      reusablePartTypes.includes(part.type) && isNumber(part.quality) &&
      part.quality >= 0 && part.quality <= 100 && isNumber(part.condition) &&
      part.condition >= 0 && part.condition <= 100 && Number.isInteger(part.builtYear) &&
      part.builtYear >= 1;
  }

  function validProject(project) {
    return project && typeof project.prototypeBuilt === "boolean" &&
      Number.isInteger(project.prototypeTests) && project.prototypeTests >= 0 && project.prototypeTests <= 3 &&
      Number.isInteger(project.finalTests) && project.finalTests >= 0 && project.finalTests <= 2 &&
      Array.isArray(project.reusedPartIds) && new Set(project.reusedPartIds).size === project.reusedPartIds.length &&
      (project.finalAircraft === null || (
        project.finalAircraft && typeof project.finalAircraft.name === "string" &&
        Number.isInteger(project.finalAircraft.year) && project.finalAircraft.year >= 1 &&
        isNumber(project.finalAircraft.reliabilityBonus) && project.finalAircraft.reliabilityBonus >= 0 &&
        project.finalAircraft.reliabilityBonus <= 0.1 &&
        project.finalAircraft.attributes && attributes.every(({ key }) =>
          isNumber(project.finalAircraft.attributes[key]) &&
          project.finalAircraft.attributes[key] >= 0 && project.finalAircraft.attributes[key] <= 100
        ) &&
        project.finalAircraft.components && reusablePartTypes.every((type) =>
          validPart(project.finalAircraft.components[type]) &&
          project.finalAircraft.components[type].type === type
        )
      ));
  }

  function validSkills(skills) {
    if (!Array.isArray(skills) || new Set(skills).size !== skills.length ||
      !skills.every((skill) => skillNodeIds.includes(skill))) return false;
    const selectedConcepts = skills.filter((skill) => skillNodes.find((node) => node.id === skill).concept);
    if (selectedConcepts.length > 1) return false;
    return skills.every((skill) => {
      const node = skillNodes.find((entry) => entry.id === skill);
      return (node.requires || []).every((required) => skills.includes(required)) &&
        (!node.requiresAny || node.requiresAny.some((required) => skills.includes(required)));
    });
  }

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
        aircraftBaseName: aircraftName || "Aurora",
        difficulty,
        seasonScope: seasonScopeForYear(1).id,
        skills: [],
        year: 1,
        week: 0,
        cash: difficulties[difficulty].startingCash,
        prestige: 0,
        reputation: 0,
        team: game.Team.create(1),
        attributes: { ...emptyStats },
        parts: [],
        project: {
          prototypeBuilt: false,
          prototypeTests: 0,
          finalTests: 0,
          finalAircraft: null,
          reusedPartIds: []
        },
        rivals: game.Rivals.create(1),
        scouted: {},
        rivalNews: { week: 0, activities: [] },
        annualGoals: seasonGoalsForYear(1, baseStats),
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
          rival.weights && Object.keys(rival.weights).length === 5 &&
          rival.lastAction && typeof rival.lastAction.text === "string");
      const validGoals = candidate.annualGoals && candidate.annualGoals.year === candidate.year &&
        candidate.annualGoals.placement && Number.isInteger(candidate.annualGoals.placement.targetPosition) &&
        candidate.annualGoals.placement.targetPosition >= 1 && candidate.annualGoals.placement.targetPosition <= 5 &&
        candidate.annualGoals.technical && attributes.some(({ key }) => key === candidate.annualGoals.technical.attribute) &&
        isNumber(candidate.annualGoals.technical.baseline) && candidate.annualGoals.technical.baseline >= 0 &&
        candidate.annualGoals.technical.baseline <= 100 && isNumber(candidate.annualGoals.technical.target) &&
        candidate.annualGoals.technical.target >= candidate.annualGoals.technical.baseline &&
        candidate.annualGoals.technical.target <= 100 &&
        (candidate.annualGoals.result === null || (
          candidate.annualGoals.result && typeof candidate.annualGoals.result.technicalMet === "boolean" &&
          typeof candidate.annualGoals.result.placementMet === "boolean" &&
          isNumber(candidate.annualGoals.result.reputationGained) &&
          candidate.annualGoals.result.reputationGained >= 0
        ));
      const validRivalNews = candidate.rivalNews && Number.isInteger(candidate.rivalNews.week) &&
        candidate.rivalNews.week >= 0 && candidate.rivalNews.week <= weeksPerSeason &&
        Array.isArray(candidate.rivalNews.activities) &&
        candidate.rivalNews.activities.every((activity) =>
          activity && typeof activity.name === "string" && typeof activity.text === "string"
        );
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
          validSkills(team.skills) &&
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
        Number.isInteger(candidate.reputation) && candidate.reputation >= 0 && candidate.reputation <= 100 &&
        Number.isInteger(candidate.rngState) && candidate.rngState >= 0 && candidate.rngState <= 0xffffffff &&
        validAttributes && validSkills(candidate.skills) && validRivals && validGoals && validRivalNews &&
        typeof candidate.aircraftBaseName === "string" && candidate.aircraftBaseName.trim().length > 0 &&
        candidate.aircraftBaseName.length <= 24 &&
        Array.isArray(candidate.parts) && candidate.parts.every(validPart) &&
        new Set(candidate.parts.map((part) => part.id)).size === candidate.parts.length &&
        validProject(candidate.project) &&
        candidate.project.reusedPartIds.every((id) => candidate.parts.some((part) => part.id === id)) &&
        game.Team.validate(candidate.team, candidate.year, candidate.reputation) &&
        Array.isArray(candidate.history) && Array.isArray(candidate.log) &&
        candidate.scouted && typeof candidate.scouted === "object" &&
        validStrategies && validEvent &&
        validPhases.includes(candidate.phase) &&
        validEventPhase;
    },
    migrate(candidate) {
      if (!candidate || !Number.isInteger(candidate.version) || candidate.version < 1 ||
        candidate.version >= saveVersion) return candidate;
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
          migrated.project = {
            finalAircraft: {
              attributes: { ...(candidate.attributes || baseStats) },
              reliabilityBonus: 0
            }
          };
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
        skills: Array.isArray(migrated.skills)
          ? migrated.skills.filter((skill) => skillNodeIds.includes(skill)).filter((skill, index, list) => list.indexOf(skill) === index)
          : [],
        teamName: typeof migrated.teamName === "string" && migrated.teamName.trim()
          ? migrated.teamName.trim()
          : "Projeto Aurora",
        aircraftName: typeof migrated.aircraftName === "string" && migrated.aircraftName.trim()
          ? migrated.aircraftName.trim()
          : "Aurora",
        aircraftBaseName: typeof migrated.aircraftBaseName === "string" && migrated.aircraftBaseName.trim()
          ? migrated.aircraftBaseName.trim()
          : typeof migrated.aircraftName === "string" && migrated.aircraftName.trim()
            ? migrated.aircraftName.trim()
            : "Aurora",
        difficulty: Object.hasOwn(difficulties, migrated.difficulty) ? migrated.difficulty : "standard",
        seasonScope: seasonScopes.some((scope) => scope.id === migrated.seasonScope)
          ? migrated.seasonScope
          : seasonScopeForYear(migrated.year || 1).id
      };
      migrated.reputation = Number.isInteger(migrated.reputation)
        ? Math.max(0, Math.min(100, migrated.reputation))
        : 0;
      migrated.team = game.Team.create(migrated.year || 1);
      migrated.annualGoals = migrated.annualGoals?.year === migrated.year
        ? migrated.annualGoals
        : seasonGoalsForYear(migrated.year || 1, migrated.attributes || baseStats);
      migrated.rivals = (migrated.rivals || game.Rivals.create(migrated.year || 1)).map((rival) => ({
        ...rival,
        lastAction: rival.lastAction && typeof rival.lastAction.text === "string"
          ? rival.lastAction
          : { type: "opening", text: "manteve o plano de desenvolvimento da temporada" }
      }));
      migrated.rivalNews = migrated.rivalNews && Array.isArray(migrated.rivalNews.activities)
        ? migrated.rivalNews
        : { week: migrated.week || 0, activities: [] };
      migrated.scouted = Object.fromEntries(Object.entries(migrated.scouted || {}).map(([index, analysis]) => [
        index,
        analysis && typeof analysis.strength === "string"
          ? analysis
          : { year: migrated.year || 1, week: migrated.week || 0, legacy: true, estimate: analysis }
      ]));
      if (migrated.event && !migrated.event.scope) {
        migrated.event.scope = { ...seasonScopes.find((scope) => scope.id === migrated.seasonScope) };
      }
      if (migrated.event) {
        migrated.event = {
          ...migrated.event,
          standings: migrated.event.standings.map((team) => ({
            ...team,
            skills: Array.isArray(team.skills) ? team.skills.filter((skill) => skillNodeIds.includes(skill)) : []
          }))
        };
      }
      migrated.parts = [];
      migrated.project = {
        prototypeBuilt: (migrated.week || 0) >= seasonPhases[0].weeks,
        prototypeTests: 0,
        finalTests: 0,
        finalAircraft: null,
        reusedPartIds: []
      };
      if (migrated.phase !== "preparation") {
        const player = migrated.event?.standings.find((team) => team.isPlayer);
        const aircraftAttributes = player?.attributes || migrated.attributes || { ...emptyStats };
        const components = Object.fromEntries(reusablePartTypes.map((type) => [type, {
          id: `migrated-${migrated.year}-${type}`,
          type,
          quality: aircraftAttributes[type],
          condition: 100,
          builtYear: migrated.year || 1
        }]));
        migrated.project.finalAircraft = {
          name: migrated.aircraftName,
          year: migrated.year || 1,
          attributes: { ...aircraftAttributes },
          components,
          reliabilityBonus: 0
        };
        migrated.project.prototypeBuilt = true;
      }
      migrated.skills = migrated.skills.filter((skill) => !conceptSkillIds.includes(skill));
      return migrated;
    }
  });
})();
