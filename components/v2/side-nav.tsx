"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/brand";
import { v2Routes } from "@/lib/routes";
import { ButtonLink } from "./button";
import { cx } from "./cx";
import { activeNavKey, navItems } from "./nav-items";

/** Desktop navigation (216–248 px): name, "Nuevo gasto" and the six destinations, with the drafts counter. */
export function SideNav({ draftCount }: { draftCount: number }) {
  const active = activeNavKey(usePathname());
  return <nav aria-label="Principal" className="ui:sticky ui:top-0 ui:hidden ui:h-dvh ui:w-58 ui:shrink-0 ui:flex-col ui:gap-6 ui:overflow-y-auto ui:border-r ui:border-line ui:px-4 ui:py-6 ui:md:flex">
    <Link href={v2Routes.home} data-v2-button="" className="ui:px-2 ui:font-display ui:text-wordmark ui:text-text ui:no-underline">{APP_NAME}</Link>
    <ButtonLink href={v2Routes.newMovement()} variant="soft" className="ui:w-full"><Plus aria-hidden="true" className="ui:size-5" strokeWidth={1.75} />Nuevo gasto</ButtonLink>
    <div className="ui:flex ui:flex-col ui:gap-0.5">
      {navItems().map((item) => {
        const current = item.key === active;
        return <Link key={item.key} href={item.href} data-v2-button="" aria-current={current ? "page" : undefined}
          className={cx("ui:flex ui:h-9 ui:items-center ui:justify-between ui:gap-2 ui:rounded-item ui:px-2.5 ui:no-underline", current ? "ui:bg-surface-raised ui:font-semibold ui:text-text" : "ui:text-text-2 ui:hover:text-text")}>
          {item.label}
          {item.key === "drafts" && draftCount > 0 && <span className="ui:rounded-full ui:bg-track ui:px-2 ui:py-px ui:text-tag ui:font-semibold ui:text-text" aria-label={`${draftCount} por confirmar`}>{draftCount}</span>}
        </Link>;
      })}
    </div>
  </nav>;
}
