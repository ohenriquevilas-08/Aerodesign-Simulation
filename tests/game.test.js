import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
  "content.js",
  "random.js",
  "aircraft.js",
  "team.js",
  "rivals.js",
  "competition.js",
  "state.js",
  "game.js",
  "storage.js",
  "ui.js"
];

function createHarness() {
  const storage = new Map();
  const elements = new Map();
  const screens = ["overview", "engineering", "skills", "fundraising", "rivals", "team", "championship"];
  const navButtons = screens.map((screen) => ({
    dataset: { screen },
    attributes: {},
    hidden: false,
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; },
    focus() {}
  }));
  const screenPanels = screens.map((screen) => ({
    dataset: { screenPanel: screen },
    setAttribute() {},
    inert: false,
    hidden: false,
    style: {}
  }));
  const createElement = () => ({
    textContent: "",
    innerHTML: "",
    dataset: {},
    style: {},
    hidden: false,
    disabled: false,
    setAttribute() {}
  });
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelectorAll(selector) {
      return selector === ".career-nav-button" ? navButtons : selector === ".career-screen" ? screenPanels : [];
    },
    querySelector(selector) {
      if (selector === '[data-action="previous-screen"]') return getElementById("previousScreen");
      if (selector === '[data-action="next-screen"]') return getElementById("nextScreen");
      return createElement();
    }
  };
  function getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  }
  document.getElementById = getElementById;
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); }
  };
  const context = vm.createContext({ document, localStorage, console });
  for (const file of sourceFiles) {
    vm.runInContext(readFileSync(path.join(root, "src", file), "utf8"), context, { filename: file });
  }
  return { game: context.AeroDesign, elements, storage, navButtons, screenPanels };
}

function apply(game, state, type, details = {}) {
  const transition = game.Game.apply(state, { type, ...details });
  return transition.state;
}

function prepareSeason(game, initialState, atFinalStage = null) {
  let state = initialState;
  const testAttributes = ["aerodynamics", "structures", "systems"];
  while (state.phase === "preparation") {
    const stage = game.Content.seasonPhaseForWeek(state.week).id;
    if (stage === "final" && atFinalStage) {
      state = atFinalStage(state);
      atFinalStage = null;
    }
    if (stage === "project") {
      state = state.cash < 780
        ? apply(game, state, "fundraise", { id: "raffle" })
        : apply(game, state, "advance-week");
    } else if (stage === "prototype") {
      if (!state.project.prototypeBuilt) state = apply(game, state, "build-prototype");
      else if (state.project.prototypeTests < 3) {
        state = apply(game, state, "test-prototype", {
          key: testAttributes[state.project.prototypeTests]
        });
      } else state = apply(game, state, "advance-week");
    } else if (!state.project.finalAircraft) {
      state = apply(game, state, "build-final-aircraft");
    } else if (state.attributes.report < 100) {
      state = apply(game, state, "write-report");
    } else if (state.project.finalTests < 2) {
      state = apply(game, state, "test-final-aircraft");
    } else state = apply(game, state, "advance-week");
  }
  return state;
}

function addAircraftSnapshot(state) {
  state.project.finalAircraft = {
    name: state.aircraftName,
    year: state.year,
    attributes: { ...state.attributes },
    components: {},
    reliabilityBonus: 0
  };
  return state;
}

