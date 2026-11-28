import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { DraftActions } from "@/components/draft-actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ReviewLine } from "@/components/review-line";
import { StatusBadge } from "@/components/status-badge";
import { todayInBogota } from "@/lib/domain/dates";
import { formatDateShort, formatMoney } from "@/lib/format";
import { historyTypeLabels } from "@/lib/history-types";
import { loadDraftInbox, type DraftCardLabel } from "@/lib/queries/draft-inbox";
import type { InboxDraft } from "@/lib/queries/drafts";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata: Metadata = { title: "Por confirmar" };

function draftName(draft: InboxDraft): string {
  return draft.suggestions?.merchantName ?? draft.merchantRaw ?? "Movimiento sin leer";
}

function Suggestions({ draft, categories }: { draft: InboxDraft; categories: Map<string, string> }) {
  const suggestion = draft.suggestions;
  if (!suggestion) return null;
  const items = [
    suggestion.merchantName && suggestion.merchantName !== draft.merchantRaw ? `Nombre: ${suggestion.merchantName}` : null,
    suggestion.categoryId && categories.has(suggestion.categoryId) ? `Categoría: ${categories.get(suggestion.categoryId)}` : null,
    suggestion.installmentsCount ? `${suggestion.installmentsCount} ${suggestion.installmentsCount === 1 ? "cuota" : "cuotas"}` : null,
    suggestion.billingCurrency && suggestion.billingCurrency !== draft.currency ? `Puede facturarse en ${suggestion.billingCurrency}` : null,
    suggestion.isInternational ? "Compra internacional" : null,
  ].filter((item): item is string => !!item);
  if (!items.length && !suggestion.reason) return null;
  return <div className="flex min-w-0 flex-col gap-1 rounded-md border border-border p-3">
    <p className="text-small text-muted-foreground">Sugerido · confianza {suggestion.confidence}</p>
    {items.length > 0 && <p className="text-small wrap-anywhere">{items.join(" · ")}</p>}
    {suggestion.reason && <p className="text-small text-muted-foreground wrap-anywhere">{suggestion.reason}</p>}
  </div>;
}

function DraftItem({ draft, cards, categories, today }: { draft: InboxDraft; cards: Map<string, DraftCardLabel>; categories: Map<string, string>; today: string }) {
  const card = draft.cardId ? cards.get(draft.cardId) : undefined;
  const name = draftName(draft);
  const details = [
    draft.occurredOn ? formatDateShort(draft.occurredOn, today) : null,
    draft.occurredTime,
    card ? `${card.name} •••• ${card.last4}` : draft.last4 ? `•••• ${draft.last4}` : null,
    draft.type && draft.type !== "purchase" ? historyTypeLabels[draft.type] : null,
  ].filter(Boolean).join(" · ");
  const candidates = draft.candidates.map((candidate) => ({
    id: candidate.id,
    label: `${candidate.merchant || "Sin comercio"} · ${formatDateShort(candidate.date, today)} · ${formatMoney(candidate.amount, candidate.currency)}`,
  }));
  return <ReviewLine title={name} details={details} amount={draft.amount} currency={draft.currency}>
    <div className="flex min-w-0 flex-col gap-3 pt-1">
      {draft.status === "unknown_card" && <StatusBadge tone="neutral" text="Tarjeta no registrada" />}
      {draft.status === "needs_review" && <StatusBadge tone="neutral" text="Revisar" />}
      {draft.readByAi && <p className="text-small wrap-anywhere">Leído con IA. Revisa el valor, la fecha y la tarjeta antes de confirmar.</p>}
      <p className="text-small text-muted-foreground wrap-anywhere">Del correo: «{draft.phrase}»</p>
      {draft.subscription && <p className="text-small wrap-anywhere">{draft.subscription.change
        ? `${draft.subscription.name} cobró ${formatMoney(draft.subscription.change.charged, draft.subscription.change.currency)}; tu suscripción dice ${formatMoney(draft.subscription.change.expected, draft.subscription.change.currency)}.`
        : `Parece el cobro de tu suscripción ${draft.subscription.name}.`}</p>}
      <Suggestions draft={draft} categories={categories} />
      {draft.statementCutoff && card && <p className="text-small text-muted-foreground">Iría al extracto con corte del {formatDateShort(draft.statementCutoff, today)}.</p>}
      <DraftActions draftId={draft.id} name={name} candidates={candidates} />
    </div>
  </ReviewLine>;
}

export default async function DraftsPage() {
  const { supabase, user } = await requireUser();
  const today = todayInBogota();
  const { drafts, cards, categories } = await loadDraftInbox(supabase, user.id);
  return <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-6">
    <PageHeader title="Por confirmar" subtitle="Movimientos que llegaron de tus alertas. No cuentan en tus meses hasta que los confirmes." />
    {drafts.length === 0
      ? <EmptyState icon={Inbox} text="No tienes movimientos por confirmar." />
      : <section aria-label={`Movimientos por confirmar (${drafts.length})`} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <ul className="grid gap-3">{drafts.map((draft) => <DraftItem key={draft.id} draft={draft} cards={cards} categories={categories} today={today} />)}</ul>
      </section>}
  </div>;
}
