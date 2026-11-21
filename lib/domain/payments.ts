import Decimal from "decimal.js";
import { compareIsoDates, daysBetween, type IsoDate } from "./dates";
import { amortize, type AmortizationMethod, type InstallmentRow, type ScheduleItem } from "./installments";
import { roundMoney, type Currency } from "./money";

/** D37: how much of the statement the payment intends to cover. */
export type PaymentKind = "minimum" | "total" | "other";
/** D38: how a card applies the excess over the minimum (R9). */
export type AllocationRule = "bancolombia_priority" | "oldest_first" | "directed";
/** D38: same installment and fewer installments, or same term and a new installment. */
export type PrepaymentEffect = "reduce_term" | "reduce_installment";
/** Movements that can receive a prepayment: balances still to be billed. */
export type PrepaymentTargetType = "purchase" | "cash_advance" | "advance_fee" | "adjustment";

/** Banks round each balance up to the next peso or dollar (R8): up to one unit over the minimum is not a prepayment. */
export const BANK_ROUNDING = new Decimal(1);
const ZERO = new Decimal(0);
const sum = (values: Decimal[]) => values.reduce((total, value) => total.plus(value), ZERO);

/** Terms of a purchase needed to rebuild its unbilled installments. `monthlyRate` is 0 for on-balance, interest-free or one-installment plans. */
export type PlanTerms = {
  amount: Decimal; amountCop: Decimal; currency: Currency; fxRate: Decimal | null;
  method: AmortizationMethod; monthlyRate: Decimal;
};
/**
 * A prepayment or balance correction already applied to the movement, in its currency and its COP reference (signed for
 * corrections, D39). `date` is when it took effect: the payment date, or the cutoff of the corrected statement.
 */
export type AppliedPrepayment = { amount: Decimal; amountCop: Decimal; date?: IsoDate };

/** A movement of the card in the payment currency, with what is needed to classify it and rebuild its plan. */
export type PaymentTarget = {
  id: string; type: PrepaymentTargetType; date: IsoDate; currency: Currency;
  installmentsCount: number; interestFree: boolean; isInternational: boolean;
  /** Cutoff of the statement the movement belongs to. */
  statementCutoff: IsoDate;
  terms: PlanTerms;
  /** Installment rows in order; empty for single-installment charges. */
  rows: InstallmentRow[];
  prepayments: AppliedPrepayment[];
};

export type PrepaymentCandidate = Pick<PaymentTarget, "id" | "type" | "date" | "currency" | "installmentsCount" | "interestFree" | "isInternational"> & {
  /** Principal still to be billed at the payment date (R9). */
  pending: Decimal;
};

export type Allocation = { transactionId: string; amount: Decimal; assumed: boolean };

/**
 * R9: what is still due of the statement's minimum in one currency: the bank's minimum when registered (the bank applies
 * payments to its own figure), otherwise the calculation; minus payments already registered for that statement.
 */
export function pendingMinimum(input: { calculated: Decimal; bankMinimum: Decimal | null; paid: Decimal }): Decimal {
  return Decimal.max((input.bankMinimum ?? input.calculated).minus(input.paid), 0);
}

/** Amount offered for "Mínimo" and "Total": banks bill whole pesos or dollars, rounded up. */
export function roundUpToUnit(value: Decimal): Decimal {
  return value.ceil();
}

/** D37: a payment covers the pending minimum first; what exceeds it by more than the bank's rounding is a prepayment. */
export function splitPayment(amount: Decimal, pending: Decimal) {
  const toMinimum = Decimal.min(amount, pending);
  const excess = amount.minus(toMinimum);
  return { toMinimum, coversMinimum: amount.gte(pending), prepayable: excess.gt(BANK_ROUNDING) ? excess : ZERO };
}

/** Billed rows: paid before tracking or in a statement cut before the payment date. They never change. */
function isBilledAt(row: Pick<InstallmentRow, "beforeTracking" | "cutoffDate">, date: IsoDate): boolean {
  return row.beforeTracking || compareIsoDates(row.cutoffDate!, date) < 0;
}

