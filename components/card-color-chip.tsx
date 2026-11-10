import { cardColorClasses, type CardColor } from "@/lib/card-colors";

export function CardColorChip({ color, name }: { color: CardColor; name: string }) {
  return <span className="inline-flex items-center gap-2 text-small"><span aria-hidden="true" className={`size-2 rounded-full ${cardColorClasses[color]}`} />{name}</span>;
}
