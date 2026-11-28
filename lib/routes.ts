/**
 * App routes with a configurable base (D58, D63). The new interface lives under `/v2` during H13 and moves to the root
 * when it replaces the current one (step 56): only `V2_BASE` changes. The current interface keeps its literal paths.
 */
export type RouteBase = "" | "/v2";

export const V2_BASE: RouteBase = "/v2";
/** Every interface that renders financial data; writes revalidate all of them. */
export const ROUTE_BASES: readonly RouteBase[] = ["", V2_BASE];

type QueryValue = string | number | null | undefined;

function withQuery(path: string, query: Record<string, QueryValue> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function createRoutes(base: RouteBase) {
  const at = (path: string) => (path === "/" ? base || "/" : `${base}${path}`);
  return {
    base,
    home: at("/"),
    months: at("/meses"),
    month: (month: string) => at(`/meses/${month}`),
    cards: at("/tarjetas"),
    card: (cardId: string) => at(`/tarjetas/${cardId}`),
    statement: (cardId: string, cutoffDate: string) => at(`/tarjetas/${cardId}/extractos/${cutoffDate}`),
    statementPayment: (cardId: string, cutoffDate: string) => at(`/tarjetas/${cardId}/extractos/${cutoffDate}/pago`),
    statementReconcile: (cardId: string, cutoffDate: string) => at(`/tarjetas/${cardId}/extractos/${cutoffDate}/conciliar`),
    movements: (query?: Record<string, QueryValue>) => withQuery(at("/movimientos"), query),
    movement: (id: string) => at(`/movimientos/${id}`),
    editMovement: (id: string) => at(`/movimientos/${id}/editar`),
    newMovement: (options: { draftId?: string } = {}) => withQuery(at("/movimientos/nuevo"), { borrador: options.draftId }),
    drafts: at("/por-confirmar"),
    subscriptions: at("/suscripciones"),
    subscription: (id: string) => `${at("/suscripciones")}#suscripcion-${id}`,
    settings: at("/ajustes"),
    newCard: at("/ajustes/tarjetas/nueva"),
    editCard: (cardId: string) => at(`/ajustes/tarjetas/${cardId}`),
    importStatement: at("/ajustes/importar"),
    /** Shared by both interfaces: route handlers and the login do not move with the base. */
    exportData: (query: { formato: "json" | "csv"; tabla?: string }) => withQuery("/ajustes/exportar", query),
    login: "/login",
  };
}

export type AppRoutes = ReturnType<typeof createRoutes>;

export const v2Routes = createRoutes(V2_BASE);

/** Route patterns of each interface for `revalidatePath`; dynamic ones need the `page` type. */
export function revalidationPatterns(base: RouteBase): Array<{ path: string; type?: "page" | "layout" }> {
  if (base === "") {
    return [
      { path: "/" },
      { path: "/movimientos" },
      { path: "/movimientos/nuevo" },
      { path: "/suscripciones" },
      { path: "/ajustes" },
      { path: "/por-confirmar" },
      { path: "/meses/[mes]", type: "page" },
      { path: "/movimientos/[id]", type: "page" },
      { path: "/movimientos/[id]/editar", type: "page" },
      { path: "/tarjetas/[id]", type: "page" },
      { path: "/tarjetas/[id]/extractos/[cutoff]", type: "page" },
    ];
  }
  const routes = createRoutes(base);
  return [
    // The layout carries the navigation counter and covers every page beneath it.
    { path: base, type: "layout" },
    { path: routes.home },
    { path: routes.months },
    { path: routes.cards },
    { path: routes.movements() },
    { path: routes.newMovement() },
    { path: routes.drafts },
    { path: routes.subscriptions },
    { path: routes.settings },
    { path: routes.newCard },
    { path: routes.importStatement },
    { path: routes.month("[mes]"), type: "page" },
    { path: routes.card("[id]"), type: "page" },
    { path: routes.statement("[id]", "[cutoff]"), type: "page" },
    { path: routes.statementPayment("[id]", "[cutoff]"), type: "page" },
    { path: routes.statementReconcile("[id]", "[cutoff]"), type: "page" },
    { path: routes.movement("[id]"), type: "page" },
    { path: routes.editMovement("[id]"), type: "page" },
    { path: routes.editCard("[id]"), type: "page" },
  ];
}

/**
 * A destination received from the client, accepted only as an internal path of the app (no scheme, host, protocol-relative
 * `//`, backslashes or control characters). Returns `fallback` otherwise, so an action never redirects outside the app.
 */
export function safeInternalPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "http://al-corte.invalid");
    if (parsed.origin !== "http://al-corte.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
