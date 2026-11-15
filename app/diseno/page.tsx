import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WalletCards } from "lucide-react";
import Decimal from "decimal.js";
import { AppWordmark } from "@/components/app-wordmark";
import { CardColorChip } from "@/components/card-color-chip";
import { MonthCardsStrip } from "@/components/month-cards-strip";
import { MonthRow } from "@/components/month-row";
import { DesignControlsPreview } from "@/components/design-controls-preview";
import { DesignSheetPreview } from "@/components/design-sheet-preview";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UtilizationBar } from "@/components/utilization-bar";
import { CARD_COLORS, cardColorNames } from "@/lib/card-colors";
import { buildMonths } from "@/lib/domain/months";

export const metadata: Metadata = { title: "Sistema de diseño" };

const exampleCards = CARD_COLORS.map((color, index) => ({
  id: `example-${index + 1}`,
  color,
  name: `Tarjeta de ejemplo ${index + 1}`,
  bank: cardColorNames[color],
  last4: `${index + 1}234`,
  available: new Decimal(index % 3 === 0 ? "3750000" : index % 3 === 1 ? "1600000" : "500000"),
  utilization: new Decimal(index % 3 === 0 ? "0.25" : index % 3 === 1 ? "0.68" : "0.9"),
  used: new Decimal("100000"), handlingFee: new Decimal(0), cutoffDay: 15, paymentDay: 28, archived: false,
}));

const [exampleMonth] = buildMonths(exampleCards.map((card) => ({
  cardId: card.id, origin: "real" as const, cutoffDate: "2026-11-15", dueDate: "2026-11-28",
  paidAt: null, recordedTotal: new Decimal(100000), projectedTotal: new Decimal(0), unconvertedCharges: [],
})), "2026-11-13");

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
      <p className="text-small text-muted-foreground">Datos de ejemplo. Cada tarjeta conserva su color junto al nombre y en la composición del mes.</p>
      <MonthCardsStrip cards={exampleCards} />
      {exampleMonth && <MonthRow month={exampleMonth} cards={exampleCards} subscriptionNames={{}} featured />}
    </section>
    <EmptyState icon={WalletCards} text="Aún no tienes tarjetas. Agrega la primera." />
    <DesignControlsPreview />
    <DesignSheetPreview />
  </main>;
}
