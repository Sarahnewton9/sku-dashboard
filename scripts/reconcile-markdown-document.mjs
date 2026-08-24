import fs from "node:fs";
import mysql from "mysql2/promise";

const documentPath = "/home/ubuntu/upload/pasted_content_2.txt";
const skuDataPath = "/home/ubuntu/sku-dashboard/client/src/lib/skuData.ts";
const apply = process.argv.includes("--apply");

function normalise(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function primaryMaterial(value) {
  return normalise(value).split("/")[0].trim();
}

// These reflect naming differences seen between the website/doc and the
// dashboard data. Exact dashboard matches are always preferred first.
function materialAliases(value) {
  const raw = normalise(value);
  const aliases = new Set([raw, primaryMaterial(raw)]);
  aliases.add(raw.replace(/\bHI SHINE\b/g, "PATENT"));
  aliases.add(raw.replace(/\bCROC\b/g, "CROCO"));
  aliases.add(raw.replace(/\bCHOCOLATE\b/g, "CHOC"));
  aliases.add(raw.replace(/\bCHOC\b/g, "CHOCOLATE"));
  return [...aliases].map(normalise);
}

function parseDocument() {
  const entries = [];
  for (const line of fs.readFileSync(documentPath, "utf8").split(/\r?\n/)) {
    const [style, ...colourParts] = line.split("\t");
    const colour = colourParts.join(" ").trim();
    if (!style?.trim() || !colour) continue;
    entries.push({ style: normalise(style), colour: normalise(colour) });
  }
  return [...new Map(entries.map((entry) => [`${entry.style}|${entry.colour}`, entry])).values()];
}

function parseStaticSkus() {
  const source = fs.readFileSync(skuDataPath, "utf8");
  const rows = [];
  const pattern = /"style":"([^"]+)","colour":"([^"]+)","leather":"([^"]*)"/g;
  for (const match of source.matchAll(pattern)) {
    rows.push({ style: normalise(match[1]), colour: normalise(match[2]), leather: normalise(match[3]) });
  }
  return rows;
}

function dashboardLabel(row) {
  return normalise([row.colour, row.leather].filter(Boolean).join(" "));
}

const documentEntries = parseDocument();
const staticSkus = parseStaticSkus();
const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const [customSkus] = await connection.query("SELECT style, colour, leather FROM custom_skus");
  const [markdownRows] = await connection.query(
    "SELECT style_code, colour, status FROM markdown_skus",
  );

  const dashboardRows = [
    ...staticSkus,
    ...customSkus.map((row) => ({
      style: normalise(row.style),
      colour: normalise(row.colour),
      leather: normalise(row.leather),
    })),
  ];
  const dashboardByStyle = new Map();
  for (const row of dashboardRows) {
    const styleRows = dashboardByStyle.get(row.style) ?? [];
    const label = dashboardLabel(row);
    if (!styleRows.some((candidate) => dashboardLabel(candidate) === label)) styleRows.push(row);
    dashboardByStyle.set(row.style, styleRows);
  }

  const markdownByKey = new Map(
    markdownRows.map((row) => [`${normalise(row.style_code)}|${normalise(row.colour)}`, row]),
  );

  const resolved = [];
  const unmatched = [];
  for (const entry of documentEntries) {
    const candidates = dashboardByStyle.get(entry.style) ?? [];
    const aliases = materialAliases(entry.colour);
    const matched = candidates.find((candidate) => aliases.includes(dashboardLabel(candidate)));
    if (!matched) {
      unmatched.push(entry);
      continue;
    }
    const dashboardColour = dashboardLabel(matched);
    const markdownKey = `${entry.style}|${dashboardColour}`;
    resolved.push({
      ...entry,
      dashboardColour,
      existing: markdownByKey.get(markdownKey) ?? null,
      sourceAlreadyRecorded: markdownByKey.get(`${entry.style}|${entry.colour}`) ?? null,
    });
  }

  const toQueue = resolved.filter((entry) => !entry.existing);
  if (apply && toQueue.length > 0) {
    for (const entry of toQueue) {
      await connection.execute(
        `INSERT INTO markdown_skus (style_code, colour, product_title, status, flagged_at, updated_at)
         VALUES (?, ?, ?, 'pending', NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           product_title = VALUES(product_title),
           status = IF(status = 'deleted', 'deleted', status),
           flagged_at = NOW(),
           updated_at = NOW()`,
        [entry.style, entry.dashboardColour, `${entry.style} ${entry.colour}`],
      );
    }
  }

  const summary = {
    document_entries: documentEntries.length,
    dashboard_matches: resolved.length,
    already_recorded_with_exact_dashboard_name: resolved.filter((entry) => entry.existing).length,
    missing_dashboard_matches_queued: apply ? toQueue.length : 0,
    missing_dashboard_matches: toQueue.length,
    document_entries_not_in_dashboard: unmatched.length,
    label_mismatches_resolved: resolved.filter((entry) => entry.dashboardColour !== entry.colour).length,
  };
  console.log(JSON.stringify({ summary, queued: toQueue, unmatched }, null, 2));
} finally {
  await connection.end();
}
