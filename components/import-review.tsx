"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Money } from "@/components/money";
import { Disclosure, DisclosureContent, DisclosureSummary } from "@/components/ui/disclosure";
import type { ImportDecision, ReviewRow, ReviewStatus } from "@/lib/import/monthly-review";
import { formatDateShort, formatMoney } from "@/lib/format";

type CardLabel = { name: string; last4: string };
const groups: Array<{ status: ReviewStatus; title: string; help?: string; folded?: boolean }> = [
  { status: "new", title: "Nuevos", help: "Se importan los que dejes marcados." },
  { status: "conflict", title: "En conflicto", help: "Se parecen a un movimiento que ya tienes. Decide cada uno; por defecto no se importan." },
  { status: "payment_missing", title: "Pagos sin registrar", help: "Los pagos no se importan: necesitan su tipo y reparto. Regístralos desde el extracto." },
  { status: "statement_conflict", title: "Revisar en el cierre", help: "El banco cobró otro valor. Corrígelo en el cierre del extracto, no aquí." },
  { status: "blocked", title: "No se pueden importar" },
  { status: "registered", title: "Ya registrados", folded: true },
  { status: "payment_registered", title: "Pagos ya registrados", folded: true },
];

function Detail({ row, card, today }: { row: ReviewRow; card: CardLabel | undefined; today: string }) {
  const statement = `/tarjetas/${row.cardId}/extractos/${row.statementCutoff}`;
  switch (row.status) {
    case "conflict":
      return row.reason === "subscription_amount"
        ? <p className="text-small text-muted-foreground">El banco cobró {formatMoney(row.amount, row.currency)}; el cobro de tu suscripción es de {formatMoney(row.match!.amount, row.currency)}.</p>
        : <p className="text-small text-muted-foreground">En Al Corte: {row.match!.merchant || "Sin comercio"} · {formatDateShort(row.match!.date, today)} · {formatMoney(row.match!.amount, row.currency)}</p>;
    case "statement_conflict":
      return <p className="text-small text-muted-foreground">En Al Corte es de {formatMoney(row.match!.amount, row.currency)}. <Link className="underline" href={`${statement}#cierre`}>Ir al cierre<span className="sr-only"> de {card?.name ?? "la tarjeta"}</span></Link></p>;
    case "payment_missing":
      return <p className="text-small"><Link className="underline" href={statement}>Registrar el pago en el extracto<span className="sr-only"> de {card?.name ?? "la tarjeta"} del {formatDateShort(row.statementCutoff, today)}</span></Link></p>;
    case "registered":
      return row.match ? <p className="text-small"><Link className="underline" href={`/movimientos/${row.match.id}`}>Ver en Al Corte<span className="sr-only">: {row.merchant}</span></Link></p> : null;
    case "blocked":
      return <p className="text-small text-muted-foreground">{row.blocked}</p>;
    default:
      return null;
  }
}

function Control({ row, decision, onDecision, disabled }: { row: ReviewRow; decision: ImportDecision | undefined; onDecision: (key: string, decision: ImportDecision) => void; disabled?: boolean }) {
  if (row.status === "new") {
    return <label className="flex min-h-11 items-center gap-3 text-body"><input type="checkbox" className="size-5 accent-foreground" disabled={disabled} checked={decision !== "skip"} onChange={(event) => onDecision(row.key, event.target.checked ? "import" : "skip")} />Importar</label>;
  }
  if (row.status !== "conflict") return null;
  const options: Array<[ImportDecision, string]> = [["skip", "No importar"], ["link", "Es el mismo"], ["import", "Importar como nuevo"]];
  return <fieldset className="flex flex-wrap gap-x-4">
    <legend className="sr-only">Qué hacer con {row.merchant || "este movimiento"} del {row.date}</legend>
    {options.map(([value, label]) => <label key={value} className="flex min-h-11 items-center gap-2 text-body">
      <input type="radio" className="size-5 accent-foreground" name={`decision-${row.key}`} value={value} disabled={disabled} checked={(decision ?? "skip") === value} onChange={() => onDecision(row.key, value)} />{label}
    </label>)}
  </fieldset>;
}

function Line({ row, card, today, children }: { row: ReviewRow; card: CardLabel | undefined; today: string; children: ReactNode }) {
  const details = [formatDateShort(row.date, today), card ? `•••• ${card.last4}` : null, row.installment ? `Cuota ${row.installment.current} de ${row.installment.count}` : null, row.fee ? `comisión ${formatMoney(row.fee, "COP")}` : null].filter(Boolean).join(" · ");
  return <li className="flex min-w-0 flex-col gap-1 border-t border-border pt-3 first:border-t-0 first:pt-0">
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
      <div className="min-w-0"><p className="text-body wrap-anywhere">{row.merchant || "Sin comercio"}</p><p className="text-small text-muted-foreground">{details}</p></div>
      <span className="text-right"><Money value={row.amount} currency={row.currency} /></span>
    </div>
    {children}
  </li>;
}

/**
 * Review of movements before saving them (F22), reusable by the "Por confirmar" inbox of H12: each line with its state,
 * the difference with what is already in Al Corte and, when it applies, the owner's decision.
 */
export function ImportReview({ rows, decisions, onDecision, cards, today, disabled }: {
  rows: ReviewRow[]; decisions: Record<string, ImportDecision>; onDecision: (key: string, decision: ImportDecision) => void;
  cards: Record<string, CardLabel>; today: string; disabled?: boolean;
}) {
  return <div className="flex min-w-0 flex-col gap-6">
    {groups.map((group) => {
      const items = rows.filter((row) => row.status === group.status);
      if (!items.length) return null;
      const list = <ul className="grid gap-3">{items.map((row) => <Line key={row.key} row={row} card={cards[row.cardId]} today={today}>
        <Detail row={row} card={cards[row.cardId]} today={today} />
        <Control row={row} decision={decisions[row.key]} onDecision={onDecision} disabled={disabled} />
      </Line>)}</ul>;
      const heading = `${group.title} (${items.length})`;
      if (group.folded) return <Disclosure key={group.status}><DisclosureSummary><span>{heading}</span><ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} /></DisclosureSummary><DisclosureContent className="rounded-xl border border-border bg-card p-4">{list}</DisclosureContent></Disclosure>;
      return <section key={group.status} aria-label={heading} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-heading">{heading}</h3>
        {group.help && <p className="text-small text-muted-foreground">{group.help}</p>}
        {list}
      </section>;
    })}
  </div>;
}
