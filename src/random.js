(() => {
  const game = globalThis.AeroDesign ||= {};

  game.Random = Object.freeze({
    seed() {
      return Math.floor(Math.random() * 0x100000000) >>> 0;
    },
    next(seed) {
      const nextSeed = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
      return { seed: nextSeed, value: nextSeed / 0x100000000 };
    },
    integer(seed, maxExclusive) {
      const result = this.next(seed);
      return { seed: result.seed, value: Math.floor(result.value * maxExclusive) };
    }
  });
})();
