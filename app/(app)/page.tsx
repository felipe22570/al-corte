import type { Metadata } from "next";
import { WalletCards } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NewExpenseFab } from "@/components/new-expense-fab";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Tablero" };

export default function DashboardPage() {
  return <><PageHeader title="Tablero" subtitle="Tus tarjetas, claras antes de cada corte." /><EmptyState icon={WalletCards} text="Aún no tienes tarjetas. Podrás agregarlas desde Ajustes." /><NewExpenseFab /></>;
}
