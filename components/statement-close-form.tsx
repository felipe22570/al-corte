"use client";

import Decimal from "decimal.js";
import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Money } from "@/components/money";
import { SelectControl } from "@/components/select-control";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { closeStatement, reopenStatement } from "@/lib/actions/statements";
import { bankDifference } from "@/lib/domain/balances";
import type { Currency } from "@/lib/domain/money";
import { monthlyRateFromEA } from "@/lib/domain/rates";
import { bankInterest } from "@/lib/domain/reconciliation";
import { formatDateShort, formatMoney } from "@/lib/format";
import { formatAmountInput, parseColombianDecimal } from "@/lib/money-input";

export type StatementClosePurchase = { id: string; label: string; detail: string; calculated: string; bankBalance: string | null };
type Props = {
  statementId: string;
  currency: Currency;
  today: string;
  /** Card, cutoff and currency, for accessible names and messages. */
  context: string;
  /** Title when the statement has several currencies. */
  title: string;
  /** The rate in force is asked once per statement. */
  showRate: boolean;
  calculated: { minimum: string; debt: string; interest: string; estimated: boolean };
  bank: { minimum: string | null; debt: string | null; interest: string | null; lateInterest: string | null; rateEa: string | null; reconciledAt: string | null };
  purchases: StatementClosePurchase[];
};

const input = (value: string | null) => value === null ? "" : formatAmountInput(value);
function parse(value: string): Decimal | null | undefined {
  if (!value.trim()) return null;
  try { return new Decimal(parseColombianDecimal(value)); } catch { return undefined; }
}

function Difference({ value, currency }: { value: Decimal | null; currency: Currency }) {
  if (!value) return null;
  return <span className="block text-small text-warning">Diferencia: {value.gt(0) ? "+" : ""}{formatMoney(value, currency)}</span>;
}

/**
 * F15: monthly close of one currency of a statement (D39). The owner copies the bank values; the app shows the differences
 * beyond the bank's rounding, takes the real interest in place of the estimate and the bank balance of each purchase.
 */
