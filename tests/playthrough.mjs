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
const state = new GameState(progression);

let operations = 0;
const operationLimit = 10000;

while (!state.isComplete && operations < operationLimit) {
  const target = state
    .getAvailableNodes()
    .slice()
    .sort((a, b) => a.cost - b.cost)[0];

  if (!target) {
    throw new Error("No available node before game completion.");
  }

  if (state.progress >= target.cost) {
    if (!state.install(target.id)) {
      throw new Error(`Could not install affordable node: ${target.id}`);
    }
  } else {
    state.work(10);
    state.deploy(10);
    operations += 2;
  }
}

if (!state.isComplete) {
  throw new Error(`Playthrough exceeded ${operationLimit} operations.`);
}

console.log(
  JSON.stringify(
    {
      installed: state.installed.length,
      operations,
      totalCycles: Math.round(state.totalCycles),
      totalProgress: Math.round(state.totalProgress),
    },
    null,
    2,
  ),
);