test("full season persists between report and flight stages and records a championship", () => {
  const { game, storage } = createHarness();
  let state = game.State.create();
  state.attributes = { aerodynamics: 67, structures: 61, systems: 54, report: 48 };
  state.rngState = 123456789;
  assert.equal(game.State.validate(state), true);

  state = prepareSeason(game, state);
  assert.equal(state.week, 20);
  assert.equal(state.phase, "event-report");
  assert.equal(state.event.round, 0);
  assert.equal(state.event.standings.length, 5);
  assert(state.event.standings.every((team) => team.total === 0));
  assert.equal(game.State.validate(state), true);

  state = apply(game, state, "reveal-reports");
  assert.equal(state.phase, "event-flight");
  assert(state.event.standings.every((team) => team.total === team.report));

  state = apply(game, state, "choose-strategy", { round: 0, strategy: "aggressive" });
  assert.equal(state.eventStrategies[0], "aggressive");
  const saved = game.Storage.save(state);
  assert.equal(saved.ok, true);
  const restored = game.Storage.load();
  assert.equal(restored.ok, true);
  state = restored.state;

  const deterministicReplay = game.Game.apply(state, { type: "run-flight" }).state;
  const replay = game.Game.apply(state, { type: "run-flight" }).state;
  assert.deepEqual(
    JSON.parse(JSON.stringify(deterministicReplay.event)),
    JSON.parse(JSON.stringify(replay.event))
  );
  assert.equal(deterministicReplay.rngState, replay.rngState);
  state = deterministicReplay;
  assert.equal(state.event.round, 1);
  assert.equal(state.phase, "event-flight");
  assert.equal(state.event.standings.find((team) => team.isPlayer).flights[0].strategy, "Agressiva");

  state = apply(game, state, "choose-strategy", { round: 1, strategy: "conservative" });
  state = apply(game, state, "run-flight");
  assert.equal(state.event.round, 2);
  assert.equal(state.event.standings.find((team) => team.isPlayer).flights[1].strategy, "Segura");
  state = apply(game, state, "run-flight");

  assert.equal(state.phase, "results");
  assert.equal(state.event.round, 3);
  assert(state.event.standings.every((team) => team.flights.length === 3));
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].standings.length, 5);
  assert.equal(state.history[0].winner, state.eventResult.winner);
  assert.equal(game.State.validate(state), true);

  const player = state.event.standings.find((team) => team.isPlayer);
  const prize = player.position === 1 ? 1400 : player.position === 2 ? 900 : player.position === 3 ? 600 : 300;
  assert(state.cash >= prize);
  assert.equal(storage.has(game.Content.saveKey), true);

  state = apply(game, state, "next-season");
  assert.equal(state.year, 2);
  assert.equal(state.week, 0);
  assert.equal(state.phase, "preparation");
  assert.equal(state.event, null);
  assert.equal(state.history.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(state.attributes)), {
    aerodynamics: 0,
    structures: 0,
    systems: 0,
    report: 0
  });
  assert.equal(state.project.prototypeBuilt, false);
  assert.equal(state.project.finalAircraft, null);
  assert.equal(state.aircraftName, "Aurora 2");
  assert(state.parts.length > 0);
  assert.equal(state.seasonScope, "reliability");
});

test("mission rules reject invalid transitions and migrate existing version-one saves", () => {
  const { game } = createHarness();
  const current = game.State.create();
  const lateSeason = { ...current, week: 19 };
  const rejected = game.Game.apply(lateSeason, { type: "fundraise", id: "sponsorship"   });

  assert.equal(rejected.state, lateSeason);
  assert.equal(rejected.notice.kind, "warning");

  const legacy = { ...current, version: 1 };
  delete legacy.rngState;
  delete legacy.event;
  delete legacy.eventStrategies;
  const migrated = game.State.migrate(legacy);
  assert.equal(migrated.version, game.Content.saveVersion);
  assert.equal(game.State.validate(migrated), true);

  const forged = { ...migrated, phase: "event-flight", event: null };
  assert.equal(game.State.validate(forged), false);
});

test("new careers start with an empty project and recover parts after the event", () => {
  const { game } = createHarness();
  let state = game.State.create();
  assert.deepEqual(JSON.parse(JSON.stringify(state.attributes)), {
    aerodynamics: 0,
    structures: 0,
    systems: 0,
    report: 0
  });
  assert.deepEqual(JSON.parse(JSON.stringify(state.parts)), []);
  assert.equal(state.project.prototypeBuilt, false);
  assert.equal(state.project.finalAircraft, null);
  assert.equal(game.State.validate(state), true);

  const earlyPrototype = game.Game.apply(state, { type: "build-prototype" });
  assert.equal(earlyPrototype.state, state);
  assert.match(earlyPrototype.notice.text, /segunda etapa/);

  state = prepareSeason(game, state);
  assert.equal(state.phase, "event-report");
  assert(state.project.finalAircraft);
  assert.equal(game.State.validate(state), true);
  state = apply(game, state, "reveal-reports");
  for (let flight = 0; flight < 3; flight += 1) state = apply(game, state, "run-flight");
  state = apply(game, state, "next-season");
  assert(state.parts.length > 0);
  assert.equal(state.project.finalAircraft, null);
  assert.equal(state.attributes.aerodynamics, 0);
  assert.equal(game.State.validate(state), true);
});

test("reused aircraft parts follow the annual regulation and retain their original identity", () => {
  const { game } = createHarness();
  let state = prepareSeason(game, game.State.create());
  state = apply(game, state, "reveal-reports");
  for (let flight = 0; flight < 3; flight += 1) state = apply(game, state, "run-flight");
  state = apply(game, state, "next-season");
  const structure = state.parts.find((part) => part.type === "structures");
  const wing = state.parts.find((part) => part.type === "aerodynamics");
  assert(structure);
  assert(wing);
  assert.deepEqual(
    JSON.parse(JSON.stringify(game.Content.seasonScopes.find((scope) => scope.id === state.seasonScope).reusableParts)),
    ["structures"]
  );

  state = prepareSeason(game, state, (finalStageState) => {
    const forbidden = game.Game.apply(finalStageState, { type: "toggle-part-reuse", partId: wing.id });
    assert.equal(forbidden.state, finalStageState);
    const selected = apply(game, finalStageState, "toggle-part-reuse", { partId: structure.id });
    assert.deepEqual(JSON.parse(JSON.stringify(selected.project.reusedPartIds)), [structure.id]);
    return selected;
  });
  assert.equal(state.project.finalAircraft.components.structures.builtYear, structure.builtYear);
  assert.equal(state.project.finalAircraft.components.aerodynamics.builtYear, state.year);
  assert.equal(state.parts.some((part) => part.id === structure.id), false);
  assert.equal(game.State.validate(state), true);
});

