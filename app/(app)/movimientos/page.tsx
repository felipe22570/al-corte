import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Movimientos" };

export default async function MovimientosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center p-6">
      <h1 className="font-display text-title">Al Corte</h1>
      <p className="mt-2 text-muted-foreground">Sesión iniciada. El historial de movimientos estará disponible en el hito H7.</p>
      <p className="mt-4 text-small text-muted-foreground">{user?.email}</p>
      <form action={signOut} className="mt-4">
        <Button type="submit" variant="outline">Cerrar sesión</Button>
      </form>
    </main>
  );
}
