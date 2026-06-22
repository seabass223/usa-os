const SAVE_KEY = "usa-os-poc-save-v2";

export class GameState extends EventTarget {
  constructor(progression, economy) {
    super();
    this.progression = progression;
    this.economy = economy;
    this.nodeMap = new Map(progression.nodes.map((node) => [node.id, node]));
    this.assetMap = new Map(economy.assets.map((asset) => [asset.id, asset]));
    this.policyMap = new Map(economy.policies.map((policy) => [policy.id, policy]));
    this.timer = null;
    this.debugEra = this.loadDebugEra();
    this.reset(false);
  }

  reset(notify = true) {
    this.cycles = 0;
    this.progress = 0;
    this.totalCycles = 0;
    this.totalProgress = 0;
    this.instability = 0;
    this.crises = 0;
    this.gameOver = false;
    this.installed = [];
    this.assets = {};
    this.policies = [];
    this.achievements = [];
    this.buyQuantity = 1;
    this.startedAt = Date.now();
    this.lastTickAt = Date.now();
    this.log = ["USA-OS awaiting first work cycle."];
    this.victoryAcknowledged = false;
    localStorage.removeItem(SAVE_KEY);
    if (notify) this.changed();
  }

  startTicker() {
    if (this.timer) return;
    this.lastTickAt = Date.now();
    this.timer = window.setInterval(() => {
      const now = Date.now();
      const seconds = Math.min(2, (now - this.lastTickAt) / 1000);
      this.lastTickAt = now;
      this.tick(seconds);
    }, 250);
  }

  tick(seconds, notify = true) {
    if (seconds <= 0 || this.gameOver) return;
    const stats = this.stats;
    const produced = stats.cyclesPerSecond * seconds;
    this.cycles += produced;
    this.totalCycles += produced;

    const deployed = Math.min(this.cycles, stats.deployPerSecond * seconds);
    this.cycles -= deployed;
    this.progress += deployed;
    this.totalProgress += deployed;

    const instabilityDelta = stats.netInstabilityPerSecond * seconds;
    this.instability = clamp(this.instability + instabilityDelta, 0, 100);
    if (this.instability >= this.economy.settings.crisisThreshold) {
      this.endGame();
    }

    this.checkAchievements();
    if (notify) this.changed(false);
  }

  get era() {
    if (this.debugEra !== null) {
      return this.economy.eras.find((era) => era.id === this.debugEra);
    }
    return [...this.economy.eras]
      .reverse()
      .find((era) => this.installed.length >= era.requiredMilestones);
  }

  get nextEra() {
    if (this.debugEra !== null) {
      return this.economy.eras.find((era) => era.id === this.debugEra + 1);
    }
    return this.economy.eras.find(
      (era) => era.requiredMilestones > this.installed.length,
    );
  }

  get debugMode() {
    return this.debugEra !== null;
  }

  loadDebugEra() {
    const raw = localStorage.getItem("usa-os-debug-era");
    if (raw === null) return null;
    const era = Number(raw);
    return Number.isInteger(era) && era >= 0 && era < this.economy.eras.length
      ? era
      : null;
  }

  setDebugEra(era) {
    if (era === null) {
      this.debugEra = null;
      localStorage.removeItem("usa-os-debug-era");
    } else {
      this.debugEra = clamp(
        Number(era),
        0,
        this.economy.eras.length - 1,
      );
      localStorage.setItem("usa-os-debug-era", String(this.debugEra));
    }
    this.changed(false);
  }

  stepDebugEra(direction) {
    if (!this.debugMode) return;
    this.setDebugEra(this.debugEra + direction);
  }