test("new careers store team identity and difficulty and migrate version-two saves", () => {
  const { game } = createHarness();
  const state = game.State.create({
    teamName: "  Asa Verde  ",
    aircraftName: "  Ventania  ",
    difficulty: "freshman"
  });
  assert.equal(state.teamName, "Asa Verde");
  assert.equal(state.aircraftName, "Ventania");
  assert.equal(state.cash, 1400);
  assert.equal(state.project.finalAircraft, null);
  assert.equal(state.teamName, "Asa Verde");

  const savedVersionTwo = { ...game.State.create(), version: 2, year: 4, cash: 735 };
  delete savedVersionTwo.teamName;
  delete savedVersionTwo.aircraftName;
  delete savedVersionTwo.difficulty;
  const migrated = game.State.migrate(savedVersionTwo);
  assert.equal(migrated.version, game.Content.saveVersion);
  assert.equal(migrated.teamName, "Projeto Aurora");
  assert.equal(migrated.aircraftName, "Aurora");
  assert.equal(migrated.difficulty, "standard");
  assert.equal(migrated.year, 4);
  assert.equal(migrated.cash, 735);
  assert.equal(game.State.validate(migrated), true);

  const easy = game.State.create({ difficulty: "freshman" });
  const veteran = game.State.create({ difficulty: "veteran" });
  const easyProgress = game.Rivals.advance(easy.rivals, 2468, easy.difficulty).rivals;
  const veteranProgress = game.Rivals.advance(veteran.rivals, 2468, veteran.difficulty).rivals;
  assert(easyProgress.some((rival, index) =>
    rival.attributes.aerodynamics + rival.attributes.structures + rival.attributes.systems + rival.attributes.report <
    veteranProgress[index].attributes.aerodynamics + veteranProgress[index].attributes.structures +
      veteranProgress[index].attributes.systems + veteranProgress[index].attributes.report
  ));
});

test("annual scopes change competition criteria without resetting aircraft levels", () => {
  const { game } = createHarness();
  const state = game.State.create();
  state.year = 3;
  state.seasonScope = game.Content.seasonScopeForYear(3).id;
  state.attributes.report = 72;
  const event = game.Competition.create(addAircraftSnapshot(state)).event;
  const player = event.standings.find((team) => team.isPlayer);
  assert.equal(event.scope.id, "technical-report");
  assert.equal(player.report, game.Aircraft.reportScore(72, 1.1));

  const oldEvent = game.Competition.create(addAircraftSnapshot(game.State.create())).event;
  delete oldEvent.scope;
  const versionThree = {
    ...game.State.create(),
    version: 3,
    year: 2,
    week: 20,
    phase: "event-report",
    event: oldEvent
  };
  const migrated = game.State.migrate(versionThree);
  assert.equal(migrated.event.scope.id, "payload");
  assert.equal(game.State.validate(migrated), true);
});

