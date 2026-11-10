import { expect, it } from "vitest";
import { categoryIcons } from "@/lib/category-icons";

it("incluye los iconos de las categorías iniciales", () => {
  for (const icon of ["shopping-cart", "utensils", "car", "receipt", "heart-pulse", "clapperboard", "repeat", "plane", "graduation-cap", "house", "ellipsis"]) {
    expect(categoryIcons).toHaveProperty(icon);
  }
});
