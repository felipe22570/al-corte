import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ claims: null as Record<string, unknown> | null }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: auth.claims ? { claims: auth.claims } : null, error: null }) } }),
}));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "http://127.0.0.1:54321", publishableKey: "publishable" }) }));

import { requiresSession, updateSession } from "@/lib/supabase/proxy";

const request = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));

describe("session proxy", () => {
  beforeEach(() => { auth.claims = null; });

  it("sends a request under /v2 without a session to the login", async () => {
    for (const path of ["/v2", "/v2/tarjetas", "/v2/movimientos/nuevo?borrador=x"]) {
      const response = await updateSession(request(path));
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
      expect(new URL(response.headers.get("location")!).search).toBe("");
    }
  });

  it("lets /v2 through with a session", async () => {
    auth.claims = { sub: "owner" };
    const response = await updateSession(request("/v2/tarjetas"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves the current interface, the login and the ingest route to their own checks", async () => {
    for (const path of ["/", "/login", "/meses/2026-12", "/api/ingest/alerts", "/v2x", "/ajustes/v2"]) {
      const response = await updateSession(request(path));
      expect(response.headers.get("location")).toBeNull();
    }
    expect(requiresSession("/v2")).toBe(true);
    expect(requiresSession("/v2/")).toBe(true);
    expect(requiresSession("/v20")).toBe(false);
  });
});
