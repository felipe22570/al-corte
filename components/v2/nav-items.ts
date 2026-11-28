import { v2Routes, type AppRoutes } from "@/lib/routes";

export type NavKey = "home" | "drafts" | "cards" | "movements" | "subscriptions" | "settings";

/** The six destinations of the new interface (D61), in order. */
export function navItems(routes: AppRoutes = v2Routes): Array<{ key: NavKey; label: string; href: string }> {
  return [
    { key: "home", label: "Inicio", href: routes.home },
    { key: "drafts", label: "Por confirmar", href: routes.drafts },
    { key: "cards", label: "Tarjetas", href: routes.cards },
    { key: "movements", label: "Movimientos", href: routes.movements() },
    { key: "subscriptions", label: "Suscripciones", href: routes.subscriptions },
    { key: "settings", label: "Ajustes", href: routes.settings },
  ];
}

/**
 * Destination highlighted for a path. Payment months belong to Inicio; a card, its statements, payments and reconciliation
 * to Tarjetas; card forms live in Ajustes. Paths outside the interface highlight nothing.
 */
export function activeNavKey(pathname: string, routes: AppRoutes = v2Routes): NavKey | null {
  const within = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  if (pathname === routes.home || within(routes.months)) return "home";
  if (within(routes.drafts)) return "drafts";
  if (within(routes.cards)) return "cards";
  if (within(routes.movements())) return "movements";
  if (within(routes.subscriptions)) return "subscriptions";
  if (within(routes.settings)) return "settings";
  return null;
}
