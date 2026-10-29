(() => {
  const game = globalThis.AeroDesign ||= {};
  const { milestones: milestoneConfig, milestoneLevel, skillNodes } = game.Content;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function skillEffects(skills = []) {
    return skills.reduce((total, skillId) => {
      const effects = skillNodes.find((node) => node.id === skillId)?.effects;
      if (!effects) return total;
      Object.entries(effects).forEach(([key, value]) => {
        if (key.endsWith("Multiplier")) total[key] = (total[key] ?? 1) * value;
        else total[key] = (total[key] ?? 0) + value;
      });
      return total;
    }, {});
  }

  game.Aircraft = Object.freeze({
    derive(attributes, skills = []) {
      const effects = skillEffects(skills);
      const milestones = Object.fromEntries(milestoneConfig.map(({ key }) => [key, attributes[key] >= milestoneLevel]));
      const emptyWeightBase = 15.8 - attributes.structures * 0.07 + attributes.systems * 0.018;
      const payloadBase = 0.8 + attributes.aerodynamics * 0.052 + attributes.systems * 0.017 + attributes.structures * 0.006;
      const emptyWeight = clamp(
        (emptyWeightBase * (milestones.structures ? 0.92 : 1)) - (effects.emptyWeightReduction ?? 0),
        7.5,
        16
      );
      const payload = clamp(
        payloadBase * (milestones.aerodynamics ? 1.08 : 1) * (effects.payloadMultiplier ?? 1),
        1,
        10.5
      );
      const reliability = clamp(
        0.58 + attributes.structures * 0.0028 + attributes.systems * 0.0025 -
          attributes.aerodynamics * 0.00055 + (milestones.systems ? 0.06 : 0) +
          (effects.reliabilityModifier ?? 0),
        0.55,
        0.97
      );
      const payloadPotential = clamp(payload * 9.2 + (16 - emptyWeight) * 3.2, 0, 100);
      return { emptyWeight, payload, reliability, payloadPotential, milestones, effects };
    },
    reportScore(report, multiplier = 1, skills = []) {
      const effects = skillEffects(skills);
      return Math.round(clamp((28 + report * 0.72 + (report >= milestoneLevel ? 8 : 0) +
        (effects.reportBonus ?? 0)) * multiplier, 0, 100));
    },
    upgradeCost(attribute, level, skills = []) {
      const effects = skillEffects(skills);
      return Math.round(attribute.baseCost * (1 + level / 100) * (effects.upgradeCostMultiplier ?? 1));
    },
    upgradeGain(attribute, level, skills = []) {
      const effects = skillEffects(skills);
      return Math.min(100 - level, attribute.baseGain * (1 - level / 135) *
        (effects.upgradeGainMultiplier ?? 1));
    },
    researchCost(node, skills = []) {
      const effects = skillEffects(skills);
      return Math.round(node.cost * (effects.researchCostMultiplier ?? 1));
    }
  });
})();
