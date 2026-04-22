/**
 * Spec templates — defines the ordered list of component rows for each shoe category.
 * Each component has a key (used as DB identifier), a label (displayed in the form),
 * and a field type (dropdown | text | boolean).
 *
 * Universal components appear in all templates.
 * Category-specific components are added per template.
 * Buckle is handled separately via the hasBuckle toggle on styleSpecMeta.
 */

export type FieldType = "dropdown" | "text";

export interface SpecComponent {
  key: string;           // DB key — stable identifier, never change
  label: string;         // Display label
  type: FieldType;
  section: "upper" | "construction" | "sole" | "heel" | "packaging";
}

// ─── Universal components (shared across all categories) ─────────────────────

const UPPER_BASE: SpecComponent[] = [
  { key: "upper_1",       label: "Upper 1",        type: "dropdown", section: "upper" },
  { key: "stitch",        label: "Stitch",          type: "dropdown", section: "upper" },
  { key: "lining",        label: "Lining",          type: "dropdown", section: "upper" },
];

const SOCK_BASE: SpecComponent[] = [
  { key: "sock",          label: "Sock",            type: "dropdown", section: "construction" },
  { key: "sock_treatment",label: "Sock Treatment",  type: "dropdown", section: "construction" },
  { key: "heel_counter",  label: "Heel Counter",    type: "dropdown", section: "construction" },
  { key: "insole_name",   label: "Insole Name",     type: "text",     section: "construction" },
];

const SOLE_BASE: SpecComponent[] = [
  { key: "sole_name",     label: "Sole Name",       type: "text",     section: "sole" },
  { key: "sole_colour",   label: "Sole Colour",     type: "dropdown", section: "sole" },
  { key: "sole_edge",     label: "Sole Edge",       type: "dropdown", section: "sole" },
  { key: "sole_treatment",label: "Sole Treatment",  type: "dropdown", section: "sole" },
  { key: "logo",          label: "Logo",            type: "dropdown", section: "sole" },
];

const HEEL_BASE: SpecComponent[] = [
  { key: "heel_name",     label: "Heel Name",       type: "text",     section: "heel" },
  { key: "heel_cover",    label: "Heel Cover",      type: "dropdown", section: "heel" },
  { key: "top_lift",      label: "Top Lift",        type: "dropdown", section: "heel" },
];

const PACKAGING: SpecComponent[] = [
  { key: "shoe_box",      label: "Shoe Box",        type: "dropdown", section: "packaging" },
  { key: "tissue",        label: "Tissue",          type: "dropdown", section: "packaging" },
  { key: "commercial_markings",          label: "Commercial Markings",          type: "text", section: "packaging" },
  { key: "commercial_markings_position", label: "Commercial Markings Position", type: "dropdown", section: "packaging" },
  { key: "barcode",       label: "Barcode",         type: "dropdown", section: "packaging" },
];

// Buckle — added dynamically when hasBuckle = true
export const BUCKLE_COMPONENT: SpecComponent = {
  key: "buckle",          label: "Buckle Colour",   type: "dropdown", section: "upper",
};

// ─── Category templates ───────────────────────────────────────────────────────

export type ShoeCategory =
  | "Dress Shoe"
  | "Ballet Flat"
  | "Loafer"
  | "Platform"
  | "Boot"
  | "Sandal"
  | "Wedge"
  | "Ankle Boot"
  | "Calf Boot";

