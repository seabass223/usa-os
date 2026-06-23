import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);

const productionEntries = [
  "index.html",
  "styles.css",
  "assets",
  "data",
  "js",
  "vendor",
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of productionEntries) {
  const source = new URL(entry, root);
  const destination = new URL(basename(entry), dist);
  const sourceStat = await stat(source);
  await cp(source, destination, {
    recursive: sourceStat.isDirectory(),
    force: true,
    errorOnExist: false,
  });
}

await writeFile(
  new URL("build-info.json", dist),
  JSON.stringify(
    {
      name: "USA-OS",
      builtAt: new Date().toISOString(),
      output: "dist",
    },
    null,
    2,
  ),
);

console.log(`USA-OS production build written to ${join(process.cwd(), "dist")}`);
