(() => {
  const game = globalThis.AeroDesign ||= {};
  const { saveKey } = game.Content;

  game.Storage = Object.freeze({
    save(state) {
      try {
        globalThis.localStorage.setItem(saveKey, JSON.stringify(state));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error.message };
      }
    },
    load() {
      try {
        const saved = globalThis.localStorage.getItem(saveKey);
        if (!saved) return { ok: false, missing: true, message: "Nenhum jogo salvo foi encontrado neste navegador." };
        const state = game.State.migrate(JSON.parse(saved));
        if (!game.State.validate(state)) {
          return { ok: false, message: "O jogo salvo não corresponde a um estado válido ou a uma versão compatível." };
        }
        return { ok: true, state };
      } catch (error) {
        return { ok: false, message: `Falha ao carregar o jogo: ${error.message}` };
      }
    }
  });
})();
