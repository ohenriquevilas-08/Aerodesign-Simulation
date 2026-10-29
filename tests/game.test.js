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
  const screens = ["overview", "engineering", "skills", "fundraising", "rivals", "championship"];
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

test("full season persists between report and flight stages and records a championship", () => {
  const { game, storage } = createHarness();
  let state = game.State.create();
  state.attributes = { aerodynamics: 67, structures: 61, systems: 54, report: 48 };
  state.rngState = 123456789;
  assert.equal(game.State.validate(state), true);

  for (let week = 0; week < 20; week += 1) {
    state = apply(game, state, "advance-week");
  }
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
  assert(state.cash >= 1000 + prize);
  assert.equal(storage.has(game.Content.saveKey), true);

  state = apply(game, state, "next-season");
  assert.equal(state.year, 2);
  assert.equal(state.week, 0);
  assert.equal(state.phase, "preparation");
  assert.equal(state.event, null);
  assert.equal(state.history.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(state.attributes)), {
    aerodynamics: 67, structures: 61, systems: 54, report: 48
  });
  assert.equal(state.seasonScope, "reliability");
});

test("mission rules reject invalid transitions and migrate existing version-one saves", () => {
  const { game } = createHarness();
  const current = game.State.create();
  const lateSeason = { ...current, week: 19 };
  const rejected = game.Game.apply(lateSeason, { type: "fundraise", id: "sponsorship" });
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
  assert.equal(game.Competition.create(state).event.standings[0].name, "Asa Verde");

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
  const event = game.Competition.create(state).event;
  const player = event.standings.find((team) => team.isPlayer);
  assert.equal(event.scope.id, "technical-report");
  assert.equal(player.report, game.Aircraft.reportScore(72, 1.1));

  const oldEvent = game.Competition.create(game.State.create()).event;
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
  assert.deepEqual(JSON.parse(JSON.stringify(preservedSkills.skills)), JSON.parse(JSON.stringify(state.skills)));
});

test("version-four careers migrate without losing in-progress event validity", () => {
  const { game } = createHarness();
  const state = game.State.create();
  for (let week = 0; week < 20; week += 1) state.week += 1;
  state.phase = "event-report";
  state.event = game.Competition.create(state).event;
  state.version = 4;
  delete state.skills;
  state.event.standings.forEach((team) => { delete team.skills; });
  const migrated = game.State.migrate(state);
  assert.deepEqual(JSON.parse(JSON.stringify(migrated.skills)), []);
  assert(migrated.event.standings.every((team) => Array.isArray(team.skills)));
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

  for (let week = 0; week < 20; week += 1) state = apply(game, state, "advance-week");
  state = apply(game, state, "reveal-reports");
  game.UI.render(state, "championship", { text: "", kind: "" });
  assert.match(elements.get("eventView").innerHTML, /Pista 2D · Ventania/);
  assert.match(elements.get("eventView").innerHTML, /id="flightPlane"/);
  assert.doesNotMatch(elements.get("eventView").innerHTML, /animateMotion/);
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
  assert.equal(elements.get("careerPosition").textContent, "01 / 05");
  assert.equal(navButtons[0].attributes["aria-current"], "page");
  assert.equal(navButtons[5].hidden, true);
  assert.equal(screenPanels[5].hidden, true);
  assert.equal(screenPanels[0].inert, false);
  assert.equal(screenPanels[1].inert, true);

  game.UI.render(state, "engineering", { text: "", kind: "" });
  assert.equal(elements.get("careerTrack").style.transform, "translateX(-20%)");
  assert.equal(elements.get("careerPosition").textContent, "02 / 05");
  assert.equal(navButtons[0].attributes["aria-current"], undefined);
  assert.equal(navButtons[1].attributes["aria-current"], "page");
  assert.equal(screenPanels[0].inert, true);
  assert.equal(screenPanels[1].inert, false);

  for (let week = 0; week < 20; week += 1) state = apply(game, state, "advance-week");
  game.UI.render(state, "championship", { text: "", kind: "" });
  assert.equal(navButtons[5].hidden, false);
  assert.equal(screenPanels[5].hidden, false);
  assert.equal(elements.get("careerPosition").textContent, "06 / 06");
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
