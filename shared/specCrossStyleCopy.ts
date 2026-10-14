import { getSpecColourKeyCandidates, normalizeSpecColourPart } from "./specColourKey";
import { getKnownSpecComponent, type SpecComponent } from "./specTemplates";

export type CrossStyleSpecMap = Record<string, Record<string, string>>;

export type CrossStyleCustomRow = {
  colour: string;
  section: string;
  title: string;
  value: string | null;
  sortOrder: number;
};

export type CrossStyleCustomRowCopy = {
  section: string;
  title: string;
  value: string;
  sortOrder: number;
};

export type CrossStyleComponentCopyPlan = {
  /** Values whose semantic component exists in the target style template. */
  componentRows: Array<{ style: string; colour: string; component: string; value: string }>;
  /** Source-only components promoted into visible custom rows on the target. */
  customRows: CrossStyleCustomRowCopy[];
};

function normaliseComponentLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function humaniseComponentKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Finds the source SKU's component values whether legacy data is stored using a
 * raw colour, a colour/leather label, or a dual-upper label. The source label is
 * intentionally distinct from the target label: similar styles do not need to
 * share Upper 1 in order to copy their construction components.
 */
export function resolveCrossStyleSourceSpecs(
  specsByColour: CrossStyleSpecMap,
  sourceColourLabel: string,
  sourceRawColour?: string,
): Record<string, string> {
  const normalized = new Map<string, Record<string, string>>();
  for (const [colour, values] of Object.entries(specsByColour)) {
    normalized.set(normalizeSpecColourPart(colour), values);
  }

  for (const candidate of getSpecColourKeyCandidates(sourceColourLabel, sourceRawColour)) {
    const values = normalized.get(normalizeSpecColourPart(candidate));
    if (values) return values;
  }
  return {};
}

/**
 * Builds all template-cell writes for a cross-style copy. Upper 1 is purposely
 * excluded because every target SKU keeps its own material/colour description.
 */
export function buildCrossStyleComponentCopies(
  targetStyle: string,
  targetColourLabels: readonly string[],
  sourceValues: Record<string, string>,
): Array<{ style: string; colour: string; component: string; value: string }> {
  const components = Object.entries(sourceValues)
    .filter(([component, value]) => component !== "upper_1" && value.trim().length > 0);

  return targetColourLabels.flatMap((colour) => components.map(([component, value]) => ({
    style: targetStyle,
    colour,
    component,
    value,
  })));
}

/**
 * Plans a cross-style copy against the target template instead of blindly
 * persisting source component IDs. Style-specific IDs (for example
 * `roxie_leather_bow`) are not part of another style's template and would
 * otherwise save successfully but never be rendered. When the target exposes a
 * component with the same display label, its target key is used. Otherwise the
 * source component is kept as a visible custom row with its original label.
 */
export function planCrossStyleComponentCopies(
  targetStyle: string,
  targetColourLabels: readonly string[],
  sourceValues: Record<string, string>,
  targetTemplate: readonly SpecComponent[],
): CrossStyleComponentCopyPlan {
  const targetByKey = new Map(targetTemplate.map((component) => [component.key, component]));
  const targetByLabel = new Map<string, SpecComponent>();
  for (const component of targetTemplate) {
    const label = normaliseComponentLabel(component.label);
    if (!targetByLabel.has(label)) targetByLabel.set(label, component);
  }

  type Candidate = {
    value: string;
    priority: number;
    component?: SpecComponent;
    custom?: CrossStyleCustomRowCopy;
  };
  const chosen = new Map<string, Candidate>();

  for (const [sourceKey, rawValue] of Object.entries(sourceValues)) {
    const value = rawValue.trim();
    if (!value || sourceKey === "upper_1") continue;

    const sourceComponent = getKnownSpecComponent(sourceKey);
    const targetComponent = targetByKey.get(sourceKey)
      ?? (sourceComponent ? targetByLabel.get(normaliseComponentLabel(sourceComponent.label)) : undefined);
    const priority = targetByKey.has(sourceKey) ? 2 : 1;

    if (targetComponent) {
      const destination = `template:${targetComponent.key}`;
      const previous = chosen.get(destination);
      if (!previous || priority >= previous.priority) {
        chosen.set(destination, { value, priority, component: targetComponent });
      }
      continue;
    }

    const title = sourceComponent?.label ?? humaniseComponentKey(sourceKey);
    const section = sourceComponent?.section ?? "components";
    const destination = `custom:${section}:${normaliseComponentLabel(title)}`;
    const previous = chosen.get(destination);
    if (!previous || priority >= previous.priority) {
      chosen.set(destination, {
        value,
        priority,
        custom: {
          section,
          title,
          value,
          sortOrder: targetTemplate.length + chosen.size,
        },
      });
    }
  }

  const componentValues: Record<string, string> = {};
  const customRows: CrossStyleCustomRowCopy[] = [];
  for (const candidate of Array.from(chosen.values())) {
    if (candidate.component) componentValues[candidate.component.key] = candidate.value;
    if (candidate.custom) customRows.push(candidate.custom);
  }

  return {
    componentRows: buildCrossStyleComponentCopies(targetStyle, targetColourLabels, componentValues),
    customRows: customRows.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
  };
}

/**
 * Selects one value per custom-row title for a source SKU. A source-specific
 * value wins over a shared __all__ row; this preserves reusable custom fields
 * such as Wedge Name and Wedge Cover when copying to a different Upper 1.
 */
export function selectCrossStyleCustomRowCopies(
  rows: readonly CrossStyleCustomRow[],
  sourceColourLabel: string,
  sourceRawColour?: string,
): CrossStyleCustomRowCopy[] {
  const candidates = getSpecColourKeyCandidates(sourceColourLabel, sourceRawColour)
    .map(normalizeSpecColourPart);
  const candidateRank = new Map(candidates.map((colour, index) => [colour, index]));
  const chosen = new Map<string, { row: CrossStyleCustomRow; rank: number }>();

  for (const row of rows) {
    const value = row.value?.trim() ?? "";
    if (!value) continue;

    const colour = normalizeSpecColourPart(row.colour);
    const rank = colour === "__ALL__" ? Number.MAX_SAFE_INTEGER : candidateRank.get(colour);
    if (rank === undefined) continue;

    const key = `${row.section}\u0000${row.title}`;
    const existing = chosen.get(key);
    if (!existing || rank < existing.rank) chosen.set(key, { row, rank });
  }

  return Array.from(chosen.values())
    .map(({ row }) => ({
      section: row.section,
      title: row.title,
      value: row.value!.trim(),
      sortOrder: row.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}
