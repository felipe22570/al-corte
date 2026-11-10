import { BookOpen, Briefcase, Bus, Car, Clapperboard, Coffee, Dumbbell, Ellipsis, Film, Gamepad2, Gift, GraduationCap, HeartPulse, House, Laptop, Music, PawPrint, Plane, Receipt, Repeat, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Stethoscope, Train, Utensils, Wallet, Wifi, Wrench } from "lucide-react";

export const categoryIcons = {
  "shopping-cart": ShoppingCart, utensils: Utensils, car: Car, receipt: Receipt,
  "heart-pulse": HeartPulse, clapperboard: Clapperboard, repeat: Repeat, plane: Plane,
  "graduation-cap": GraduationCap, house: House, ellipsis: Ellipsis,
  "book-open": BookOpen, briefcase: Briefcase, bus: Bus, coffee: Coffee,
  dumbbell: Dumbbell, film: Film, "gamepad-2": Gamepad2, gift: Gift,
  laptop: Laptop, music: Music, "paw-print": PawPrint, "shopping-bag": ShoppingBag,
  smartphone: Smartphone, sparkles: Sparkles, stethoscope: Stethoscope, train: Train,
  wallet: Wallet, wifi: Wifi, wrench: Wrench,
} as const;
export type CategoryIcon = keyof typeof categoryIcons;
export const CATEGORY_ICON_NAMES = Object.keys(categoryIcons) as CategoryIcon[];
export const categoryIconLabels: Record<CategoryIcon, string> = {
  "shopping-cart": "Mercado", utensils: "Restaurantes", car: "Carro", receipt: "Servicios",
  "heart-pulse": "Salud", clapperboard: "Entretenimiento", repeat: "Suscripciones", plane: "Viajes",
  "graduation-cap": "Educación", house: "Hogar", ellipsis: "Otros", "book-open": "Libros",
  briefcase: "Trabajo", bus: "Bus", coffee: "Café", dumbbell: "Deporte", film: "Cine",
  "gamepad-2": "Juegos", gift: "Regalos", laptop: "Computador", music: "Música",
  "paw-print": "Mascotas", "shopping-bag": "Compras", smartphone: "Celular", sparkles: "Cuidado personal",
  stethoscope: "Atención médica", train: "Tren", wallet: "Billetera", wifi: "Internet", wrench: "Reparaciones",
};
