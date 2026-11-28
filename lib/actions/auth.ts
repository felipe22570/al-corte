"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeInternalPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

/** Where the current interface lands after signing in. */
const DEFAULT_AFTER_LOGIN = "/movimientos";

function loginUrl(message: string) {
  return `/login?error=${encodeURIComponent(message)}`;
}

/** An optional `next` field picks the screen to open after signing in, only as an internal path (D63). */
function nextPath(formData: FormData) {
  return safeInternalPath(formData.get("next"), DEFAULT_AFTER_LOGIN);
}

export async function signIn(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirect(loginUrl("Ingresa tu correo y contraseña."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(loginUrl("No fue posible iniciar sesión. Verifica tus datos."));
  }

  redirect(nextPath(formData));
}

export async function signInWithMagicLink(formData: FormData) {
  const email = formData.get("email");

  if (typeof email !== "string") {
    redirect(loginUrl("Ingresa tu correo."));
  }

  const origin = (await headers()).get("origin");
  if (!origin) {
    redirect(loginUrl("No fue posible preparar el enlace de acceso."));
  }

  const next = nextPath(formData);
  const callback = next === DEFAULT_AFTER_LOGIN ? "/auth/callback" : `/auth/callback?next=${encodeURIComponent(next)}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}${callback}` },
  });

  if (error) {
    redirect(loginUrl("No fue posible enviar el enlace de acceso."));
  }

  redirect("/login?message=Revisa tu correo para continuar.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