test("skill tree enforces concept choices, prerequisites, costs, and persistent effects", () => {
  const { game, storage } = createHarness();
  let state = game.State.create();
  state.cash = 5000;
  state.attributes = { aerodynamics: 50, structures: 50, systems: 50, report: 50 };
  const originalDesign = game.Aircraft.derive(state.attributes);
  const conceptResearch = game.Game.apply(state, { type: "research-skill", id: "concept-lift" });
  state = conceptResearch.state;
  assert.equal(state.week, 2);
  assert.equal(state.cash, 4580);
  assert.deepEqual(JSON.parse(JSON.stringify(state.skills)), ["concept-lift"]);
  const liftDesign = game.Aircraft.derive(state.attributes, state.skills);
  assert(liftDesign.payload > originalDesign.payload);
  assert(liftDesign.reliability < originalDesign.reliability);
  assert.equal(game.State.validate(state), true);

  const conflictingConcept = game.Game.apply(state, { type: "research-skill", id: "concept-stable" });
  assert.equal(conflictingConcept.state, state);
  assert.equal(conflictingConcept.notice.kind, "warning");
  const lockedResearch = game.Game.apply(state, { type: "research-skill", id: "advanced-manufacturing" });
  assert.equal(lockedResearch.state, state);
  assert.equal(game.State.validate({ ...state, skills: ["advanced-manufacturing"] }), false);
  assert.equal(game.State.validate({ ...state, skills: ["concept-lift", "concept-stable"] }), false);

  state = apply(game, state, "research-skill", { id: "team-coordination" });
  assert.equal(state.week, 3);
  assert.equal(state.cash, 4280);
  const discountedCost = game.Aircraft.researchCost(
    game.Content.skillNodes.find((node) => node.id === "design-method"),
    state.skills
  );
  assert.equal(discountedCost, 425);
  state = apply(game, state, "research-skill", { id: "design-method" });
  assert(state.skills.includes("design-method"));
  const attribute = game.Content.attributes.find((entry) => entry.key === "aerodynamics");
  assert(game.Aircraft.upgradeGain(attribute, state.attributes.aerodynamics, state.skills) >
    game.Aircraft.upgradeGain(attribute, state.attributes.aerodynamics));

  assert.equal(game.Storage.save(state).ok, true);
  const restored = game.Storage.load();
  assert.equal(restored.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.state.skills)), JSON.parse(JSON.stringify(state.skills)));
  assert.equal(storage.has(game.Content.saveKey), true);

  const nextSeason = { ...state, phase: "results" };
  const preservedSkills = apply(game, nextSeason, "next-season");
  assert.deepEqual(
    JSON.parse(JSON.stringify(preservedSkills.skills)),
    JSON.parse(JSON.stringify(state.skills.filter((skill) =>
      !game.Content.skillNodes.find((node) => node.id === skill).concept
    )))
  );
});

test("version-four careers migrate without losing in-progress event validity", () => {
  const { game } = createHarness();
  const state = game.State.create();
  for (let week = 0; week < 20; week += 1) state.week += 1;
  state.phase = "event-report";
  state.project.finalAircraft = {
    name: state.aircraftName,
    year: state.year,
    attributes: { ...state.attributes },
    components: {},
    reliabilityBonus: 0
  };
  state.event = game.Competition.create(state).event;
  state.version = 4;
  delete state.skills;
  state.event.standings.forEach((team) => { delete team.skills; });
  const migrated = game.State.migrate(state);
  assert.deepEqual(JSON.parse(JSON.stringify(migrated.skills)), []);
  assert(migrated.event.standings.every((team) => Array.isArray(team.skills)));
  assert.equal(game.State.validate(migrated), true);
});

test("version-seven saves gain a valid aircraft snapshot during an active event", () => {
  const { game } = createHarness();
  const legacy = prepareSeason(game, game.State.create());
  legacy.version = 7;
  delete legacy.aircraftBaseName;
  delete legacy.parts;
  delete legacy.project;

  const migrated = game.State.migrate(legacy);
  assert.equal(migrated.version, game.Content.saveVersion);
  assert.equal(migrated.phase, "event-report");
  assert.equal(migrated.project.finalAircraft.name, legacy.aircraftName);
  assert.equal(migrated.project.finalAircraft.attributes.aerodynamics,
    legacy.event.standings.find((team) => team.isPlayer).attributes.aerodynamics);
  assert.equal(game.State.validate(migrated), true);
});

test("career UI keeps cash visible and presents the aircraft flight circuit", () => {
  const { game, elements } = createHarness();
  let state = game.State.create({ aircraftName: "Ventania" });
  game.UI.render(state, "overview", { text: "", kind: "" });
  assert.equal(elements.get("careerCashLabel").textContent, "1.000 cr");
  assert.match(elements.get("scopeTitle").textContent, /Ano 1/);
  assert.match(elements.get("skillTreeSummary").textContent, /Ainda não definido/);
  assert.match(elements.get("skillTree").innerHTML, /Conceito · Carga máxima/);

  state = prepareSeason(game, state);
  state = apply(game, state, "reveal-reports");
  game.UI.render(state, "championship", { text: "", kind: "" });
  assert.match(elements.get("eventView").innerHTML, /Pista 2D · Ventania/);
  assert.match(elements.get("eventView").innerHTML, /id="flightPlane"/);
  assert.doesNotMatch(elements.get("eventView").innerHTML, /animateMotion/);
});

