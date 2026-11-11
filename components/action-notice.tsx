"use client";

import { useSearchParams } from "next/navigation";
import { SaveNotice } from "@/components/save-notice";

export function ActionNotice() {
  const notice = useSearchParams().get("notice");
  const message = notice === "updated" ? "Movimiento actualizado" : notice === "deleted" ? "Movimiento eliminado" : null;
  return message ? <SaveNotice key={notice} message={message} /> : null;
}
