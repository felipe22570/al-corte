import { type NextRequest, NextResponse } from "next/server";

import { safeInternalPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // D63: the screen to open comes only as a validated internal path.
      return NextResponse.redirect(`${origin}${safeInternalPath(searchParams.get("next"), "/movimientos")}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=No%20fue%20posible%20validar%20el%20enlace.`);
}