test("aircraft overview plots all four attributes on a labeled radar chart", () => {
  const { game, elements } = createHarness();
  const state = game.State.create();
  state.project.prototypeBuilt = true;
  state.attributes = { aerodynamics: 12, structures: 34, systems: 56, report: 78 };
  game.UI.render(state, "overview", { text: "", kind: "" });

  assert.equal(elements.get("aircraftPending").hidden, true);
  assert.equal(elements.get("aircraftStats").hidden, false);
  assert.equal(elements.get("aircraftDetails").hidden, false);
  const chart = elements.get("aircraftStats").innerHTML;
  assert.match(chart, /<svg class="aircraft-radar"[^>]+role="img"/);
  assert.match(chart, /points="130\.0,91\.8 153\.1,100\.0 130\.0,138\.1 77\.0,100\.0"/);
  for (const [label, value] of [
    ["Aerodinâmica", 12],
    ["Estruturas", 34],
    ["Sistemas", 56],
    ["Relatório", 78]
  ]) {
    assert.match(chart, new RegExp(`<span class="aircraft-radar-key"[^>]+></span><span>${label}</span><strong>${value}</strong>`));
  }
  assert.doesNotMatch(chart, /mini-track|aircraft-stat/);
});

test("aircraft overview hides flight indicators until a prototype is built", () => {
  const { game, elements } = createHarness();
  const state = game.State.create();

  game.UI.render(state, "overview", { text: "", kind: "" });

  assert.equal(elements.get("aircraftSummary").textContent, "Projeto em desenvolvimento · nenhuma aeronave montada");
  assert.equal(elements.get("aircraftPending").hidden, false);
  assert.match(elements.get("aircraftPending").textContent, /Construa o protótipo/);
  assert.equal(elements.get("aircraftStats").hidden, true);
  assert.equal(elements.get("aircraftDetails").hidden, true);

  state.project.prototypeBuilt = true;
  game.UI.render(state, "overview", { text: "", kind: "" });

  assert.equal(elements.get("aircraftPending").hidden, true);
  assert.equal(elements.get("aircraftStats").hidden, false);
  assert.equal(elements.get("aircraftDetails").hidden, false);
  assert.match(elements.get("aircraftStats").innerHTML, /aircraft-radar/);
  assert.match(elements.get("derivedStats").innerHTML, /Peso vazio/);
});

test("rival strategies reflect team philosophy and flight choices trade reliability for score", () => {
  const { game } = createHarness();
  const design = { aerodynamics: 50, structures: 60, systems: 55, report: 20 };
  const weather = game.Content.weather.find((option) => option.id === "clear");
  const aggressiveProfile = {
    weights: { aerodynamics: 0.43, structures: 0.14, systems: 0.12, report: 0.16, funding: 0.15 }
  };
  const safetyProfile = {
    weights: { aerodynamics: 0.13, structures: 0.38, systems: 0.22, report: 0.17, funding: 0.10 }
  };
  assert.equal(game.Rivals.flightStrategy(aggressiveProfile, weather), "aggressive");
  assert.equal(game.Rivals.flightStrategy(safetyProfile, weather), "conservative");

  function simulate(strategyId, seed, trials) {
    let crashCount = 0;
    let totalScore = 0;
    for (let index = 0; index < trials; index += 1) {
      const event = {
        round: 0,
        weather: [weather],
        commentary: [],
        standings: [{
          name: "Projeto Aurora",
          isPlayer: true,
          attributes: design,
          report: 50,
          flights: [],
          total: 50
        }]
      };
      const result = game.Competition.runFlight(event, strategyId, seed);
      seed = result.seed;
      const flight = result.event.standings[0].flights[0];
      if (flight.crashed) crashCount += 1;
      totalScore += flight.score;
    }
    return { crashRate: crashCount / trials, averageScore: totalScore / trials };
  }

  const safe = simulate("conservative", 892341, 1200);
  const aggressive = simulate("aggressive", 892341, 1200);
  assert(aggressive.crashRate > safe.crashRate);
  assert(aggressive.averageScore > safe.averageScore);
});

