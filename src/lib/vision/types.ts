import { z } from "zod";
import { CATEGORIES } from "@/lib/domain";

export const SHOT_TYPES = ["door", "shelf", "drawer", "pantry", "unknown"] as const;
export type ShotType = (typeof SHOT_TYPES)[number];

/**
 * The contract between the vision model and the rest of the app. The same
 * shape is sent to the model as a tool input schema and used to validate what
 * comes back, so a malformed response fails loudly instead of silently
 * poisoning the inventory.
 */
export const visionItemSchema = z.object({
  slug: z.string().min(1),
  display_name: z.string().min(1),
  category: z.enum([...CATEGORIES, "other"]),
  availability: z.enum(["plenty", "low"]),
  confidence: z.number().min(0).max(1),
  shot: z.enum(SHOT_TYPES).optional(),
  notes: z.string().optional(),
});

export const visionResultSchema = z.object({
  shots_processed: z.array(z.enum(SHOT_TYPES)),
  items: z.array(visionItemSchema),
  unreadable_shots: z.array(z.string()).default([]),
});

export type VisionItem = z.infer<typeof visionItemSchema>;
export type VisionResult = z.infer<typeof visionResultSchema>;

/**
 * JSON Schema handed to the model as a tool definition. `strict: true` on the
 * tool requires `additionalProperties: false` and an explicit `required` list
 * at every object level, which is also what makes the arguments safe to parse.
 */
export const VISION_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shots_processed", "items"],
  properties: {
    shots_processed: {
      type: "array",
      items: { type: "string", enum: SHOT_TYPES },
      description: "Which kind of shot each supplied photo turned out to be.",
    },
    items: {
      type: "array",
      description: "One entry per distinct food, deduplicated across photos.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slug", "display_name", "category", "availability", "confidence"],
        properties: {
          slug: {
            type: "string",
            description:
              "snake_case identifier. MUST be copied from the supplied catalog when any catalog item matches.",
          },
          display_name: { type: "string" },
          category: { type: "string", enum: [...CATEGORIES, "other"] },
          availability: {
            type: "string",
            enum: ["plenty", "low"],
            description: "'low' only when the container is visibly nearly empty.",
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          shot: { type: "string", enum: SHOT_TYPES },
          notes: {
            type: "string",
            description: "Only if the item looks spoiled or near expiry.",
          },
        },
      },
    },
    unreadable_shots: {
      type: "array",
      items: { type: "string" },
      description: "Reasons any photo could not be read (too dark, blurry, closed door).",
    },
  },
};

export type VisionInput = {
  /** Image bytes with their media types, in shot order. */
  images: readonly { base64: string; mediaType: string; shotType: ShotType }[];
};

/** Every provider — stub or live — satisfies this. */
export type VisionProvider = {
  readonly name: string;
  analyze(input: VisionInput): Promise<VisionResult>;
};
