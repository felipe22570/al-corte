"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" className={cn("min-w-0 flex-1 truncate text-left", className)} {...props} />;
}

function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return <SelectPrimitive.Trigger data-slot="select-trigger" className={cn("flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-input text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-placeholder:text-muted-foreground pointer-coarse:h-11", className)} {...props}>
    {children}<SelectPrimitive.Icon><ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} /></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>;
}

function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return <SelectPrimitive.Portal><SelectPrimitive.Positioner sideOffset={4} align="start" alignItemWithTrigger={false} className="z-50 max-w-[calc(100vw-2rem)]">
    <SelectPrimitive.Popup data-slot="select-content" className={cn("max-h-[min(var(--available-height),20rem)] w-[var(--anchor-width)] min-w-36 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none", className)} {...props}>
      <SelectPrimitive.List>{children}</SelectPrimitive.List>
    </SelectPrimitive.Popup>
  </SelectPrimitive.Positioner></SelectPrimitive.Portal>;
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return <SelectPrimitive.Item data-slot="select-item" className={cn("relative flex min-h-9 cursor-default items-center gap-2 rounded-sm py-2 pr-9 pl-3 text-input outline-none select-none data-highlighted:bg-secondary data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:min-h-11", className)} {...props}>
    <SelectPrimitive.ItemText className="min-w-0 break-words">{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex size-5 items-center justify-center"><Check aria-hidden="true" className="size-5" strokeWidth={1.75} /></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>;
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
