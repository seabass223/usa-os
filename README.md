# USA-OS POC

A deliberately ugly, dependency-free clicker/skill-tree prototype.

## Run

The game loads its progression from `data/progression.json`, so open it through
a local static server rather than directly from the filesystem.

Examples:

```powershell
node scripts/serve.mjs
```

Then open `http://localhost:8000`.

## Controls

- `A`: generate CPU cycles.
- `B`: convert all CPU cycles into progress.
- Hold either on-screen button to repeat.
- Hold `Shift` while clicking or pressing `A`/`B` for 10 operations.
- Spend progress to install every available historical package.

Progress autosaves in `localStorage`.

## Tests

With the local server running:

```powershell
node tests/playthrough.mjs
node tests/browser-smoke.mjs
```

The first test completes the economy directly. The second uses installed
Microsoft Edge in headless mode to click from boot through all 41 nodes and
assert the victory screen.

## Structure

- `data/progression.json`: progression graph, costs, descriptions, and effects.
- `js/game-state.js`: economy, progression, saves, and victory state.
- `js/components.js`: DOM components.
- `js/data-loader.js`: progression loading and validation.
- `js/app.js`: application wiring and screen flow.
- `tests/playthrough.mjs`: dependency and economy playthrough.
- `tests/browser-smoke.mjs`: rendered start-to-finish browser playthrough.
