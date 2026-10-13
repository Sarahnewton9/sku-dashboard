import { getSkuCompositeIdentity } from "./skuCompositeIdentity";
import { formatSkuUpperPart } from "./skuExportLabel";

export type ColourLeatherSourceSku = {
  style: string;
  colour: string;
  leather: string;
  colour2?: string | null;
  leather2?: string | null;
  isNew: boolean;
};

export type ColourLeatherUpperRole = "Upper 1" | "Upper 2" | "Upper 1 + Upper 2";

export type ColourLeatherMaterialUsage = {
  style: string;
  identity: string;
  isNew: boolean;
  materialLabel: string;
  upperRole: ColourLeatherUpperRole;
  upper1Label: string;
  upper2Label: string;
};

export type ColourLeatherMaterialGroup = {
  key: string;
  colour: string;
  leather: string;
  totalCount: number;
  newCount: number;
  existingCount: number;
  skus: ColourLeatherMaterialUsage[];
};

export type ColourLeatherMaterialGroups = {
  groups: ColourLeatherMaterialGroup[];
  totalSkus: number;
  newSkus: number;
  existingSkus: number;
};

function mergeUpperRoles(
  current: ColourLeatherUpperRole,
  next: ColourLeatherUpperRole,
): ColourLeatherUpperRole {
  return current === next ? current : "Upper 1 + Upper 2";
}

/**
 * Groups every material used by an active physical SKU. Dual-upper SKUs are
 * included under both their Upper 1 and Upper 2 material labels, so material
 * discovery never hides a secondary construction such as DIMA's Cloud Snake.
 * A SKU that uses the same material in both uppers remains one use in that
 * material group and is labelled "Upper 1 + Upper 2".
 */
export function buildColourLeatherMaterialGroups(
  skus: readonly ColourLeatherSourceSku[],
): ColourLeatherMaterialGroups {
  const groups = new Map<string, ColourLeatherMaterialGroup>();
  const physicalSkus = new Map<string, boolean>();

  function addMaterial(
    sku: ColourLeatherSourceSku,
    identity: string,
    materialLabel: string,
    upperRole: ColourLeatherUpperRole,
    upper1Label: string,
    upper2Label: string,
  ) {
    if (!materialLabel) return;

    const existingGroup = groups.get(materialLabel) ?? {
      key: materialLabel,
      colour: "",
      leather: "",
      totalCount: 0,
      newCount: 0,
      existingCount: 0,
      skus: [],
    };
    if (!groups.has(materialLabel)) groups.set(materialLabel, existingGroup);

    const existingUsage = existingGroup.skus.find((usage) => usage.identity === identity);
    if (existingUsage) {
      existingUsage.upperRole = mergeUpperRoles(existingUsage.upperRole, upperRole);
      return;
    }

    existingGroup.skus.push({
      style: sku.style,
      identity,
      isNew: sku.isNew,
      materialLabel,
      upperRole,
      upper1Label,
      upper2Label,
    });
    existingGroup.totalCount++;
    if (sku.isNew) existingGroup.newCount++;
    else existingGroup.existingCount++;
  }

  for (const sku of skus) {
    const identity = getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2);
    physicalSkus.set(identity, sku.isNew);

    const upper1Label = formatSkuUpperPart(sku.colour, sku.leather, sku.style);
    const upper2Label = formatSkuUpperPart(sku.colour2, sku.leather2, sku.style);
    addMaterial(sku, identity, upper1Label, "Upper 1", upper1Label, upper2Label);
    addMaterial(sku, identity, upper2Label, "Upper 2", upper1Label, upper2Label);
  }

  const physicalFlags = Array.from(physicalSkus.values());
  return {
    groups: Array.from(groups.values()).sort((a, b) => b.totalCount - a.totalCount || a.key.localeCompare(b.key)),
    totalSkus: physicalFlags.length,
    newSkus: physicalFlags.filter(Boolean).length,
    existingSkus: physicalFlags.filter((isNew) => !isNew).length,
  };
}
