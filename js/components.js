const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const fullNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export class StatusBar {
  constructor(element) {
    this.element = element;
    this.state = null;
    bindImmediateAction(
      this.element,
      "[data-debug-era]",
      "debugEra",
      (direction) => this.state?.stepDebugEra(Number(direction)),
    );
  }

  render(state) {
    this.state = state;
    const stats = state.stats;
    const eraTarget = state.nextEra?.requiredMilestones ?? state.installed.length;
    const eraStart = state.era.requiredMilestones;
    const eraSpan = Math.max(1, eraTarget - eraStart);
    const eraProgress = state.nextEra
      ? ((state.installed.length - eraStart) / eraSpan) * 100
      : 100;
    const pressure = stats.netInstabilityPerSecond;

    this.element.innerHTML = `
      <section class="status-dashboard">
        <div class="status-left-column">
          <div class="primary-metric-row">
            ${heroMetric(
              "CPU CYCLES",
              formatFull(state.cycles),
              `${format(stats.cyclesPerSecond)} produced / sec`,
              "cpu",
            )}
            ${heroMetric(
              "NATIONAL PROGRESS",
              formatFull(state.progress),
              `${format(stats.deployPerSecond)} deployed / sec`,
              "progress",
            )}
          </div>
          <div class="left-telemetry-row">
            ${balanceCard(stats)}
            <div class="nes-container is-dark telemetry-card">
              <div class="telemetry-heading">
                <span>INSTABILITY</span>
                <strong>${state.instability.toFixed(1)}%</strong>
              </div>
              <progress class="nes-progress is-error" value="${state.instability}" max="100"></progress>
              <small>${pressure > 0 ? "RISING" : pressure < 0 ? "FALLING" : "STABLE"} at ${signed(pressure)} / sec</small>
            </div>
          </div>
        </div>

        <div class="nes-container is-dark with-title era-progress-panel">
          <p class="title">USA-OS ERA MAP</p>
          <div class="era-panel-content">
            <div class="era-image-frame">
              <img
                class="era-image"
                src="${escapeHtml(state.era.image)}"
                alt="${escapeHtml(state.era.title)} map"
                width="160"
                height="90"
                onerror="this.hidden=true; this.nextElementSibling.hidden=false"
              >
              <span class="era-image-placeholder" hidden>ERA MAP</span>
            </div>
            <div class="era-panel-data">
              <div class="era-panel-heading">
                <span>ERA: ${escapeHtml(state.era.title)}</span>
                <strong>${state.nextEra ? `${state.installed.length}/${eraTarget}` : "COMPLETE"}</strong>
              </div>
              <progress class="nes-progress is-primary" value="${eraProgress}" max="100"></progress>
              <small>${state.nextEra ? `Next: ${escapeHtml(state.nextEra.title)}` : "Present-day build installed"}</small>
              ${
                state.debugMode
                  ? `
                    <div class="era-debug-controls">
                      <button class="nes-btn" type="button" data-debug-era="-1" ${state.era.id === 0 ? "disabled" : ""}>◀ PREV</button>
                      <span>DEBUG ERA ${state.era.id}</span>
                      <button class="nes-btn" type="button" data-debug-era="1" ${state.era.id === state.economy.eras.length - 1 ? "disabled" : ""}>NEXT ▶</button>
                    </div>
                  `
                  : ""
              }
            </div>
          </div>
        </div>
      </section>
    `;
  }
}

export class CoreControls {
  constructor(workButton, deployButton, workOutput, deployOutput, actions) {
    this.workButton = workButton;
    this.deployButton = deployButton;
    this.workOutput = workOutput;
    this.deployOutput = deployOutput;
    this.bindHold(workButton, actions.work);
    this.bindHold(deployButton, actions.deploy);
  }

  bindHold(button, action) {
    let repeatTimer;
    const stop = () => window.clearInterval(repeatTimer);
    button.addEventListener("click", (event) => action(event.shiftKey ? 10 : 1));
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      repeatTimer = window.setInterval(() => action(event.shiftKey ? 10 : 1), 90);
    });
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointerleave", stop);
    button.addEventListener("pointercancel", stop);
  }

  render(state) {
    this.workOutput.textContent = `+${format(state.stats.workPerAction)} cycles`;
    this.deployOutput.textContent =
      `up to ${format(state.stats.deployPerAction)} stored cycles`;
    this.deployButton.disabled = state.cycles <= 0;
    this.workButton.disabled = state.gameOver;
    this.deployButton.disabled = state.gameOver || state.cycles <= 0;
  }
}

