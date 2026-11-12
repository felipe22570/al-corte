import Link from "next/link";
import Decimal from "decimal.js";
import { Tags } from "lucide-react";
import { CardColorChip } from "@/components/card-color-chip";
import { categoryIcons, type CategoryIcon } from "@/lib/category-icons";
import { groupByDay } from "@/lib/domain/history";
import { formatDateWithWeekday, formatMoney, formatSignedMoney } from "@/lib/format";
import { historyTypeLabels, type HistoryCard, type HistoryCategory, type HistoryRow } from "@/lib/history-types";

export function TransactionList({ rows, allRows, cards, categories, today }: { rows: HistoryRow[]; allRows: HistoryRow[]; cards: HistoryCard[]; categories: HistoryCategory[]; today: string }) {
  const toDomain = (item: HistoryRow) => ({ ...item, amountCop: new Decimal(item.amount_cop), cardId: item.card_id, categoryId: item.category_id });
  const totals = new Map(groupByDay(allRows.map(toDomain)).map((group) => [group.date, group.total]));
  return <section aria-label="Movimientos" className="flex flex-col gap-6">{groupByDay(rows.map(toDomain)).map((group) => <section key={group.date} className="flex flex-col gap-2"><div className="flex items-center justify-between gap-3"><h2 className="text-heading">{formatDateWithWeekday(group.date, today)}</h2><span className="text-amount text-right">{formatMoney(totals.get(group.date) ?? "0", "COP")}</span></div>{group.movements.map((item) => { const card = cards.find((entry) => entry.id === item.card_id); const category = categories.find((entry) => entry.id === item.category_id); const Icon = category?.icon && Object.hasOwn(categoryIcons, category.icon) ? categoryIcons[category.icon as CategoryIcon] : Tags; const credit = item.type === "payment" || item.type === "refund"; return <Link key={item.id} href={`/movimientos/${item.id}`} className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"><span className="flex min-w-0 flex-col gap-1"><span className="text-body">{item.merchant || historyTypeLabels[item.type] || "Movimiento"}</span><span className="inline-flex items-center gap-2 text-small text-muted-foreground"><Icon className="size-5 shrink-0" strokeWidth={1.75} />{category?.name ?? "Sin categoría"} · {credit ? "Abono" : historyTypeLabels[item.type]}{item.installments_count > 1 ? ` · ${item.installments_count} cuotas` : ""}</span>{card && <CardColorChip color={card.color} name={`${card.name} · •••• ${card.last4}`} />}</span><span className="text-amount text-right">{credit ? formatSignedMoney(item.amount, item.currency, "credit") : formatMoney(item.amount, item.currency)}</span></Link>; })}</section>)}</section>;
}
