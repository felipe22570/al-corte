"use client";

import { Menu as Primitive } from "@base-ui/react/menu";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { buttonClasses } from "./button";
import { cx } from "./cx";
import { useOverlayContainer } from "./overlay-root";

const item = "ui:flex ui:min-h-9 ui:w-full ui:cursor-pointer ui:items-center ui:gap-2 ui:rounded-item ui:px-3 ui:py-2 ui:text-left ui:text-body ui:no-underline ui:outline-none ui:data-highlighted:bg-track ui:data-disabled:pointer-events-none ui:data-disabled:opacity-50 ui:pointer-coarse:min-h-11";

/**
 * The "···" menu of secondary actions (docs/design-v2.md). `label` names the default "···" button for screen readers
 * ("Más opciones del extracto"); a custom `trigger` shows `triggerContent` as its visible name instead.
 */
export function Menu({ label, trigger, triggerContent, children, align = "end", side = "bottom" }: {
  label?: string; trigger?: ReactElement; triggerContent?: ReactNode; children: ReactNode; align?: "start" | "center" | "end"; side?: "top" | "bottom";
}) {
  const container = useOverlayContainer();
  return <Primitive.Root>
    {trigger
      ? <Primitive.Trigger render={trigger}>{triggerContent}</Primitive.Trigger>
      : <Primitive.Trigger aria-label={label} render={<button type="button" className={buttonClasses("more")} />}>
        <Ellipsis aria-hidden="true" className="ui:size-5" strokeWidth={1.75} />
      </Primitive.Trigger>}
    <Primitive.Portal container={container}>
      <Primitive.Positioner sideOffset={6} align={align} side={side} className="ui:z-50">
        <Primitive.Popup className="ui:flex ui:min-w-44 ui:flex-col ui:rounded-block ui:border ui:border-field-border ui:bg-surface-raised ui:p-1.5 ui:text-text ui:outline-none">{children}</Primitive.Popup>
      </Primitive.Positioner>
    </Primitive.Portal>
  </Primitive.Root>;
}

export function MenuItem({ children, onClick, danger, disabled }: { children: ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return <Primitive.Item onClick={onClick} disabled={disabled} className={cx(item, danger && "ui:text-danger")}>{children}</Primitive.Item>;
}

export function MenuLink({ href, children, badge }: { href: string; children: ReactNode; badge?: ReactNode }) {
  return <Primitive.LinkItem render={<Link href={href} data-v2-button="" />} className={cx(item, "ui:justify-between ui:text-text")}>{children}{badge}</Primitive.LinkItem>;
}
