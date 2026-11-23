/**
 * Alert phrases for the ingest rules (step 42) and the Apps Script (step 44). The two purchases follow the format the
 * owner documented for the real alerts of November 2026 (plan of step 42); the card digits are fictitious.
 */
export const ALERTS = {
  directv: "Bancolombia: Compraste COP140.910,00 en DIRECTV, el 17/11/2026 a las 12:27. Esta compra esta asociada a T.Cred *1999",
  chatgpt: "Bancolombia: Compraste COP81.000,00 en GOOGLE *ChatGPT, el 16/11/2026 a las 11:33. Esta compra esta asociada a T.Cred *1999",
  dollars: "Bancolombia: Compraste USD15,99 en SPOTIFY P3A1B2C3D4, el 20/11/2026 a las 07:05. Esta compra esta asociada a T.Cred *1999",
  /** Debit and savings alerts do not mention "T.Cred" (D44). */
  savings: "Bancolombia: Transferiste $50.000 desde tu cuenta *5678 a la cuenta *0000 el 18/11/2026 a las 09:15.",
  debit: "Bancolombia: Compraste $25.000,00 en PANADERIA con tu T.Deb *5678, el 18/11/2026 a las 08:10.",
  /** A payment to the card from savings mentions both; it is not a purchase. */
  payment: "Bancolombia: Pagaste $1.178.836,00 a tu T.Cred *1999 desde tu cuenta *5678 el 02/12/2026 a las 10:00.",
  advance: "Bancolombia: Retiraste $200.000,00 en CAJERO EJEMPLO con tu T.Cred *1999 el 21/11/2026 a las 18:40.",
} as const;
