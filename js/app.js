import { loadGameData } from "./data-loader.js";
import { GameState } from "./game-state.js";
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
    "start-game",
    "continue-game",
    "work-button",
    "deploy-button",
    "work-output",
    "deploy-output",
    "save-button",
    "reset-button",
    "keep-playing",
    "new-game",
    "victory-summary",
    "release-notes",
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

try {
  const { progression, economy } = await loadGameData();
  const state = new GameState(progression, economy);
  window.__usaOsState = state;
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

  const render = () => {
    for (const component of components) component.render(state);
    if (state.isComplete && !state.victoryAcknowledged) showVictory(state);
  };

  const startGame = (loadSave = false) => {
    if (loadSave) state.load();
    elements["boot-screen"].hidden = true;
    elements["victory-screen"].hidden = true;
    elements["game-screen"].hidden = false;
    state.startTicker();
    render();
  };

  elements["continue-game"].hidden = !state.hasSave();
  elements["start-game"].addEventListener("click", () => {
    state.reset();
    startGame();
  });
  elements["continue-game"].addEventListener("click", () => startGame(true));
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
