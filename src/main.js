(() => {
  const game = globalThis.AeroDesign;
  let state = game.State.create();
  let careerScreen = "overview";
  let notice = { text: "", kind: "" };
  let appView = "home";
  let hubNotice = { text: "", kind: "" };
  const careerScreens = ["overview", "engineering", "fundraising", "rivals", "championship"];
  let swipeStart = null;
  let flightLaunching = false;

  function render() {
    const inGame = appView === "game";
    document.getElementById("hubView").hidden = inGame;
    document.getElementById("gameApp").hidden = !inGame;
    document.getElementById("homeMenu").hidden = appView !== "home";
    document.getElementById("newGameMenu").hidden = appView !== "setup";
    const hubStatus = document.getElementById("hubStatus");
    hubStatus.textContent = hubNotice.text;
    hubStatus.dataset.kind = hubNotice.kind;

    if (!inGame) {
      const saved = game.Storage.load();
      const canContinue = saved.ok;
      const saveExists = !saved.missing;
      document.getElementById("continueButton").disabled = !canContinue;
      document.getElementById("savedGameSummary").textContent = canContinue
        ? `${saved.state.teamName} · Ano ${saved.state.year}, semana ${saved.state.week}/20 · ${game.Content.difficulties[saved.state.difficulty].label}`
        : saveExists
          ? saved.message
          : "Nenhuma carreira salva neste navegador. Comece uma nova temporada.";
      if (appView === "setup") {
        const difficulty = game.Content.difficulties[document.getElementById("difficultyInput").value];
        document.getElementById("difficultyHelp").textContent = difficulty?.description || "";
      }
      if (appView === "home" && !canContinue && saveExists && !hubNotice.text) {
        hubStatus.textContent = saved.message;
        hubStatus.dataset.kind = "error";
      }
      return;
    }

    game.UI.render(state, careerScreen, notice);
  }

  function navigateCareer(offset) {
    const nextIndex = Math.max(0, Math.min(careerScreens.length - 1, careerScreens.indexOf(careerScreen) + offset));
    if (careerScreens[nextIndex] === careerScreen) return;
    careerScreen = careerScreens[nextIndex];
    render();
  }

  function apply(action) {
    const previousState = state;
    const transition = game.Game.apply(state, action);
    state = transition.state;
    notice = transition.notice;
    if (previousState.phase === "preparation" && state.phase !== "preparation") careerScreen = "championship";
    else if (previousState.phase === "results" && state.year > previousState.year) careerScreen = "overview";
    if (state !== previousState && notice.kind !== "error" && notice.kind !== "warning") {
      const saved = game.Storage.save(state);
      if (!saved.ok) notice = { text: `Ação concluída, mas não foi possível salvar automaticamente: ${saved.message}`, kind: "error" };
    }
    render();
  }

  function handleClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.screen && appView === "game") {
      careerScreen = button.dataset.screen;
      render();
      return;
    }
    if (button.dataset.action === "previous-screen" || button.dataset.action === "next-screen") {
      navigateCareer(button.dataset.action === "next-screen" ? 1 : -1);
      return;
    }

    switch (button.dataset.action) {
      case "new-game":
        appView = "setup";
        hubNotice = { text: "", kind: "" };
        render();
        return;
      case "home":
        if (flightLaunching) return;
        if (appView === "game") {
          const saved = game.Storage.save(state);
          hubNotice = saved.ok
            ? { text: "", kind: "" }
            : { text: `Não foi possível salvar a carreira: ${saved.message}`, kind: "error" };
        }
        appView = "home";
        render();
        return;
      case "continue": {
        if (flightLaunching) return;
        const loaded = game.Storage.load();
        if (loaded.ok) {
          state = loaded.state;
          careerScreen = loaded.state.phase === "preparation" ? "overview" : "championship";
          notice = { text: "Carreira retomada.", kind: "success" };
          appView = "game";
          hubNotice = { text: "", kind: "" };
        } else {
          hubNotice = { text: loaded.message, kind: loaded.missing ? "warning" : "error" };
        }
        render();
        return;
      }
      case "save": {
        const saved = game.Storage.save(state);
        notice = saved.ok
          ? { text: "Jogo salvo neste navegador.", kind: "success" }
          : { text: `Falha ao salvar: ${saved.message}`, kind: "error" };
        render();
        return;
      }
      case "load": {
        if (flightLaunching) return;
        const loaded = game.Storage.load();
        if (loaded.ok) {
          state = loaded.state;
          careerScreen = loaded.state.phase === "preparation" ? "overview" : "championship";
          notice = { text: "Jogo carregado.", kind: "success" };
        } else {
          notice = { text: loaded.message, kind: loaded.missing ? "warning" : "error" };
        }
        render();
        return;
      }
      case "upgrade": return apply({ type: "upgrade", key: button.dataset.attribute });
      case "fundraise": return apply({ type: "fundraise", id: button.dataset.fundraiser });
      case "scout": return apply({ type: "scout", index: Number(button.dataset.rival) });
      case "advance-week": return apply({ type: "advance-week" });
      case "reveal-reports": return apply({ type: "reveal-reports" });
      case "choose-strategy": return apply({
        type: "choose-strategy",
        round: Number(button.dataset.round),
        strategy: button.dataset.strategy
      });
      case "run-flight": return launchFlight(button);
      case "next-season": return apply({ type: "next-season" });
      default: return;
    }
  }

  function handleNewGame(event) {
    if (flightLaunching) return;
    event.preventDefault();
    const teamName = document.getElementById("teamNameInput").value.trim();
    const aircraftName = document.getElementById("aircraftNameInput").value.trim();
    const difficulty = document.getElementById("difficultyInput").value;
    if (!teamName || !aircraftName) {
      hubNotice = { text: "Informe o nome da equipe e do avião.", kind: "error" };
      render();
      return;
    }

    state = game.State.create({ teamName, aircraftName, difficulty });
    careerScreen = "overview";
    appView = "game";
    notice = { text: `Carreira iniciada · dificuldade ${game.Content.difficulties[state.difficulty].label}.`, kind: "success" };
    const result = game.Storage.save(state);
    if (!result.ok) notice = { text: `Carreira iniciada, mas não foi possível salvar: ${result.message}`, kind: "error" };
    hubNotice = { text: "", kind: "" };
    render();
  }

  function launchFlight(button) {
    if (flightLaunching) return;
    const motion = document.getElementById("flightMotion");
    if (!motion || typeof motion.beginElement !== "function") {
      apply({ type: "run-flight" });
      return;
    }

    flightLaunching = true;
    button.disabled = true;
    document.querySelectorAll('[data-action="choose-strategy"]').forEach((option) => { option.disabled = true; });
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 40 : 2500;
    const launchingState = state;
    const launchingRound = state.event.round;
    motion.setAttribute("dur", `${reducedMotion ? 0.01 : 2.4}s`);
    motion.beginElement();
    window.setTimeout(() => {
      if (state !== launchingState || state.phase !== "event-flight" || state.event.round !== launchingRound) {
        flightLaunching = false;
        return;
      }
      flightLaunching = false;
      apply({ type: "run-flight" });
    }, duration);
  }

  function handleKeydown(event) {
    if (appView !== "game" || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    if (event.target.closest("input, select, textarea, [contenteditable='true']")) return;
    event.preventDefault();
    navigateCareer(event.key === "ArrowRight" ? 1 : -1);
  }

  function handlePointerDown(event) {
    if (appView !== "game" || event.button !== 0) return;
    if (event.target.closest("button, input, select, textarea, a, [role='button']")) return;
    swipeStart = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event) {
    if (!swipeStart) return;
    const horizontalDistance = event.clientX - swipeStart.x;
    const verticalDistance = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(horizontalDistance) < 70 || Math.abs(horizontalDistance) < Math.abs(verticalDistance) * 1.35) return;
    navigateCareer(horizontalDistance < 0 ? 1 : -1);
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);
  document.getElementById("careerViewport").addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("pointerup", handlePointerUp);
  document.addEventListener("pointercancel", () => { swipeStart = null; });
  document.getElementById("newGameForm").addEventListener("submit", handleNewGame);
  document.getElementById("difficultyInput").addEventListener("change", render);
  render();
})();