export function StatementCloseForm({ statementId, currency, today, context, title, showRate, calculated, bank, purchases }: Props) {
  const router = useRouter();
  const id = useId();
  const [minimum, setMinimum] = useState(input(bank.minimum));
  const [debt, setDebt] = useState(input(bank.debt));
  const [interest, setInterest] = useState(input(bank.interest));
  const [lateInterest, setLateInterest] = useState(input(bank.lateInterest));
  const [rate, setRate] = useState(bank.rateEa ? monthlyRateFromEA(new Decimal(bank.rateEa)).times(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed().replace(".", ",") : "");
  const [rateUnit, setRateUnit] = useState<"mv" | "ea">("mv");
  const [balances, setBalances] = useState<Record<string, string>>(Object.fromEntries(purchases.map((purchase) => [purchase.id, input(purchase.bankBalance)])));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const values = { minimum: parse(minimum), debt: parse(debt), interest: parse(interest), lateInterest: parse(lateInterest) };
  const invalid = Object.values(values).some((value) => value === undefined) || Object.values(balances).some((value) => parse(value) === undefined);
  // With the bank interest the calculation changes: the estimate (or the registered interest) is replaced.
  const enteredInterest = bankInterest(values.interest ?? null, values.lateInterest ?? null);
  const interestDelta = enteredInterest ? enteredInterest.minus(calculated.interest) : new Decimal(0);
  const expectedMinimum = new Decimal(calculated.minimum).plus(interestDelta);
  // The bank balances entered per purchase also change the debt (D39), measured from the balance already in effect.
  const balanceDelta = purchases.reduce((sum, purchase) => {
    const entered = parse(balances[purchase.id] ?? "");
    const current = purchase.bankBalance === null ? new Decimal(purchase.calculated) : new Decimal(purchase.bankBalance);
    return sum.plus((entered ?? new Decimal(purchase.calculated)).minus(current));
  }, new Decimal(0));
  const expectedDebt = new Decimal(calculated.debt).plus(interestDelta).plus(balanceDelta);

  async function submit(reconcile: boolean) {
    setBusy(true); setMessage("");
    try {
      const result = await closeStatement(statementId, currency, {
        realMinimum: minimum, realTotal: debt, interest, lateInterest, rate: showRate ? rate : "", rateUnit, reconcile,
        balances: Object.entries(balances).map(([transactionId, bankBalance]) => ({ transactionId, bankBalance })),
      });
      setFailed(!result.ok);
      setMessage(result.ok ? reconcile ? `Conciliaste el extracto: ${context}.` : "Guardamos los valores del banco." : result.error);
      if (result.ok) router.refresh();
    } catch {
      setFailed(true);
      setMessage("No pudimos guardar el cierre. Revisa tu conexión e intenta de nuevo.");
    } finally { setBusy(false); }
  }

  async function reopen() {
    setBusy(true); setMessage("");
    try {
      const result = await reopenStatement(statementId, currency);
      setFailed(!result.ok);
      setMessage(result.ok ? `Reabriste el extracto: ${context}.` : result.error);
      if (result.ok) router.refresh();
    } catch {
      setFailed(true);
      setMessage("No pudimos reabrir el extracto. Intenta de nuevo.");
    } finally { setBusy(false); }
  }

  const field = (key: string, label: string, value: string, onChange: (value: string) => void, extra?: ReactNode) => <div className="flex min-w-0 flex-col gap-2">
    <Label htmlFor={`${id}-${key}`}>{label}<span className="sr-only"> · {context}</span></Label>
    <Input id={`${id}-${key}`} inputMode="decimal" autoComplete="off" placeholder="Sin registrar" value={value} onChange={(event) => onChange(event.target.value)} disabled={busy} aria-invalid={parse(value) === undefined} />
    {extra}
  </div>;

  return <section aria-labelledby={`${id}-title`} className="grid min-w-0 gap-4 rounded-xl border border-border bg-card p-4">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <h2 id={`${id}-title`} className="text-heading">{title}</h2>
      {bank.reconciledAt && <StatusBadge text={`Conciliado el ${formatDateShort(bank.reconciledAt.slice(0, 10), today)}`} tone="ok" />}
    </div>
    <p className="text-small text-muted-foreground">Copia los valores de tu extracto del banco. Las diferencias aparecen solo si superan el redondeo del banco.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      {field("minimum", "Pago mínimo del banco", minimum, setMinimum, <Difference value={values.minimum ? bankDifference(expectedMinimum, values.minimum) : null} currency={currency} />)}
      {field("debt", "Deuda total del banco", debt, setDebt, <Difference value={values.debt ? bankDifference(expectedDebt, values.debt) : null} currency={currency} />)}
      {field("interest", "Intereses corrientes", interest, setInterest, <span className="text-small text-muted-foreground">{calculated.estimated ? "Estimado en Al Corte" : "En Al Corte, con mora"}: <Money value={calculated.interest} currency={currency} tone="muted" /></span>)}
      {field("late", "Intereses de mora", lateInterest, setLateInterest)}
    </div>
    {showRate && <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={`${id}-rate`}>Tasa vigente de compras (%)<span className="sr-only"> · {context}</span></Label><Input id={`${id}-rate`} inputMode="decimal" autoComplete="off" placeholder="Por ejemplo 2,1003" value={rate} onChange={(event) => setRate(event.target.value)} disabled={busy} aria-describedby={`${id}-rate-help`} /></div>
      <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={`${id}-unit`}>Tipo de tasa</Label><SelectControl id={`${id}-unit`} value={rateUnit} onValueChange={(value) => setRateUnit(value as "mv" | "ea")} disabled={busy} options={[{ value: "mv", label: "Mes vencido (M.V.)" }, { value: "ea", label: "Efectiva anual (E.A.)" }]} /></div>
      <p id={`${id}-rate-help`} className="text-small text-muted-foreground sm:col-span-2">Se usa solo en compras nuevas. Las compras registradas conservan su tasa.</p>
    </div>}
    {purchases.length > 0 && <fieldset className="grid min-w-0 gap-3">
      <legend className="mb-2 text-body">Saldo por compra</legend>
      <p className="text-small text-muted-foreground">Si el banco muestra otro saldo, escríbelo: la compra conserva su cuota y cambia el número de cuotas restantes.</p>
      {purchases.map((purchase) => {
        const entered = parse(balances[purchase.id] ?? "");
        const difference = entered ? bankDifference(new Decimal(purchase.calculated), entered) : null;
        return <div key={purchase.id} className="grid min-w-0 gap-2 border-t border-border pt-3">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
            <Label htmlFor={`${id}-${purchase.id}`} className="min-w-0 wrap-anywhere">{purchase.label}</Label>
            <span className="text-small text-muted-foreground">Calculado <Money value={purchase.calculated} currency={currency} tone="muted" /></span>
          </div>
          <p className="text-small text-muted-foreground">{purchase.detail}</p>
          <Input id={`${id}-${purchase.id}`} inputMode="decimal" autoComplete="off" placeholder="Igual al calculado" value={balances[purchase.id] ?? ""} onChange={(event) => setBalances((current) => ({ ...current, [purchase.id]: event.target.value }))} disabled={busy} aria-label={`Saldo según el banco · ${purchase.label} · ${context}`} aria-invalid={entered === undefined} />
          {entered && purchase.bankBalance !== null && entered.equals(purchase.bankBalance)
            ? <p className="text-small text-muted-foreground">Plan ajustado al saldo del banco.</p>
            : <Difference value={difference} currency={currency} />}
        </div>;
      })}
    </fieldset>}
    {invalid && <p role="alert" className="text-small text-danger">Escribe los valores como aparecen en el extracto, por ejemplo 1.234.567,89.</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={busy || invalid} onClick={() => submit(!bank.reconciledAt)} aria-label={`${bank.reconciledAt ? "Guardar cierre" : "Guardar y conciliar"} · ${context}`}>{busy ? "Guardando…" : bank.reconciledAt ? "Guardar cierre" : "Guardar y conciliar"}</Button>
      {!bank.reconciledAt && <Button type="button" variant="ghost" disabled={busy || invalid} onClick={() => submit(false)} aria-label={`Guardar sin conciliar · ${context}`}>Guardar sin conciliar</Button>}
      {bank.reconciledAt && <Button type="button" variant="ghost" disabled={busy} onClick={reopen} aria-label={`Reabrir · ${context}`}>Reabrir</Button>}
    </div>
    {message && <p role={failed ? "alert" : "status"} className={failed ? "text-small text-danger" : "text-small text-muted-foreground"}>{message}</p>}
  </section>;
}
