import Decimal from "decimal.js";
import { expect, it } from "vitest";
import { chargeDatesBetween, isTrialEndingSoon, monthlyEquivalent, nextChargeDate, subscriptionTotals, yearlyEquivalent } from "@/lib/domain/subscriptions";

it("genera cobros mensuales ajustados al fin de mes", () => {
  expect(chargeDatesBetween({ startDate: "2026-01-10", frequency: "monthly", billingDay: 31, status: "active" }, "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
});
it("genera renovaciones anuales en años bisiestos", () => {
  expect(chargeDatesBetween({ startDate: "2027-02-28", frequency: "yearly", billingDay: 29, status: "active" }, "2027-01-01", "2029-12-31")).toEqual(["2027-02-28", "2028-02-29", "2029-02-28"]);
});
it("conserva el día 29 para renovaciones posteriores al año bisiesto", () => {
  const sub = { startDate: "2028-02-29", frequency: "yearly" as const, billingDay: 29, status: "active" as const };
  expect(chargeDatesBetween(sub, "2029-01-01", "2032-12-31")).toEqual(["2029-02-28", "2030-02-28", "2031-02-28", "2032-02-29"]);
});
it("incluye la fecha inicial y limita el resultado a la ventana solicitada", () => {
  const sub = { startDate: "2028-02-29", frequency: "monthly" as const, billingDay: 31, status: "active" as const };
  expect(chargeDatesBetween(sub, "2028-02-29", "2028-03-06")).toEqual(["2028-02-29"]);
  expect(nextChargeDate({ ...sub, startDate: "1800-01-01" }, "2026-03-01")).toBe("2026-03-31");
});
it("busca el próximo cobro tras la prueba gratis y respeta el límite de fechas", () => {
  const sub = { startDate: "2026-01-01", frequency: "monthly" as const, billingDay: 15, status: "active" as const, trialEndsAt: "2028-01-01" };
  expect(nextChargeDate(sub, "2026-01-01")).toBe("2028-01-15");
  expect(nextChargeDate({ ...sub, startDate: "9999-01-01", trialEndsAt: null }, "9999-12-31")).toBeNull();
});
it("respeta pausas, pruebas gratis y el próximo cobro", () => {
  const paused = { startDate: "2026-01-10", frequency: "monthly" as const, billingDay: 10, status: "paused" as const };
  expect(chargeDatesBetween(paused, "2026-01-01", "2026-03-31")).toEqual([]);
  const trial = { ...paused, status: "active" as const, trialEndsAt: "2026-02-15" };
  expect(chargeDatesBetween(trial, "2026-01-01", "2026-03-31")).toEqual(["2026-03-10"]);
  expect(nextChargeDate(trial, "2026-02-16")).toBe("2026-03-10");
  expect(isTrialEndingSoon("2026-02-20", "2026-02-15")).toBe(true);
  expect(isTrialEndingSoon(null, "2026-02-15")).toBe(false);
  expect(isTrialEndingSoon("2026-02-14", "2026-02-15")).toBe(false);
});
it("valida rangos y equivalentes", () => {
  const sub = { startDate: "2026-01-10", frequency: "monthly" as const, billingDay: 10, status: "cancelled" as const };
  expect(chargeDatesBetween(sub, "2026-03-01", "2026-02-01")).toEqual([]);
  expect(chargeDatesBetween(sub, "2026-01-01", "2026-03-31")).toEqual([]);
  expect(nextChargeDate(sub, "2026-01-01")).toBeNull();
  expect(() => chargeDatesBetween({ ...sub, status: "active", billingDay: 0 }, "2026-01-01", "2026-03-31")).toThrow("Día de cobro");
  expect(monthlyEquivalent(new Decimal(120000), "yearly").toString()).toBe("10000");
  expect(monthlyEquivalent(new Decimal(10000), "monthly").toString()).toBe("10000");
  expect(yearlyEquivalent(new Decimal(10000), "monthly").toString()).toBe("120000");
  expect(yearlyEquivalent(new Decimal(120000), "yearly").toString()).toBe("120000");
});
it("calcula equivalentes de suscripciones activas", () => {
  const totals = subscriptionTotals([{ amountCop: new Decimal("10000"), frequency: "monthly", status: "active" }, { amountCop: new Decimal("20000"), frequency: "monthly", status: "active" }, { amountCop: new Decimal("120000"), frequency: "yearly", status: "active" }, { amountCop: new Decimal("90000"), frequency: "yearly", status: "paused" }]);
  expect(totals.monthly.toString()).toBe("40000"); expect(totals.yearly.toString()).toBe("480000");
  expect(subscriptionTotals([{ amountCop: new Decimal("1"), frequency: "yearly", status: "active" }]).yearly.toString()).toBe("1");
});
