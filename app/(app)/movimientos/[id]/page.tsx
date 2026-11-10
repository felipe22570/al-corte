import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Detalle del movimiento" };
export default function MovementDetailPage() {
  return <><PageHeader title="Detalle del movimiento" /><EmptyState icon={ReceiptText} text="El detalle de movimientos estará disponible pronto." /></>;
}
