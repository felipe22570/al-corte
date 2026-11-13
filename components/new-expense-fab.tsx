import { Plus } from "lucide-react";
import Link from "next/link";

export function NewExpenseFab() {
  return <Link href="/movimientos/nuevo" className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-body font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"><Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />Nuevo gasto</Link>;
}
