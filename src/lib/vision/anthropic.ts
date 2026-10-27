import Anthropic from "@anthropic-ai/sdk";
import { VISION_SYSTEM_PROMPT, userPrompt } from "./prompt";
import type { VisionInput, VisionProvider, VisionResult } from "./types";
import { VISION_TOOL_SCHEMA, visionResultSchema } from "./types";

/**
 * The live provider. The model records its findings through a strict tool
 * rather than free text, so the arguments are schema-valid on arrival; we
 * validate them again with zod, because a malformed scan must fail loudly
 * instead of half-populating the inventory.
 *
 * Note on `tool_choice`: forced tool use (`any` / `tool`) is rejected by
 * current models, so the call uses `auto` with `strict: true` and an explicit
 * instruction naming the tool, which is the supported equivalent.
 *
 * Swapping this in is a one-line env change (`VISION_PROVIDER=anthropic`);
 * nothing upstream of the `VisionProvider` interface knows the difference.
 */

const MODEL = "claude-opus-5-5";
const TOOL_NAME = "record_inventory";

export function anthropicProvider(apiKey: string): VisionProvider {
  const client = new Anthropic({ apiKey });

  return {
    name: `anthropic:${MODEL}`,
    async analyze(input: VisionInput): Promise<VisionResult> {
      const content: Anthropic.ContentBlockParam[] = [
        ...input.images.map(
          (img): Anthropic.ContentBlockParam => ({
            type: "image",
            source: {
              type: "base64",
              media_type: img.mediaType as "image/jpeg" | "image/png" | "image/webp",
              data: img.base64,
            },
          }),
        ),
        { type: "text", text: userPrompt(input.images.map((i) => i.shotType)) },
      ];

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: VISION_SYSTEM_PROMPT,
        tools: [
          {
            name: TOOL_NAME,
            description: "Record the lunchbox-relevant items visible in the photos.",
            input_schema: VISION_TOOL_SCHEMA as Anthropic.Tool["input_schema"],
            strict: true,
          },
        ],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content }],
      });

      if (response.stop_reason === "refusal") {
        throw new Error(
          `בקשת הראייה נדחתה: ${response.stop_details?.explanation ?? "לא ניתן הסבר"}`,
        );
      }

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock =>
          block.type === "tool_use" && block.name === TOOL_NAME,
      );
      if (!toolUse) {
        throw new Error("תשובת הראייה לא הכילה קריאה לכלי המלאי.");
      }

      return visionResultSchema.parse(toolUse.input);
    },
  };
}
