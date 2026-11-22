import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

import { readAiConfig, readAnthropicApiKey } from "./config";
import type { AiContext } from "./types";
import { supabaseUsageStore } from "./usage";

/** Per attempt; the SDK retries connection errors, 429 and 5xx up to `maxRetries` times. */
export const AI_REQUEST_TIMEOUT_MS = 30_000;
export const AI_MAX_RETRIES = 2;

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, timeout: AI_REQUEST_TIMEOUT_MS, maxRetries: AI_MAX_RETRIES });
}

/** Server context for `runTask`: owner, Anthropic client (or `null` without key), usage log and configuration. */
export function createAiContext(supabase: SupabaseClient, userId: string, env: Record<string, string | undefined> = process.env): AiContext {
  const apiKey = readAnthropicApiKey(env);
  return {
    userId,
    client: apiKey ? createAnthropicClient(apiKey) : null,
    usage: supabaseUsageStore(supabase),
    config: readAiConfig(env),
  };
}
