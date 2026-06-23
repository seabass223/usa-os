const SAVE_KEY = "usa-os-poc-save-v1";

export class GameState extends EventTarget {
  constructor(progression) {
    super();
    this.progression = progression;
    this.nodeMap = new Map(progression.nodes.map((node) => [node.id, node]));
    this.timer = null;
    this.reset(false);
  }

  reset(notify = true) {
    this.cycles = 0;
    this.progress = 0;
    this.totalCycles = 0;
    this.totalProgress = 0;
    this.installed = [];
    this.startedAt = Date.now();
    this.log = ["USA-OS awaiting first work cycle."];
    this.victoryAcknowledged = false;
    localStorage.removeItem(SAVE_KEY);
    if (notify) this.changed();
  }

  startTicker() {
    if (this.timer) return;
    this.timer = window.setInterval(() => {
      const passive = this.stats.passiveCycles;
      if (passive > 0) {
        this.cycles += passive;
        this.totalCycles += passive;
        this.changed(false);
      }
    }, 1000);
  }

  get stats() {
    const totals = {
      workMultiplier: 1,
      deployMultiplier: 1,
      passiveCycles: 0,
    };

    for (const id of this.installed) {
      const effect = this.nodeMap.get(id)?.effect ?? {};
      totals.workMultiplier *= effect.workMultiplier ?? 1;
      totals.deployMultiplier *= effect.deployMultiplier ?? 1;
      totals.passiveCycles += effect.passiveCycles ?? 0;
    }

    return {
      workPerAction: this.progression.settings.baseWork * totals.workMultiplier,
      conversionRate:
        this.progression.settings.baseConversion * totals.deployMultiplier,
      passiveCycles: totals.passiveCycles * totals.workMultiplier,
    };
  }

  work(times = 1) {
    const amount = this.stats.workPerAction * times;
    this.cycles += amount;
    this.totalCycles += amount;
    this.changed();
  }

  deploy(times = 1) {
    if (this.cycles <= 0) return;
    const efficiencyBonus = 1 + Math.log10(Math.max(1, times)) * 0.1;
    const amount = this.cycles * this.stats.conversionRate * efficiencyBonus;
    this.progress += amount;
    this.totalProgress += amount;
    this.cycles = 0;
    this.changed();
  }

  getAvailableNodes() {
    return this.progression.nodes.filter((node) => {
      if (this.installed.includes(node.id)) return false;
      return (node.requires ?? []).every((id) => this.installed.includes(id));
    });
  }

  canInstall(node) {
    return this.getAvailableNodes().some((candidate) => candidate.id === node.id) &&
      this.progress >= node.cost;
  }

  install(id) {
    const node = this.nodeMap.get(id);
    if (!node || !this.canInstall(node)) return false;

    this.progress -= node.cost;
    this.installed.push(node.id);
    this.log.unshift(`INSTALLED: ${node.title} — ${node.description}`);
    this.log = this.log.slice(0, 30);
    this.save();
    this.changed();
    return true;
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
        installed: this.installed,
        startedAt: this.startedAt,
        log: this.log,
        victoryAcknowledged: this.victoryAcknowledged,
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
      this.installed = (save.installed ?? []).filter((id) =>
        this.nodeMap.has(id),
      );
      this.startedAt = save.startedAt || Date.now();
      this.log = Array.isArray(save.log) ? save.log : [];
      this.victoryAcknowledged = Boolean(save.victoryAcknowledged);
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

  changed(autoSave = true) {
    if (autoSave) this.save();
    this.dispatchEvent(new CustomEvent("change"));
  }
}
