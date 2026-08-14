import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESET_DIR = join(__dirname, "../site/data/presets");

/**
 * Deep-merge preset overlay onto base (objects only; arrays replaced).
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
 * @param {string} name preset filename without path (e.g. stage2-default)
 */
export function loadPresetSync(name) {
  const file = name.endsWith(".json") ? name : `${name}.json`;
  const path = join(PRESET_DIR, file);
  const preset = JSON.parse(readFileSync(path, "utf8"));
  if (!preset.extends) return preset;
  const baseName = preset.extends.replace(/\.json$/, "");
  return mergePresets(loadPresetSync(baseName), preset);
}
