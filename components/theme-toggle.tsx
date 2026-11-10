"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return <label className="inline-flex items-center gap-2 text-small"><Icon aria-hidden="true" className="size-5 text-muted-foreground" strokeWidth={1.75} />Tema<select aria-label="Tema de apariencia" value={theme ?? "system"} onChange={(event) => setTheme(event.target.value)} className="h-11 rounded-md border border-input bg-card px-3 text-input text-foreground"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>;
}