test("renderer presents rivalry, weather, the live battery decision, and accessibility state", () => {
  const { game, elements, navButtons, screenPanels } = createHarness();
  let state = game.State.create();
  state.rngState = 24680;
  state.history = [{
    year: 1,
    position: 2,
    score: 171,
    winner: state.rivals[1].name,
    standings: [
      { name: state.rivals[1].name, position: 1, score: 180 },
      { name: "Projeto Aurora", position: 2, score: 171 }
    ]
  }];
  game.UI.render(state, "overview", { text: "", kind: "" });
  assert.match(elements.get("rivalryScore").innerHTML, /Campeã defensora/);
  assert.equal(elements.get("careerTrack").style.transform, "translateX(0%)");
  assert.equal(elements.get("careerPosition").textContent, "01 / 06");
  assert.equal(navButtons[0].attributes["aria-current"], "page");
  assert.equal(navButtons[6].hidden, true);
  assert.equal(screenPanels[6].hidden, true);
  assert.equal(screenPanels[0].inert, false);
  assert.equal(screenPanels[1].inert, true);

  game.UI.render(state, "engineering", { text: "", kind: "" });
  assert.equal(elements.get("careerTrack").style.transform, "translateX(-16.666666666666668%)");
  assert.equal(elements.get("careerPosition").textContent, "02 / 06");
  assert.equal(navButtons[0].attributes["aria-current"], undefined);
  assert.equal(navButtons[1].attributes["aria-current"], "page");
  assert.equal(screenPanels[0].inert, true);
  assert.equal(screenPanels[1].inert, false);

  state = prepareSeason(game, state);
  game.UI.render(state, "championship", { text: "", kind: "" });
  assert.equal(navButtons[6].hidden, false);
  assert.equal(screenPanels[6].hidden, false);
  assert.equal(elements.get("careerPosition").textContent, "07 / 07");
  assert.match(elements.get("eventView").innerHTML, /Revelar notas do relatório/);
  assert.match(elements.get("eventView").innerHTML, /Bateria 1/);
  assert.equal(elements.get("championshipPreparation").hidden, true);
  assert.equal(elements.get("eventView").hidden, false);

  state = apply(game, state, "reveal-reports");
  game.UI.render(state, "championship", { text: "", kind: "" });
  assert.match(elements.get("eventView").innerHTML, /id="flightPlane"/);
  assert.doesNotMatch(elements.get("eventView").innerHTML, /animateMotion/);
  const flightHtml = elements.get("eventView").innerHTML;
  assert(flightHtml.indexOf('class="event-stages"') < flightHtml.indexOf('class="flight-circuit"'));
  assert(flightHtml.indexOf('class="flight-circuit"') < flightHtml.indexOf("flight-launch-actions"));
  assert.match(elements.get("eventView").innerHTML, /Classificação parcial/);
  assert.match(elements.get("eventView").innerHTML, /data-action="choose-strategy"/);
  assert.match(elements.get("eventView").innerHTML, /aria-pressed=/);
});

test("annual goals award institutional reputation and preserve rival development across seasons", () => {
  const { game } = createHarness();
  let state = game.State.create();
  state.attributes = { aerodynamics: 100, structures: 100, systems: 100, report: 100 };
  state = prepareSeason(game, state);
  state = apply(game, state, "reveal-reports");
  while (state.phase === "event-flight") state = apply(game, state, "run-flight");

  const player = state.event.standings.find((team) => team.isPlayer);
  const baseReward = game.Content.placementReputation[player.position - 1];
  assert.equal(state.annualGoals.result.technicalMet, true);
  assert.equal(state.annualGoals.result.placementMet, player.position <= 4);
  assert.equal(
    state.reputation,
    Math.min(100, baseReward + 4 + (player.position <= 4 ? 4 : 0))
  );
  assert.equal(state.history[0].reputation, state.reputation);
  assert.equal(game.State.validate(state), true);

  const seasonRivals = JSON.parse(JSON.stringify(state.rivals.map(({ attributes, cash }) => ({ attributes, cash }))));
  state = apply(game, state, "next-season");
  assert.equal(state.year, 2);
  assert.deepEqual(
    JSON.parse(JSON.stringify(state.rivals.map(({ attributes, cash }) => ({ attributes, cash })))),
    seasonRivals
  );
  assert.equal(state.annualGoals.placement.targetPosition, 4);
  assert.equal(game.State.validate(state), true);
  assert.deepEqual(
    Array.from({ length: 5 }, (_, index) =>
      game.Content.seasonGoalsForYear(index + 1, game.Content.baseStats).placement.targetPosition
    ),
    [4, 4, 3, 2, 1]
  );
});

test("reputation unlocks fundraisers and scouting produces tactical intel without advancing the week", () => {
  const { game } = createHarness();
  let state = game.State.create();
  const blocked = game.Game.apply(state, { type: "fundraise", id: "science-fair" });
  assert.equal(blocked.state, state);
  assert.equal(blocked.state.week, 0);

  state.reputation = 15;
  const fundraiser = game.Game.apply(state, { type: "fundraise", id: "science-fair" });
  assert.equal(fundraiser.state.week, 1);
  assert.equal(fundraiser.state.cash, state.cash + 650);

  state = game.State.create();
  const rivalsBefore = JSON.parse(JSON.stringify(state.rivals));
  const seedBefore = state.rngState;
  const scouting = game.Game.apply(state, { type: "scout", index: 2 });
  assert.equal(scouting.state.week, 0);
  assert.equal(scouting.state.cash, state.cash - game.Content.scoutingCost);
  assert.equal(scouting.state.rngState, seedBefore);
  assert.deepEqual(JSON.parse(JSON.stringify(scouting.state.rivals)), rivalsBefore);
  assert.equal(scouting.state.scouted[2].year, state.year);
  assert.equal(scouting.state.scouted[2].week, 0);
  assert.equal(typeof scouting.state.scouted[2].strength, "string");
  assert.equal(typeof scouting.state.scouted[2].vulnerability, "string");
  assert.equal(scouting.state.scouted[2].weatherStrategies.length, 3);
  assert.equal(game.State.validate(scouting.state), true);

  const repeated = game.Game.apply(scouting.state, { type: "scout", index: 2 });
  assert.equal(repeated.state, scouting.state);
  const poor = { ...state, cash: game.Content.scoutingCost - 1 };
  const unaffordable = game.Game.apply(poor, { type: "scout", index: 0 });
  assert.equal(unaffordable.state, poor);
  assert.equal(unaffordable.state.week, 0);
});

