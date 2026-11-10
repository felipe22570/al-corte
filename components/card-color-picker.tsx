"use client";

import { Check } from "lucide-react";
import { CARD_COLORS, cardColorClasses, cardColorNames, type CardColor } from "@/lib/card-colors";

export function CardColorPicker({ value, onChange }: { value: CardColor; onChange: (value: CardColor) => void }) {
  return <fieldset><legend className="mb-2 text-small font-medium">Color de tarjeta</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{CARD_COLORS.map((color) => <label key={color} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-small focus-within:ring-2 focus-within:ring-ring ${color === value ? "border-foreground font-semibold" : "border-border"}`}><input className="sr-only" type="radio" name="color" value={color} checked={value === color} onChange={() => onChange(color)} /><span className={`size-3 rounded-full ${cardColorClasses[color]}`} aria-hidden="true" /><span>{cardColorNames[color]}</span>{color === value && <Check className="ml-auto size-5" strokeWidth={1.75} aria-hidden="true" />}</label>)}</div></fieldset>;
}
