import { describe, expect, it } from "vitest";

import { normalizePhrase, readAlert } from "../bancolombia";
import { ALERTS } from "./fixtures";

describe("readAlert (R10)", () => {
  it("reads the DirecTV and ChatGPT purchases exactly", () => {
    expect(readAlert(ALERTS.directv)).toEqual({ kind: "purchase", last4: "1999", currency: "COP", amount: "140910.00", merchant: "DIRECTV", date: "2026-11-17", time: "12:27" });
    expect(readAlert(ALERTS.chatgpt)).toEqual({ kind: "purchase", last4: "1999", currency: "COP", amount: "81000.00", merchant: "GOOGLE *ChatGPT", date: "2026-11-16", time: "11:33" });
  });

  it("reads dollars with cents", () => {
    expect(readAlert(ALERTS.dollars)).toMatchObject({ kind: "purchase", currency: "USD", amount: "15.99", merchant: "SPOTIFY P3A1B2C3D4" });
  });

  it("tolerates line breaks, non-breaking spaces, an accent and a final period", () => {
    const messy = "Compraste COP140.910,00 en\nDIRECTV, el 17/11/2026 a las 12:27.  Esta compra está asociada a T.Cred *1999.";
    expect(readAlert(messy)).toMatchObject({ kind: "purchase", amount: "140910.00", merchant: "DIRECTV", last4: "1999" });
    expect(normalizePhrase(" a\n\tb ")).toBe("a b");
  });

  it("ignores alerts that do not mention a credit card, leaving no data", () => {
    expect(readAlert(ALERTS.savings)).toEqual({ kind: "ignored" });
    expect(readAlert(ALERTS.debit)).toEqual({ kind: "ignored" });
    expect(readAlert("")).toEqual({ kind: "ignored" });
  });

  it("never reads a payment or an advance as a purchase", () => {
    expect(readAlert(ALERTS.payment)).toEqual({ kind: "unknown", last4: "1999" });
    expect(readAlert(ALERTS.advance)).toEqual({ kind: "unknown", last4: "1999" });
  });

  it("reads alerts that write the card as T.Credito", () => {
    expect(readAlert(ALERTS.directv.replace("T.Cred *", "T.Credito *"))).toEqual({ kind: "purchase", last4: "1999", currency: "COP", amount: "140910.00", merchant: "DIRECTV", date: "2026-11-17", time: "12:27" });
    expect(readAlert(ALERTS.chatgpt.replace("T.Cred *", "T.Crédito *"))).toMatchObject({ kind: "purchase", last4: "1999" });
    expect(readAlert(ALERTS.payment.replace("T.Cred *", "T.Credito *"))).toEqual({ kind: "unknown", last4: "1999" });
    expect(readAlert("Bancolombia: tu T.Credito tiene un nuevo extracto.")).toEqual({ kind: "unknown", last4: null });
  });

  it("does not take other words that start with Cred as a credit card", () => {
    expect(readAlert("Bancolombia: tu T.Credencial *1999 fue actualizada.")).toEqual({ kind: "ignored" });
  });

  it("keeps a credit card alert without digits for review", () => {
    expect(readAlert("Bancolombia: tu T.Cred tiene un nuevo extracto.")).toEqual({ kind: "unknown", last4: null });
  });

  it.each([
    ["an impossible date", ALERTS.directv.replace("17/11/2026", "31/02/2026")],
    ["an impossible hour", ALERTS.directv.replace("12:27", "25:10")],
    ["an impossible minute", ALERTS.directv.replace("12:27", "12:61")],
    ["a zero amount", ALERTS.directv.replace("140.910,00", "0,00")],
    ["badly grouped thousands", ALERTS.directv.replace("140.910,00", "1409.10,00")],
    ["another currency", ALERTS.directv.replace("COP140", "EUR140")],
    ["text after the card", `${ALERTS.directv}. Si tienes dudas llama`],
    ["a merchant too long", ALERTS.directv.replace("DIRECTV", "X".repeat(201))],
  ])("sends %s to review instead of guessing", (_, phrase) => {
    expect(readAlert(phrase)).toEqual({ kind: "unknown", last4: "1999" });
  });
});
