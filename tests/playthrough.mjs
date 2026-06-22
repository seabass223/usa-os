import fs from "node:fs/promises";

globalThis.localStorage = {
  data: new Map(),
  getItem(key) {
    return this.data.get(key) ?? null;
  },
  setItem(key, value) {
    this.data.set(key, value);
  },
  removeItem(key) {
    this.data.delete(key);
  },
};

globalThis.CustomEvent = class CustomEvent extends Event {
  constructor(type) {
    super(type);
  }
};

const { GameState } = await import("../js/game-state.js");
const progression = JSON.parse(
  await fs.readFile(new URL("../data/progression.json", import.meta.url), "utf8"),
);
const economy = JSON.parse(
  await fs.readFile(new URL("../data/economy.json", import.meta.url), "utf8"),
);
const state = new GameState(progression, economy);

let operations = 0;
const operationLimit = 20000;

while (!state.isComplete && operations < operationLimit) {
  let acted = false;

  for (const node of state.getAvailableNodes()) {
    if (state.canInstall(node)) {
      state.install(node.id);
      acted = true;
      break;
    }
  }
  if (acted) continue;

  for (const category of ["innovation", "infrastructure", "institutions"]) {
    const categoryOwned = state
      .getUnlockedAssets(category)
      .reduce((sum, asset) => sum + (state.assets[asset.id] ?? 0), 0);
    const candidate = state
      .getUnlockedAssets(category)
      .map((asset) => ({ asset, purchase: state.getAssetCost(asset.id, 1) }))
      .filter(
        ({ purchase }) =>
          purchase.cost <= state.progress * (categoryOwned === 0 ? 1 : 0.35),
      )
      .sort((a, b) => a.purchase.cost - b.purchase.cost)[0];
    if (candidate) {
      state.setBuyQuantity(1);
      state.buyAsset(candidate.asset.id);
      acted = true;
    }
  }
  if (acted) continue;

  const policy = state
    .getAvailablePolicies()
    .find((candidate) => candidate.cost <= state.progress * 0.25);
  if (policy) {
    state.buyPolicy(policy.id);
    continue;
  }

  if (state.stats.cyclesPerSecond > 0 || state.stats.deployPerSecond > 0) {
    state.tick(10);
    if (state.cycles > 0 && state.stats.deployPerSecond === 0) state.deploy(10);
  } else {
    state.work(10);
    state.deploy(10);
  }
  operations += 1;
}

if (!state.isComplete) {
  throw new Error(
    `Playthrough exceeded ${operationLimit} operations: ` +
      JSON.stringify({
        installed: state.installed.length,
        era: state.era.id,
        progress: state.progress,
        cyclesPerSecond: state.stats.cyclesPerSecond,
        deployPerSecond: state.stats.deployPerSecond,
        assets: state.assets,
      }),
  );
}
console.log(
  JSON.stringify(
    {
      installed: state.installed.length,
      assets: state.metric("assetsOwned"),
      policies: state.policies.length,
      achievements: state.achievements.length,
      crises: state.crises,
      operations,
      totalProgress: Math.round(state.totalProgress),
    },
    null,
    2,
  ),
);
