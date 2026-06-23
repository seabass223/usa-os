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
  if (state.gameOver) {
    throw new Error(
      `Stability-aware playthrough ended at ${state.installed.length} milestones.`,
    );
  }

  let acted = false;

  for (const node of state.getAvailableNodes()) {
    if (state.canInstall(node)) {
      state.install(node.id);
      acted = true;
      break;
    }
  }
  if (acted) continue;

  if (state.stats.netInstabilityPerSecond > 0) {
    const institution = state
      .getUnlockedAssets("institutions")
      .map((asset) => ({ asset, purchase: state.getAssetCost(asset.id, 1) }))
      .filter(({ purchase }) => purchase.cost <= state.progress)
      .sort(
        (left, right) =>
          right.asset.stabilityPerSecond - left.asset.stabilityPerSecond,
      )[0];
    if (institution) {
      state.setBuyQuantity(1);
      state.buyAsset(institution.asset.id);
      continue;
    }
    state.work(100);
    state.deploy(100);
    operations += 1;
    continue;
  }

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
    const pressure = Math.max(0, state.stats.netInstabilityPerSecond);
    const safeSeconds =
      pressure > 0 ? Math.max(0.1, (95 - state.instability) / pressure) : 10;
    state.tick(Math.min(10, safeSeconds));
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

state.save();
const savedProgress = state.progress;
const savedInstalled = state.installed.length;
const reloadedState = new GameState(progression, economy);
if (!reloadedState.hasSave()) {
  throw new Error("Constructing GameState erased an existing saved game.");
}
if (!reloadedState.load()) {
  throw new Error("Saved game did not load.");
}
if (
  reloadedState.installed.length !== savedInstalled ||
  reloadedState.progress < savedProgress
) {
  throw new Error("Saved game did not restore the expected state.");
}

const failureState = new GameState(progression, economy);
failureState.progress = 1000;
failureState.setBuyQuantity(1);
failureState.buyAsset("workshop");
failureState.tick(10000);
if (!failureState.gameOver || failureState.instability !== 100) {
  throw new Error("Instability did not produce a terminal game-over state.");
}
const frozenProgress = failureState.progress;
failureState.tick(100);
failureState.work(100);
if (failureState.progress !== frozenProgress) {
  throw new Error("Game state continued changing after game over.");
}
console.log(
  JSON.stringify(
    {
      installed: state.installed.length,
      assets: state.metric("assetsOwned"),
      policies: state.policies.length,
      achievements: state.achievements.length,
      crises: state.crises,
      gameOverTest: failureState.gameOver,
      operations,
      totalProgress: Math.round(state.totalProgress),
    },
    null,
    2,
  ),
);
