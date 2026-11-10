import { notFound } from "next/navigation";
import { WalletCards } from "lucide-react";
import { AppWordmark } from "@/components/app-wordmark";
import { CardColorChip } from "@/components/card-color-chip";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UtilizationBar } from "@/components/utilization-bar";
import { CARD_COLORS, cardColorNames } from "@/lib/card-colors";

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
    <AppWordmark /><PageHeader title="Sistema de diseño" subtitle="Catálogo de componentes" action={<ThemeToggle />} />
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"><h2 className="text-heading">Tipografía</h2><p className="text-title">Título de pantalla</p><p className="text-body">Texto principal de la aplicación</p><p className="text-small text-muted-foreground">Texto secundario y ayudas</p><p className="text-amount">$15.000</p></section>
    <section className="flex flex-wrap gap-4"><Button>Primario</Button><Button variant="outline">Secundario</Button><Button variant="ghost">Alternativo</Button></section>
    <Input aria-label="Campo de ejemplo" placeholder="Campo de ejemplo" />
    <section className="flex flex-wrap gap-2"><StatusBadge tone="ok" text="Al día" /><StatusBadge tone="warning" text="Pronto" /><StatusBadge tone="danger" text="Vencido" /><StatusBadge tone="neutral" text="Sin estado" /></section>
    <section className="flex flex-wrap gap-4">{CARD_COLORS.map((color) => <CardColorChip key={color} color={color} name={cardColorNames[color]} />)}</section>
    <Money value="1284500" currency="COP" size="lg" /><UtilizationBar percent={68} />
    <EmptyState icon={WalletCards} text="Aún no tienes tarjetas. Agrega la primera." />
  </main>;
}
