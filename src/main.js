(() => {
  const game = globalThis.AeroDesign;
  let state = game.State.create();
  let careerScreen = "overview";
  let notice = { text: "", kind: "" };
  let appView = "home";
  let hubNotice = { text: "", kind: "" };
  const careerScreens = ["overview", "engineering", "skills", "fundraising", "rivals", "team", "championship"];
  let swipeStart = null;
  let flightLaunching = false;

  function availableCareerScreens() {
    return state.phase === "preparation"
      ? careerScreens.filter((screen) => screen !== "championship")
      : careerScreens;
  }

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
    const screens = availableCareerScreens();
    const currentIndex = screens.indexOf(careerScreen);
    const nextIndex = Math.max(0, Math.min(screens.length - 1, (currentIndex < 0 ? 0 : currentIndex) + offset));
    if (screens[nextIndex] === careerScreen) return;
    careerScreen = screens[nextIndex];
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
    if (flightLaunching && (button.dataset.screen ||
      ["previous-screen", "next-screen"].includes(button.dataset.action))) return;
    if (button.dataset.screen && appView === "game") {
      if (!availableCareerScreens().includes(button.dataset.screen)) return;
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
      case "research-skill": return apply({ type: "research-skill", id: button.dataset.skill });
      case "build-prototype": return apply({ type: "build-prototype" });
      case "test-prototype": return apply({ type: "test-prototype", key: button.dataset.attribute });
      case "toggle-part-reuse": return apply({ type: "toggle-part-reuse", partId: button.dataset.part });
      case "build-final-aircraft": return apply({ type: "build-final-aircraft" });
      case "test-final-aircraft": return apply({ type: "test-final-aircraft" });
      case "write-report": return apply({ type: "write-report" });
      case "fundraise": return apply({ type: "fundraise", id: button.dataset.fundraiser });
      case "scout": return apply({ type: "scout", index: Number(button.dataset.rival) });
      case "recruit-member": return apply({ type: "recruit-member", candidateId: button.dataset.candidate });
      case "nominate-captain": {
        const area = button.dataset.area;
        const nominee = document.getElementById(`captainNominee-${area}`);
        return apply({ type: "nominate-captain", area, memberId: nominee?.value || "" });
      }
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

  function handleChange(event) {
    const assignment = event.target.closest("select[data-member-assignment]");
    if (assignment) {
      apply({
        type: "assign-member",
        memberId: assignment.dataset.memberAssignment,
        assignment: assignment.value
      });
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
    notice = { text: "", kind: "" };
    const result = game.Storage.save(state);
    if (!result.ok) notice = { text: `Carreira iniciada, mas não foi possível salvar: ${result.message}`, kind: "error" };
    hubNotice = { text: "", kind: "" };
    render();
  }

  function animateFlight(path, plane, duration) {
    const length = path.getTotalLength();
    const start = performance.now();
    return new Promise((resolve) => {
      function frame(now) {
        const progress = Math.min(1, (now - start) / duration);
        const distance = progress * length;
        const point = path.getPointAtLength(distance);
        const nextPoint = path.getPointAtLength(Math.min(length, distance + 1));
        const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * (180 / Math.PI);
        plane.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${angle})`);
        if (progress < 1) window.requestAnimationFrame(frame);
        else resolve();
      }
      window.requestAnimationFrame(frame);
    });
  }

  async function launchFlight(button) {
    if (flightLaunching) return;
    const path = document.getElementById("circuitPath");
    const plane = document.getElementById("flightPlane");
    const circuit = document.querySelector(".flight-circuit");
    if (!path || !plane || typeof path.getTotalLength !== "function" ||
      typeof path.getPointAtLength !== "function" || typeof window.requestAnimationFrame !== "function" ||
      !circuit) {
      apply({ type: "run-flight" });
      return;
    }

    flightLaunching = true;
    button.disabled = true;
    document.querySelectorAll('[data-action="choose-strategy"]').forEach((option) => { option.disabled = true; });
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 1000 : 2500;
    const launchingState = state;
    const launchingRound = state.event.round;
    await animateFlight(path, plane, duration);
    if (state !== launchingState || state.phase !== "event-flight" || state.event.round !== launchingRound) {
      flightLaunching = false;
      return;
    }
    flightLaunching = false;
    apply({ type: "run-flight" });
  }

  function handleKeydown(event) {
    if (appView !== "game" || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    if (event.target.closest("input, select, textarea, [contenteditable='true']")) return;
    event.preventDefault();
    if (flightLaunching) return;
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
  document.addEventListener("change", handleChange);
  document.addEventListener("keydown", handleKeydown);
  document.getElementById("careerViewport").addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("pointerup", handlePointerUp);
  document.addEventListener("pointercancel", () => { swipeStart = null; });
  document.getElementById("newGameForm").addEventListener("submit", handleNewGame);
  document.getElementById("difficultyInput").addEventListener("change", render);
  render();
})();