  get stats() {
    const history = {
      workMultiplier: 1,
      deployMultiplier: 1,
      passiveCycles: 0,
    };
    for (const id of this.installed) {
      const effect = this.nodeMap.get(id)?.effect ?? {};
      history.workMultiplier *= effect.workMultiplier ?? 1;
      history.deployMultiplier *= effect.deployMultiplier ?? 1;
      history.passiveCycles += effect.passiveCycles ?? 0;
    }

    let manualWorkMultiplier = history.workMultiplier;
    let manualDeployMultiplier = history.deployMultiplier;
    let instabilityMultiplier = 1;
    for (const id of this.policies) {
      const effect = this.policyMap.get(id)?.effect ?? {};
      manualWorkMultiplier *= effect.manualWorkMultiplier ?? 1;
      manualDeployMultiplier *= effect.manualDeployMultiplier ?? 1;
      instabilityMultiplier *= effect.instabilityMultiplier ?? 1;
    }

    let cyclesPerSecond = history.passiveCycles * history.workMultiplier;
    let deployPerSecond = 0;
    let instabilityPerSecond = 0;
    let stabilityPerSecond = 0;

    for (const asset of this.economy.assets) {
      const count = this.assets[asset.id] ?? 0;
      if (!count) continue;
      const multiplier = this.assetMultiplier(asset);
      cyclesPerSecond += (asset.cyclesPerSecond ?? 0) * count * multiplier;
      deployPerSecond +=
        (asset.deployPerSecond ?? 0) *
        count *
        multiplier *
        history.deployMultiplier;
      stabilityPerSecond +=
        (asset.stabilityPerSecond ?? 0) * count * multiplier;
      instabilityPerSecond += (asset.instability ?? 0) * count;
    }

    instabilityPerSecond *= instabilityMultiplier;
    return {
      workPerAction: this.economy.settings.baseWork * manualWorkMultiplier,
      deployPerAction: this.economy.settings.baseDeploy * manualDeployMultiplier,
      cyclesPerSecond,
      deployPerSecond,
      instabilityPerSecond,
      stabilityPerSecond,
      netInstabilityPerSecond: instabilityPerSecond - stabilityPerSecond,
    };
  }

  assetMultiplier(asset) {
    let multiplier = 1;
    for (const id of this.policies) {
      const effect = this.policyMap.get(id)?.effect ?? {};
      if (effect.assets?.includes(asset.id)) multiplier *= effect.assetMultiplier ?? 1;
      if (effect.categories?.includes(asset.category)) {
        multiplier *= effect.categoryMultiplier ?? 1;
      }
    }
    return multiplier;
  }

  work(times = 1) {
    if (this.gameOver) return;
    const amount = this.stats.workPerAction * times;
    this.cycles += amount;
    this.totalCycles += amount;
    this.checkAchievements();
    this.changed();
  }

  deploy(times = 1) {
    if (this.cycles <= 0 || this.gameOver) return;
    const amount = Math.min(
      this.cycles,
      this.stats.deployPerAction * Math.max(1, times),
    );
    this.cycles -= amount;
    this.progress += amount;
    this.totalProgress += amount;
    this.changed();
  }

  setBuyQuantity(quantity) {
    this.buyQuantity = quantity;
    this.changed(false);
  }

  getUnlockedAssets(category) {
    return this.economy.assets
      .filter(
        (asset) =>
          asset.category === category && asset.unlockEra <= this.era.id,
      )
      .sort((left, right) => right.baseCost - left.baseCost);
  }

  getAssetCost(id, requested = this.buyQuantity) {
    const asset = this.assetMap.get(id);
    if (!asset) return { quantity: 0, cost: 0 };
    const owned = this.assets[id] ?? 0;
    const growth = this.economy.settings.assetCostGrowth;
    const quantity =
      requested === "max"
        ? this.maxAffordable(asset, owned, growth)
        : Number(requested);
    if (quantity <= 0) return { quantity: 0, cost: 0 };
    const firstCost = asset.baseCost * growth ** owned;
    const cost = firstCost * ((growth ** quantity - 1) / (growth - 1));
    return { quantity, cost };
  }

  maxAffordable(asset, owned, growth) {
    if (this.progress < asset.baseCost * growth ** owned) return 0;
    const firstCost = asset.baseCost * growth ** owned;
    return Math.max(
      0,
      Math.floor(
        Math.log(1 + (this.progress * (growth - 1)) / firstCost) /
          Math.log(growth),
      ),
    );
  }

  buyAsset(id) {
    if (this.gameOver) return false;
    const { quantity, cost } = this.getAssetCost(id);
    if (quantity <= 0 || this.progress + 1e-6 < cost) return false;
    this.progress -= cost;
    this.assets[id] = (this.assets[id] ?? 0) + quantity;
    const asset = this.assetMap.get(id);
    this.log.unshift(`ACQUIRED ${quantity} × ${asset.title}.`);
    this.trimLog();
    this.checkAchievements();
    this.changed();
    return true;
  }

  getAvailablePolicies() {
    return this.economy.policies.filter(
      (policy) =>
        policy.unlockEra <= this.era.id && !this.policies.includes(policy.id),
    );
  }

  buyPolicy(id) {
    if (this.gameOver) return false;
    const policy = this.policyMap.get(id);
    if (
      !policy ||
      this.policies.includes(id) ||
      policy.unlockEra > this.era.id ||
      this.progress < policy.cost
    ) {
      return false;
    }
    this.progress -= policy.cost;
    this.policies.push(id);
    this.log.unshift(`POLICY INSTALLED: ${policy.title}.`);
    this.trimLog();
    this.changed();
    return true;
  }