test("weekly turns publish rival activity and migrate version-five careers", () => {
  const { game } = createHarness();
  let state = game.State.create();
  state = apply(game, state, "advance-week");
  assert.equal(state.rivalNews.week, 1);
  assert.equal(state.rivalNews.activities.length, 4);
  assert.match(state.log[0].text, /Rivais:/);
  state.rivalNews.activities.forEach((activity) => {
    const rival = state.rivals.find((entry) => entry.name === activity.name);
    assert.equal(rival.lastAction.text, activity.text);
  });
  assert.equal(game.State.validate(state), true);

  const legacy = { ...game.State.create(), version: 5, year: 3, cash: 825 };
  delete legacy.reputation;
  delete legacy.annualGoals;
  delete legacy.rivalNews;
  legacy.scouted = { 1: { aerodynamics: 40, structures: 50, systems: 30, report: 20 } };
  legacy.rivals.forEach((rival) => { delete rival.lastAction; });
  const migrated = game.State.migrate(legacy);
  assert.equal(migrated.version, game.Content.saveVersion);
  assert.equal(migrated.year, 3);
  assert.equal(migrated.cash, 825);
  assert.equal(migrated.reputation, 0);
  assert.equal(migrated.annualGoals.year, 3);
  assert.equal(migrated.scouted[1].legacy, true);
  assert.equal(game.State.validate(migrated), true);
});

test("career panels show goals, reputation unlocks, weekly rival news, and actionable scouting", () => {
  const { game, elements } = createHarness();
  let state = game.State.create();
  state = apply(game, state, "advance-week");
  game.UI.render(state, "overview", { text: "", kind: "" });

  assert.equal(elements.get("careerReputationLabel").textContent, "Reputação 0");
  assert.match(elements.get("campaignGoals").innerHTML, /Campanha principal · Ano 1 de 5/);
  assert.match(elements.get("campaignGoals").innerHTML, /Meta: 4º lugar ou melhor/);
  assert.match(elements.get("fundraisingList").innerHTML, /Desbloqueia com 15 de reputação/);
  assert.match(elements.get("fundraisingList").innerHTML, /data-fundraiser="science-fair" disabled/);
  assert.match(elements.get("rivalList").innerHTML, /BOT ATIVO/);
  assert.match(elements.get("rivalList").innerHTML, /investiu em|buscou recursos/);

  state = apply(game, state, "scout", { index: 0 });
  game.UI.render(state, "rivals", { text: "", kind: "" });
  assert.match(elements.get("scoutingList").innerHTML, /Força/);
  assert.match(elements.get("scoutingList").innerHTML, /Fragilidade/);
  assert.match(elements.get("scoutingList").innerHTML, /Regulamento/);
  assert.match(elements.get("scoutingList").innerHTML, /Tendências aproximadas/);
  assert.match(elements.get("scoutingList").innerHTML, /Analisar · 150 cr/);
});

test("the founding trio delegates background work and recruits without spending a week", () => {
  const { game } = createHarness();
  let state = game.State.create();
  assert.equal(state.team.members.length, 3);
  assert.equal(state.team.members.filter((member) => member.role === "founder-captain").length, 2);
  assert.equal(state.team.members.find((member) => member.id === "president").leaveYear, null);
  assert.equal(game.State.validate(state), true);

  const initialCash = state.cash;
  const initialAero = state.attributes.aerodynamics;
  const recruitment = game.Game.apply(state, {
    type: "recruit-member",
    candidateId: "candidate-1-aerodynamics"
  });
  state = recruitment.state;
  assert.equal(state.week, 0);
  assert.equal(state.cash, initialCash - 320);
  assert.equal(state.team.members.length, 4);
  const member = state.team.members.find((entry) => entry.specialty === "aerodynamics" && entry.role === "member");

  state = apply(game, state, "assign-member", {
    memberId: member.id,
    assignment: "fundraising"
  });
  assert.equal(state.week, 0);
  const cashBeforeTurn = state.cash;
  state = apply(game, state, "advance-week");
  assert.equal(state.week, 1);
  assert(state.cash > cashBeforeTurn);
  assert(state.attributes.aerodynamics > initialAero);
  assert(state.team.members.find((entry) => entry.id === member.id).experience > member.experience);
  assert(state.team.weekReport.contributions.some((entry) => entry.text.includes("captação")));
  assert.equal(game.State.validate(state), true);

  const repeated = game.Game.apply(state, {
    type: "assign-member",
    memberId: member.id,
    assignment: "fundraising"
  });
  assert.equal(repeated.state, state);
});

