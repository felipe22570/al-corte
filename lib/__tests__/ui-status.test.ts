import { expect, it } from "vitest";
import { utilizationTone } from "@/lib/ui-status";

it("respeta los límites de utilización", () => {
  expect([29.99, 30, 70, 70.01, 110].map(utilizationTone)).toEqual(["ok", "warning", "warning", "danger", "danger"]);
});