/** Principal still to be billed at `date`: the value minus billed principal and previous prepayments (invariant of D31 and R9). */
export function pendingAt(target: Pick<PaymentTarget, "terms" | "rows" | "prepayments" | "statementCutoff">, date: IsoDate): Decimal {
  const prepaid = sum(target.prepayments.map((item) => item.amount));
  // A single-installment charge can only be prepaid while its statement has not been cut.
  if (!target.rows.length) return compareIsoDates(target.statementCutoff, date) >= 0 ? target.terms.amount.minus(prepaid) : ZERO;
  return target.terms.amount.minus(sum(target.rows.filter((row) => isBilledAt(row, date)).map((row) => row.principal))).minus(prepaid);
}

export function toCandidate(target: PaymentTarget, date: IsoDate): PrepaymentCandidate {
  const { id, type, date: movementDate, currency, installmentsCount, interestFree, isInternational } = target;
  return { id, type, date: movementDate, currency, installmentsCount, interestFree, isInternational, pending: pendingAt(target, date) };
}

/**
 * Position in the order Bancolombia publishes (R9), restricted to balances Al Corte registers; lower goes first.
 * Pesos: comisiones (2), compras a una cuota (5), ajustes de una cuota (6), compras a cuotas diferidas (8),
 * compras internacionales (12), avances (13), avances internacionales (14), compras con tasa 0 % (17).
 * Dólares: comisiones (2), compras de cuotas diferidas (5), ajustes a una cuota (6), avances (7), compras con tasa 0 % (8).
 */
export function bancolombiaLevel(candidate: Pick<PrepaymentCandidate, "type" | "currency" | "installmentsCount" | "interestFree" | "isInternational">): number {
  const zeroRate = candidate.interestFree && candidate.installmentsCount > 1;
  if (candidate.type === "advance_fee") return 2;
  if (candidate.type === "adjustment") return 6;
  if (candidate.currency === "USD") return candidate.type === "cash_advance" ? 7 : zeroRate ? 8 : 5;
  if (candidate.type === "cash_advance") return candidate.isInternational ? 14 : 13;
  if (zeroRate) return 17;
  if (candidate.isInternational) return 12;
  return candidate.installmentsCount > 1 ? 8 : 5;
}

function byAge(a: PrepaymentCandidate, b: PrepaymentCandidate): number {
  return compareIsoDates(a.date, b.date) || a.id.localeCompare(b.id);
}

/**
 * Proposed distribution of a prepayment (D38). Bancolombia does not publish the order within a level (R9): when the money
 * runs out inside a level with several balances, "oldest first" is an assumption and stays marked. `directed` proposes nothing.
 */
export function proposeAllocation(prepayable: Decimal, candidates: PrepaymentCandidate[], rule: AllocationRule): { allocations: Allocation[]; unallocated: Decimal } {
  const eligible = candidates.filter((candidate) => candidate.pending.gt(0));
  if (rule === "directed") return { allocations: [], unallocated: prepayable };
  const level = (candidate: PrepaymentCandidate) => rule === "bancolombia_priority" ? bancolombiaLevel(candidate) : 0;
  const ordered = [...eligible].sort((a, b) => level(a) - level(b) || byAge(a, b));
  const byId = new Map(ordered.map((candidate) => [candidate.id, candidate]));
  const allocations: Allocation[] = [];
  let remaining = prepayable;
  for (const candidate of ordered) {
    if (!remaining.gt(0)) break;
    const amount = Decimal.min(remaining, candidate.pending);
    allocations.push({ transactionId: candidate.id, amount, assumed: false });
    remaining = remaining.minus(amount);
  }
  if (rule === "bancolombia_priority") {
    for (const allocation of allocations) {
      const peers = ordered.filter((candidate) => level(candidate) === level(byId.get(allocation.transactionId)!));
      const allocated = sum(allocations.filter((item) => peers.some((peer) => peer.id === item.transactionId)).map((item) => item.amount));
      allocation.assumed = peers.length > 1 && allocated.lt(sum(peers.map((peer) => peer.pending)));
    }
  }
  return { allocations, unallocated: remaining };
}

