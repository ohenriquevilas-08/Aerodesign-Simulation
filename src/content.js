(() => {
  const game = globalThis.AeroDesign ||= {};

  game.Content = Object.freeze({
    saveKey: "aerodesign-manager-save-v1",
    saveVersion: 2,
    weeksPerSeason: 20,
    milestoneLevel: 50,
    baseStats: Object.freeze({ aerodynamics: 30, structures: 30, systems: 25, report: 20 }),
    attributes: Object.freeze([
      { key: "aerodynamics", name: "Aerodinâmica", icon: "↗", baseCost: 240, baseGain: 8, description: "Aumenta a capacidade de carga e a eficiência do voo." },
      { key: "structures", name: "Estruturas", icon: "⌁", baseCost: 220, baseGain: 8, description: "Reduz o peso vazio e melhora a confiabilidade." },
      { key: "systems", name: "Sistemas", icon: "⌘", baseCost: 200, baseGain: 8, description: "Eleva a confiabilidade com um custo moderado de peso." },
      { key: "report", name: "Relatório", icon: "▤", baseCost: 150, baseGain: 9, description: "Garante pontos de apresentação antes das baterias de voo." }
    ]),
    rivalBlueprints: Object.freeze([
      { name: "Instituto Politécnico", philosophy: "Estruturas e segurança", weights: { aerodynamics: 0.13, structures: 0.38, systems: 0.22, report: 0.17, funding: 0.10 } },
      { name: "Universidade Estadual", philosophy: "Eficiência equilibrada", weights: { aerodynamics: 0.28, structures: 0.22, systems: 0.19, report: 0.20, funding: 0.11 } },
      { name: "Centro Universitário do Vale", philosophy: "Carga máxima", weights: { aerodynamics: 0.43, structures: 0.14, systems: 0.12, report: 0.16, funding: 0.15 } },
      { name: "Escola Técnica do Litoral", philosophy: "Sistemas e captação", weights: { aerodynamics: 0.17, structures: 0.18, systems: 0.30, report: 0.15, funding: 0.20 } }
    ]),
    fundraisers: Object.freeze([
      { id: "raffle", name: "Organizar rifa", weeks: 1, reward: 420, description: "Uma ação rápida para reforçar o caixa sem interromper o projeto por muito tempo." },
      { id: "sponsorship", name: "Buscar patrocínio", weeks: 2, reward: 1120, description: "Uma rodada de contatos com retorno maior, mas consome duas semanas de preparação." }
    ]),
    strategies: Object.freeze({
      conservative: { label: "Segura", loadMultiplier: 0.72, reliabilityModifier: 0.16 },
      balanced: { label: "Equilibrada", loadMultiplier: 0.90, reliabilityModifier: 0 },
      aggressive: { label: "Agressiva", loadMultiplier: 1.05, reliabilityModifier: -0.13 }
    }),
    weather: Object.freeze([
      { id: "clear", label: "Céu limpo", effect: "Condições estáveis", payloadMultiplier: 1, reliabilityModifier: 0 },
      { id: "gusts", label: "Rajadas de vento", effect: "Carga −4% · Confiabilidade −8 p.p.", payloadMultiplier: 0.96, reliabilityModifier: -0.08 },
      { id: "heat", label: "Calor e ar rarefeito", effect: "Carga −12% · Confiabilidade −2 p.p.", payloadMultiplier: 0.88, reliabilityModifier: -0.02 },
      { id: "turbulence", label: "Turbulência", effect: "Carga −8% · Confiabilidade −12 p.p.", payloadMultiplier: 0.92, reliabilityModifier: -0.12 }
    ]),
    milestones: Object.freeze([
      { key: "aerodynamics", label: "Aerodinâmica · Perfil avançado", effect: "+8% de potencial de carga" },
      { key: "structures", label: "Estruturas · Manufatura leve", effect: "−8% de peso vazio" },
      { key: "systems", label: "Sistemas · Redundância", effect: "+6 p.p. de confiabilidade" },
      { key: "report", label: "Relatório · Revisão técnica", effect: "+8 pontos de apresentação" }
    ]),
    prizes: Object.freeze([1400, 900, 600, 300, 300]),
    prestigeAwards: Object.freeze([10, 5, 2, 0, 0])
  });
})();
