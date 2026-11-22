import "server-only";

import type { JSONOutputFormat } from "@anthropic-ai/sdk/resources/messages/messages";
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";
import { z } from "zod";

/**
 * JSON Schema for structured outputs (`output_config.format`). Zod 4 derives it and the SDK moves the constraints the
 * API does not accept (lengths, ranges) into descriptions and closes every object; `runTask` still enforces them
 * locally when it validates the answer with the same Zod schema.
 */
export function outputFormat(schema: z.ZodType): JSONOutputFormat {
  const jsonSchema = z.toJSONSchema(schema, { io: "output", unrepresentable: "throw" });
  return { type: "json_schema", schema: transformJSONSchema(jsonSchema as Parameters<typeof transformJSONSchema>[0]) as JSONOutputFormat["schema"] };
}
