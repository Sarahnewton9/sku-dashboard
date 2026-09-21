export type SpecColourSku = {
  style: string;
  colour: string;
  leather?: string | null;
  colour2?: string | null;
  leather2?: string | null;
};

export function normalizeSpecColourPart(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeStoredSpecColourKey(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  return trimmed.toLowerCase() === "__all__" ? "__all__" : normalizeSpecColourPart(trimmed);
}

export function getSpecSkuIdentity(
  style: string,
  colour: string,
  leather?: string | null,
  colour2?: string | null,
  leather2?: string | null,
): string {
  return [
    normalizeSpecColourPart(style),
    normalizeSpecColourPart(colour),
    normalizeSpecColourPart(leather),
    normalizeSpecColourPart(colour2),
    normalizeSpecColourPart(leather2),
  ].join("\u0000");
}

/**
 * Builds the column key used by the Specs grid. A leather suffix is only used
 * when the same style and colour are present with more than one leather.
 */
export function buildSpecColourKeyLookup(skus: readonly SpecColourSku[]): Map<string, string> {
  const leatherCounts = new Map<string, Set<string>>();
  const secondaryCounts = new Map<string, Set<string>>();
  const normalizedSkus = skus.map((sku) => ({
    style: normalizeSpecColourPart(sku.style),
    colour: normalizeSpecColourPart(sku.colour),
    leather: normalizeSpecColourPart(sku.leather),
    colour2: normalizeSpecColourPart(sku.colour2),
    leather2: normalizeSpecColourPart(sku.leather2),
  }));

  for (const sku of normalizedSkus) {
    const colourIdentity = `${sku.style}\u0000${sku.colour}`;
    const leathers = leatherCounts.get(colourIdentity) ?? new Set<string>();
    leathers.add(sku.leather);
    leatherCounts.set(colourIdentity, leathers);

    const primaryIdentity = getSpecSkuIdentity(sku.style, sku.colour, sku.leather);
    const secondaries = secondaryCounts.get(primaryIdentity) ?? new Set<string>();
    secondaries.add(`${sku.colour2}\u0000${sku.leather2}`);
    secondaryCounts.set(primaryIdentity, secondaries);
  }

  const keys = new Map<string, string>();
  for (const sku of normalizedSkus) {
    const colourIdentity = `${sku.style}\u0000${sku.colour}`;
    const hasMultipleLeathers = (leatherCounts.get(colourIdentity)?.size ?? 0) > 1;
    const primaryIdentity = getSpecSkuIdentity(sku.style, sku.colour, sku.leather);
    const hasMultipleSecondaryUppers = (secondaryCounts.get(primaryIdentity)?.size ?? 0) > 1;
    const primaryKey = (hasMultipleLeathers || hasMultipleSecondaryUppers) && sku.leather
      ? `${sku.colour} ${sku.leather}`
      : sku.colour;
    const secondaryKey = [sku.colour2, sku.leather2].filter(Boolean).join(" ");
    const key = hasMultipleSecondaryUppers && secondaryKey
      ? `${primaryKey}/${secondaryKey}`
      : primaryKey;
    keys.set(getSpecSkuIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2), key);
  }
  return keys;
}

/** Returns normalized current and legacy candidates for reading stored per-colour spec values. */
export function getSpecColourKeyCandidates(colour: string, rawColour?: string): string[] {
  const full = normalizeSpecColourPart(colour);
  const raw = normalizeSpecColourPart(rawColour);
  const candidates = [
    full,
    raw,
    full.split("/")[0] ?? "",
    raw.split("/")[0] ?? "",
    full.split(" ")[0] ?? "",
    raw.split(" ")[0] ?? "",
  ].filter(Boolean);
  return Array.from(new Set(candidates));
}

export function readSpecColourValue(
  valuesByColour: Record<string, string>,
  colour: string,
  rawColour?: string,
): string | undefined {
  const valuesByNormalizedKey = new Map<string, string>();
  for (const [storedKey, value] of Object.entries(valuesByColour)) {
    valuesByNormalizedKey.set(normalizeSpecColourPart(storedKey), value);
  }
  for (const candidate of getSpecColourKeyCandidates(colour, rawColour)) {
    const value = valuesByNormalizedKey.get(candidate);
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

export function findSpecColourMapValue<T>(
  valuesByColour: ReadonlyMap<string, T>,
  colour: string,
  rawColour?: string,
): T | undefined {
  const valuesByNormalizedKey = new Map<string, T>();
  for (const [storedKey, value] of Array.from(valuesByColour.entries())) {
    valuesByNormalizedKey.set(normalizeSpecColourPart(storedKey), value);
  }
  for (const candidate of getSpecColourKeyCandidates(colour, rawColour)) {
    const value = valuesByNormalizedKey.get(candidate);
    if (value !== undefined) return value;
  }
  return undefined;
}