export class AssetMarket {
  constructor(element, quantityElement, onBuy, onQuantity) {
    this.element = element;
    this.quantityElement = quantityElement;
    this.onBuy = onBuy;
    this.onQuantity = onQuantity;
    bindImmediateAction(
      this.element,
      "[data-buy-asset]",
      "buyAsset",
      this.onBuy,
    );
    this.quantityElement.addEventListener("click", (event) => {
      const button = event.target.closest("[data-quantity]");
      if (!button) return;
      const quantity =
        button.dataset.quantity === "max"
          ? "max"
          : Number(button.dataset.quantity);
      this.onQuantity(quantity);
    });
  }

  render(state) {
    for (const button of this.quantityElement.querySelectorAll("[data-quantity]")) {
      button.classList.toggle(
        "is-primary",
        String(state.buyQuantity) === button.dataset.quantity,
      );
    }

    this.element.innerHTML = ["innovation", "infrastructure", "institutions"]
      .map((category) => {
        const assets = state.getUnlockedAssets(category);
        return `
          <section class="nes-container is-dark with-title market-column">
            <p class="title">${category.toUpperCase()}</p>
            <p class="category-help">${categoryHelp(category)}</p>
            ${assets.map((asset) => assetCard(asset, state)).join("")}
          </section>
        `;
      })
      .join("");
  }
}

export class PolicyPanel {
  constructor(element, onBuy) {
    this.element = element;
    this.onBuy = onBuy;
    bindImmediateAction(
      this.element,
      "[data-buy-policy]",
      "buyPolicy",
      this.onBuy,
    );
  }

  render(state) {
    const available = state.getAvailablePolicies();
    this.element.innerHTML = available.length
      ? available
          .map((policy) => {
            const affordable = state.progress >= policy.cost;
            return `
              <article class="nes-container is-rounded is-dark node-card ${affordable ? "affordable" : ""}">
                <h3>${escapeHtml(policy.title)}</h3>
                <p>${escapeHtml(policy.description)}</p>
                <button class="nes-btn is-warning" data-buy-policy="${policy.id}" ${affordable ? "" : "disabled"}>
                  INSTALL POLICY — ${format(policy.cost)}
                </button>
              </article>
            `;
          })
          .join("")
      : "<p>All currently available policies are installed.</p>";
  }
}

export class SkillTree {
  constructor(availableElement, installedElement, onInstall) {
    this.availableElement = availableElement;
    this.installedElement = installedElement;
    this.onInstall = onInstall;
    bindImmediateAction(
      this.availableElement,
      "[data-install]",
      "install",
      this.onInstall,
    );
  }

