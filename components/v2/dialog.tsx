"use client";

import { Dialog as Primitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { buttonClasses } from "./button";
import { cx } from "./cx";
import { useOverlayContainer } from "./overlay-root";

/**
 * Short forms and confirmations (D61): focus trapped, Escape and the close button close it, and it fills the screen on a
 * phone. Controlled with `open`/`onOpenChange`, or opened by `trigger`.
 */
export function Dialog({ title, trigger, open, onOpenChange, children, footer, className }: {
  title: string; trigger?: ReactElement; open?: boolean; onOpenChange?: (open: boolean) => void;
  children: ReactNode; footer?: ReactNode; className?: string;
}) {
  const container = useOverlayContainer();
  return <Primitive.Root open={open} onOpenChange={onOpenChange}>
    {trigger && <Primitive.Trigger render={trigger} />}
    <Primitive.Portal container={container}>
      <Primitive.Backdrop className="ui:fixed ui:inset-0 ui:z-40 ui:bg-scrim ui:dark:opacity-80" />
      <Primitive.Popup className={cx(
        "ui:fixed ui:z-50 ui:flex ui:flex-col ui:gap-4 ui:overflow-y-auto ui:bg-surface ui:p-6 ui:text-text ui:outline-none",
        "ui:inset-0 ui:md:inset-auto ui:md:left-1/2 ui:md:top-16 ui:md:max-h-[calc(100dvh-8rem)] ui:md:w-full ui:md:max-w-dialog ui:md:-translate-x-1/2 ui:md:rounded-hero ui:md:border ui:md:border-track",
        className)}>
        <div className="ui:flex ui:items-center ui:justify-between ui:gap-3">
          <Primitive.Title className="ui:m-0 ui:font-display ui:text-dialog-title">{title}</Primitive.Title>
          <Primitive.Close aria-label="Cerrar" className={buttonClasses("icon")}><X aria-hidden="true" className="ui:size-5" strokeWidth={1.75} /></Primitive.Close>
        </div>
        {children}
        {footer && <div className="ui:flex ui:flex-wrap ui:items-center ui:gap-4 ui:pt-1">{footer}</div>}
      </Primitive.Popup>
    </Primitive.Portal>
  </Primitive.Root>;
}

/** A link-styled button that closes the dialog ("Cancelar"). */
export function DialogClose({ children }: { children: ReactNode }) {
  return <Primitive.Close className={buttonClasses("link")}>{children}</Primitive.Close>;
}
