(() => {
  const game = globalThis.AeroDesign ||= {};
  const { milestones: milestoneConfig, milestoneLevel } = game.Content;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  game.Aircraft = Object.freeze({
    derive(attributes) {
      const milestones = Object.fromEntries(milestoneConfig.map(({ key }) => [key, attributes[key] >= milestoneLevel]));
      const emptyWeightBase = 15.8 - attributes.structures * 0.07 + attributes.systems * 0.018;
      const payloadBase = 0.8 + attributes.aerodynamics * 0.052 + attributes.systems * 0.017 + attributes.structures * 0.006;
      const emptyWeight = clamp(emptyWeightBase * (milestones.structures ? 0.92 : 1), 7.5, 16);
      const payload = clamp(payloadBase * (milestones.aerodynamics ? 1.08 : 1), 1, 10.5);
      const reliability = clamp(
        0.58 + attributes.structures * 0.0028 + attributes.systems * 0.0025 -
          attributes.aerodynamics * 0.00055 + (milestones.systems ? 0.06 : 0),
        0.55,
        0.97
      );
      const payloadPotential = clamp(payload * 9.2 + (16 - emptyWeight) * 3.2, 0, 100);
      return { emptyWeight, payload, reliability, payloadPotential, milestones };
    },
    reportScore(report, multiplier = 1) {
      return Math.round(clamp((28 + report * 0.72 + (report >= milestoneLevel ? 8 : 0)) * multiplier, 0, 100));
    },
    upgradeCost(attribute, level) {
      return Math.round(attribute.baseCost * (1 + level / 100));
    },
    upgradeGain(attribute, level) {
      return Math.min(100 - level, attribute.baseGain * (1 - level / 135));
    }
  });
})();
