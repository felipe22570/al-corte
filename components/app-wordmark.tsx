import { APP_NAME } from "@/lib/brand";

export function AppWordmark({ compact = false }: { compact?: boolean }) {
  return <span className={compact ? "font-display text-wordmark" : "font-display text-display"}>{APP_NAME}</span>;
}