test("captain succession replaces founders in year three and rotates captains annually", () => {
  const { game } = createHarness();
  const finishSeason = (start) => {
    let state = start;
    state = prepareSeason(game, state);
    state = apply(game, state, "reveal-reports");
    while (state.phase === "event-flight") state = apply(game, state, "run-flight");
    return state;
  };
  let state = game.State.create();
  state = game.Game.apply(state, {
    type: "recruit-member",
    candidateId: "candidate-1-aerodynamics"
  }).state;
  state = game.Game.apply(state, {
    type: "recruit-member",
    candidateId: "candidate-1-structures"
  }).state;
  state = finishSeason(state);
  state = apply(game, state, "next-season");
  assert(state.team.members.some((member) => member.role === "founder-captain"));

  const aeroSuccessor = state.team.members.find((member) => member.role === "member" && member.specialty === "aerodynamics");
  const structureSuccessor = state.team.members.find((member) => member.role === "member" && member.specialty === "structures");
  state = apply(game, state, "nominate-captain", { area: "aerodynamics", memberId: aeroSuccessor.id });
  state = apply(game, state, "nominate-captain", { area: "structures", memberId: structureSuccessor.id });
  assert.equal(state.week, 0);
  state = finishSeason(state);
  state.reputation = 60;
  state = apply(game, state, "next-season");

  assert.equal(state.year, 3);
  assert.equal(state.team.members.some((member) => member.role === "founder-captain"), false);
  assert.equal(state.team.members.filter((member) => member.role === "captain").length, 2);
  assert.equal(state.team.members.find((member) => member.captainArea === "aerodynamics").id, aeroSuccessor.id);
  assert.equal(state.team.members.find((member) => member.captainArea === "structures").id, structureSuccessor.id);
  assert(state.team.members.filter((member) => member.role === "captain").every((member) => member.leaveYear === 4));

  state.cash = 5000;
  state = game.Game.apply(state, {
    type: "recruit-member",
    candidateId: "candidate-3-aerodynamics"
  }).state;
  state = game.Game.apply(state, {
    type: "recruit-member",
    candidateId: "candidate-3-structures"
  }).state;
  const nextAeroCaptain = state.team.members.find((member) =>
    member.role === "member" && member.specialty === "aerodynamics" && member.joinYear === 3
  );
  const nextStructureCaptain = state.team.members.find((member) =>
    member.role === "member" && member.specialty === "structures" && member.joinYear === 3
  );
  state = apply(game, state, "nominate-captain", { area: "aerodynamics", memberId: nextAeroCaptain.id });
  state = apply(game, state, "nominate-captain", { area: "structures", memberId: nextStructureCaptain.id });
  state = finishSeason(state);
  state = apply(game, state, "next-season");

  assert.equal(state.year, 4);
  assert.equal(state.team.members.some((member) => member.id === aeroSuccessor.id), false);
  assert.equal(state.team.members.some((member) => member.id === structureSuccessor.id), false);
  assert.equal(state.team.members.find((member) => member.captainArea === "aerodynamics").id, nextAeroCaptain.id);
  assert.equal(state.team.members.find((member) => member.captainArea === "structures").id, nextStructureCaptain.id);
  assert.equal(game.State.validate(state), true);
});

test("version-six careers migrate team continuity and the new team screen presents management options", () => {
  const { game, elements } = createHarness();
  const legacy = { ...game.State.create(), version: 6, year: 4 };
  delete legacy.team;
  const migrated = game.State.migrate(legacy);
  assert.equal(migrated.version, game.Content.saveVersion);
  assert(migrated.team.members.some((member) => member.role === "captain"));
  assert.equal(game.State.validate(migrated), true);

  const state = game.State.create();
  game.UI.render(state, "team", { text: "", kind: "" });
  assert.equal(elements.get("careerPosition").textContent, "06 / 06");
  assert.match(elements.get("teamSummary").innerHTML, /3\/5 integrantes/);
  assert.match(elements.get("teamRoster").innerHTML, /CAPITÃO FUNDADOR/);
  assert.match(elements.get("teamRoster").innerHTML, /data-member-assignment=/);
  assert.match(elements.get("teamSuccession").innerHTML, /No Ano 2, indique integrantes/);
  assert.match(elements.get("teamCandidates").innerHTML, /Integrante · Aerodinâmica/);
  assert.match(elements.get("teamCandidates").innerHTML, /REPUTAÇÃO 10/);
});
