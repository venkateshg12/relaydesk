// The widget's colour rules, shared so the admin's warning and the widget's text colour can never disagree
// (DESIGN_SYSTEM §9). The business picks the brand colour; its text colour is computed, not chosen.
export const DEFAULT_BRAND_COLOR = "#2450E6";
const INK = "#17181D";

const channels = (hex: string): [number, number, number] => {
  const value = parseInt(hex.replace(/^#/, ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

// WCAG relative luminance.
const luminance = (hex: string) => {
  const [r, g, b] = channels(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

// Contrast of white text on this colour (1–21).
export const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

// White when it reaches 4.5:1 on the colour, otherwise ink — so pale yellow still gets readable buttons.
export const brandForeground = (hex: string) => (contrastWithWhite(hex) >= 4.5 ? "#FFFFFF" : INK);
