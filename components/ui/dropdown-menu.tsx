"use client";

import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

const DropdownMenu = Menu.Root;
const DropdownMenuTrigger = Menu.Trigger;

function DropdownMenuContent({ className, ...props }: Menu.Popup.Props) {
  return <Menu.Portal><Menu.Positioner sideOffset={8} align="end" className="z-50">
    <Menu.Popup {...props} className={cn("min-w-44 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none", className)} />
  </Menu.Positioner></Menu.Portal>;
}

function DropdownMenuItem({ className, destructive, ...props }: Menu.Item.Props & { destructive?: boolean }) {
  return <Menu.Item {...props} className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-body outline-none data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:min-h-11", destructive ? "text-danger data-highlighted:bg-danger-soft" : "data-highlighted:bg-secondary", className)} />;
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger };
