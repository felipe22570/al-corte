import type { Metadata } from "next";
import { Repeat } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Suscripciones" };
export default function SubscriptionsPage() {
  return <><PageHeader title="Suscripciones" subtitle="Consulta tus cobros recurrentes." /><EmptyState icon={Repeat} text="Aún no tienes suscripciones registradas." /></>;
}
