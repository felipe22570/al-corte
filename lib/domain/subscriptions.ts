import Decimal from "decimal.js";
import { addDays, addMonths, clampDay, compareIsoDates, parseIsoDate, type IsoDate } from "./dates";

export type Frequency = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "paused" | "cancelled";
type Subscription = { startDate: IsoDate; frequency: Frequency; billingDay: number; status: SubscriptionStatus; trialEndsAt?: IsoDate | null };

function assertDay(day: number) { if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error("Día de cobro inválido"); }
function firstEligibleDate(subscription: Subscription) { return subscription.trialEndsAt && compareIsoDates(subscription.trialEndsAt, subscription.startDate) > 0 ? subscription.trialEndsAt : subscription.startDate; }
function chargeAt(subscription: Subscription, offset: number): IsoDate {
  const base = addMonths(subscription.startDate, subscription.frequency === "monthly" ? offset : offset * 12);
  const { year, month } = parseIsoDate(base);
  return clampDay(year, month, subscription.billingDay);
}

export function chargeDatesBetween(subscription: Subscription, from: IsoDate, to: IsoDate): IsoDate[] {
  assertDay(subscription.billingDay); if (subscription.status !== "active" || compareIsoDates(from, to) > 0) return [];
  const eligible = firstEligibleDate(subscription); const dates: IsoDate[] = [];
  const start = parseIsoDate(subscription.startDate);
  const fromParts = parseIsoDate(from);
  const toParts = parseIsoDate(to);
  const interval = subscription.frequency === "monthly" ? 1 : 12;
  const monthDifference = (fromParts.year - start.year) * 12 + fromParts.month - start.month;
  const endDifference = (toParts.year - start.year) * 12 + toParts.month - start.month;
  for (let offset = Math.max(0, Math.floor(monthDifference / interval)); offset * interval <= endDifference; offset += 1) {
    const date = chargeAt(subscription, offset);
    if (compareIsoDates(date, to) > 0) break;
    if (compareIsoDates(date, eligible) >= 0 && compareIsoDates(date, from) >= 0) dates.push(date);
  }
  return dates;
}

export function nextChargeDate(subscription: Subscription, today: IsoDate): IsoDate | null {
  if (subscription.status !== "active") return null;
  const eligible = firstEligibleDate(subscription);
  const from = compareIsoDates(today, eligible) >= 0 ? today : eligible;
  const { year } = parseIsoDate(from);
  const end = year === 9999 ? "9999-12-31" : addMonths(from, 12);
  return chargeDatesBetween(subscription, from, end)[0] ?? null;
}
export function monthlyEquivalent(amount: Decimal, frequency: Frequency) { return frequency === "monthly" ? new Decimal(amount) : new Decimal(amount).div(12); }
export function yearlyEquivalent(amount: Decimal, frequency: Frequency) { return frequency === "yearly" ? new Decimal(amount) : new Decimal(amount).times(12); }
export function subscriptionTotals(subscriptions: Array<{ amountCop: Decimal; frequency: Frequency; status: SubscriptionStatus }>) {
  const active = subscriptions.filter((subscription) => subscription.status === "active");
  const monthly = active.reduce((sum, subscription) => sum.plus(monthlyEquivalent(subscription.amountCop, subscription.frequency)), new Decimal(0));
  const yearly = active.reduce((sum, subscription) => sum.plus(yearlyEquivalent(subscription.amountCop, subscription.frequency)), new Decimal(0));
  return { monthly, yearly };
}
export function isTrialEndingSoon(trialEndsAt: IsoDate | null, today: IsoDate, days = 7) { return trialEndsAt !== null && compareIsoDates(trialEndsAt, today) >= 0 && compareIsoDates(trialEndsAt, addDays(today, days)) <= 0; }
