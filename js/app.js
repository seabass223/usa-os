import { loadGameData } from "./data-loader.js";
import { preloadAssets } from "./asset-preloader.js";
import { GameState } from "./game-state.js";
import { EndBossBattle } from "./end-boss.js";
import { PixelFireworks } from "./fireworks.js";
import { SoundPool } from "./sound-pool.js";
import {
  AchievementPanel,
  AssetMarket,
  buildReleaseNotes,
  CoreControls,
  EventLog,
  PolicyPanel,
  SkillTree,
  StatusBar,
} from "./components.js";

const elements = Object.fromEntries(
  [
    "intro-screen",
    "intro-start",
    "preload-label",
    "preload-progress",
    "intro-voice",
    "help-open",
    "boss-mode-toggle",
    "help-modal",
    "help-close",
    "boot-screen",
    "game-screen",
    "victory-screen",
    "game-over-screen",
    "start-game",
    "continue-game",
    "background-music",
    "work-button",
    "deploy-button",
    "work-output",
    "deploy-output",
    "save-button",
    "reset-button",
    "keep-playing",
    "new-game",
    "restart-game",
    "victory-summary",
    "release-notes",
    "game-over-summary",
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

try {
  const { progression, economy } = await loadGameData();
  await preloadAssets(buildAssetManifest(economy), ({ completed, total, percent }) => {
    elements["preload-progress"].value = percent;
    elements["preload-label"].textContent =
      `LOADING USA-OS ASSETS... ${completed}/${total}`;
  });
  elements["preload-progress"].value = 100;
  elements["preload-label"].textContent = "USA-OS ASSETS READY";
  elements["intro-screen"].classList.add("intro-ready");
  elements["intro-start"].disabled = false;

  const state = new GameState(progression, economy);
  window.__usaOsState = state;
  const fireworks = new PixelFireworks();
  window.__usaOsFireworks = fireworks;
  const popSounds = new SoundPool("./assets/audio/pop.mp3", {
    initialSize: 8,
    volume: 0.65,
  });
  const eraUnlockSound = new SoundPool("./assets/audio/vo-unlock.mp3", {
    initialSize: 2,
    volume: 1,
  });
  const coinSounds = new SoundPool("./assets/audio/coin.mp3", {
    initialSize: 6,
    volume: 0.7,
  });
  const eagleSounds = new SoundPool("./assets/audio/eagle.mp3", {
    initialSize: 3,
    volume: 0.9,
  });
  const soundPools = [popSounds, eraUnlockSound, coinSounds, eagleSounds];
  const endBossBattle = new EndBossBattle({
    overlay: document.querySelector("#end-boss-overlay"),
    state,
    fireworks,
    popSounds,
  });
  window.__usaOsEndBoss = endBossBattle;
  const patrioticFireworks = {
    colors: ["#d52b1e", "#ffffff", "#2878d0"],
    onBurst: () => popSounds.play(),
  };
  fireworks.attach(elements["work-button"], patrioticFireworks);
  fireworks.attach(elements["deploy-button"], patrioticFireworks);
  const achievementById = new Map(
    economy.achievements.map((achievement) => [achievement.id, achievement]),
  );

  const attachButtonImpact = (button) => {
    button.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 || button.disabled) return;
        button.classList.remove("button-impact");
        void button.offsetWidth;
        button.classList.add("button-impact");
      },
      { passive: true },
    );
    button.addEventListener("animationend", () =>
      button.classList.remove("button-impact"),
    );
  };
  attachButtonImpact(elements["work-button"]);
  attachButtonImpact(elements["deploy-button"]);
  attachButtonImpact(elements["save-button"]);
  attachButtonImpact(elements["help-open"]);
  attachButtonImpact(elements["boss-mode-toggle"]);

  const setBossMode = (enabled) => {
    document.body.classList.toggle("boss-mode", enabled);
    elements["boss-mode-toggle"].setAttribute("aria-pressed", String(enabled));
    elements["boss-mode-toggle"].textContent = enabled ? "EXIT BOSS" : "BOSS MODE";
    localStorage.setItem("usa-os-boss-mode", enabled ? "1" : "0");
    for (const audio of [elements["background-music"], elements["intro-voice"]]) {
      audio.muted = enabled;
      if (enabled) audio.pause();
    }
    for (const pool of soundPools) pool.setMuted(enabled);
    if (enabled) {
      fireworks.particles.length = 0;
      for (const timer of fireworks.celebrationTimers) window.clearTimeout(timer);
      fireworks.celebrationTimers.clear();
      document.body.classList.remove("era-change-shake");
      document.querySelectorAll(".eagle-flyover").forEach((element) => element.remove());
    } else if (!elements["game-screen"].hidden && !state.gameOver) {
      elements["background-music"].volume = 0.45;
      elements["background-music"].play().catch(() => {
        // Playback remains optional if the browser or user blocks audio.
      });
    }
  };
  setBossMode(localStorage.getItem("usa-os-boss-mode") === "1");
  elements["boss-mode-toggle"].addEventListener("click", () => {
    setBossMode(!document.body.classList.contains("boss-mode"));
  });

  elements["help-open"].addEventListener("click", () => {
    elements["help-modal"].showModal();
  });
  elements["help-modal"].addEventListener("click", (event) => {
    if (event.target === elements["help-modal"]) {
      elements["help-modal"].close();
    }
  });

  const launchEagle = (message) => {
    if (document.body.classList.contains("boss-mode")) return;
    eagleSounds.play();

    const flyover = document.createElement("div");
    flyover.className = "eagle-flyover";
    flyover.setAttribute("role", "status");
    flyover.setAttribute("aria-live", "polite");

    const content = document.createElement("div");
    content.className = "eagle-flyover-content";

    const leftMedal = createMedalIcon();
    const text = document.createElement("strong");
    text.textContent = message;
    const rightMedal = createMedalIcon();

    const eagle = document.createElement("div");
    eagle.className = "eagle-flyover-sprite";
    eagle.setAttribute("aria-hidden", "true");

    content.append(leftMedal, text, rightMedal);
    flyover.append(content, eagle);
    document.body.append(flyover);

    flyover.addEventListener("animationend", (event) => {
      if (event.animationName === "eagle-flyover-band") {
        flyover.remove();
      }
    });
    window.setTimeout(() => flyover.remove(), 1800);
  };

  const createMedalIcon = () => {
    const medal = document.createElement("img");
    medal.src = "./assets/icons/tabs/medals.png";
    medal.alt = "";
    medal.width = 24;
    medal.height = 24;
    medal.className = "eagle-flyover-medal";
    medal.onerror = () => medal.remove();
    return medal;
  };

  const components = [
    new StatusBar(document.querySelector("#status-bar")),
    new CoreControls(
      elements["work-button"],
      elements["deploy-button"],
      elements["work-output"],
      elements["deploy-output"],
      {
        work: (times) => state.work(times),
        deploy: (times) => state.deploy(times),
      },
    ),
    new AssetMarket(
      document.querySelector("#asset-market"),
      document.querySelector("#buy-quantity"),
      (id) => {
        if (state.buyAsset(id)) coinSounds.play();
      },
      (quantity) => state.setBuyQuantity(quantity),
    ),
    new PolicyPanel(document.querySelector("#policy-list"), (id) => {
      if (state.buyPolicy(id)) coinSounds.play();
    }),
    new SkillTree(
      document.querySelector("#available-nodes"),
      document.querySelector("#installed-nodes"),
      (id) => {
        if (state.install(id)) coinSounds.play();
      },
    ),
    new AchievementPanel(document.querySelector("#achievements")),
    new EventLog(document.querySelector("#event-log")),
  ];

  const tabs = [...document.querySelectorAll("[data-tab]")];
  const panels = [...document.querySelectorAll("[data-panel]")];
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const selected = tab.dataset.tab;
      for (const candidate of tabs) {
        candidate.classList.toggle("active", candidate === tab);
        candidate.classList.toggle("is-primary", candidate === tab);
      }
      for (const panel of panels) {
        const active = panel.dataset.panel === selected;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      }
    });
  }

  let observedEraId = null;
  let observedAchievementIds = new Set(state.achievements);
  let suppressAchievementFlyovers = false;
  let shakeTimer = null;

  const celebrateEraChange = () => {
    if (document.body.classList.contains("boss-mode")) return;
    eraUnlockSound.play();
    fireworks.celebrateFullscreen({
      bursts: 16,
      duration: 1250,
      onBurst: () => popSounds.play(),
    });
    document.body.classList.remove("era-change-shake");
    void document.body.offsetWidth;
    document.body.classList.add("era-change-shake");
    window.clearTimeout(shakeTimer);
    shakeTimer = window.setTimeout(
      () => document.body.classList.remove("era-change-shake"),
      900,
    );
  };

  let musicStoppedForGameOver = false;

  const primeAchievementWatcher = () => {
    observedAchievementIds = new Set(state.achievements);
  };

  const announceNewAchievements = () => {
    if (suppressAchievementFlyovers) return;
    for (const id of state.achievements) {
      if (observedAchievementIds.has(id)) continue;
      observedAchievementIds.add(id);
      const title = achievementById.get(id)?.title ?? "MEDAL UNLOCKED";
      launchEagle(title);
    }
  };

  const render = () => {
    const currentEraId = state.era.id;
    if (observedEraId !== null && currentEraId !== observedEraId) {
      celebrateEraChange();
    }
    observedEraId = currentEraId;
    announceNewAchievements();

    for (const component of components) component.render(state);
    if (
      state.achievements.length === economy.achievements.length &&
      !endBossBattle.state.active &&
      !endBossBattle.state.concluded
    ) {
      endBossBattle.start();
      return;
    }
    if (state.gameOver) {
      stopMusic();
      showGameOver(state);
    } else if (state.isComplete && !state.victoryAcknowledged) {
      showVictory(state);
    }
  };

  const startGame = (loadSave = false) => {
    if (loadSave) {
      suppressAchievementFlyovers = true;
      state.load();
      primeAchievementWatcher();
      suppressAchievementFlyovers = false;
    } else {
      primeAchievementWatcher();
    }
    observedEraId = state.era.id;
    elements["boot-screen"].hidden = true;
    elements["victory-screen"].hidden = true;
    elements["game-over-screen"].hidden = true;
    elements["game-screen"].hidden = false;
    state.startTicker();
    render();
  };

  const startMusic = () => {
    musicStoppedForGameOver = false;
    elements["background-music"].volume = 0.45;
    if (document.body.classList.contains("boss-mode")) return;
    elements["background-music"].play().catch(() => {
      // Playback remains optional if the browser or user blocks audio.
    });
  };

  const stopMusic = () => {
    if (musicStoppedForGameOver) return;
    musicStoppedForGameOver = true;
    elements["background-music"].pause();
    elements["background-music"].currentTime = 0;
  };

  let introFinished = false;
  const finishIntro = () => {
    if (introFinished) return;
    introFinished = true;
    elements["intro-screen"].classList.add("intro-exit");
    window.setTimeout(() => {
      elements["intro-screen"].hidden = true;
      if (state.hasSave()) {
        startGame(true);
      } else {
        state.reset();
        startGame();
      }
    }, 500);
  };

  elements["intro-start"].addEventListener("click", () => {
    elements["intro-start"].disabled = true;
    elements["intro-screen"].classList.add("intro-playing");
    startMusic();
    elements["intro-voice"].currentTime = 0;
    if (!document.body.classList.contains("boss-mode")) {
      elements["intro-voice"].play().catch(() => {});
    }
    window.setTimeout(finishIntro, 1900);
  });

  elements["continue-game"].hidden = !state.hasSave();
  elements["start-game"].addEventListener("click", () => {
    startMusic();
    observedEraId = null;
    state.reset(false);
    startGame();
  });
  elements["continue-game"].addEventListener("click", () => {
    startMusic();
    startGame(true);
  });
  let saveFeedbackTimer = null;
  const showSaveFeedback = (label, className) => {
    const button = elements["save-button"];
    button.textContent = label;
    button.classList.toggle("is-success", className === "success");
    button.classList.toggle("is-error", className === "error");
    window.clearTimeout(saveFeedbackTimer);
    saveFeedbackTimer = window.setTimeout(() => {
      button.textContent = "SAVE SYSTEM";
      button.classList.add("is-success");
      button.classList.remove("is-error");
    }, 1400);
  };

  elements["save-button"].addEventListener("click", () => {
    try {
      state.log.unshift(
        `MANUAL SAVE COMPLETE: ${new Date().toLocaleTimeString()}.`,
      );
      state.trimLog();
      state.save();
      render();
      showSaveFeedback("SYSTEM SAVED", "success");
    } catch (error) {
      state.log.unshift("MANUAL SAVE FAILED.");
      state.trimLog();
      render();
      showSaveFeedback("SAVE FAILED", "error");
      console.error(error);
    }
  });
  elements["reset-button"].addEventListener("click", () => {
    if (window.confirm("Erase all USA-OS progress?")) {
      state.reset();
      window.location.reload();
    }
  });
  elements["keep-playing"].addEventListener("click", () => {
    state.acknowledgeVictory();
    elements["victory-screen"].hidden = true;
    elements["game-screen"].hidden = false;
  });
  elements["new-game"].addEventListener("click", () => {
    observedEraId = null;
    state.reset(false);
    elements["victory-screen"].hidden = true;
    startGame();
  });
  elements["restart-game"].addEventListener("click", () => {
    observedEraId = null;
    state.reset(false);
    elements["game-over-screen"].hidden = true;
    startMusic();
    startGame();
  });
  state.addEventListener("change", render);

  window.addEventListener("keydown", (event) => {
    recordCheatKey(event.key);
    if (elements["help-modal"].open) return;
    if (elements["game-screen"].hidden || event.repeat) return;
    if (event.key.toLowerCase() === "a") state.work(event.shiftKey ? 10 : 1);
    if (event.key.toLowerCase() === "b") state.deploy(event.shiftKey ? 10 : 1);
  });

  let cheatBuffer = "";
  const recordCheatKey = (key) => {
    if (key.length !== 1) return;
    cheatBuffer = `${cheatBuffer}${key.toLowerCase()}`.slice(-6);
    if (cheatBuffer === "usa250") {
      endBossBattle.start({ cheat: true });
      cheatBuffer = "";
    }
  };
} catch (error) {
  document.querySelector("#game").innerHTML = `
    <section class="panel">
      <h2>BOOT FAILURE</h2>
      <p>${error.message}</p>
      <p>Run this project through its local static server.</p>
    </section>
  `;
}

