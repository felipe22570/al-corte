import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Disclosure({ className, ...props }: ComponentProps<"details">) {
  return <details {...props} className={cn("group/disclosure min-w-0", className)} />;
}

export function DisclosureSummary({ className, ...props }: ComponentProps<"summary">) {
  return <summary {...props} className={cn("flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md py-2 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden [&_svg]:shrink-0 [&_svg]:text-muted-foreground [&_svg]:group-open/disclosure:rotate-180", className)} />;
}

export function DisclosureContent({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("pt-3 pb-1", className)} />;
}
