import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client with the service key: bypasses RLS. Only for server code without a session (the alert ingest route, D51),
 * which must fix `user_id` itself in every query. Never with a `NEXT_PUBLIC_` variable.
 */
export function createServiceClient(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