  getAvailableNodes() {
    return this.progression.nodes.filter((node) => {
      if (this.installed.includes(node.id)) return false;
      return (node.requires ?? []).every((id) => this.installed.includes(id));
    });
  }

  canInstall(node) {
    return (
      this.getAvailableNodes().some((candidate) => candidate.id === node.id) &&
      this.progress >= node.cost
    );
  }

  install(id) {
    if (this.gameOver) return false;
    const node = this.nodeMap.get(id);
    if (!node || !this.canInstall(node)) return false;
    const oldEra = this.era.id;
    this.progress -= node.cost;
    this.installed.push(node.id);
    this.log.unshift(`HISTORY PATCH: ${node.title}.`);
    if (this.era.id > oldEra) {
      this.log.unshift(`NEW ERA UNLOCKED: ${this.era.title}.`);
    }
    this.trimLog();
    this.checkAchievements();
    this.changed();
    return true;
  }

  endGame() {
    this.instability = 100;
    this.gameOver = true;
    this.log.unshift("FATAL SYSTEM FAILURE: instability reached 100%.");
    this.trimLog();
    this.save();
  }

  checkAchievements() {
    for (const achievement of this.economy.achievements) {
      if (
        !this.achievements.includes(achievement.id) &&
        this.metric(achievement.metric) >= achievement.threshold
      ) {
        this.achievements.push(achievement.id);
        this.log.unshift(`ACHIEVEMENT: ${achievement.title}.`);
      }
    }
    this.trimLog();
  }

  metric(name) {
    const counts = Object.entries(this.assets).filter(([, count]) => count > 0);
    const values = {
      totalCycles: this.totalCycles,
      assetsOwned: counts.reduce((sum, [, count]) => sum + count, 0),
      categoriesOwned: new Set(
        counts.map(([id]) => this.assetMap.get(id)?.category),
      ).size,
      institutionsOwned: this.economy.assets
        .filter((asset) => asset.category === "institutions")
        .reduce((sum, asset) => sum + (this.assets[asset.id] ?? 0), 0),
      milestones: this.installed.length,
    };
    return values[name] ?? 0;
  }

  applyOfflineProgress(lastSavedAt) {
    const seconds = Math.min(
      this.economy.settings.offlineCapSeconds,
      Math.max(0, (Date.now() - lastSavedAt) / 1000),
    );
    if (seconds < 2) return;
    const before = this.progress;
    this.tick(seconds, false);
    this.log.unshift(
      `OFFLINE RUN: ${Math.round(seconds)}s, +${Math.round(this.progress - before).toLocaleString()} progress.`,
    );
    this.trimLog();
  }

  get isComplete() {
    return this.installed.length === this.progression.nodes.length;
  }

  save() {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cycles: this.cycles,
        progress: this.progress,
        totalCycles: this.totalCycles,
        totalProgress: this.totalProgress,
        instability: this.instability,
        crises: this.crises,
        gameOver: this.gameOver,
        installed: this.installed,
        assets: this.assets,
        policies: this.policies,
        achievements: this.achievements,
        buyQuantity: this.buyQuantity,
        startedAt: this.startedAt,
        log: this.log,
        victoryAcknowledged: this.victoryAcknowledged,
        savedAt: Date.now(),
      }),
    );
  }

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const save = JSON.parse(raw);
      this.cycles = Number(save.cycles) || 0;
      this.progress = Number(save.progress) || 0;
      this.totalCycles = Number(save.totalCycles) || 0;
      this.totalProgress = Number(save.totalProgress) || 0;
      this.instability = Number(save.instability) || 0;
      this.crises = Number(save.crises) || 0;
      this.gameOver = Boolean(save.gameOver);
      this.installed = (save.installed ?? []).filter((id) => this.nodeMap.has(id));
      this.assets = save.assets ?? {};
      this.policies = (save.policies ?? []).filter((id) => this.policyMap.has(id));
      this.achievements = save.achievements ?? [];
      this.buyQuantity = save.buyQuantity ?? 1;
      this.startedAt = save.startedAt || Date.now();
      this.log = Array.isArray(save.log) ? save.log : [];
      this.victoryAcknowledged = Boolean(save.victoryAcknowledged);
      this.applyOfflineProgress(save.savedAt ?? Date.now());
      this.changed();
      return true;
    } catch {
      localStorage.removeItem(SAVE_KEY);
      return false;
    }
  }

  hasSave() {
    return Boolean(localStorage.getItem(SAVE_KEY));
  }

  acknowledgeVictory() {
    this.victoryAcknowledged = true;
    this.save();
  }

  trimLog() {
    this.log = this.log.slice(0, 40);
  }

  changed(autoSave = true) {
    if (autoSave) this.save();
    this.dispatchEvent(new CustomEvent("change"));
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
