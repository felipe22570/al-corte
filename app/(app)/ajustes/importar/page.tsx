import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatementImport } from "@/components/statement-import";
import { todayInBogota } from "@/lib/domain/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Importar extracto" };

export default async function StatementImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
    <PageHeader title="Importar extracto" subtitle="Agrega lo que no registraste a mano. Nunca cambia ni borra tus movimientos." />
    <StatementImport today={todayInBogota()} />
  </div>;
}
