"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Sheet({ title, open, onOpenChange, trigger, children }: { title: string; open: boolean; onOpenChange: (open: boolean) => void; trigger: ReactElement; children: ReactNode }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Trigger render={trigger} />
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-30 bg-overlay/60" />
      <Dialog.Popup className="fixed inset-x-0 bottom-0 z-40 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-lg focus:outline-none md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-full md:max-w-lg md:rounded-t-none md:rounded-l-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 p-4"><Dialog.Title className="font-display text-title">{title}</Dialog.Title><Dialog.Close aria-label="Cerrar" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11"><X aria-hidden="true" className="size-5" strokeWidth={1.75} /></Dialog.Close></div>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function SheetBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6", className)}>{children}</div>;
}

export function SheetFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex shrink-0 flex-col gap-3 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]", className)}>{children}</div>;
}
