import { revalidatePath } from "next/cache";
import { paymentMonth } from "@/lib/domain/months";
import { createRoutes, revalidationPatterns, ROUTE_BASES } from "@/lib/routes";

/**
 * Financial writes can affect multiple installments, historical comparisons,
 * projections and identities. Route patterns cover both previous and new
 * references without relying on Next.js's temporary router-cache behavior.
 * Both interfaces are revalidated while H13 keeps them side by side (D63).
 */
export function revalidateFinancialViews() {
  for (const base of ROUTE_BASES) {
    for (const { path, type } of revalidationPatterns(base)) {
      if (type) revalidatePath(path, type);
      else revalidatePath(path);
    }
  }
}

/** A statement change: its card, the statement, its payment month and the home of each interface, then every financial view. */
export function revalidateStatementViews(statement: { card_id: string; cutoff_date: string; due_date: string }) {
  for (const base of ROUTE_BASES) {
    const routes = createRoutes(base);
    revalidatePath(routes.card(statement.card_id));
    revalidatePath(routes.statement(statement.card_id, statement.cutoff_date));
    revalidatePath(routes.month(paymentMonth(statement.due_date)));
    revalidatePath(routes.home);
  }
  revalidateFinancialViews();
}

/** Capture settings and card aliases: settings, home and the drafts inbox of each interface. */
export function revalidateCaptureViews() {
  for (const base of ROUTE_BASES) {
    const routes = createRoutes(base);
    revalidatePath(routes.settings);
    revalidatePath(routes.home);
    revalidatePath(routes.drafts);
  }
}
