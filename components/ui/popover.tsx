"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

function PopoverContent({ className, ...props }: PopoverPrimitive.Popup.Props) {
  return <PopoverPrimitive.Portal><PopoverPrimitive.Positioner sideOffset={8} align="end" className="z-50">
    <PopoverPrimitive.Popup className={cn("max-h-[var(--available-height)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none", className)} {...props} />
  </PopoverPrimitive.Positioner></PopoverPrimitive.Portal>;
}

export { Popover, PopoverContent, PopoverTrigger };
