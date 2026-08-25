export type BuyLocation = "au" | "usa" | "nyc" | "la";

export type BuyLocationItem = {
  style: string;
  auQty: number;
  usaQty: number;
  nycQty: number;
  laQty: number;
};

export type LocationStyleGroup<T extends BuyLocationItem> = {
  style: string;
  quantity: number;
  items: T[];
};

export function getLocationQuantity(item: BuyLocationItem, location: BuyLocation): number {
  if (location === "au") return item.auQty;
  if (location === "usa") return item.usaQty;
  if (location === "nyc") return item.nycQty;
  return item.laQty;
}

export function groupBoughtStylesByLocation<T extends BuyLocationItem>(
  items: readonly T[],
  location: BuyLocation,
): LocationStyleGroup<T>[] {
  const groups = new Map<string, LocationStyleGroup<T>>();

  for (const item of items) {
    const quantity = getLocationQuantity(item, location);
    if (quantity <= 0) continue;

    const group = groups.get(item.style) ?? { style: item.style, quantity: 0, items: [] };
    group.quantity += quantity;
    group.items.push(item);
    groups.set(item.style, group);
  }

  return Array.from(groups.values()).sort(
    (a, b) => b.quantity - a.quantity || a.style.localeCompare(b.style),
  );
}
