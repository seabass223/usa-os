import { loadGameData } from "./data-loader.js";
import { GameState } from "./game-state.js";
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
    volume: 0.85,
  });
  const patrioticFireworks = {
    colors: ["#d52b1e", "#ffffff", "#2878d0"],
    onBurst: () => popSounds.play(),
  };
  fireworks.attach(elements["work-button"], patrioticFireworks);
  fireworks.attach(elements["deploy-button"], patrioticFireworks);
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
      (id) => state.buyAsset(id),
      (quantity) => state.setBuyQuantity(quantity),
    ),
    new PolicyPanel(document.querySelector("#policy-list"), (id) =>
      state.buyPolicy(id),
    ),
    new SkillTree(
      document.querySelector("#available-nodes"),
      document.querySelector("#installed-nodes"),
      (id) => state.install(id),
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
  let shakeTimer = null;

  const celebrateEraChange = () => {
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

  const render = () => {
    const currentEraId = state.era.id;
    if (observedEraId !== null && currentEraId !== observedEraId) {
      celebrateEraChange();
    }
    observedEraId = currentEraId;

    for (const component of components) component.render(state);
    if (state.gameOver) {
      showGameOver(state);
    } else if (state.isComplete && !state.victoryAcknowledged) {
      showVictory(state);
    }
  };

  const startGame = (loadSave = false) => {
    if (loadSave) state.load();
    observedEraId = state.era.id;
    elements["boot-screen"].hidden = true;
    elements["victory-screen"].hidden = true;
    elements["game-over-screen"].hidden = true;
    elements["game-screen"].hidden = false;
    state.startTicker();
    render();
  };

  const startMusic = () => {
    elements["background-music"].volume = 0.45;
    elements["background-music"].play().catch(() => {
      // Playback remains optional if the browser or user blocks audio.
    });
  };

  elements["continue-game"].hidden = !state.hasSave();
  elements["start-game"].addEventListener("click", () => {
    startMusic();
    state.reset();
    startGame();
  });
  elements["continue-game"].addEventListener("click", () => {
    startMusic();
    startGame(true);
  });
  elements["save-button"].addEventListener("click", () => {
    state.log.unshift("MANUAL SAVE COMPLETE.");
    state.save();
    render();
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
    state.reset();
    elements["victory-screen"].hidden = true;
    startGame();
  });
  elements["restart-game"].addEventListener("click", () => {
    state.reset();
    observedEraId = state.era.id;
    elements["game-over-screen"].hidden = true;
    startGame();
  });
  state.addEventListener("change", render);

  window.addEventListener("keydown", (event) => {
    if (elements["game-screen"].hidden || event.repeat) return;
    if (event.key.toLowerCase() === "a") state.work(event.shiftKey ? 10 : 1);
    if (event.key.toLowerCase() === "b") state.deploy(event.shiftKey ? 10 : 1);
  });
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
