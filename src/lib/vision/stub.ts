import { FIXTURES, type FixtureName } from "./fixtures";
import type { VisionInput, VisionProvider, VisionResult } from "./types";
import { visionResultSchema } from "./types";

/**
 * The MVP default. Returns a fixture instead of calling a model, so every
 * screen and every planner path is reachable with no API key and no cost.
 * Which fixture is chosen by the caller (the scan page passes `?fixture=`),
 * defaulting to a well-stocked fridge.
 */
export function stubProvider(fixture: FixtureName = "full"): VisionProvider {
  return {
    name: `stub:${fixture}`,
    async analyze(input: VisionInput): Promise<VisionResult> {
      // Keep the fixture honest about how many photos it was actually given.
      const raw = FIXTURES[fixture];
      const shots = input.images.map((i) => i.shotType);
      return visionResultSchema.parse({
        ...raw,
        shots_processed: shots.length > 0 ? shots : raw.shots_processed,
      });
    },
  };
}
