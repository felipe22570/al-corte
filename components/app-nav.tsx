"use client";

import { LayoutDashboard, List, LogOut, Settings, Repeat } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppWordmark } from "@/components/app-wordmark";
import { signOut } from "@/lib/actions/auth";
import { isNavigationActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Tablero", icon: LayoutDashboard },
  { href: "/movimientos", label: "Movimientos", icon: List },
  { href: "/suscripciones", label: "Suscripciones", icon: Repeat },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
] as const;

export function AppNav() {
  const pathname = usePathname();
  return <>
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-card p-4 md:flex">
      <Link href="/" aria-label="Al Corte, ir al tablero" className="flex min-h-10 items-center rounded-md px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"><AppWordmark compact /></Link>
      <nav aria-label="Navegación principal" className="mt-6 flex flex-col gap-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active = isNavigationActive(href, pathname);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-5" strokeWidth={1.75} />{label}</Link>;
        })}
      </nav>
      <form action={signOut} className="mt-auto"><button type="submit" className="flex min-h-10 items-center gap-3 rounded-md px-3 text-body text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"><LogOut className="size-5" strokeWidth={1.75} />Cerrar sesión</button></form>
    </aside>
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      {links.map(({ href, label, icon: Icon }) => {
        const active = isNavigationActive(href, pathname);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "font-semibold text-foreground" : "text-muted-foreground")}><Icon className="size-5" strokeWidth={1.75} /><span>{label}</span><span aria-hidden="true" className={cn("h-1 w-4 rounded-full", active ? "bg-foreground" : "bg-transparent")} /></Link>;
      })}
    </nav>
  </>;
}
