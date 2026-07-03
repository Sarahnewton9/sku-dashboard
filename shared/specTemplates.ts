/**
 * Spec templates — defines the ordered list of component rows for each shoe category.
 * Each component has a key (used as DB identifier), a label (displayed in the form),
 * and a field type (dropdown | text | boolean).
 *
 * Universal components appear in all templates.
 * Category-specific components are added per template.
 * Buckle is handled separately via the hasBuckle toggle on styleSpecMeta.
 *
 * Per-style overrides are defined in STYLE_COMPONENT_OVERRIDES below.
 * These add or remove specific components for named styles without changing the category template.
 */

export type FieldType = "dropdown" | "text";

export interface SpecComponent {
  key: string;           // DB key — stable identifier, never change
  label: string;         // Display label
  type: FieldType;
  section: "upper" | "construction" | "sole" | "heel" | "packaging" | "components";
}

// ─── Universal components (shared across all categories) ─────────────────────

const UPPER_BASE: SpecComponent[] = [
  { key: "upper_1",       label: "Upper 1",        type: "dropdown", section: "components" },
  { key: "stitch",        label: "Stitch",          type: "dropdown", section: "components" },
  { key: "lining",        label: "Lining",          type: "dropdown", section: "components" },
];

const SOCK_BASE: SpecComponent[] = [
  { key: "sock",          label: "Sock",            type: "dropdown", section: "components" },
  { key: "sock_treatment",label: "Sock Treatment",  type: "dropdown", section: "components" },
  { key: "heel_counter",  label: "Heel Counter",    type: "dropdown", section: "components" },
  { key: "insole_name",   label: "Insole Name",     type: "text",     section: "components" },
];

const SOLE_BASE: SpecComponent[] = [
  { key: "sole_name",     label: "Sole Name",       type: "text",     section: "components" },
  { key: "sole_colour",   label: "Sole Colour",     type: "dropdown", section: "components" },
  { key: "sole_edge",     label: "Sole Edge",       type: "dropdown", section: "components" },
  { key: "sole_treatment",label: "Sole Treatment",  type: "dropdown", section: "components" },
  { key: "logo",          label: "Logo",            type: "dropdown", section: "components" },
];

const HEEL_BASE: SpecComponent[] = [
  { key: "heel_name",     label: "Heel Name",       type: "text",     section: "components" },
  { key: "heel_cover",    label: "Heel Cover",      type: "dropdown", section: "components" },
  { key: "top_lift",      label: "Top Lift",        type: "dropdown", section: "components" },
];

const PACKAGING: SpecComponent[] = [
  { key: "shoe_box",      label: "Shoe Box",        type: "dropdown", section: "packaging" },
  { key: "tissue",        label: "Tissue",          type: "dropdown", section: "packaging" },
  { key: "commercial_markings",          label: "Commercial Markings",          type: "text", section: "packaging" },
  { key: "commercial_markings_position", label: "Commercial Markings Position", type: "dropdown", section: "packaging" },
  { key: "barcode",       label: "Barcode",         type: "dropdown", section: "packaging" },
];

// Buckle — always present in Components (not toggled)
export const BUCKLE_COMPONENT: SpecComponent = {
  key: "buckle",          label: "Buckle",          type: "dropdown", section: "components",
};

// ─── Category templates ───────────────────────────────────────────────────────

export type ShoeCategory =
  | "Dress Shoe"
  | "Ballet Flat"
  | "Loafer"
  | "Platform"
  | "Boot"
  | "Sandal"
  | "Dress Sandal"
  | "Wedge"
  | "Ankle Boot"
  | "Calf Boot"
  | "Casual Flat";

