import { revalidatePath } from "next/cache";

import { readIngestConfig } from "@/lib/ingest/config";
import { ingestAlert, MAX_BODY_BYTES } from "@/lib/ingest/ingest-alert";
import { supabaseIngestStore } from "@/lib/ingest/supabase-store";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

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
  const result = await ingestAlert(
    { body, timestamp: request.headers.get("x-al-corte-timestamp"), signature: request.headers.get("x-al-corte-signature") },
    { secret: config.secret, userId: config.userId, store: supabaseIngestStore(createServiceClient(config.supabaseUrl, config.serviceKey)), now: new Date() },
  );
  if (result.body.ok && result.body.result === "created") {
    revalidatePath("/");
    revalidatePath("/por-confirmar");
  }
  return json(result.status, result.body);
}
