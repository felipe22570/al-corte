"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { v2Routes } from "@/lib/routes";
import { cx } from "./cx";
import { Menu, MenuLink } from "./menu";
import { activeNavKey, type NavKey } from "./nav-items";

const tab = "ui:flex ui:min-h-11 ui:flex-1 ui:items-center ui:justify-center ui:text-tag ui:no-underline";

/** Phone navigation: Inicio, Tarjetas, the new-expense button, Movimientos and "Más" with the other destinations. */
export function BottomNav({ draftCount }: { draftCount: number }) {
  const active = activeNavKey(usePathname());
  const link = (key: NavKey, href: string, label: string) => <Link href={href} data-v2-button="" aria-current={active === key ? "page" : undefined}
    className={cx(tab, active === key ? "ui:font-semibold ui:text-text" : "ui:font-medium ui:text-text-3")}>{label}</Link>;
  const inMore = active === "drafts" || active === "subscriptions" || active === "settings";
  return <nav aria-label="Principal" className="ui:fixed ui:inset-x-0 ui:bottom-0 ui:z-30 ui:flex ui:items-center ui:gap-1 ui:border-t ui:border-line ui:bg-ground ui:px-2.5 ui:pt-2 ui:pb-[max(1.375rem,env(safe-area-inset-bottom))] ui:md:hidden">
    {link("home", v2Routes.home, "Inicio")}
    {link("cards", v2Routes.cards, "Tarjetas")}
    <Link href={v2Routes.newMovement()} data-v2-button="" aria-label="Nuevo gasto" className="ui:flex ui:size-13 ui:shrink-0 ui:items-center ui:justify-center ui:rounded-panel ui:bg-primary ui:text-on-primary ui:no-underline"><Plus aria-hidden="true" className="ui:size-6.5" strokeWidth={2} /></Link>
    {link("movements", v2Routes.movements(), "Movimientos")}
    <Menu side="top" triggerContent="Más" trigger={<button type="button" aria-current={inMore ? "page" : undefined} className={cx(tab, "ui:cursor-pointer ui:bg-transparent", inMore ? "ui:font-semibold ui:text-text" : "ui:font-medium ui:text-text-3")} />}>
      <MenuLink href={v2Routes.drafts} badge={draftCount > 0 ? <span className="ui:rounded-full ui:bg-track ui:px-2 ui:py-px ui:text-tag ui:font-semibold">{draftCount}</span> : undefined}>Por confirmar</MenuLink>
      <MenuLink href={v2Routes.subscriptions}>Suscripciones</MenuLink>
      <MenuLink href={v2Routes.settings}>Ajustes</MenuLink>
    </Menu>
  </nav>;
}
