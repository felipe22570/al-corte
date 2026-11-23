import "server-only";

import { z } from "zod";

export type IngestConfig = { secret: string; userId: string; supabaseUrl: string; serviceKey: string };

/**
 * D51: signing secret, owner and service key only in server variables. Missing or invalid values disable the route
 * (503) instead of accepting unsigned requests. The secret needs at least 32 characters.
 */
export function readIngestConfig(env: Record<string, string | undefined> = process.env): IngestConfig | null {
  const parsed = z.object({
    INGEST_SIGNING_SECRET: z.string().trim().min(32),
    INGEST_USER_ID: z.uuid(),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().trim().min(1),
  }).safeParse(env);
  if (!parsed.success) return null;
  return { secret: parsed.data.INGEST_SIGNING_SECRET, userId: parsed.data.INGEST_USER_ID, supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL, serviceKey: parsed.data.SUPABASE_SECRET_KEY };
}
