(() => {
  const game = globalThis.AeroDesign;
  let state = game.State.create();
  let activeTab = "engineering";
  let notice = { text: "", kind: "" };
  let screen = "home";
  let hubNotice = { text: "", kind: "" };

  function render() {
    const inGame = screen === "game";
    document.getElementById("hubView").hidden = inGame;
    document.getElementById("gameApp").hidden = !inGame;
    document.getElementById("homeMenu").hidden = screen !== "home";
    document.getElementById("newGameMenu").hidden = screen !== "setup";
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
      document.getElementById("replaceSaveLabel").hidden = screen !== "setup" || !saveExists;
      if (screen === "setup") {
        const difficulty = game.Content.difficulties[document.getElementById("difficultyInput").value];
        document.getElementById("difficultyHelp").textContent = difficulty?.description || "";
      }
      if (screen === "home" && !canContinue && saveExists && !hubNotice.text) {
        hubStatus.textContent = saved.message;
        hubStatus.dataset.kind = "error";
      }
      return;
    }

    game.UI.render(state, activeTab, notice);
  }

  function apply(action) {
    const previousState = state;
    const transition = game.Game.apply(state, action);
    state = transition.state;
    notice = transition.notice;
    if (state !== previousState && notice.kind !== "error" && notice.kind !== "warning") {
      const saved = game.Storage.save(state);
      if (!saved.ok) notice = { text: `Ação concluída, mas não foi possível salvar automaticamente: ${saved.message}`, kind: "error" };
    }
    render();
  }

  function handleClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.tab) {
      activeTab = button.dataset.tab;
      render();
      return;
    }

    switch (button.dataset.action) {
      case "new-game":
        screen = "setup";
        hubNotice = { text: "", kind: "" };
        document.getElementById("replaceSaveInput").checked = false;
        render();
        return;
      case "home":
        if (screen === "game") {
          const saved = game.Storage.save(state);
          hubNotice = saved.ok
            ? { text: "", kind: "" }
            : { text: `Não foi possível salvar a carreira: ${saved.message}`, kind: "error" };
        }
        screen = "home";
        render();
        return;
      case "continue": {
        const loaded = game.Storage.load();
        if (loaded.ok) {
          state = loaded.state;
          activeTab = "engineering";
          notice = { text: "Carreira retomada.", kind: "success" };
          screen = "game";
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
        const loaded = game.Storage.load();
        if (loaded.ok) {
          state = loaded.state;
          activeTab = "engineering";
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
      case "run-flight": return apply({ type: "run-flight" });
      case "next-season": return apply({ type: "next-season" });
      default: return;
    }
  }

  function handleNewGame(event) {
    event.preventDefault();
    const teamName = document.getElementById("teamNameInput").value.trim();
    const aircraftName = document.getElementById("aircraftNameInput").value.trim();
    const difficulty = document.getElementById("difficultyInput").value;
    if (!teamName || !aircraftName) {
      hubNotice = { text: "Informe o nome da equipe e do avião.", kind: "error" };
      render();
      return;
    }

    const saved = game.Storage.load();
    if (!saved.missing && !document.getElementById("replaceSaveInput").checked) {
      hubNotice = { text: "Marque a confirmação para substituir o jogo salvo antes de iniciar.", kind: "error" };
      render();
      return;
    }

    state = game.State.create({ teamName, aircraftName, difficulty });
    activeTab = "engineering";
    screen = "game";
    notice = { text: `Carreira iniciada · dificuldade ${game.Content.difficulties[state.difficulty].label}.`, kind: "success" };
    const result = game.Storage.save(state);
    if (!result.ok) notice = { text: `Carreira iniciada, mas não foi possível salvar: ${result.message}`, kind: "error" };
    hubNotice = { text: "", kind: "" };
    render();
  }

  function handleKeydown(event) {
    if (screen !== "game" || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const tabs = [...document.querySelectorAll(".tab")];
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(currentIndex + offset + tabs.length) % tabs.length];
    next.focus();
    activeTab = next.dataset.tab;
    render();
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);
  document.getElementById("newGameForm").addEventListener("submit", handleNewGame);
  document.getElementById("difficultyInput").addEventListener("change", render);
  render();
})();
