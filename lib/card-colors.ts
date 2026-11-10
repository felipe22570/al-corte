export const CARD_COLORS = ["card-1", "card-2", "card-3", "card-4", "card-5", "card-6"] as const;
export type CardColor = typeof CARD_COLORS[number];
export const cardColorClasses: Record<CardColor, string> = {
  "card-1": "bg-card-1", "card-2": "bg-card-2", "card-3": "bg-card-3",
  "card-4": "bg-card-4", "card-5": "bg-card-5", "card-6": "bg-card-6",
};
export const cardColorNames: Record<CardColor, string> = {
  "card-1": "Azul", "card-2": "Violeta", "card-3": "Petróleo",
  "card-4": "Vino", "card-5": "Mostaza", "card-6": "Pizarra",
};
