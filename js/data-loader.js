export async function loadProgression(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load progression data (${response.status}).`);
  }

  const data = await response.json();
  validateProgression(data);
  return data;
}

function validateProgression(data) {
  if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) {
    throw new Error("Progression JSON must contain at least one node.");
  }

  const ids = new Set(data.nodes.map((node) => node.id));
  if (ids.size !== data.nodes.length) {
    throw new Error("Progression JSON contains duplicate node IDs.");
  }

  for (const node of data.nodes) {
    for (const requirement of node.requires ?? []) {
      if (!ids.has(requirement)) {
        throw new Error(`${node.id} requires unknown node ${requirement}.`);
      }
    }
  }
}
