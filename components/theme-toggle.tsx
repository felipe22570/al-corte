"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { SelectControl } from "@/components/select-control";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const currentTheme = mounted ? theme ?? "system" : "system";
  const Icon = currentTheme === "light" ? Sun : currentTheme === "dark" ? Moon : Monitor;
  return <div className="inline-flex items-center gap-2 text-small"><Icon aria-hidden="true" className="size-5 text-muted-foreground" strokeWidth={1.75} /><label htmlFor="appearance-theme">Tema</label><SelectControl id="appearance-theme" name="theme" aria-label="Tema de apariencia" value={currentTheme} onValueChange={setTheme} className="w-auto min-w-32" options={[{ value: "system", label: "Sistema" }, { value: "light", label: "Claro" }, { value: "dark", label: "Oscuro" }]} /></div>;
}
