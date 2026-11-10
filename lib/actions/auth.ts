"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function loginUrl(message: string) {
  return `/login?error=${encodeURIComponent(message)}`;
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

  redirect("/movimientos");
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
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
