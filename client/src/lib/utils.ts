import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalise leather name for display.
 * KID → CAPRI for all styles except CAPRICE.
 */
export function displayLeather(leather: string, style?: string): string {
  if (leather === "KID" && style?.toUpperCase() !== "CAPRICE") return "CAPRI";
  return leather;
}

/**
 * Normalise colour name for display.
 * CHOC + VENICE leather → CHOCOLATE.
 */
export function displayColour(colour: string, leather?: string): string {
  if (colour === "CHOC" && leather === "VENICE") return "CHOCOLATE";
  return colour;
}

/**
 * Return the full display label for a colour+leather combo.
 * e.g. "BLACK CAPRI", "CHOCOLATE VENICE"
 */
export function displayColourLeather(colour: string, leather: string, style?: string): string {
  const c = displayColour(colour, leather);
  const l = displayLeather(leather, style);
  return `${c} ${l}`;
}
