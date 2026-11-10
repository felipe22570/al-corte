import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Detalle de tarjeta" };
export default function CardDetailPage() {
  return <><PageHeader title="Detalle de tarjeta" /><EmptyState icon={CreditCard} text="El detalle de tus tarjetas estará disponible pronto." /></>;
}
