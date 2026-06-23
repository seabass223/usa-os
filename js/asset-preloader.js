const AUDIO_TIMEOUT_MS = 3500;

export async function preloadAssets(assets, onProgress = () => {}) {
  const uniqueAssets = dedupeAssets(assets);
  let completed = 0;
  const total = uniqueAssets.length;

  const report = (asset, status) => {
    completed += 1;
    onProgress({
      asset,
      completed,
      total,
      status,
      percent: total ? Math.round((completed / total) * 100) : 100,
    });
  };

  const results = await Promise.allSettled(
    uniqueAssets.map(async (asset) => {
      try {
        await preloadAsset(asset);
        report(asset, "loaded");
      } catch (error) {
        report(asset, "failed");
        throw error;
      }
    }),
  );

  return {
    total,
    loaded: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}

function dedupeAssets(assets) {
  const seen = new Set();
  return assets.filter((asset) => {
    const key = `${asset.type}:${asset.src ?? asset.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function preloadAsset(asset) {
  if (asset.type === "image") return preloadImage(asset.src);
  if (asset.type === "audio") return preloadAudio(asset.src);
  if (asset.type === "font") return preloadFont(asset.name);
  return Promise.resolve();
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = async () => {
      try {
        if (image.decode) await image.decode();
      } catch {
        // Decoding is a nice-to-have; the asset is already fetched.
      }
      resolve();
    };
    image.onerror = reject;
    image.src = src;
  });
}

function preloadAudio(src) {
  return fetchWithTimeout(src, AUDIO_TIMEOUT_MS)
    .then((response) => {
      if (!response.ok) throw new Error(`Audio preload failed: ${src}`);
      return response.arrayBuffer();
    })
    .catch(() => preloadPlayableAudio(src));
}

function preloadPlayableAudio(src) {
  return new Promise((resolve) => {
    const audio = new Audio();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      audio.removeEventListener("canplaythrough", finish);
      audio.removeEventListener("loadeddata", finish);
      audio.removeEventListener("error", finish);
      resolve();
    };

    audio.preload = "auto";
    audio.addEventListener("canplaythrough", finish, { once: true });
    audio.addEventListener("loadeddata", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    audio.src = src;
    audio.load();
    window.setTimeout(finish, AUDIO_TIMEOUT_MS);
  });
}

function fetchWithTimeout(src, timeoutMs) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(src, {
    cache: "force-cache",
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timer));
}

function preloadFont(name) {
  if (!document.fonts?.load) return Promise.resolve();
  return document.fonts.load(`12px "${name}"`);
}
