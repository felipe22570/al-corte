import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WalletCards } from "lucide-react";
import { AppWordmark } from "@/components/app-wordmark";
import { CardColorChip } from "@/components/card-color-chip";
import { CardSummary } from "@/components/card-summary";
import { DesignControlsPreview } from "@/components/design-controls-preview";
import { DesignSheetPreview } from "@/components/design-sheet-preview";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { MonthlySpendingChart } from "@/components/monthly-spending-chart";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UtilizationBar } from "@/components/utilization-bar";
import { CARD_COLORS, cardColorNames } from "@/lib/card-colors";

export const metadata: Metadata = { title: "Sistema de diseño" };

const exampleCards = CARD_COLORS.map((color, index) => ({
  id: `example-${index + 1}`,
  color,
  name: `Tarjeta de ejemplo ${index + 1}`,
  bank: cardColorNames[color],
  last4: `${index + 1}234`,
  available: index % 3 === 0 ? "3750000" : index % 3 === 1 ? "1600000" : "500000",
  utilization: index % 3 === 0 ? "0.25" : index % 3 === 1 ? "0.68" : "0.9",
  payment: index === 5 ? null : { total: "1284500", dueDate: index % 3 === 0 ? "2026-12-02" : index % 3 === 1 ? "2026-11-15" : "2026-11-12" },
}));

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
    <AppWordmark /><PageHeader title="Sistema de diseño" subtitle="Catálogo de componentes" action={<ThemeToggle />} />
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"><h2 className="text-heading">Tipografía</h2><p className="text-title">Título de pantalla</p><p className="text-body">Texto principal de la aplicación</p><p className="text-small text-muted-foreground">Texto secundario y ayudas</p><p className="text-amount">$15.000</p></section>
    <section className="flex flex-wrap gap-4"><Button>Primario</Button><Button variant="outline">Secundario</Button><Button variant="ghost">Alternativo</Button><Button variant="destructive">Borrar ejemplo</Button><Button variant="link">Enlace de ejemplo</Button></section>
    <Input aria-label="Campo de ejemplo" placeholder="Campo de ejemplo" />
    <section aria-labelledby="design-statuses" className="flex min-w-0 flex-col gap-3"><h2 id="design-statuses" className="text-heading">Estados en columna</h2><StatusBadge tone="ok" text="Al día" /><StatusBadge tone="warning" text="Pronto" /><StatusBadge tone="danger" text="Vencido" /><StatusBadge tone="neutral" text="Pendiente de revisión del extracto de una tarjeta con un nombre largo" /></section>
    <section className="flex flex-wrap gap-4">{CARD_COLORS.map((color) => <CardColorChip key={color} color={color} name={cardColorNames[color]} />)}</section>
    <Money value="1284500" currency="COP" size="lg" /><UtilizationBar percent={68} />
    <section aria-labelledby="design-card-identity" className="flex min-w-0 flex-col gap-4">
      <h2 id="design-card-identity" className="text-heading">Identidad de tarjetas</h2>
      <p className="text-small text-muted-foreground">Datos de ejemplo. Cada tarjeta conserva su color en la franja, el chip y el gráfico; el estado depende del pago y la utilización.</p>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">{exampleCards.map((card) => <CardSummary key={card.id} {...card} today="2026-11-13" />)}</div>
      <MonthlySpendingChart cards={exampleCards} rows={[{ month: "2026-10", amounts: { "example-1": "320000", "example-2": "150000", "example-3": "80000", "example-4": "240000", "example-5": "180000", "example-6": "100000" } }, { month: "2026-11", amounts: { "example-1": "400000", "example-2": "200000", "example-3": "60000", "example-4": "160000", "example-5": "240000", "example-6": "80000" } }]} />
    </section>
    <EmptyState icon={WalletCards} text="Aún no tienes tarjetas. Agrega la primera." />
    <DesignControlsPreview />
    <DesignSheetPreview />
  </main>;
}
