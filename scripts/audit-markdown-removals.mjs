import fs from "node:fs";

const requested = JSON.parse(fs.readFileSync(new URL("./markdown-sku-removal.json", import.meta.url), "utf8"));
const skuDataSource = fs.readFileSync(new URL("../client/src/lib/skuData.ts", import.meta.url), "utf8");
const rawSkusMatch = skuDataSource.match(/"rawSkus":(\[.*?\]),"totalSKUs"/s);

if (!rawSkusMatch) throw new Error("Unable to find rawSkus in skuData.ts");
const rawSkus = JSON.parse(rawSkusMatch[1]);
const staticKeys = new Set(rawSkus.map((sku) => `${sku.style}|${[sku.colour, sku.leather].filter(Boolean).join(" ").toUpperCase()}`));
const matched = [];
const unmatched = [];

for (const [style, colourLeather] of requested) {
  const key = `${style}|${colourLeather}`;
  (staticKeys.has(key) ? matched : unmatched).push(key);
}

const unmatchedCandidates = Object.fromEntries(unmatched.map((key) => {
  const [style] = key.split("|");
  const candidates = rawSkus
    .filter((sku) => sku.style === style)
    .map((sku) => `${sku.style}|${[sku.colour, sku.leather].filter(Boolean).join(" ").toUpperCase()}`);
  return [key, candidates];
}));

const esc = (value) => value.replaceAll("'", "''");
const sqlValues = requested.map(([style, colour]) => `('${esc(style)}', '${esc(colour)}', 'User-provided markdown list', 'manual://markdown-removal', 'deleted')`).join(",\n");
const sql = `INSERT INTO markdown_skus (style_code, colour, product_title, source_url, status)\nVALUES\n${sqlValues}\nON DUPLICATE KEY UPDATE\n  product_title = VALUES(product_title),\n  source_url = VALUES(source_url),\n  status = 'deleted',\n  updated_at = CURRENT_TIMESTAMP;`;

fs.writeFileSync(new URL("./markdown-sku-removal.sql", import.meta.url), sql);
fs.writeFileSync(new URL("./markdown-sku-removal-audit.json", import.meta.url), JSON.stringify({
  requestedCount: requested.length,
  matchedStaticCount: matched.length,
  unmatchedStaticCount: unmatched.length,
  matched,
  unmatched,
  unmatchedCandidates,
}, null, 2));

console.log(JSON.stringify({ requested: requested.length, staticMatches: matched.length, staticUnmatched: unmatched.length, unmatchedCandidates }, null, 2));
