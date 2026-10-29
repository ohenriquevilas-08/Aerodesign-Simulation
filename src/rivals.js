(() => {
  const game = globalThis.AeroDesign ||= {};
  const { rivalBlueprints } = game.Content;
  const { Random, Aircraft } = game;
  const attributeLabels = Object.fromEntries(game.Content.attributes.map(({ key, name }) => [key, name]));

  function chooseAction(rival, seed) {
    const weights = Object.entries(rival.weights).map(([key, weight]) =>
      [key, key === "funding" && rival.cash < 500 ? weight * 1.8 : weight]
    );
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    const { seed: nextSeed, value } = Random.next(seed);
    let roll = value * total;
    for (const [action, weight] of weights) {
      roll -= weight;
      if (roll <= 0) return { action, seed: nextSeed };
    }
    return { action: weights[0][0], seed: nextSeed };
  }

  game.Rivals = Object.freeze({
    create(year) {
      const progression = Math.min(24, Math.max(0, year - 1) * 2);
      return rivalBlueprints.map((blueprint, index) => {
        const base = 27 + progression + (index % 2) * 4 + ((year - 1) % 4);
        return {
          name: blueprint.name,
          philosophy: blueprint.philosophy,
          weights: { ...blueprint.weights },
          attributes: {
            aerodynamics: base + (index === 2 ? 9 : 0),
            structures: base + (index === 0 ? 10 : 0),
            systems: base + (index === 3 ? 7 : 0),
            report: base - 4
          },
          cash: 700 + year * 80,
          lastAction: { type: "opening", text: "manteve o plano de desenvolvimento da temporada" }
        };
      });
    },
    advance(rivals, seed, difficulty = "standard") {
      let nextSeed = seed;
      const progressRate = game.Content.difficulties[difficulty]?.rivalProgress ?? 1;
      const activities = [];
      const updated = rivals.map((rival) => {
        const result = chooseAction(rival, nextSeed);
        nextSeed = result.seed;
        const copy = { ...rival, attributes: { ...rival.attributes } };
        let activity;
        if (result.action === "funding") {
          copy.cash += 330;
          activity = { name: rival.name, type: "funding", text: "buscou recursos para o projeto" };
        } else {
          const current = copy.attributes[result.action];
          copy.attributes[result.action] = Math.min(100, current + 6 * progressRate * (1 - current / 135));
          activity = {
            name: rival.name,
            type: "engineering",
            attribute: result.action,
            text: `investiu em ${attributeLabels[result.action]}`
          };
        }
        copy.lastAction = { type: activity.type, text: activity.text };
        activities.push(activity);
        return copy;
      });
      return { rivals: updated, seed: nextSeed, activities };
    },
    analyze(rival, index, year, scope) {
      const estimate = (value, dimension) => {
        const seed = (Math.imul(year, 73856093) ^ Math.imul(index + 1, 19349663) ^ Math.imul(dimension + 1, 83492791)) >>> 0;
        const noise = (Random.next(seed).value - 0.5) * 16;
        return Math.max(0, Math.min(100, value + noise));
      };
      const design = Aircraft.derive(rival.attributes);
      const measures = game.Content.attributes.map(({ key, name }, dimension) => ({
        key,
        name,
        estimate: estimate(rival.attributes[key], dimension)
      }));
      const orderedMeasures = [...measures].sort((first, second) => second.estimate - first.estimate);
      const fitByScope = {
        payload: design.payloadPotential,
        reliability: design.reliability * 100,
        "technical-report": Aircraft.reportScore(rival.attributes.report),
        "balanced-efficiency": (
          design.payloadPotential + design.reliability * 100 + Aircraft.reportScore(rival.attributes.report)
        ) / 3
      };
      const scopeFit = estimate(fitByScope[scope.id], 5);
      const fitLabel = scopeFit >= 66 ? "vantagem provável"
        : scopeFit >= 47 ? "competitiva"
          : "ponto vulnerável";
      const forecast = game.Content.weather
        .filter((weather) => ["clear", "gusts", "turbulence"].includes(weather.id))
        .map((weather) => ({
          weather: weather.label,
          strategy: this.flightStrategy(rival, weather)
        }));
      return {
        year,
        week: 0,
        strength: orderedMeasures[0].name,
        vulnerability: orderedMeasures[orderedMeasures.length - 1].name,
        scopeFit: fitLabel,
        weatherStrategies: forecast,
        confidence: "Tendências aproximadas; não são valores oficiais."
      };
    },
    flightStrategy(rival, weather) {
      const stability = rival.weights.structures + rival.weights.systems;
      if (weather.reliabilityModifier <= -0.08 && stability >= 0.48) return "conservative";
      if (rival.weights.aerodynamics >= 0.38) return "aggressive";
      if (stability >= 0.52) return "conservative";
      return "balanced";
    }
  });
})();
