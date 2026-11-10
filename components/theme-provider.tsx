"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { storageKey } from "@/lib/brand";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey={storageKey("theme")}>{children}</NextThemesProvider>;
}
