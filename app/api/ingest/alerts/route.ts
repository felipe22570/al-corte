import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { readAiConfig, readAnthropicApiKey } from "@/lib/ai/config";
import { createAnthropicClient } from "@/lib/ai/context";
import { supabaseUsageStore } from "@/lib/ai/usage";
import { addMonths, todayInBogota } from "@/lib/domain/dates";
import { enrichDraft } from "@/lib/ingest/ai-enrichment";
import { readIngestConfig } from "@/lib/ingest/config";
import { ingestAlert, MAX_BODY_BYTES } from "@/lib/ingest/ingest-alert";
import { supabaseEnrichStore, supabaseIngestStore } from "@/lib/ingest/supabase-store";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
/** Covers the AI suggestions that run after answering (step 43); the script never waits for them. */
export const maxDuration = 60;

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Alerts captured by the owner's Apps Script (F18, D43). Signed with HMAC, no session: it writes with the service key
 * and always as `INGEST_USER_ID` (D51). Answers carry no internal details and the phrase is never logged.
 */
export async function POST(request: Request) {
  const config = readIngestConfig();
  if (!config) return json(503, { ok: false });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json(413, { ok: false });
  let body: string;
  try {
    body = await request.text();
  } catch {
    return json(400, { ok: false });
  }
  const supabase = createServiceClient(config.supabaseUrl, config.serviceKey);
  const result = await ingestAlert(
    { body, timestamp: request.headers.get("x-al-corte-timestamp"), signature: request.headers.get("x-al-corte-signature") },
    { secret: config.secret, userId: config.userId, store: supabaseIngestStore(supabase), now: new Date() },
  );
  const draftId = result.draftId;
  if (draftId) {
    revalidatePath("/");
    revalidatePath("/por-confirmar");
    // R10: AI only suggests and reads unknown formats; usage is logged for the owner and the monthly budget applies.
    after(async () => {
      try {
        const apiKey = readAnthropicApiKey();
        const ai = { userId: config.userId, client: apiKey ? createAnthropicClient(apiKey) : null, usage: supabaseUsageStore(supabase), config: readAiConfig() };
        await enrichDraft(draftId, { userId: config.userId, ai, store: supabaseEnrichStore(supabase), historySince: addMonths(todayInBogota(), -12) });
        revalidatePath("/por-confirmar");
      } catch {
        // A misconfigured AI layer leaves the draft without suggestions; the alert is already saved.
      }
    });
  }
  return json(result.status, result.body);
}
