import type { Metadata } from "next";
import { WalletCards } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NewExpenseFab } from "@/components/new-expense-fab";
import { PageHeader } from "@/components/page-header";
import { SaveNotice } from "@/components/save-notice";

export const metadata: Metadata = { title: "Tablero" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  return <>{saved === "1" && <SaveNotice />}<PageHeader title="Tablero" subtitle="Tus tarjetas, claras antes de cada corte." /><EmptyState icon={WalletCards} text="Tu tablero estará disponible pronto." /><NewExpenseFab /></>;
}
