import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { V2_BASE } from "@/lib/routes";
import { getSupabaseEnv } from "./env";

/**
 * Paths that need a session before rendering. The current interface checks it in its layout; the new one (D58) is also
 * guarded here so no page under `/v2` renders without a session. Step 56 revisits this when the base moves to the root.
 */
export function requiresSession(pathname: string): boolean {
  return pathname === V2_BASE || pathname.startsWith(`${V2_BASE}/`);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseEnv();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && requiresSession(request.nextUrl.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    const redirect = NextResponse.redirect(login);
    // Keep any cookie the session refresh changed (for example, a cleared expired session).
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
