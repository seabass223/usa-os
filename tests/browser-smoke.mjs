import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
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

  const result = await evaluate(`
    (async () => {
      const click = (selector, count = 1) => {
        for (let index = 0; index < count; index += 1) {
          document.querySelector(selector).click();
        }
      };

      click("#start-game");
      click("#work-button", 8);
      click("#deploy-button");
      click("[data-install='plymouth']");
      click("#save-button");

      return {
        gameVisible: !document.querySelector("#game-screen").hidden,
        installedPlymouth: Boolean(
          [...document.querySelectorAll("#installed-nodes h3")].find((node) =>
            node.textContent.includes("LAND AT PLYMOUTH"),
          ),
        ),
        nextNodeAvailable: Boolean(
          document.querySelector("[data-install='explore']"),
        ),
        hasSave: Boolean(localStorage.getItem("usa-os-poc-save-v1")),
        bootFailure: document.body.textContent.includes("BOOT FAILURE"),
      };
    })()
  `);

  for (const [name, passed] of Object.entries({
    gameVisible: result.gameVisible,
    installedPlymouth: result.installedPlymouth,
    nextNodeAvailable: result.nextNodeAvailable,
    hasSave: result.hasSave,
    noBootFailure: !result.bootFailure,
  })) {
    if (!passed) throw new Error(`Browser assertion failed: ${name}`);
  }

  const completion = await evaluate(`
    (() => {
      let rounds = 0;

      while (document.querySelector("#victory-screen").hidden && rounds < 5000) {
        const installButton = document.querySelector(
          "#available-nodes button:not([disabled])",
        );

        if (installButton) {
          installButton.click();
        } else {
          for (let index = 0; index < 10; index += 1) {
            document.querySelector("#work-button").click();
          }
          document.querySelector("#deploy-button").click();
        }
        rounds += 1;
      }

      return {
        rounds,
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
    allNodesInstalled: completion.installedCount === 41,
    releaseNotesPresent: completion.releaseNotesPresent,
  })) {
    if (!passed) throw new Error(`Completion assertion failed: ${name}`);
  }

  console.log(JSON.stringify({ firstPatch: result, completion }, null, 2));
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
  await wait(300);
  await rm(profilePath, { recursive: true, force: true });
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
