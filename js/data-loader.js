export async function loadGameData() {
  const [progression, economy] = await Promise.all([
    loadJson("./data/progression.json"),
    loadJson("./data/economy.json"),
  ]);

  validateProgression(progression);
  validateEconomy(economy);
  return { progression, economy };
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status}).`);
  return response.json();
}

function validateProgression(data) {
  if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) {
    throw new Error("Progression JSON must contain nodes.");
  }
  const ids = new Set(data.nodes.map((node) => node.id));
  if (ids.size !== data.nodes.length) throw new Error("Duplicate milestone IDs.");
  for (const node of data.nodes) {
    for (const requirement of node.requires ?? []) {
      if (!ids.has(requirement)) {
        throw new Error(`${node.id} requires unknown milestone ${requirement}.`);
      }
    }
  }
}

function validateEconomy(data) {
  if (!data?.settings || !Array.isArray(data.assets) || !Array.isArray(data.eras)) {
    throw new Error("Economy JSON is incomplete.");
  }
  const ids = new Set(data.assets.map((asset) => asset.id));
  if (ids.size !== data.assets.length) throw new Error("Duplicate asset IDs.");
}
