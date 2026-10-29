(() => {
  const game = globalThis.AeroDesign ||= {};
  const { rivalBlueprints } = game.Content;
  const { Random, Aircraft } = game;

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
          cash: 700 + year * 80
        };
      });
    },
    advance(rivals, seed, difficulty = "standard") {
      let nextSeed = seed;
      const progressRate = game.Content.difficulties[difficulty]?.rivalProgress ?? 1;
      const updated = rivals.map((rival) => {
        const result = chooseAction(rival, nextSeed);
        nextSeed = result.seed;
        const copy = { ...rival, attributes: { ...rival.attributes } };
        if (result.action === "funding") {
          copy.cash += 330;
        } else {
          const current = copy.attributes[result.action];
          copy.attributes[result.action] = Math.min(100, current + 6 * progressRate * (1 - current / 135));
        }
        return copy;
      });
      return { rivals: updated, seed: nextSeed };
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