export const SPEC_TEMPLATES: Record<ShoeCategory, SpecComponent[]> = {
  "Dress Shoe": [
    ...UPPER_BASE,
    // Sling back elastic injected dynamically when dressShoeSubType = "sling"
    ...SOCK_BASE,
    { key: "toe_puff",       label: "Toe Puff",       type: "dropdown", section: "construction" },
    { key: "toe_piece",      label: "Toe Piece",      type: "dropdown", section: "construction" },
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
    { key: "heel_counter",   label: "Heel Counter",   type: "dropdown", section: "construction" },
    { key: "insole_name",    label: "Insole Name",    type: "text",     section: "construction" },
    { key: "toe_piece",      label: "Toe Piece",      type: "dropdown", section: "construction" },
    ...SOLE_BASE,
    { key: "top_lift",       label: "Top Lift",       type: "dropdown", section: "heel" },
    ...PACKAGING,
  ],

  "Loafer": [
    ...UPPER_BASE,
    { key: "sock",           label: "Sock",           type: "dropdown", section: "construction" },
    { key: "heel_counter",   label: "Heel Counter",   type: "dropdown", section: "construction" },
    { key: "insole_name",    label: "Insole Name",    type: "text",     section: "construction" },
    { key: "toe_piece",      label: "Toe Piece",      type: "dropdown", section: "construction" },
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
    { key: "toe_piece",      label: "Toe Piece",      type: "dropdown", section: "construction" },
    ...SOLE_BASE,
    ...HEEL_BASE,
    ...PACKAGING,
  ],

  "Ankle Boot": [
    ...UPPER_BASE,
    { key: "leg_height",     label: "Leg Height",     type: "text",     section: "upper" },
    { key: "zip",            label: "Zip",            type: "dropdown", section: "upper" },
    ...SOCK_BASE,
    { key: "toe_piece",      label: "Toe Piece",      type: "dropdown", section: "construction" },
    ...SOLE_BASE,
    ...HEEL_BASE,
    ...PACKAGING,
  ],

  "Calf Boot": [
    ...UPPER_BASE,
    { key: "leg_height",     label: "Leg Height",     type: "text",     section: "upper" },
    { key: "zip",            label: "Zip",            type: "dropdown", section: "upper" },
    ...SOCK_BASE,
    { key: "toe_piece",      label: "Toe Piece",      type: "dropdown", section: "construction" },
    ...SOLE_BASE,
    ...HEEL_BASE,
    ...PACKAGING,
  ],

  "Sandal": [
    ...UPPER_BASE,
    { key: "foot_bed_cover", label: "Foot Bed Cover", type: "dropdown", section: "construction" },
    { key: "insole_name",    label: "Insole Name",    type: "text",     section: "construction" },
    { key: "toe_piece",      label: "Toe Piece",      type: "dropdown", section: "construction" },
    ...SOLE_BASE,
    ...PACKAGING,
  ],

  "Dress Sandal": [
    ...UPPER_BASE,
    { key: "foot_bed_cover", label: "Foot Bed Cover", type: "dropdown", section: "construction" },
    { key: "insole_name",    label: "Insole Name",    type: "text",     section: "construction" },
    { key: "toe_piece",      label: "Toe Piece",      type: "dropdown", section: "construction" },
    ...SOLE_BASE,
    ...HEEL_BASE,
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

  "Casual Flat": [
    ...UPPER_BASE,
    { key: "topline",        label: "Topline",        type: "dropdown", section: "upper" },
    { key: "sock",           label: "Sock",           type: "dropdown", section: "construction" },
    { key: "heel_counter",   label: "Heel Counter",   type: "dropdown", section: "construction" },
    { key: "insole_name",    label: "Insole Name",    type: "text",     section: "construction" },
    { key: "toe_piece",      label: "Toe Piece",      type: "dropdown", section: "construction" },
    ...SOLE_BASE,
    { key: "top_lift",       label: "Top Lift",       type: "dropdown", section: "heel" },
    ...PACKAGING,
  ],
};

// Sling back elastic — injected after Upper 1 for Dress Shoe sling sub-type
export const SLING_BACK_COMPONENT: SpecComponent = {
  key: "sling_back_elastic", label: "Sling Back Elastic", type: "dropdown", section: "upper",
};

// ─── Per-style component overrides ───────────────────────────────────────────
// Each entry specifies components to ADD and/or keys to REMOVE for a specific style.
// ADD components are appended after the last component in the matching section.
// REMOVE keys are filtered out of the final list.

interface StyleOverride {
  add?: SpecComponent[];
  remove?: string[];  // keys to remove
}

export const STYLE_COMPONENT_OVERRIDES: Record<string, StyleOverride> = {
  // DONTE – Add Binding, Toe Cap and Elastic
  "DONTE": {
    add: [
      { key: "donte_binding",   label: "Binding",        type: "dropdown", section: "components" },
      { key: "donte_toe_cap",   label: "Toe Cap",        type: "dropdown", section: "components" },
      { key: "donte_elastic",   label: "Elastic",        type: "dropdown", section: "components" },
    ],
  },

  // EMILY – Add Toe Cap
  "EMILY": {
    add: [
      { key: "emily_toe_cap",   label: "Toe Cap",        type: "dropdown", section: "components" },
    ],
  },

  // JANET – Remove Insole Name and Sole Edge
  "JANET": {
    remove: ["insole_name", "sole_edge"],
  },

  // KAILA – Add Inking, Platform Cover, Insole Cover. Remove Foot Bed Cover.
  "KAILA": {
    add: [
      { key: "kaila_inking",         label: "Inking",         type: "dropdown", section: "components" },
      { key: "kaila_platform_cover", label: "Platform Cover", type: "dropdown", section: "components" },
      { key: "kaila_insole_cover",   label: "Insole Cover",   type: "dropdown", section: "components" },
    ],
    remove: ["foot_bed_cover"],
  },

  // LEGACY – Add Toe Cap
  "LEGACY": {
    add: [
      { key: "legacy_toe_cap",  label: "Toe Cap",        type: "dropdown", section: "components" },
    ],
  },

  // LUNA – Remove Sole Edge, Sole Treatment, Insole Name
  "LUNA": {
    remove: ["sole_edge", "sole_treatment", "insole_name"],
  },

  // LAVA – Remove Sole Edge, Sole Treatment, Insole Name
  "LAVA": {
    remove: ["sole_edge", "sole_treatment", "insole_name"],
  },

  // MIXA – Add Elastic and Vamp
  "MIXA": {
    add: [
      { key: "mixa_elastic",    label: "Elastic",        type: "dropdown", section: "components" },
      { key: "mixa_vamp",       label: "Vamp",           type: "dropdown", section: "components" },
    ],
  },

  // PIXIE – Add Elastic and Toe Cap
  "PIXIE": {
    add: [
      { key: "pixie_elastic",   label: "Elastic",        type: "dropdown", section: "components" },
      { key: "pixie_toe_cap",   label: "Toe Cap",        type: "dropdown", section: "components" },
    ],
  },

  // RORY – Add Grosgrain Binding, Toe Embroidery
  "RORY": {
    add: [
      { key: "rory_grosgrain_binding", label: "Grosgrain Binding", type: "dropdown", section: "components" },
      { key: "rory_toe_embroidery",    label: "Toe Embroidery",    type: "dropdown", section: "components" },
    ],
  },

  // ROXIE – Add Leather Bow, Grosgrain Topline and Toe Cap
  "ROXIE": {
    add: [
      { key: "roxie_leather_bow",      label: "Leather Bow",       type: "dropdown", section: "components" },
      { key: "roxie_grosgrain_topline",label: "Grosgrain Topline", type: "dropdown", section: "components" },
      { key: "roxie_toe_cap",          label: "Toe Cap",           type: "dropdown", section: "components" },
    ],
  },

  // ROBYN – Add Leather Bow, Grosgrain Topline and Toe Cap
  "ROBYN": {
    add: [
      { key: "robyn_leather_bow",      label: "Leather Bow",       type: "dropdown", section: "components" },
      { key: "robyn_grosgrain_topline",label: "Grosgrain Topline", type: "dropdown", section: "components" },
      { key: "robyn_toe_cap",          label: "Toe Cap",           type: "dropdown", section: "components" },
    ],
  },

  // SARAH – Add Piping and Toe Cap
  "SARAH": {
    add: [
      { key: "sarah_piping",    label: "Piping",         type: "dropdown", section: "components" },
      { key: "sarah_toe_cap",   label: "Toe Cap",        type: "dropdown", section: "components" },
    ],
  },

  // SAVANT – Add Binding and Toe Cap
  "SAVANT": {
    add: [
      { key: "savant_binding",  label: "Binding",        type: "dropdown", section: "components" },
      { key: "savant_toe_cap",  label: "Toe Cap",        type: "dropdown", section: "components" },
    ],
  },

  // VOLLI – Remove Toe Piece & Insole Binding
  "VOLLI": {
    remove: ["toe_piece", "insole_binding"],
  },

  // VILLA – Remove Toe Piece & Insole Binding
  "VILLA": {
    remove: ["toe_piece", "insole_binding"],
  },

  // CAPPA – Add Toe Cap
  "CAPPA": {
    add: [
      { key: "cappa_toe_cap",   label: "Toe Cap",        type: "dropdown", section: "components" },
    ],
  },
};

// Note: SAMMY – "Picking up Black Capri instead of Black Venice" is a data issue
// (the colour/leather dropdown value), not a component structure issue.
// TILDA – "Black Speckle missing" is a SKU data issue, not a component issue.
// These are tracked separately.

/**
 * Get the full component list for a style, injecting optional components based on meta
 * and applying any per-style overrides.
 */
export function getTemplateForCategory(
  category: string,
  opts: {
    hasBuckle?: boolean;
    dressShoeSubType?: "court" | "sling" | null;
    style?: string;
  } = {}
): SpecComponent[] {
  const cat = category as ShoeCategory;
  const base = SPEC_TEMPLATES[cat] ?? SPEC_TEMPLATES["Dress Shoe"];
  let result = [...base];

  // Inject sling back elastic after Upper 1 for sling-back dress shoes
  if (cat === "Dress Shoe" && opts.dressShoeSubType === "sling") {
    const upperIdx = result.findIndex((c) => c.key === "upper_1");
    result.splice(upperIdx + 1, 0, SLING_BACK_COMPONENT);
  }

  // Always inject buckle into components (after lining, before sock)
  if (opts.hasBuckle) {
    // Insert after lining if present, otherwise after upper_1
    const liningIdx = result.findIndex((c) => c.key === "lining");
    const upper1Idx = result.findIndex((c) => c.key === "upper_1");
    const insertAfter = liningIdx !== -1 ? liningIdx : upper1Idx;
    if (insertAfter !== -1) result.splice(insertAfter + 1, 0, BUCKLE_COMPONENT);
    else result.splice(0, 0, BUCKLE_COMPONENT);
  }

  // Apply per-style overrides
  if (opts.style) {
    const override = STYLE_COMPONENT_OVERRIDES[opts.style.toUpperCase()];
    if (override) {
      // Remove specified keys
      if (override.remove && override.remove.length > 0) {
        const removeSet = new Set(override.remove);
        result = result.filter((c) => !removeSet.has(c.key));
      }
      // Add new components before packaging section
      if (override.add && override.add.length > 0) {
        for (const comp of override.add) {
          // Insert before packaging
          const pkgIdx = result.findIndex((c) => c.section === "packaging");
          const insertIdx = pkgIdx === -1 ? result.length : pkgIdx;
          result.splice(insertIdx, 0, comp);
        }
      }
    }
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
  // New component dropdowns
  donte_binding: ["MATCHING", "CONTRAST", "NONE"],
  donte_toe_cap: ["MATCHING", "CONTRAST", "NONE"],
  donte_elastic: ["MATCHING", "CONTRAST", "CLEAR", "NONE"],
  emily_toe_cap: ["MATCHING", "CONTRAST", "NONE"],
  kaila_inking: ["STANDARD", "NONE"],
  kaila_sock_logo: ["EMBOSS", "LASER", "WOVEN LABEL"],
  kaila_platform_cover: ["UPPER 1", "MATCHING", "CONTRAST"],
  kaila_insole_cover: ["MATCHING", "SHEEP LEATHER", "NONE"],
  legacy_toe_cap: ["MATCHING", "CONTRAST", "NONE"],
  mixa_elastic: ["MATCHING", "CONTRAST", "CLEAR", "NONE"],
  mixa_vamp: ["UPPER 1", "MATCHING", "CONTRAST"],
  pixie_elastic: ["MATCHING", "CONTRAST", "CLEAR", "NONE"],
  pixie_toe_cap: ["MATCHING", "CONTRAST", "NONE"],
  rory_grosgrain_binding: ["MATCHING", "CONTRAST", "NONE"],
  rory_toe_embroidery: ["MATCHING", "CONTRAST", "NONE"],
  roxie_leather_bow: ["MATCHING", "CONTRAST", "NONE"],
  roxie_grosgrain_topline: ["MATCHING GROSGRAIN", "CONTRAST GROSGRAIN", "NONE"],
  roxie_toe_cap: ["MATCHING", "CONTRAST", "NONE"],
  robyn_leather_bow: ["MATCHING", "CONTRAST", "NONE"],
  robyn_grosgrain_topline: ["MATCHING GROSGRAIN", "CONTRAST GROSGRAIN", "NONE"],
  robyn_toe_cap: ["MATCHING", "CONTRAST", "NONE"],
  sarah_piping: ["MATCHING", "CONTRAST", "NONE"],
  sarah_toe_cap: ["MATCHING", "CONTRAST", "NONE"],
  savant_binding: ["MATCHING", "CONTRAST", "NONE"],
  savant_toe_cap: ["MATCHING", "CONTRAST", "NONE"],
  cappa_toe_cap: ["MATCHING", "CONTRAST", "NONE"],
};

export const SECTION_LABELS: Record<string, string> = {
  components: "Components",
  upper: "Components",        // legacy — maps to Components
  construction: "Components", // legacy — maps to Components
  sole: "Components",         // legacy — maps to Components
  heel: "Components",         // legacy — maps to Components
  packaging: "Packaging",
};

/**
 * Flat map of component labels (uppercase) → internal key.
 * Built from all templates + common factory aliases.
 * Used by the spec sheet importer to match factory labels to internal keys.
 */
export const COMPONENT_LABEL_TO_KEY: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  // Core components from all base arrays
  const allComps = [
    ...UPPER_BASE, ...SOCK_BASE, ...SOLE_BASE, ...HEEL_BASE, ...PACKAGING,
    BUCKLE_COMPONENT, SLING_BACK_COMPONENT,
  ];
  for (const comp of allComps) {
    map[comp.label.toUpperCase()] = comp.key;
  }
  // All template-specific components
  for (const comps of Object.values(SPEC_TEMPLATES)) {
    for (const comp of comps) {
      map[comp.label.toUpperCase()] = comp.key;
    }
  }
  // All style override components
  for (const override of Object.values(STYLE_COMPONENT_OVERRIDES)) {
    if (override.add) {
      for (const comp of override.add) {
        map[comp.label.toUpperCase()] = comp.key;
      }
    }
  }
  // Factory spec sheet label aliases
  map["UPPER 1"] = "upper_1";
  map["GROSGRAIN TOPLINE"] = "topline";
  map["ELASTIC BOW"] = "bow";
  map["HEEL COUNTER"] = "heel_counter";
  map["SOCK TREATMENT"] = "sock_treatment";
  map["INSOLE BINDING"] = "insole_binding";
  map["INSOLE NAME"] = "insole_name";
  map["SOLE NAME"] = "sole_name";
  map["SOLE COLOUR"] = "sole_colour";
  map["SOLE EDGE"] = "sole_edge";
  map["SOLE TREATMENT"] = "sole_treatment";
  map["HEEL NAME"] = "heel_name";
  map["HEEL COVER"] = "heel_cover";
  map["TOP LIFT"] = "top_lift";
  map["TOE PUFF"] = "toe_puff";
  map["TOE PIECE"] = "toe_piece";
  map["SHOE BOX"] = "shoe_box";
  map["COMMERCIAL MARKINGS"] = "commercial_markings";
  map["COMMERCIAL MARKINGS POSITION"] = "commercial_markings_position";
  map["FOOT BED COVER"] = "foot_bed_cover";
  map["PLATFORM NAME"] = "platform_name";
  map["PLATFORM COVER"] = "platform_cover";
  map["WEDGE NAME"] = "wedge_name";
  map["WEDGE COVER"] = "wedge_cover";
  map["LEG HEIGHT"] = "leg_height";
  map["SOCK LOGO"] = "sock_logo";
  map["SLING BACK ELASTIC"] = "sling_back_elastic";
  map["TOE CAP"] = "toe_cap";
  map["BINDING"] = "binding";
  map["ELASTIC"] = "elastic";
  map["VAMP"] = "vamp";
  map["PIPING"] = "piping";
  map["LEATHER BOW"] = "leather_bow";
  map["GROSGRAIN BINDING"] = "grosgrain_binding";
  map["TOE EMBROIDERY"] = "toe_embroidery";
  map["INKING"] = "inking";
  map["INSOLE COVER"] = "insole_cover";
  return map;
})();
