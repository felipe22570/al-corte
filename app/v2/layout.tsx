import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/v2/app-shell";
import { OverlayRoot } from "@/components/v2/overlay-root";
import { countOpenDrafts } from "@/lib/queries/drafts";
import { requireUser } from "@/lib/supabase/require-user";
import "./v2.css";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-v2-display" });
const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-v2-sans" });

/** The new interface (D58): its own tokens and fonts inside `[data-ui="v2"]`, with the session checked here and in the proxy. */
export default async function V2Layout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireUser();
  const draftCount = await countOpenDrafts(supabase, user.id);
  return <div data-ui="v2" className={`${display.variable} ${sans.variable}`}>
    <AppShell draftCount={draftCount}>{children}</AppShell>
    <OverlayRoot />
  </div>;
}
