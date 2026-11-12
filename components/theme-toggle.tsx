"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { NativeSelect } from "@/components/ui/native-select";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const currentTheme = mounted ? theme ?? "system" : "system";
  const Icon = currentTheme === "light" ? Sun : currentTheme === "dark" ? Moon : Monitor;
  return <label className="inline-flex items-center gap-2 text-small"><Icon aria-hidden="true" className="size-5 text-muted-foreground" strokeWidth={1.75} />Tema<NativeSelect name="theme" aria-label="Tema de apariencia" value={currentTheme} onChange={(event) => setTheme(event.target.value)} className="w-auto"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></NativeSelect></label>;
}
