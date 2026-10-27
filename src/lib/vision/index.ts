import { anthropicProvider } from "./anthropic";
import type { FixtureName } from "./fixtures";
import { stubProvider } from "./stub";
import type { VisionProvider } from "./types";

export type { VisionProvider, VisionInput, VisionResult, ShotType } from "./types";
export { normalizeScan, type NormalizedScan, type NormalizedItem } from "./normalize";
export { FIXTURE_NAMES, type FixtureName } from "./fixtures";

/**
 * Resolves the provider from the environment. `stub` is the default so that a
 * fresh clone runs end to end with no credentials.
 */
export function getVisionProvider(fixture?: FixtureName): VisionProvider {
  if (process.env.VISION_PROVIDER === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error("VISION_PROVIDER=anthropic אבל ANTHROPIC_API_KEY לא מוגדר.");
    }
    return anthropicProvider(key);
  }
  return stubProvider(fixture);
}
