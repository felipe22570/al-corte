import { cardColorClasses, type CardColor } from "@/lib/card-colors";

export function CardColorChip({ color, name }: { color: CardColor; name: string }) {
  return <span className="inline-flex min-w-0 max-w-full items-center gap-2 text-small"><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${cardColorClasses[color]}`} /><span className="min-w-0 wrap-anywhere">{name}</span></span>;
}
