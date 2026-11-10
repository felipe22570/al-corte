import { expect, it } from "vitest";
import { dueTone, trialTone, utilizationTone } from "@/lib/ui-status";

it("respeta los límites de utilización", () => {
  expect([29.99, 30, 70, 70.01, 110].map(utilizationTone)).toEqual(["ok", "warning", "warning", "danger", "danger"]);
});
it("clasifica vencimientos y pagos", () => {
  expect([6, 5, 0, -1].map((days) => dueTone(days, false))).toEqual(["neutral", "warning", "warning", "danger"]);
  expect(dueTone(-1, true)).toBe("ok");
  expect([-1, 0, 7, 8].map(trialTone)).toEqual(["neutral", "warning", "warning", "neutral"]);
});
