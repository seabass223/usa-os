import { spawn } from "node:child_process";
import { join } from "node:path";

const storageAccount = "kylephoto";
const container = "summer-into-ai";
const virtualDir = readOption("--dir") ?? process.env.USA_OS_DEPLOY_DIR ?? "usa-os";
const distPath = join(process.cwd(), "dist");
const dryRun = process.argv.includes("--dry-run");
const azureCli = process.platform === "win32" ? "az.cmd" : "az";

await import("./build.mjs");

const commands = [
  {
    label: `Removing old blobs at ${container}/${virtualDir}/`,
    command: azureCli,
    args: [
      "storage",
      "blob",
      "delete-batch",
      "--account-name",
      storageAccount,
      "--source",
      container,
      "--pattern",
      `${virtualDir}/*`,
      "--auth-mode",
      "key",
      "--only-show-errors",
    ],
  },
  {
    label: `Uploading dist/ to ${container}/${virtualDir}/`,
    command: azureCli,
    args: [
      "storage",
      "blob",
      "upload-batch",
      "--account-name",
      storageAccount,
      "--destination",
      container,
      "--destination-path",
      virtualDir,
      "--source",
      distPath,
      "--overwrite",
      "true",
      "--auth-mode",
      "key",
      "--only-show-errors",
    ],
  },
];

for (const step of commands) {
  await run(step);
}

if (dryRun) {
  console.log("USA-OS deploy dry run complete. No blobs were changed.");
} else {
  console.log(
    `USA-OS deployed to https://${storageAccount}.blob.core.windows.net/${container}/${virtualDir}/`,
  );
}

function run({ label, command, args }) {
  console.log(label);
  if (dryRun) {
    console.log(formatCommand(command, args));
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let child;
    try {
      const useWindowsShell = process.platform === "win32";
      child = spawn(useWindowsShell ? formatCommand(command, args) : command, useWindowsShell ? [] : args, {
        shell: useWindowsShell,
        stdio: "inherit",
        windowsHide: true,
      });
    } catch (error) {
      reject(formatSpawnError(error));
      return;
    }

    child.on("error", (error) => {
      reject(formatSpawnError(error));
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function formatSpawnError(error) {
  if (error.code === "ENOENT" || error.code === "EINVAL") {
    return new Error(
      "Azure CLI could not be launched. Install Azure CLI, make sure `az --version` works in this terminal, then run `az login` before deploying.",
    );
  }
  return error;
}

function formatCommand(command, args) {
  return [command, ...args.map(quoteArgument)].join(" ");
}

function quoteArgument(value) {
  if (!/\s/.test(value)) return value;
  return `"${value.replaceAll('"', '\\"')}"`;
}

function readOption(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}