export const SPEC_TEMPLATES: Record<ShoeCategory, SpecComponent[]> = {
  "Dress Shoe": [
    ...UPPER_BASE,
    // Sling back elastic injected dynamically when dressShoeSubType = "sling"
    ...SOCK_BASE,
    { key: "toe_puff",       label: "Toe Puff",       type: "dropdown", section: "construction" },
    { key: "insole_binding", label: "Insole Binding", type: "dropdown", section: "construction" },
    ...SOLE_BASE,
    ...HEEL_BASE,
    ...PACKAGING,
  ],

  "Ballet Flat": [
    ...UPPER_BASE,
    { key: "topline",        label: "Topline",        type: "dropdown", section: "upper" },
    { key: "bow",            label: "Bow",            type: "dropdown", section: "upper" },
    { key: "sock",           label: "Sock",           type: "dropdown", section: "construction" },
    { key: "sock_logo",      label: "Sock Logo",      type: "dropdown", section: "construction" },
    { key: "heel_counter",   label: "Heel Counter",   type: "dropdown", section: "construction" },
    { key: "insole_name",    label: "Insole Name",    type: "text",     section: "construction" },
    ...SOLE_BASE,
    { key: "top_lift",       label: "Top Lift",       type: "dropdown", section: "heel" },
    ...PACKAGING,
  ],

  "Loafer": [
    ...UPPER_BASE,
    { key: "sock",           label: "Sock",           type: "dropdown", section: "construction" },
    { key: "sock_logo",      label: "Sock Logo",      type: "dropdown", section: "construction" },
    { key: "heel_counter",   label: "Heel Counter",   type: "dropdown", section: "construction" },
    { key: "insole_name",    label: "Insole Name",    type: "text",     section: "construction" },
    ...SOLE_BASE,
    ...HEEL_BASE,
    ...PACKAGING,
  ],

  "Platform": [
    ...UPPER_BASE,
    ...SOCK_BASE,
    { key: "toe_piece",      label: "Toe Piece",      type: "dropdown", section: "construction" },
    { key: "insole_binding", label: "Insole Binding", type: "dropdown", section: "construction" },
    ...SOLE_BASE,
    ...HEEL_BASE,
    { key: "platform_name",  label: "Platform Name",  type: "text",     section: "heel" },
    { key: "platform_cover", label: "Platform Cover", type: "dropdown", section: "heel" },
    ...PACKAGING,
  ],

  "Boot": [
    ...UPPER_BASE,
    { key: "leg_height",     label: "Leg Height",     type: "text",     section: "upper" },
    { key: "zip",            label: "Zip",            type: "dropdown", section: "upper" },
    ...SOCK_BASE,
    ...SOLE_BASE,
    ...HEEL_BASE,
    ...PACKAGING,
  ],

  "Ankle Boot": [
    ...UPPER_BASE,
    { key: "leg_height",     label: "Leg Height",     type: "text",     section: "upper" },
    { key: "zip",            label: "Zip",            type: "dropdown", section: "upper" },
    ...SOCK_BASE,
    ...SOLE_BASE,
    ...HEEL_BASE,
    ...PACKAGING,
  ],

  "Calf Boot": [
    ...UPPER_BASE,
    { key: "leg_height",     label: "Leg Height",     type: "text",     section: "upper" },
    { key: "zip",            label: "Zip",            type: "dropdown", section: "upper" },
    ...SOCK_BASE,
    ...SOLE_BASE,
    ...HEEL_BASE,
    ...PACKAGING,
  ],

  "Sandal": [
    ...UPPER_BASE,
    { key: "foot_bed_cover", label: "Foot Bed Cover", type: "dropdown", section: "construction" },
    { key: "insole_name",    label: "Insole Name",    type: "text",     section: "construction" },
    ...SOLE_BASE,
    ...PACKAGING,
  ],

  "Wedge": [
    ...UPPER_BASE,
    ...SOCK_BASE,
    { key: "toe_piece",      label: "Toe Piece",      type: "dropdown", section: "construction" },
    { key: "insole_binding", label: "Insole Binding", type: "dropdown", section: "construction" },
    ...SOLE_BASE,
    { key: "wedge_name",     label: "Wedge Name",     type: "text",     section: "heel" },
    { key: "wedge_cover",    label: "Wedge Cover",    type: "dropdown", section: "heel" },
    { key: "top_lift",       label: "Top Lift",       type: "dropdown", section: "heel" },
    ...PACKAGING,
  ],
};

// Sling back elastic — injected after Upper 1 for Dress Shoe sling sub-type
export const SLING_BACK_COMPONENT: SpecComponent = {
  key: "sling_back_elastic", label: "Sling Back Elastic", type: "dropdown", section: "upper",
};

/**
 * Get the full component list for a style, injecting optional components based on meta.
 */
