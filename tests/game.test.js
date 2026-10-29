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
  const tabs = ["engineering", "fundraising", "scouting"].map((tab) => ({
    dataset: { tab },
    setAttribute() {},
    getAttribute() { return "false"; },
    focus() {}
  }));
  const panes = ["engineering", "fundraising", "scouting"].map((tab) => ({ id: `pane-${tab}` }));
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
      return selector === ".tab" ? tabs : selector === ".tab-pane" ? panes : [];
    },
    querySelector() { return createElement(); }
  };
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); }
  };
  const context = vm.createContext({ document, localStorage, console });
  for (const file of sourceFiles) {
    vm.runInContext(readFileSync(path.join(root, "src", file), "utf8"), context, { filename: file });
  }
  return { game: context.AeroDesign, elements, storage };
}

function apply(game, state, type, details = {}) {
  const transition = game.Game.apply(state, { type, ...details });
  return transition.state;
}

test("full season persists between report and flight stages and records a championship", () => {
  const { game, storage } = createHarness();
  let state = game.State.create();
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
  const { game, elements } = createHarness();
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
  game.UI.render(state, "engineering", { text: "", kind: "" });
  assert.match(elements.get("rivalryScore").innerHTML, /Campeã defensora/);

  for (let week = 0; week < 20; week += 1) state = apply(game, state, "advance-week");
  game.UI.render(state, "engineering", { text: "", kind: "" });
  assert.match(elements.get("eventView").innerHTML, /Revelar notas do relatório/);
  assert.match(elements.get("eventView").innerHTML, /Bateria 1/);

  state = apply(game, state, "reveal-reports");
  game.UI.render(state, "engineering", { text: "", kind: "" });
  assert.match(elements.get("eventView").innerHTML, /Classificação parcial/);
  assert.match(elements.get("eventView").innerHTML, /data-action="choose-strategy"/);
  assert.match(elements.get("eventView").innerHTML, /aria-pressed=/);
});
