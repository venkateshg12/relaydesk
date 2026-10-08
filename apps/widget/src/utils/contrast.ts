import { brandForeground, DEFAULT_BRAND_COLOR, isHexColor } from "@repo/types";

// Sets the two CSS variables the whole widget is drawn with. A colour that isn't a 6-digit hex falls back
// to the default rather than painting something unreadable.
export function applyBrandTheme(brandHex?: string | null): void {
  const color = brandHex && isHexColor(brandHex) ? brandHex : DEFAULT_BRAND_COLOR;
  document.documentElement.style.setProperty("--rd-brand", color);
  document.documentElement.style.setProperty("--rd-brand-foreground", brandForeground(color));
}
