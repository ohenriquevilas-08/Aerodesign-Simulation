(() => {
  const game = globalThis.AeroDesign;
  let state = game.State.create();
  let activeTab = "engineering";
  let notice = { text: "", kind: "" };

  function render() {
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

  function handleKeydown(event) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
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
  render();
})();
