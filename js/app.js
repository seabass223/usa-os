import { loadProgression } from "./data-loader.js";
import { GameState } from "./game-state.js";
import {
  buildReleaseNotes,
  CoreControls,
  EventLog,
  SkillTree,
  StatusBar,
} from "./components.js";

const elements = {
  boot: document.querySelector("#boot-screen"),
  game: document.querySelector("#game-screen"),
  victory: document.querySelector("#victory-screen"),
  start: document.querySelector("#start-game"),
  continue: document.querySelector("#continue-game"),
  work: document.querySelector("#work-button"),
  deploy: document.querySelector("#deploy-button"),
  workOutput: document.querySelector("#work-output"),
  deployOutput: document.querySelector("#deploy-output"),
  save: document.querySelector("#save-button"),
  reset: document.querySelector("#reset-button"),
  keepPlaying: document.querySelector("#keep-playing"),
  newGame: document.querySelector("#new-game"),
  victorySummary: document.querySelector("#victory-summary"),
  releaseNotes: document.querySelector("#release-notes"),
};

try {
  const progression = await loadProgression("./data/progression.json");
  const state = new GameState(progression);
  const statusBar = new StatusBar(document.querySelector("#status-bar"));
  const controls = new CoreControls(
    elements.work,
    elements.deploy,
    elements.workOutput,
    elements.deployOutput,
    {
      work: (times) => state.work(times),
      deploy: (times) => state.deploy(times),
    },
  );
  const tree = new SkillTree(
    document.querySelector("#available-nodes"),
    document.querySelector("#installed-nodes"),
    (id) => state.install(id),
  );
  const eventLog = new EventLog(document.querySelector("#event-log"));

  const render = () => {
    statusBar.render(state);
    controls.render(state);
    tree.render(state);
    eventLog.render(state);

    if (state.isComplete && !state.victoryAcknowledged) {
      showVictory(state);
    }
  };

  const startGame = (loadSave = false) => {
    if (loadSave) state.load();
    elements.boot.hidden = true;
    elements.victory.hidden = true;
    elements.game.hidden = false;
    state.startTicker();
    render();
  };

  elements.continue.hidden = !state.hasSave();
  elements.start.addEventListener("click", () => {
    state.reset();
    startGame();
  });
  elements.continue.addEventListener("click", () => startGame(true));
  elements.save.addEventListener("click", () => {
    state.save();
    state.log.unshift("MANUAL SAVE COMPLETE.");
    render();
  });
  elements.reset.addEventListener("click", () => {
    if (window.confirm("Erase all USA-OS progress?")) {
      state.reset();
      window.location.reload();
    }
  });
  elements.keepPlaying.addEventListener("click", () => {
    state.acknowledgeVictory();
    elements.victory.hidden = true;
    elements.game.hidden = false;
  });
  elements.newGame.addEventListener("click", () => {
    state.reset();
    elements.victory.hidden = true;
    startGame();
  });
  state.addEventListener("change", render);

  window.addEventListener("keydown", (event) => {
    if (elements.game.hidden || event.repeat) return;
    if (event.key.toLowerCase() === "a") state.work(event.shiftKey ? 10 : 1);
    if (event.key.toLowerCase() === "b") state.deploy(event.shiftKey ? 10 : 1);
  });
} catch (error) {
  document.querySelector("#game").innerHTML = `
    <section class="panel">
      <h2>BOOT FAILURE</h2>
      <p>${error.message}</p>
      <p>Run this project through a local static web server so the JSON file can load.</p>
    </section>
  `;
}

function showVictory(state) {
  state.save();
  elements.game.hidden = true;
  elements.victory.hidden = false;
  elements.victorySummary.textContent =
    `All ${state.installed.length} historical packages are installed.`;
  elements.releaseNotes.textContent = buildReleaseNotes(state);
}