export function getTemplateForCategory(
  category: string,
  opts: { hasBuckle?: boolean; dressShoeSubType?: "court" | "sling" | null } = {}
): SpecComponent[] {
  const cat = category as ShoeCategory;
  const base = SPEC_TEMPLATES[cat] ?? SPEC_TEMPLATES["Dress Shoe"];
  const result = [...base];

  // Inject sling back elastic after Upper 1 for sling-back dress shoes
  if (cat === "Dress Shoe" && opts.dressShoeSubType === "sling") {
    const upperIdx = result.findIndex((c) => c.key === "upper_1");
    result.splice(upperIdx + 1, 0, SLING_BACK_COMPONENT);
  }

  // Inject buckle after Upper 1 when hasBuckle is true
  if (opts.hasBuckle) {
    const upperIdx = result.findIndex((c) => c.key === "upper_1");
    result.splice(upperIdx + 1, 0, BUCKLE_COMPONENT);
  }

  return result;
}

// ─── Default dropdown options (pre-seeded, editable in UI) ────────────────────

export const DEFAULT_DROPDOWN_OPTIONS: Record<string, string[]> = {
  upper_1: [
    "BLACK NAPPA", "PETAL NAPPA", "VANILLA NAPPA", "SKY SUEDE", "STONE SUEDE",
    "CHOCOLATE NAPPA", "BLUSH NUBUCK", "MILK CAPRETTO", "VINO NAPPA",
    "ESPRESSO ANGUILLE", "BLACK VALENCIA", "MATCHING",
  ],
  stitch: ["MATCHING", "CONTRAST", "NONE"],
  lining: [
    "MATCHING", "MATCHING SHEEP", "BLACK LEATHER", "NO LINING", "NONE",
  ],
  sock: [
    "MATCHING SHEEP", "BISCUIT", "MATCHING", "BLACK LEATHER", "NONE",
  ],
  sock_treatment: [
    "PLAIN - EMBOSS", "PLAIN - WOVEN LABEL (WHT)", "PLAIN - WOVEN LABEL (BLACK)", "N/A",
  ],
  sock_logo: ["EMBOSS", "LASER", "WOVEN LABEL"],
  heel_counter: ["NONE", "PIG LINING", "LIGHT", "STANDARD", "N/A"],
  toe_puff: ["NONE", "STANDARD", "LIGHT"],
  toe_piece: ["UPPER 1", "MATCHING", "CONTRAST"],
  insole_binding: ["UPPER 1", "MATCHING", "CONTRAST", "NONE"],
  sole_colour: [
    "BLACK POLISH", "OAK", "NATURAL", "BLACK MATTE", "BLACK RUBBER", "MATCHING",
  ],
  sole_edge: ["BLACK", "HONEY", "NATURAL", "MATCHING"],
  sole_treatment: ["TEARDROP", "STITCHED", "PLAIN", "LASER"],
  logo: ["SILVER DISC", "LASER", "EMBOSS", "NONE"],
  heel_cover: ["UPPER 1", "MATCHING", "BLACK VENEER", "CONTRAST"],
  top_lift: ["BLACK", "HONEY", "NATURAL", "MATCHING"],
  toplift: ["BLACK", "HONEY", "NATURAL", "MATCHING"],
  topline: ["MATCHING GROSGRAIN", "CONTRAST GROSGRAIN", "NONE"],
  bow: ["MATCHING LACE", "MATCHING GROSGRAIN", "CONTRAST", "NONE"],
  platform_cover: ["UPPER 1", "MATCHING", "CONTRAST"],
  wedge_cover: ["UPPER 1", "MATCHING", "CONTRAST"],
  foot_bed_cover: ["MATCHING", "SHEEP LEATHER", "CHOCOLATE (SHEEP LEATHER)", "NONE"],
  zip: ["MATCHING", "CONTRAST", "SILVER", "GOLD", "NONE"],
  buckle: ["SILVER", "GOLD", "ANTIQUE BRASS", "NONE"],
  sling_back_elastic: ["MATCHING", "CONTRAST", "CLEAR", "NONE"],
  shoe_box: ["TONY BIANCO - TURTLE DOVE", "TONY BIANCO - WHITE", "TONY BIANCO - BLACK"],
  tissue: ["TONY BIANCO", "PLAIN WHITE", "NONE"],
  commercial_markings_position: ["SOLE BOTTOM", "INSOLE", "SOCK"],
  barcode: ["YES", "NO"],
};

export const SECTION_LABELS: Record<string, string> = {
  upper: "Upper & Materials",
  construction: "Construction",
  sole: "Sole & Logo",
  heel: "Heel",
  packaging: "Packaging",
};