/** What a distribution must add up to: the whole prepayment, or every pending balance when it exceeds them (saldo a favor). Candidates have pending > 0. */
export function allocatableAmount(prepayable: Decimal, candidates: PrepaymentCandidate[]): Decimal {
  return Decimal.min(prepayable, sum(candidates.map((candidate) => candidate.pending)));
}

/**
 * Checks a distribution edited by the owner (D38). A distribution equal to the proposal keeps its "assumed" marks;
 * any other one was decided by the owner and is not an assumption.
 */
export function resolveAllocation(prepayable: Decimal, candidates: PrepaymentCandidate[], submitted: Array<{ transactionId: string; amount: Decimal }>, proposal: Allocation[]): Allocation[] {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const seen = new Set<string>();
  for (const item of submitted) {
    const candidate = byId.get(item.transactionId);
    if (!candidate || seen.has(item.transactionId)) throw new Error("La distribución incluye una compra que no admite abonos.");
    seen.add(item.transactionId);
    if (!item.amount.gt(0) || !item.amount.equals(roundMoney(item.amount, candidate.currency)) || item.amount.gt(candidate.pending)) {
      throw new Error("Cada abono debe ser mayor que cero y no superar el saldo de su compra.");
    }
  }
  if (!sum(submitted.map((item) => item.amount)).equals(allocatableAmount(prepayable, candidates))) throw new Error("La distribución no suma el valor del abono.");
  const same = submitted.length === proposal.length && submitted.every((item, index) => item.transactionId === proposal[index]!.transactionId && item.amount.equals(proposal[index]!.amount));
  return submitted.map((item, index) => ({ transactionId: item.transactionId, amount: item.amount, assumed: same && proposal[index]!.assumed }));
}

/**
 * Same installment, fewer installments (R9, `reduce_term`). French plans keep the payment, fixed-principal plans the principal.
 * Never longer than the plan it replaces: at `maxCount` the last installment takes the rest, as the last one absorbs rounding (R2).
 */
export function reduceTermSchedule(balance: Decimal, first: Pick<InstallmentRow, "principal" | "total">, maxCount: number, rate: Decimal, method: AmortizationMethod, currency: Currency): ScheduleItem[] {
  const keepsPayment = method === "french" && !rate.isZero();
  const items: ScheduleItem[] = [];
  let remaining = balance;
  for (let index = 1; remaining.gt(0); index += 1) {
    const interest = roundMoney(remaining.times(rate), currency);
    const regular = keepsPayment ? first.total.minus(interest) : first.principal;
    const principal = index >= maxCount ? remaining : Decimal.min(Decimal.max(regular, 0), remaining);
    remaining = remaining.minus(principal);
    items.push({ principal, interest, beforeTracking: false });
  }
  return items;
}

function copOf(value: Decimal, terms: PlanTerms): Decimal {
  return terms.currency === "COP" ? value : roundMoney(value.times(terms.fxRate!), "COP");
}

/**
 * Applies a prepayment to a movement (R9): billed rows stay; unbilled rows are rebuilt on the balance left, in the same
 * statements. A single-installment charge only records the amount. The last COP equivalent absorbs the difference so that
 * Σ principal_cop + Σ prepayments COP = amount_cop, as Σ principal + Σ prepayments = amount (D3, D31).
 */
