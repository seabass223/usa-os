const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

export class StatusBar {
  constructor(element) {
    this.element = element;
  }

  render(state) {
    const stats = state.stats;
    this.element.innerHTML = [
      ["CPU CYCLES", format(state.cycles)],
      ["PROGRESS", format(state.progress)],
      ["WORK / A", format(stats.workPerAction)],
      ["PASSIVE / SEC", format(stats.passiveCycles)],
    ]
      .map(
        ([label, value]) =>
          `<div class="stat">${label}<span>${value}</span></div>`,
      )
      .join("");
  }
}

export class CoreControls {
  constructor(workButton, deployButton, workOutput, deployOutput, actions) {
    this.workButton = workButton;
    this.deployButton = deployButton;
    this.workOutput = workOutput;
    this.deployOutput = deployOutput;
    this.actions = actions;
    this.bindHold(workButton, actions.work);
    this.bindHold(deployButton, actions.deploy);
  }

  bindHold(button, action) {
    let repeatTimer;
    const stop = () => window.clearInterval(repeatTimer);

    button.addEventListener("click", (event) => action(event.shiftKey ? 10 : 1));
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      repeatTimer = window.setInterval(() => action(event.shiftKey ? 10 : 1), 120);
    });
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointerleave", stop);
    button.addEventListener("pointercancel", stop);
  }

  render(state) {
    const stats = state.stats;
    this.workOutput.textContent = `+${format(stats.workPerAction)} cycles`;
    this.deployOutput.textContent =
      `${format(state.cycles)} cycles × ${stats.conversionRate.toFixed(2)}`;
    this.deployButton.disabled = state.cycles <= 0;
  }
}

export class SkillTree {
  constructor(availableElement, installedElement, onInstall) {
    this.availableElement = availableElement;
    this.installedElement = installedElement;
    this.onInstall = onInstall;
    this.availableElement.addEventListener("click", (event) => {
      const button = event.target.closest("[data-install]");
      if (button) this.onInstall(button.dataset.install);
    });
  }

  render(state) {
    const available = state.getAvailableNodes();
    this.availableElement.innerHTML = available.length
      ? available.map((node) => this.availableCard(node, state)).join("")
      : "<p>No patches currently available.</p>";

    const installed = state.installed
      .map((id) => state.nodeMap.get(id))
      .filter(Boolean)
      .reverse();
    this.installedElement.innerHTML = installed.length
      ? installed.map(installedCard).join("")
      : "<p>Nothing installed.</p>";
  }

  availableCard(node, state) {
    const affordable = state.progress >= node.cost;
    return `
      <article class="node-card ${affordable ? "affordable" : ""}">
        <h3>${escapeHtml(node.title)}</h3>
        <p>${escapeHtml(node.description)}</p>
        <p class="node-meta">
          ${escapeHtml(node.year)} · ${escapeHtml(node.category)}
          <br>Effect: ${effectText(node.effect)}
        </p>
        <button data-install="${node.id}" ${affordable ? "" : "disabled"}>
          INSTALL FOR ${format(node.cost)} PROGRESS
        </button>
      </article>
    `;
  }
}

export class EventLog {
  constructor(element) {
    this.element = element;
  }

  render(state) {
    this.element.innerHTML = state.log
      .map((entry) => `<li>${escapeHtml(entry)}</li>`)
      .join("");
  }
}

export function buildReleaseNotes(state) {
  const counts = {};
  for (const id of state.installed) {
    const category = state.nodeMap.get(id).category;
    counts[category] = (counts[category] ?? 0) + 1;
  }

  const elapsedMinutes = Math.max(
    1,
    Math.round((Date.now() - state.startedAt) / 60000),
  );
  const categories = Object.entries(counts)
    .map(([name, count]) => `+ ${name}: ${count} packages`)
    .join("\n");

  return `USA-OS PRESENT DAY RELEASE NOTES

Installed ${state.installed.length} historical packages in ${elapsedMinutes} minute(s).

MAJOR SUBSYSTEMS:
${categories}

TOTAL CPU CYCLES: ${format(state.totalCycles)}
TOTAL PROGRESS SHIPPED: ${format(state.totalProgress)}

KNOWN ISSUES:
- History contains unresolved dependencies.
- Progress is unevenly distributed.
- Congress thread may deadlock.
- Operator can still erase the timeline.`;
}

function installedCard(node) {
  return `
    <article class="node-card installed">
      <h3>✓ ${escapeHtml(node.title)}</h3>
      <span>${escapeHtml(node.year)} · ${escapeHtml(node.category)}</span>
    </article>
  `;
}

function effectText(effect = {}) {
  const effects = [];
  if (effect.workMultiplier) {
    effects.push(`work ×${effect.workMultiplier}`);
  }
  if (effect.deployMultiplier) {
    effects.push(`deploy ×${effect.deployMultiplier}`);
  }
  if (effect.passiveCycles) {
    effects.push(`+${effect.passiveCycles} passive cycles`);
  }
  return effects.join(", ") || "historical prerequisite";
}

function format(value) {
  return numberFormatter.format(Math.max(0, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
