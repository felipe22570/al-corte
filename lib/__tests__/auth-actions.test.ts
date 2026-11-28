import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signInWithOtp: vi.fn(), exchangeCodeForSession: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: "http://localhost:3000" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword: mocks.signInWithPassword, signInWithOtp: mocks.signInWithOtp, exchangeCodeForSession: mocks.exchangeCodeForSession } }),
}));

import { GET } from "@/app/auth/callback/route";
import { signIn, signInWithMagicLink } from "@/lib/actions/auth";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe("sign-in destination (D63)", () => {
  beforeEach(() => {
    mocks.signInWithPassword.mockReset().mockResolvedValue({ error: null });
    mocks.signInWithOtp.mockReset().mockResolvedValue({ error: null });
    mocks.exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  });

  it("keeps the current landing screen without a destination", async () => {
    await expect(signIn(form({ email: "owner@example.test", password: "secret" }))).rejects.toThrow("redirect:/movimientos");
  });

  it("opens an internal destination and ignores an external one", async () => {
    await expect(signIn(form({ email: "owner@example.test", password: "secret", next: "/v2/tarjetas" }))).rejects.toThrow("redirect:/v2/tarjetas");
    await expect(signIn(form({ email: "owner@example.test", password: "secret", next: "//example.com" }))).rejects.toThrow("redirect:/movimientos");
    await expect(signIn(form({ email: "owner@example.test", password: "secret", next: "https://example.com/v2" }))).rejects.toThrow("redirect:/movimientos");
  });

  it("carries a validated destination through the magic link", async () => {
    await expect(signInWithMagicLink(form({ email: "owner@example.test" }))).rejects.toThrow("redirect:/login?message=");
    expect(mocks.signInWithOtp).toHaveBeenLastCalledWith({ email: "owner@example.test", options: { emailRedirectTo: "http://localhost:3000/auth/callback" } });
    await expect(signInWithMagicLink(form({ email: "owner@example.test", next: "/v2" }))).rejects.toThrow("redirect:/login?message=");
    expect(mocks.signInWithOtp).toHaveBeenLastCalledWith({ email: "owner@example.test", options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fv2" } });
    await expect(signInWithMagicLink(form({ email: "owner@example.test", next: "//example.com" }))).rejects.toThrow("redirect:/login?message=");
    expect(mocks.signInWithOtp).toHaveBeenLastCalledWith({ email: "owner@example.test", options: { emailRedirectTo: "http://localhost:3000/auth/callback" } });
  });

  it("redirects the callback only to internal paths", async () => {
    const callback = async (query: string) => (await GET(new NextRequest(`http://localhost:3000/auth/callback?${query}`))).headers.get("location");
    expect(await callback("code=abc")).toBe("http://localhost:3000/movimientos");
    expect(await callback("code=abc&next=%2Fv2%2Ftarjetas")).toBe("http://localhost:3000/v2/tarjetas");
    expect(await callback("code=abc&next=%2F%2Fexample.com")).toBe("http://localhost:3000/movimientos");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid") });
    expect(await callback("code=abc&next=%2Fv2")).toContain("/login?error=");
  });
});
