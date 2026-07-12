import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const edgePath =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profilePath = resolve(".edge-smoke-profile");
const debugPort = 9223;

await rm(profilePath, { recursive: true, force: true });

const edge = spawn(
  edgePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profilePath}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  const target = await waitForTarget();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolveMessage, rejectMessage } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) rejectMessage(new Error(message.error.message));
    else resolveMessage(message.result);
  });

  const send = (method, params = {}) =>
    new Promise((resolveMessage, rejectMessage) => {
      const id = nextId++;
      pending.set(id, { resolveMessage, rejectMessage });
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:8000/" });
  await wait(750);

  const endBoss = await evaluate(`
    (async () => {
      const backgroundMusic = document.querySelector("#background-music");
      backgroundMusic.volume = 0.45;
      backgroundMusic.dataset.pauseCount = "0";
      backgroundMusic.pause = () => {
        backgroundMusic.dataset.pauseCount = String(Number(backgroundMusic.dataset.pauseCount || "0") + 1);
      };
      for (const key of "usa250") {
        window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
      const transitionStarted =
        document.body.classList.contains("end-boss-transition") &&
        document.querySelector("#game")?.classList.contains("shelf-knockoff") &&
        Number(backgroundMusic.volume) < 0.45;
      await new Promise((resolve) => setTimeout(resolve, 3400));
      const overlay = document.querySelector("#end-boss-overlay");
      const started =
        transitionStarted &&
        overlay &&
        !overlay.hidden &&
        document.body.classList.contains("end-boss-active") &&
        document.body.classList.contains("end-boss-transition-complete") &&
        Number(backgroundMusic.dataset.pauseCount || "0") > 0 &&
        document.body.textContent.includes("A NEW PLAYER HAS ENTERED THE SIMULATION") &&
        document.querySelector("#boss-life-meter") &&
        document.querySelector("#boss-ammo-meter") &&
        document.querySelector(".bear-sprite.idle") &&
        document.querySelector(".bear-sprite").tagName === "IMG" &&
        document.querySelector(".bear-sprite").getAttribute("src").includes("bear-idle.png");
      const initialHealth = window.__usaOsEndBoss?.state.bearHealth;
      const initialAmmo = window.__usaOsEndBoss?.state.ammo;
      const duelScaled = initialHealth >= 600 && initialAmmo >= 100;
      overlay.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 640, clientY: 320 }));
      await new Promise((resolve) => setTimeout(resolve, 60));
      const rocket = document.querySelector(".bear-rocket");
      const rocketTargetedClick =
        rocket?.style.getPropertyValue("--target-x") === "640px" &&
        rocket?.style.getPropertyValue("--target-y") === "320px";
      const rocketLaunched =
        rocket &&
        rocketTargetedClick &&
        window.__usaOsEndBoss?.state.bearHealth === initialHealth &&
        window.__usaOsEndBoss?.state.ammo < initialAmmo;
      await new Promise((resolve) => setTimeout(resolve, 560));
      const shotWorked =
        window.__usaOsEndBoss?.state.bearHealth < initialHealth &&
        initialHealth - window.__usaOsEndBoss?.state.bearHealth <= 8 &&
        document.querySelector(".bear-sprite.hit") &&
        document.querySelector(".bear-sprite").getAttribute("src").includes("bear-hit.png") &&
        window.__usaOsFireworks?.particles.length > 0;
      const eagleButton = document.querySelector("#eagle-strike-button");
      const eagleInitialHealth = window.__usaOsEndBoss?.state.bearHealth;
      eagleButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const eagleStrikeWorked =
        window.__usaOsEndBoss?.state.eagleStrikes === 2 &&
        window.__usaOsEndBoss?.state.bearHealth <= eagleInitialHealth - 70 &&
        document.querySelector("#eagle-strike-meter")?.textContent.includes("2") &&
        document.querySelector(".eagle-strike") &&
        !document.querySelector(".eagle-flyover");
      window.__usaOsEndBoss.forceAttack();
      await new Promise((resolve) => setTimeout(resolve, 30));
      const attackVisible =
        document.querySelector(".bear-sprite.attacking") &&
        document.querySelector(".bear-sprite").getAttribute("src").includes("bear-attack.png") &&
        !document.querySelector("#defend-button").disabled;
      document.querySelector("#defend-button").click();
      await new Promise((resolve) => setTimeout(resolve, 30));
      const defended = window.__usaOsEndBoss?.state.defended === true;
      window.__usaOsEndBoss.win();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const won =
        document.body.textContent.includes("BEAR DEFEATED") &&
        document.body.textContent.includes("USA-OS FINAL VICTORY") &&
        window.__usaOsFireworks?.celebrationTimers.size > 0;
      return { started, duelScaled, rocketLaunched, shotWorked, eagleStrikeWorked, attackVisible, defended, won };
    })()
  `);

  for (const [name, passed] of Object.entries(endBoss)) {
    if (!passed) throw new Error(`End-boss assertion failed: ${name}`);
  }

  await send("Page.navigate", { url: "http://127.0.0.1:8000/" });
  await wait(750);

  const result = await evaluate(`
    (async () => {
      const click = (selector, count = 1) => {
        for (let index = 0; index < count; index += 1) {
          document.querySelector(selector).click();
        }
      };

      const introInitiallyVisible =
        !document.querySelector("#intro-screen").hidden;
      const backgroundMusic = document.querySelector("#background-music");
      backgroundMusic.dataset.playCount = "0";
      backgroundMusic.play = () => {
        backgroundMusic.dataset.playCount = String(
          Number(backgroundMusic.dataset.playCount || "0") + 1,
        );
        return Promise.resolve();
      };
      const bossButton = document.querySelector("#boss-mode-toggle");
      bossButton.click();
      const bossModeEnabled =
        document.body.classList.contains("boss-mode") &&
        bossButton.getAttribute("aria-pressed") === "true" &&
        document.querySelector("#background-music").muted &&
        getComputedStyle(document.body).fontFamily.includes("Arial") &&
        getComputedStyle(document.querySelector(".usa-header")).backgroundColor === "rgb(238, 238, 238)";
      bossButton.click();
      const bossModeDisabled =
        !document.body.classList.contains("boss-mode") &&
        bossButton.getAttribute("aria-pressed") === "false";
      document.querySelector("#help-open").click();
      const helpOpened =
        document.querySelector("#help-modal").open &&
        document.body.textContent.includes("How to Play") &&
        document.body.textContent.includes("Credits");
      document.querySelector("#help-modal").close();
      const helpClosed = !document.querySelector("#help-modal").open;
      click("#intro-start");
      await new Promise((resolve) => setTimeout(resolve, 2450));
      const introCompleted =
        document.querySelector("#intro-screen").hidden &&
        !document.querySelector("#game-screen").hidden &&
        document.querySelector("#boot-screen").hidden;
      const playCountBeforeBossExit = Number(backgroundMusic.dataset.playCount || "0");
      bossButton.click();
      bossButton.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const bossExitRestartedMusic =
        !document.body.classList.contains("boss-mode") &&
        !backgroundMusic.muted &&
        Number(backgroundMusic.dataset.playCount || "0") > playCountBeforeBossExit;
      document.querySelector("#work-button").dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 150,
          clientY: 200,
          pointerId: 2,
          pointerType: "mouse",
        }),
      );
      const fireworksTriggered =
        document.querySelectorAll(".fireworks-canvas").length === 1 &&
        window.__usaOsFireworks.particles.length > 0;
      click("#work-button", 8);
      click("#deploy-button", 5);
      const workshopButton = document.querySelector(
        "[data-buy-asset='workshop']",
      );
      workshopButton.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 350));
      workshopButton.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
      click("#work-button", 8);
      click("#deploy-button", 5);
      click("[data-install='plymouth']");
      click("#save-button");
      const manualSaveFeedback =
        document.querySelector("#save-button").textContent.trim() ===
        "SYSTEM SAVED";
      const manualSaveLogged = document
        .querySelector("#event-log")
        .textContent.includes("MANUAL SAVE COMPLETE");
      const saveBeforeConstructor = localStorage.getItem("usa-os-poc-save-v2");
      const [{ GameState }, progression, economy] = await Promise.all([
        import("./js/game-state.js"),
        fetch("./data/progression.json").then((response) => response.json()),
        fetch("./data/economy.json").then((response) => response.json()),
      ]);
      const freshState = new GameState(progression, economy);
      const saveSurvivedFreshConstructor =
        Boolean(saveBeforeConstructor) &&
        Boolean(localStorage.getItem("usa-os-poc-save-v2")) &&
        freshState.hasSave() &&
        freshState.load();
      click("[data-tab='policies']");
      const policiesVisible =
        !document.querySelector("[data-panel='policies']").hidden &&
        document.querySelector("[data-panel='systems']").hidden;
      click("[data-tab='systems']");
      const initialEraDidNotShake =
        !document.body.classList.contains("era-change-shake");
      window.__usaOsState.setDebugEra(0);
      const debugNext = document.querySelector("[data-debug-era='1']");
      debugNext.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerId: 3,
          pointerType: "mouse",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 350));
      debugNext.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerId: 3,
          pointerType: "mouse",
        }),
      );
      const debugEraAdvanced =
        window.__usaOsState.era.id === 1 &&
        document.querySelector(".era-image").getAttribute("src").endsWith("era-1.png");
      const eraCelebrationTriggered =
        document.body.classList.contains("era-change-shake") &&
        window.__usaOsFireworks.celebrationTimers.size > 0;
      window.__usaOsState.setDebugEra(null);

      return {
        gameVisible: !document.querySelector("#game-screen").hidden,
        introInitiallyVisible,
        bossModeEnabled,
        bossModeDisabled,
        bossExitRestartedMusic,
        helpOpened,
        helpClosed,
        introCompleted,
        fireworksTriggered,
        installedPlymouth: Boolean(
          [...document.querySelectorAll("#installed-nodes h3")].find((node) =>
            node.textContent.includes("BEGIN COLONIZATION"),
          ),
        ),
        nextNodeAvailable: Boolean(
          document.querySelector("[data-install='explore']"),
        ),
        workshopOwned: document.body.textContent.includes("Workshop ×1"),
        hasSave: Boolean(localStorage.getItem("usa-os-poc-save-v2")),
        manualSaveFeedback,
        manualSaveLogged,
        saveSurvivedFreshConstructor,
        tabsSwitch: policiesVisible,
        debugEraAdvanced,
        initialEraDidNotShake,
        eraCelebrationTriggered,
        bootFailure: document.body.textContent.includes("BOOT FAILURE"),
      };
    })()
  `);

  for (const [name, passed] of Object.entries({
    gameVisible: result.gameVisible,
    introInitiallyVisible: result.introInitiallyVisible,
    bossModeEnabled: result.bossModeEnabled,
    bossModeDisabled: result.bossModeDisabled,
    bossExitRestartedMusic: result.bossExitRestartedMusic,
    helpOpened: result.helpOpened,
    helpClosed: result.helpClosed,
    introCompleted: result.introCompleted,
    fireworksTriggered: result.fireworksTriggered,
    installedPlymouth: result.installedPlymouth,
    nextNodeAvailable: result.nextNodeAvailable,
    workshopOwned: result.workshopOwned,
    hasSave: result.hasSave,
    manualSaveFeedback: result.manualSaveFeedback,
    manualSaveLogged: result.manualSaveLogged,
    saveSurvivedFreshConstructor: result.saveSurvivedFreshConstructor,
    tabsSwitch: result.tabsSwitch,
    debugEraAdvanced: result.debugEraAdvanced,
    initialEraDidNotShake: result.initialEraDidNotShake,
    eraCelebrationTriggered: result.eraCelebrationTriggered,
    noBootFailure: !result.bootFailure,
  })) {
    if (!passed) throw new Error(`Browser assertion failed: ${name}`);
  }

  const failureScreen = await evaluate(`
    (() => {
      const state = window.__usaOsState;
      state.instability = 99.9;
      state.tick(10);
      const visible = !document.querySelector("#game-over-screen").hidden;
      document.querySelector("#restart-game").click();
      return {
        visible,
        restarted:
          !document.querySelector("#game-screen").hidden &&
          state.instability === 0 &&
          state.gameOver === false,
      };
    })()
  `);

  for (const [name, passed] of Object.entries({
    gameOverScreenVisible: failureScreen.visible,
    gameRestarted: failureScreen.restarted,
  })) {
    if (!passed) throw new Error(`Game-over assertion failed: ${name}`);
  }

  await send("Emulation.setDeviceMetricsOverride", {
    width: 1368,
    height: 912,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 10,
  });
  const largeTouchScreen = await evaluate(`
    (() => ({
      mobileNoticeHidden:
        getComputedStyle(document.querySelector(".mobile-device-message")).display === "none",
      gameAccessible:
        getComputedStyle(document.querySelector("#game")).display !== "none",
    }))()
  `);
  for (const [name, passed] of Object.entries({
    largeTouchNoticeHidden: largeTouchScreen.mobileNoticeHidden,
    largeTouchGameAccessible: largeTouchScreen.gameAccessible,
  })) {
    if (!passed) throw new Error(`Large touch screen assertion failed: ${name}`);
  }
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  if (process.argv.includes("--screenshot")) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1600,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const screenshot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      new URL("../tmp-layout-preview.png", import.meta.url),
      Buffer.from(screenshot.data, "base64"),
    );
  }

  const completion = await evaluate(`
    (() => {
      const state = window.__usaOsState;
      let rounds = 0;

      while (!state.isComplete && rounds < 2000) {
        if (state.gameOver) break;
        const node = state.getAvailableNodes().find((item) => state.canInstall(item));
        if (node) {
          state.install(node.id);
        } else {
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
              rounds += 1;
              continue;
            }
            state.work(100);
            state.deploy(100);
            rounds += 1;
            continue;
          }

          let bought = false;
          for (const category of ["innovation", "infrastructure", "institutions"]) {
            const owned = state
              .getUnlockedAssets(category)
              .reduce((sum, asset) => sum + (state.assets[asset.id] || 0), 0);
            const candidate = state
              .getUnlockedAssets(category)
              .map((asset) => ({ asset, purchase: state.getAssetCost(asset.id, 1) }))
              .filter(({ purchase }) =>
                purchase.cost <= state.progress * (owned === 0 ? 1 : 0.35),
              )
              .sort((a, b) => a.purchase.cost - b.purchase.cost)[0];
            if (candidate) {
              state.setBuyQuantity(1);
              state.buyAsset(candidate.asset.id);
              bought = true;
            }
          }
          if (!bought) {
            if (
              state.stats.cyclesPerSecond === 0 &&
              state.stats.deployPerSecond === 0
            ) {
              state.work(10);
              state.deploy(10);
            } else {
              state.tick(10);
            }
            if (state.cycles > 0 && state.stats.deployPerSecond === 0) {
              state.deploy(10);
            }
          }
        }
        rounds += 1;
      }

      return {
        rounds,
        gameOver: state.gameOver,
        victoryVisible: !document.querySelector("#victory-screen").hidden,
        installedCount: document.querySelectorAll("#installed-nodes article").length,
        releaseNotesPresent: document
          .querySelector("#release-notes")
          .textContent.includes("PRESENT DAY RELEASE NOTES"),
      };
    })()
  `);

  for (const [name, passed] of Object.entries({
    victoryVisible: completion.victoryVisible,
    survivedInstability: !completion.gameOver,
    allNodesInstalled: completion.installedCount === 40,
    releaseNotesPresent: completion.releaseNotesPresent,
  })) {
    if (!passed) {
      throw new Error(
        `Completion assertion failed: ${name} ${JSON.stringify(completion)}`,
      );
    }
  }

  console.log(
    JSON.stringify({ firstPatch: result, failureScreen, completion }, null, 2),
  );
  socket.close();

  async function evaluate(expression) {
    const response = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text);
    }
    return response.result.value;
  }
} finally {
  edge.kill();
  await Promise.race([
    new Promise((resolveExit) => edge.once("exit", resolveExit)),
    wait(1500),
  ]);
  await removeProfile();
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(
        `http://127.0.0.1:${debugPort}/json/list`,
      ).then((response) => response.json());
      const page = targets.find((target) => target.type === "page");
      if (page) return page;
    } catch {
      // Browser is still starting.
    }
    await wait(100);
  }
  throw new Error("Edge debugging endpoint did not start.");
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function removeProfile() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(profilePath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (error.code !== "EBUSY" && error.code !== "EPERM") throw error;
      await wait(250);
    }
  }
}
