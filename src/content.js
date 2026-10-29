(() => {
  const game = globalThis.AeroDesign ||= {};
  const seasonScopes = Object.freeze([
    Object.freeze({
      id: "payload",
      title: "Desafio de carga útil",
      criteria: "A arbitragem valoriza projetos que transportam mais carga.",
      flightMultiplier: 1.08,
      reportMultiplier: 1,
      reliabilityModifier: 0,
      reusableParts: Object.freeze(["structures", "systems"]),
      reuseRule: "Reaproveite estruturas e sistemas; a asa deve ser nova."
    }),
    Object.freeze({
      id: "reliability",
      title: "Desafio de confiabilidade",
      criteria: "Segurança e voos consistentes recebem prioridade.",
      flightMultiplier: 0.98,
      reportMultiplier: 1,
      reliabilityModifier: 0.06,
      reusableParts: Object.freeze(["structures"]),
      reuseRule: "Somente a estrutura pode ser reaproveitada."
    }),
    Object.freeze({
      id: "technical-report",
      title: "Desafio de relatório técnico",
      criteria: "Documentação e apresentação técnica têm peso maior.",
      flightMultiplier: 1,
      reportMultiplier: 1.1,
      reliabilityModifier: 0,
      reusableParts: Object.freeze([]),
      reuseRule: "O regulamento exige peças novas."
    }),
    Object.freeze({
      id: "balanced-efficiency",
      title: "Desafio de eficiência",
      criteria: "A competição busca equilíbrio entre carga, segurança e projeto.",
      flightMultiplier: 1.03,
      reportMultiplier: 1.04,
      reliabilityModifier: 0.02,
      reusableParts: Object.freeze(["aerodynamics", "structures", "systems"]),
      reuseRule: "Todas as partes podem ser reaproveitadas."
    })
  ]);
  const seasonPhases = Object.freeze([
    Object.freeze({ id: "project", title: "Projeto", weeks: 6 }),
    Object.freeze({ id: "prototype", title: "Protótipos + ensaios", weeks: 7 }),
    Object.freeze({ id: "final", title: "Versão final + ensaios + relatório", weeks: 7 })
  ]);
  const seasonPhaseForWeek = (week) => {
    let remainingWeeks = Math.max(0, week);
    for (const phase of seasonPhases) {
    if (remainingWeeks < phase.weeks) return phase;
    remainingWeeks -= phase.weeks;
    }
    return seasonPhases.at(-1);
  };
  const reusablePartTypes = Object.freeze(["aerodynamics", "structures", "systems"]);
  const seasonScopeForYear = (year) => seasonScopes[(Math.max(1, year) - 1) % seasonScopes.length];
  const seasonGoalsForYear = (year, attributes) => {
    const scope = seasonScopeForYear(year);
    const technicalAttribute = {
      payload: "aerodynamics",
      reliability: "structures",
      "technical-report": "report",
      "balanced-efficiency": "systems"
    }[scope.id];
    const baseline = attributes[technicalAttribute];
    return {
      year,
      placement: {
        targetPosition: [4, 4, 3, 2, 1][Math.min(year, 5) - 1],
        reputationReward: 4
      },
      technical: {
        attribute: technicalAttribute,
        baseline,
        target: Math.min(100, baseline + 6),
        reputationReward: 4
      },
      result: null
    };
  };
  const teamRoles = Object.freeze(["aerodynamics", "structures"]);
  const teamAssignments = Object.freeze([
    { id: "aerodynamics", label: "Projeto · Aerodinâmica", attribute: "aerodynamics" },
    { id: "structures", label: "Projeto · Estruturas", attribute: "structures" },
    { id: "systems", label: "Projeto · Sistemas", attribute: "systems" },
    { id: "report", label: "Projeto · Relatório", attribute: "report" },
    { id: "fundraising", label: "Captação", weeklyCredits: 18 },
    { id: "mentoring", label: "Mentoria", reputationReward: 0 }
  ]);
  const teamCandidates = Object.freeze([
    { specialty: "aerodynamics", label: "Aerodinâmica", cost: 320, reputationRequired: 0, experience: 0.35 },
    { specialty: "structures", label: "Estruturas", cost: 340, reputationRequired: 0, experience: 0.4 },
    { specialty: "systems", label: "Sistemas", cost: 360, reputationRequired: 10, experience: 0.3 },
    { specialty: "report", label: "Relatório", cost: 330, reputationRequired: 10, experience: 0.45 },
    { specialty: "fundraising", label: "Captação", cost: 300, reputationRequired: 20, experience: 0.5 }
  ]);
  const conceptSkillIds = ["concept-lift", "concept-light", "concept-stable"];
  const skillNodes = Object.freeze([
    Object.freeze({
      id: "concept-lift",
      branch: "aircraft",
      title: "Conceito · Carga máxima",
      description: "Asa de grande sustentação prioriza carga, com maior exigência de estabilidade.",
      weeks: 2,
      cost: 420,
      concept: true,
      effects: Object.freeze({ payloadMultiplier: 1.1, reliabilityModifier: -0.04 })
    }),
    Object.freeze({
      id: "concept-light",
      branch: "aircraft",
      title: "Conceito · Estrutura leve",
      description: "Uma estrutura enxuta reduz o peso vazio e melhora a eficiência de carga.",
      weeks: 2,
      cost: 380,
      concept: true,
      effects: Object.freeze({ emptyWeightReduction: 1.1 })
    }),
    Object.freeze({
      id: "concept-stable",
      branch: "aircraft",
      title: "Conceito · Estabilidade",
      description: "Um projeto previsível prioriza confiabilidade em vez de desempenho máximo.",
      weeks: 2,
      cost: 400,
      concept: true,
      effects: Object.freeze({ payloadMultiplier: 0.95, reliabilityModifier: 0.08 })
    }),
    Object.freeze({
      id: "design-method",
      branch: "engineering",
      title: "Método de projeto",
      description: "Revisões integradas tornam cada melhoria de engenharia mais eficiente.",
      weeks: 2,
      cost: 500,
      requiresAny: conceptSkillIds,
      effects: Object.freeze({ upgradeGainMultiplier: 1.1 })
    }),
    Object.freeze({
      id: "advanced-manufacturing",
      branch: "engineering",
      title: "Manufatura avançada",
      description: "Processos repetíveis reduzem peso e aumentam a confiabilidade estrutural.",
      weeks: 2,
      cost: 650,
      requires: ["design-method"],
      effects: Object.freeze({ emptyWeightReduction: 0.35, reliabilityModifier: 0.05 })
    }),
    Object.freeze({
      id: "team-coordination",
      branch: "team",
      title: "Coordenação da equipe",
      description: "Rituais de integração diminuem o custo das pesquisas seguintes.",
      weeks: 1,
      cost: 300,
      effects: Object.freeze({ researchCostMultiplier: 0.85 })
    }),
    Object.freeze({
      id: "technical-integration",
      branch: "team",
      title: "Integração técnica",
      description: "Revisões entre áreas elevam a qualidade do relatório e evitam incompatibilidades.",
      weeks: 2,
      cost: 520,
      requires: ["team-coordination"],
      effects: Object.freeze({ reportBonus: 6, reliabilityModifier: 0.02 })
    })
  ]);

  game.Content = Object.freeze({
    saveKey: "aerodesign-manager-save-v1",
    saveVersion: 8,
    seasonScopes,
    seasonScopeForYear,
    seasonGoalsForYear,
    seasonPhases,
    seasonPhaseForWeek,
    reusablePartTypes,
    teamRoles,
    teamAssignments,
    teamCandidates,
    teamCapacityForReputation(reputation) {
      return reputation >= 60 ? 7 : reputation >= 30 ? 6 : 5;
    },
    teamMemberCost: 300,
    campaignSeasons: 5,
    placementReputation: Object.freeze([12, 9, 7, 5, 3]),
    scoutingCost: 150,
    skillNodes,
    skillBranches: Object.freeze([
      Object.freeze({ id: "aircraft", title: "Conceito do avião", description: "Escolha uma identidade de projeto. Os conceitos são mutuamente exclusivos." }),
      Object.freeze({ id: "engineering", title: "Engenharia e manufatura", description: "Desenvolva métodos para extrair mais de cada semana de projeto." }),
      Object.freeze({ id: "team", title: "Gestão da equipe", description: "Invista em integração e qualidade do trabalho entre áreas." })
    ]),
    difficulties: Object.freeze({
      freshman: { label: "Calouro", startingCash: 1400, rivalProgress: 0.75, description: "Mais créditos iniciais; as rivais evoluem com calma." },
      standard: { label: "Intermediário", startingCash: 1000, rivalProgress: 1, description: "Recursos e evolução das rivais em equilíbrio." },
      veteran: { label: "Veterano", startingCash: 850, rivalProgress: 1.2, description: "Menos créditos iniciais; as rivais avançam mais rápido." }
    }),
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
      { id: "raffle", name: "Organizar rifa", weeks: 1, reward: 420, reputationRequired: 0, description: "Uma ação rápida para reforçar o caixa sem interromper o projeto por muito tempo." },
      { id: "sponsorship", name: "Buscar patrocínio", weeks: 2, reward: 1120, reputationRequired: 0, description: "Uma rodada de contatos com retorno maior, mas consome duas semanas de preparação." },
      { id: "science-fair", name: "Feira de ciência", weeks: 1, reward: 650, reputationRequired: 15, description: "A reputação da equipe abre espaço para uma ação em evento universitário." },
      { id: "university-grant", name: "Edital universitário", weeks: 2, reward: 1800, reputationRequired: 35, description: "Um projeto consistente pode conquistar recursos institucionais." },
      { id: "industry-sponsor", name: "Patrocínio industrial", weeks: 2, reward: 2500, reputationRequired: 60, description: "Resultados reconhecidos atraem empresas do setor aeronáutico." }
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
