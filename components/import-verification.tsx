import type { ReactNode } from "react";
import Decimal from "decimal.js";
import { CardColorChip } from "@/components/card-color-chip";
import { Money } from "@/components/money";
import { bankDifference } from "@/lib/domain/balances";
import type { Currency } from "@/lib/domain/money";
import type { ReviewStatement } from "@/lib/import/monthly-review";
import type { ImportVerification as Verification } from "@/lib/import/run-monthly-import";
import { formatDateShort, formatExchangeRate, formatMoney } from "@/lib/format";

const currencyNames: Record<Currency, string> = { COP: "En pesos", USD: "En dólares" };

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
    <dt className="min-w-0 text-muted-foreground">{label}</dt>
    <dd className="ml-auto text-right">{children}</dd>
  </div>;
}

/** Calculated value next to the bank's, with the difference only beyond the bank's rounding (R8). */
function Compared({ label, calculated, bank, currency }: { label: string; calculated: string; bank: string | null; currency: Currency }) {
  const difference = bank ? bankDifference(new Decimal(calculated), new Decimal(bank)) : null;
  return <Row label={label}>
    <Money value={calculated} currency={currency} />
    {bank && <span className="block text-small text-muted-foreground">Banco: {formatMoney(bank, currency)} · {difference ? `diferencia ${difference.gt(0) ? "+" : ""}${formatMoney(difference, currency)}` : "coincide"}</span>}
  </Row>;
}

/** F22: minimum payment, total debt and available credit after the import, next to the bank values of the file. */
export function ImportVerification({ statements, verification, today, title }: { statements: ReviewStatement[]; verification: Verification[]; today: string; title: string }) {
  return <section aria-labelledby="import-verification-title" className="flex min-w-0 flex-col gap-4">
    <h2 id="import-verification-title" className="text-heading">{title}</h2>
    {statements.map((statement) => {
      const rows = verification.filter((item) => item.cardId === statement.cardId && item.cutoffDate === statement.cutoffDate);
      const available = rows[0]?.available ?? null;
      return <div key={`${statement.cardId}:${statement.cutoffDate}`} className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <CardColorChip color={statement.color} name={`${statement.cardName} · •••• ${statement.last4}`} />
          <span className="text-small text-muted-foreground">Corte del {formatDateShort(statement.cutoffDate, today)}</span>
        </div>
        {rows.map((row) => {
          const bank = statement.bank.find((item) => item.currency === row.currency);
          const kept = (bank?.minimum && row.realMinimum && !new Decimal(row.realMinimum).equals(bank.minimum)) || (bank?.total && row.realTotal && !new Decimal(row.realTotal).equals(bank.total));
          return <dl key={row.currency} className="grid gap-1 text-small">
            {statement.bank.length > 1 && <p className="text-body font-medium">{currencyNames[row.currency]}</p>}
            <Compared label="Pago mínimo" calculated={row.minimum} bank={bank?.minimum ?? null} currency={row.currency} />
            <Compared label="Deuda total" calculated={row.debt} bank={bank?.total ?? null} currency={row.currency} />
            {kept && <p className="text-muted-foreground">Ya tenías otros valores del banco para este extracto y se conservan: {row.realMinimum ? formatMoney(row.realMinimum, row.currency) : "—"} y {row.realTotal ? formatMoney(row.realTotal, row.currency) : "—"}.</p>}
          </dl>;
        })}
        {available && <dl className="grid gap-1 text-small"><Compared label="Cupo disponible" calculated={available} bank={statement.bankAvailable} currency="COP" /></dl>}
        {available && rows[0] && !new Decimal(rows[0].usdNet).isZero() && <p className="text-small text-muted-foreground">{rows[0].trm ? `Dólares del cupo con la TRM del corte: ${formatExchangeRate(rows[0].trm)}.` : "Falta la TRM del corte: el cupo usa la TRM vigente y puede no coincidir con el del banco."}</p>}
      </div>;
    })}
  </section>;
}
