/** Normalises a SKU identity part without changing the user-facing label. */
export function normalizeSkuIdentityPart(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Identifies one physical SKU by both ordered uppers.
 *
 * Upper 2 is intentionally part of the identity: two SKUs such as
 * ECRU SNAKE/ROYAL SUEDE and ECRU SNAKE/LIPSTICK SUEDE are distinct.
 * Blank and null secondary fields normalise to the same legacy single-upper
 * identity.
 */
export function getSkuCompositeIdentity(
  style: string | null | undefined,
  colour: string | null | undefined,
  leather: string | null | undefined,
  colour2?: string | null,
  leather2?: string | null,
): string {
  return [style, colour, leather, colour2, leather2]
    .map(normalizeSkuIdentityPart)
    .join("\u0000");
}
