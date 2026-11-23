import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Maximum age of a signed request (R10): a captured request cannot be replayed later. */
export const MAX_SIGNATURE_AGE_SECONDS = 5 * 60;

/** `v1=` + HMAC-SHA256 in hex of `"{timestamp}.{body}"`. The Apps Script (step 44) signs the same way. */
export function signAlert(secret: string, timestamp: string, body: string): string {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex")}`;
}

/** Valid only with the right secret, the exact body and a timestamp within 5 minutes of now (either direction). */
export function verifyAlertSignature(secret: string, timestamp: string | null, signature: string | null, body: string, now: Date): boolean {
  if (!timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(now.getTime() / 1000) - Number(timestamp)) > MAX_SIGNATURE_AGE_SECONDS) return false;
  const expected = Buffer.from(signAlert(secret, timestamp, body), "utf8");
  const received = Buffer.from(signature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
