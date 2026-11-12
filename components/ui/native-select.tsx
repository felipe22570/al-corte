import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn("h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-input text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive pointer-coarse:h-11", className)} />;
}
