import type { Metadata } from "next";
import { List } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Movimientos" };
export default function MovimientosPage() {
  return <><PageHeader title="Movimientos" subtitle="Consulta tus gastos y pagos." /><EmptyState icon={List} text="Aún no tienes movimientos registrados." /></>;
}
