/**
 * Load and merge MiraSpace preset JSON (supports `extends`).
 */

/**
 * @param {object} base
 * @param {object} overlay
 */
export function mergePresets(base, overlay) {
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(overlay)) {
    if (key === "extends") continue;
    if (value && typeof value === "object" && !Array.isArray(value) && out[key] && typeof out[key] === "object") {
      out[key] = mergePresets(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * @param {string} name e.g. stage0-default or stage2-default
 */
export async function loadPreset(name = "stage0-default") {
  const file = name.endsWith(".json") ? name : `${name}.json`;
  const response = await fetch(`./data/presets/${file}`);
  if (!response.ok) {
    throw new Error(`Failed to load preset ${file}: ${response.status}`);
  }
  const preset = await response.json();
  if (!preset.extends) return preset;
  const baseName = preset.extends.replace(/\.json$/, "");
  const base = await loadPreset(baseName);
  return mergePresets(base, preset);
}

/**
 * @param {URLSearchParams} params
 * @param {string} fallback
 */
export function parsePresetFromUrl(params, fallback = "stage0-default") {
  const raw = params.get("preset");
  if (!raw) return fallback;
  return raw.replace(/\.json$/, "");
}
