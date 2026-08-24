import fs from "node:fs";

const documentPath = "/home/ubuntu/upload/pasted_content_2.txt";
const skuDataPath = "/home/ubuntu/sku-dashboard/client/src/lib/skuData.ts";
const sqlOutputPath = "/tmp/markdown_document_static_matches.sql";
const customSkuApiUrl = "http://localhost:3000/api/trpc/customSku.getAll?input=%7B%22json%22%3A%7B%7D%7D";

function normalise(value) {
  return String(value ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

function escapedSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function materialAliases(value) {
  const raw = normalise(value);
  const aliases = new Set([raw, raw.split("/")[0].trim()]);
  aliases.add(raw.replace(/\bHI SHINE\b/g, "PATENT"));
  aliases.add(raw.replace(/\bCROC\b/g, "CROCO"));
  aliases.add(raw.replace(/\bCHOCOLATE\b/g, "CHOC"));
  aliases.add(raw.replace(/\bCHOC\b/g, "CHOCOLATE"));
  return [...aliases].map(normalise);
}

const documentEntries = [...new Map(
  fs.readFileSync(documentPath, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const [style, ...colourParts] = line.split("\t");
      return { style: normalise(style), colour: normalise(colourParts.join(" ")) };
    })
    .filter(({ style, colour }) => style && colour)
    .map((entry) => [`${entry.style}|${entry.colour}`, entry]),
).values()];

const source = fs.readFileSync(skuDataPath, "utf8");
const staticRows = [];
for (const match of source.matchAll(/"style":"([^"]+)","colour":"([^"]+)","leather":"([^"]*)"/g)) {
  const [style, colour, leather] = match.slice(1).map(normalise);
  staticRows.push({ style, colour, leather, label: normalise([colour, leather].filter(Boolean).join(" ")) });
}

const customSkuResponse = await fetch(customSkuApiUrl);
if (!customSkuResponse.ok) throw new Error(`Unable to load custom SKUs: ${customSkuResponse.status}`);
const customSkuPayload = await customSkuResponse.json();
const customRows = (customSkuPayload?.result?.data?.json ?? []).map((row) => {
  const style = normalise(row.style);
  const colour = normalise(row.colour);
  const leather = normalise(row.leather);
  return { style, colour, leather, label: normalise([colour, leather].filter(Boolean).join(" ")) };
});

const rowsByStyle = new Map();
for (const row of [...staticRows, ...customRows]) {
  const current = rowsByStyle.get(row.style) ?? [];
  if (!current.some((candidate) => candidate.label === row.label)) current.push(row);
  rowsByStyle.set(row.style, current);
}

const matched = [];
const unmatched = [];
for (const entry of documentEntries) {
  const candidates = rowsByStyle.get(entry.style) ?? [];
  const aliases = materialAliases(entry.colour);
  const dashboard = candidates.find((candidate) => aliases.includes(candidate.label));
  if (!dashboard) {
    unmatched.push(entry);
  } else {
    matched.push({ ...entry, dashboardColour: dashboard.label });
  }
}

const values = matched.map((entry) =>
  `(${escapedSql(entry.style)}, ${escapedSql(entry.dashboardColour)}, ${escapedSql(`${entry.style} ${entry.colour}`)}, 'pending', NOW(), NOW())`,
);
const sql = values.length === 0
  ? "-- No document entries matched the static dashboard range.\n"
  : `INSERT INTO markdown_skus (style_code, colour, product_title, status, flagged_at, updated_at)\nVALUES\n${values.join(",\n")}\nON DUPLICATE KEY UPDATE\n  product_title = VALUES(product_title),\n  status = IF(status = 'deleted', 'deleted', status),\n  flagged_at = NOW(),\n  updated_at = NOW();\n`;
fs.writeFileSync(sqlOutputPath, sql);

console.log(JSON.stringify({
  document_entries: documentEntries.length,
  dashboard_matches: matched.length,
  static_skus_considered: staticRows.length,
  custom_skus_considered: customRows.length,
  label_mismatches_resolved: matched.filter((entry) => entry.colour !== entry.dashboardColour).length,
  entries_not_in_static_dashboard_range: unmatched.length,
  sql_output_path: sqlOutputPath,
  unmatched,
}, null, 2));