  render(state) {
    const available = state.getAvailableNodes();
    this.availableElement.innerHTML = available.length
      ? available.map((node) => this.availableCard(node, state)).join("")
      : "<p>No historical patches currently available.</p>";

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
      <article class="nes-container is-rounded is-dark node-card ${affordable ? "affordable" : ""}">
        <h3>${escapeHtml(node.title)}</h3>
        <p>${escapeHtml(node.description)}</p>
        <p class="node-meta">${escapeHtml(node.year)} · ${escapeHtml(node.category)}</p>
        <button class="nes-btn is-primary" data-install="${node.id}" ${affordable ? "" : "disabled"}>
          ADVANCE HISTORY — ${format(node.cost)}
        </button>
      </article>
    `;
  }
}

export class AchievementPanel {
  constructor(element) {
    this.element = element;
  }

  render(state) {
    this.element.innerHTML = state.economy.achievements
      .map((achievement) => {
        const unlocked = state.achievements.includes(achievement.id);
        return `<span class="nes-badge achievement ${unlocked ? "unlocked" : ""}">
          <span class="${unlocked ? "is-warning" : "is-dark"}">
          ${unlocked ? "★" : "?"} ${escapeHtml(achievement.title)}
          </span>
        </span>`;
      })
      .join("");
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
  const totalAssets = Object.values(state.assets).reduce(
    (sum, count) => sum + count,
    0,
  );
  return `USA-OS PRESENT DAY RELEASE NOTES

Historical patches: ${state.installed.length}
Repeatable assets: ${totalAssets}
Policies installed: ${state.policies.length}
Achievements: ${state.achievements.length}
Crises survived: ${state.crises}

TOTAL CPU CYCLES: ${format(state.totalCycles)}
TOTAL PROGRESS SHIPPED: ${format(state.totalProgress)}

KNOWN ISSUES:
- Production can outrun infrastructure.
- Growth without institutions increases instability.
- Congress thread may deadlock.
- Operator can still erase the timeline.`;
}

function assetCard(asset, state) {
  const owned = state.assets[asset.id] ?? 0;
  const purchase = state.getAssetCost(asset.id);
  const affordable = purchase.quantity > 0 && state.progress >= purchase.cost;
  const output = asset.cyclesPerSecond
    ? `${format(asset.cyclesPerSecond * state.assetMultiplier(asset))} cycles/sec each`
    : asset.deployPerSecond
      ? `${format(asset.deployPerSecond * state.assetMultiplier(asset))} deploy/sec each`
      : `${format(asset.stabilityPerSecond * state.assetMultiplier(asset))} stability/sec each`;
  return `
    <article class="nes-container is-rounded is-dark asset-card ${affordable ? "affordable" : ""}">
      <div>
        <h4>${escapeHtml(asset.title)} <b>×${owned}</b></h4>
        <p>${escapeHtml(asset.description)}</p>
        <small>${output}${asset.instability ? ` · +${asset.instability} pressure` : ""}</small>
      </div>
      <button class="nes-btn ${asset.category === "innovation" ? "is-primary" : asset.category === "infrastructure" ? "is-success" : "is-warning"}" data-buy-asset="${asset.id}" ${affordable ? "" : "disabled"}>
        BUY ${purchase.quantity || state.buyQuantity} — ${format(purchase.cost)}
      </button>
    </article>
  `;
}

function installedCard(node) {
  return `
    <article class="nes-container is-rounded is-dark node-card installed">
      <h3>✓ ${escapeHtml(node.title)}</h3>
      <span>${escapeHtml(node.year)} · ${escapeHtml(node.category)}</span>
    </article>
  `;
}

function categoryHelp(category) {
  return {
    innovation: "Produces CPU cycles automatically.",
    infrastructure: "Converts stored cycles into progress automatically.",
    institutions: "Reduces instability and prevents expensive crises.",
  }[category];
}

function heroMetric(label, value, detail, type) {
  const characterCount = String(value).length;
  const sizeClass =
    characterCount >= 14
      ? "value-xxl"
      : characterCount >= 11
        ? "value-xl"
        : characterCount >= 8
          ? "value-lg"
          : "";
  return `
    <div class="nes-container is-dark with-title hero-card ${type}">
      <p class="title">${label}</p>
      <strong class="hero-value ${sizeClass}">${value}</strong>
      <span class="hero-detail">${detail}</span>
    </div>
  `;
}

function comparisonBar(label, value, maximum) {
  const percentage = maximum > 0 ? Math.max(2, (value / maximum) * 100) : 2;
  return `
    <div class="comparison-row">
      <span>${label}</span>
      <div class="pixel-track">
        <div class="pixel-fill ${label.toLowerCase()}" style="width:${percentage}%"></div>
      </div>
      <strong>${format(value)}/s</strong>
    </div>
  `;
}

function balanceCard(stats) {
  const maximum = Math.max(stats.cyclesPerSecond, stats.deployPerSecond);
  return `
    <section class="nes-container is-dark balance-card">
      <div class="telemetry-heading">
        <span>SYSTEM BALANCE</span>
        <strong>${stats.cyclesPerSecond > stats.deployPerSecond ? "BACKLOG" : "READY"}</strong>
      </div>
      <div class="balance-bars">
        ${comparisonBar("PRODUCTION", stats.cyclesPerSecond, maximum)}
        ${comparisonBar("DEPLOYMENT", stats.deployPerSecond, maximum)}
      </div>
    </section>
  `;
}

function bindImmediateAction(element, selector, dataKey, action) {
  let lastPointerAction = null;

  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const button = event.target.closest(selector);
    if (!button || button.disabled) return;

    const value = button.dataset[dataKey];
    lastPointerAction = { value, at: performance.now() };
    action(value);
  });

  element.addEventListener("click", (event) => {
    const button = event.target.closest(selector);
    if (!button || button.disabled) return;

    const value = button.dataset[dataKey];
    const alreadyHandled =
      lastPointerAction?.value === value &&
      performance.now() - lastPointerAction.at < 750;

    if (!alreadyHandled) action(value);
    lastPointerAction = null;
  });
}

function signed(value) {
  if (Math.abs(value) < 0.005) return "0";
  return `${value > 0 ? "+" : ""}${format(value)}`;
}

export function format(value) {
  return numberFormatter.format(Math.max(0, Number(value) || 0));
}

export function formatFull(value) {
  return fullNumberFormatter.format(Math.max(0, Number(value) || 0));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
