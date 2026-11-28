import { redirect } from "next/navigation";

import { createClient } from "./server";

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Session check of a server page: its Supabase client and the signed-in user, or the login otherwise. */
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