export function applyPrepayment(input: { target: PaymentTarget; amount: Decimal; date: IsoDate; effect: PrepaymentEffect }) {
  const { target, amount, date, effect } = input;
  const { terms } = target;
  const pending = pendingAt(target, date);
  if (!amount.gt(0) || amount.gt(pending)) throw new Error("El abono supera el saldo pendiente de la compra.");
  const coveredCop = sum(target.prepayments.map((item) => item.amountCop));
  const remaining = pending.minus(amount);
  if (!target.rows.length) {
    return { amountCop: remaining.isZero() ? terms.amountCop.minus(coveredCop) : copOf(amount, terms), rows: null, replacedFromNumber: null };
  }
  const firstFuture = target.rows.findIndex((row) => !isBilledAt(row, date));
  const kept = target.rows.slice(0, firstFuture);
  const future = target.rows.slice(firstFuture);
  const items = remaining.isZero() ? []
    : effect === "reduce_installment" ? amortize(remaining, future.length, terms.monthlyRate, terms.method, terms.currency)
      : reduceTermSchedule(remaining, future[0]!, future.length, terms.monthlyRate, terms.method, terms.currency);
  const keptCop = sum(kept.map((row) => row.principalCop));
  const amountCop = items.length ? copOf(amount, terms) : terms.amountCop.minus(keptCop).minus(coveredCop);
  let copSoFar = keptCop.plus(coveredCop).plus(amountCop);
  let balance = remaining;
  const rows: InstallmentRow[] = items.map((item, index) => {
    balance = balance.minus(item.principal);
    const principalCop = index === items.length - 1 ? terms.amountCop.minus(copSoFar) : copOf(item.principal, terms);
    copSoFar = copSoFar.plus(principalCop);
    const interestCop = copOf(item.interest, terms);
    return {
      number: firstFuture + index + 1, principal: item.principal, interest: item.interest, total: item.principal.plus(item.interest),
      balanceAfter: balance, cutoffDate: future[index]!.cutoffDate, beforeTracking: false, principalCop, interestCop, totalCop: principalCop.plus(interestCop),
    };
  });
  return { amountCop, rows, replacedFromNumber: firstFuture + 1 };
}

/** D37: a payment is registered for a statement already cut, up to today. "Total" also needs the next cutoff not to have passed. */
export function paymentDateError(kind: PaymentKind, date: IsoDate, statement: { cutoffDate: IsoDate; nextCutoff: IsoDate }, today: IsoDate): string | null {
  if (compareIsoDates(date, today) > 0) return "La fecha de pago no puede ser posterior a hoy.";
  if (compareIsoDates(date, statement.cutoffDate) <= 0) return "Registra pagos de extractos ya cortados, con fecha posterior al corte.";
  if (kind === "total" && compareIsoDates(date, statement.nextCutoff) > 0) return "Ya pasó el siguiente corte. Registra este pago como otro valor.";
  return null;
}

export type PaymentPlanInput = {
  kind: PaymentKind; currency: Currency; date: IsoDate; statementCutoff: IsoDate;
  /** Pending minimum of the statement in the payment currency (`pendingMinimum`). */
  pending: Decimal;
  /** Only for "other": the amount paid. */
  amount?: Decimal;
  targets: PaymentTarget[]; rule: AllocationRule; effect: PrepaymentEffect;
  /** Distribution edited by the owner; without it the proposal is used (preview). */
  distribution?: Array<{ transactionId: string; amount: Decimal }>;
};

/**
 * F14, D37, D38: amount, minimum coverage and prepayments of a payment, with the rebuilt installments of each movement.
 * "Total" settles every purchase and advance in the statement's debt (R9); "Otro valor" distributes the excess by the card's rule.
 */