function showVictory(state) {
  state.save();
  elements["game-screen"].hidden = true;
  elements["victory-screen"].hidden = false;
  elements["victory-summary"].textContent =
    `All ${state.installed.length} historical packages are installed.`;
  elements["release-notes"].textContent = buildReleaseNotes(state);
}

function showGameOver(state) {
  state.save();
  elements["game-screen"].hidden = true;
  elements["victory-screen"].hidden = true;
  elements["game-over-screen"].hidden = false;
  elements["game-over-summary"].textContent =
    `FINAL ERA: ${state.era.title}\n` +
    `HISTORY PATCHES: ${state.installed.length}/${state.progression.nodes.length}\n` +
    `PROGRESS SHIPPED: ${Math.round(state.totalProgress).toLocaleString()}`;
}

function buildAssetManifest(economy) {
  return [
    { type: "font", name: "Press Start 2P" },
    { type: "audio", src: "./assets/audio/Usa-Os.mp3" },
    { type: "audio", src: "./assets/audio/coin.mp3" },
    { type: "audio", src: "./assets/audio/eagle.mp3" },
    { type: "audio", src: "./assets/audio/pop.mp3" },
    { type: "audio", src: "./assets/audio/vo-unlock.mp3" },
    { type: "audio", src: "./assets/audio/vo-usa-os.mp3" },
    { type: "image", src: "./assets/icons/tabs/systems.png" },
    { type: "image", src: "./assets/icons/tabs/policies.png" },
    { type: "image", src: "./assets/icons/tabs/history.png" },
    { type: "image", src: "./assets/icons/tabs/medals.png" },
    { type: "image", src: "./assets/sprites/eagle.png" },
    { type: "image", src: "./assets/images/bear-idle.png" },
    { type: "image", src: "./assets/images/bear-attack.png" },
    { type: "image", src: "./assets/images/bear-hit.png" },
    ...economy.eras.map((era) => ({ type: "image", src: era.image })),
  ];
}
