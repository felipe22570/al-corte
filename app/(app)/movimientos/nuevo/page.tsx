import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Nuevo gasto" };
export default function NewExpensePage() {
  return <><PageHeader title="Nuevo gasto" /><EmptyState icon={ReceiptText} text="El registro de gastos estará disponible pronto." /></>;
}
