import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Extracto" };
export default function StatementDetailPage() {
  return <><PageHeader title="Extracto" /><EmptyState icon={FileText} text="El detalle del extracto estará disponible pronto." /></>;
}