export function buildPaymentPlan(input: PaymentPlanInput) {
  // D33: a payment only applies to balances in its own currency.
  const targets = input.targets.filter((target) => target.currency === input.currency);
  const candidates = targets.map((target) => toCandidate(target, input.date)).filter((candidate) => candidate.pending.gt(0));
  let amount: Decimal;
  let allocations: Allocation[];
  let proposal: Allocation[] = [];
  let effect = input.effect;
  if (input.kind === "total") {
    // The statement's debt: purchases and advances in installments billed up to its cutoff (R8).
    const debt = targets.filter((target) => target.rows.length && compareIsoDates(target.statementCutoff, input.statementCutoff) <= 0)
      .map((target) => toCandidate(target, input.date)).filter((candidate) => candidate.pending.gt(0));
    amount = roundUpToUnit(input.pending.plus(sum(debt.map((candidate) => candidate.pending))));
    if (!amount.gt(0)) throw new Error("Este extracto no tiene saldo pendiente.");
    allocations = debt.map((candidate) => ({ transactionId: candidate.id, amount: candidate.pending, assumed: false }));
    effect = "reduce_term";
  } else {
    if (input.kind === "minimum" && !input.pending.gt(0)) throw new Error("El pago mínimo de este extracto ya está cubierto.");
    amount = input.kind === "minimum" ? roundUpToUnit(input.pending) : input.amount!;
    if (!amount.gt(0)) throw new Error("Ingresa un valor mayor que cero.");
    const { prepayable } = splitPayment(amount, input.pending);
    proposal = proposeAllocation(prepayable, candidates, input.rule).allocations;
    allocations = input.distribution ? resolveAllocation(prepayable, candidates, input.distribution, proposal) : proposal;
  }
  const split = splitPayment(amount, input.pending);
  const prepaid = sum(allocations.map((allocation) => allocation.amount));
  const byId = new Map(targets.map((target) => [target.id, target]));
  return {
    amount, toMinimum: split.toMinimum, coversMinimum: split.coversMinimum, prepayable: split.prepayable, proposal,
    allocatable: input.kind === "total" ? prepaid : allocatableAmount(split.prepayable, candidates),
    /** Part of the payment left after the minimum and the prepayments: bank rounding or a balance in favour. */
    leftover: amount.minus(split.toMinimum).minus(prepaid),
    candidates,
    prepayments: allocations.map((allocation) => ({ ...allocation, effect, ...applyPrepayment({ target: byId.get(allocation.transactionId)!, amount: allocation.amount, date: input.date, effect }) })),
  };
}

/**
 * R9: share of the statement period during which the principal was still at the balance before a prepayment, to prorate
 * the on-balance estimate by days. Zero outside the period or on its first day.
 */
export function prepaymentInterestWeight(periodStart: IsoDate, cutoffDate: IsoDate, date: IsoDate): Decimal {
  const days = daysBetween(periodStart, date);
  if (days <= 0 || compareIsoDates(date, cutoffDate) > 0) return ZERO;
  return new Decimal(days).div(daysBetween(periodStart, cutoffDate) + 1);
}

/** An installment row as the RPCs receive it. */
export function installmentRowPayload(row: InstallmentRow) {
  return {
    number: row.number, cutoff_date: row.cutoffDate, principal: row.principal.toFixed(), interest: row.interest.toFixed(), total: row.total.toFixed(),
    balance_after: row.balanceAfter.toFixed(), principal_cop: row.principalCop.toFixed(), interest_cop: row.interestCop.toFixed(), total_cop: row.totalCop.toFixed(),
  };
}

/**
 * Payload of `register_payment`: the payment in its currency (a USD payment carries the D4 TRM only as reference),
 * the payment mark when it covers the minimum (D37) and each prepayment with its rebuilt rows.
 */
export function paymentPayload(input: { cardId: string; statementId: string; currency: Currency; kind: PaymentKind; date: IsoDate; fxRate: Decimal | null; note: string }, plan: ReturnType<typeof buildPaymentPlan>) {
  if (input.currency === "USD" && !input.fxRate?.gt(0)) throw new Error("Falta la TRM para registrar un pago en dólares.");
  const amountCop = input.currency === "COP" ? plan.amount : roundMoney(plan.amount.times(input.fxRate!), "COP");
  return {
    card_id: input.cardId, statement_id: input.statementId, date: input.date, amount: plan.amount.toFixed(), currency: input.currency,
    fx_rate: input.currency === "USD" ? input.fxRate!.toFixed() : null, amount_cop: amountCop.toFixed(), kind: input.kind, note: input.note,
    mark_paid: plan.coversMinimum,
    prepayments: plan.prepayments.map((prepayment) => ({
      transaction_id: prepayment.transactionId, amount: prepayment.amount.toFixed(), amount_cop: prepayment.amountCop.toFixed(),
      effect: prepayment.effect, assumed: prepayment.assumed, replaced_from_number: prepayment.replacedFromNumber,
      installments: prepayment.rows && prepayment.rows.map(installmentRowPayload),
    })),
  };
}
