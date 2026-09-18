import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";

const season = "W27";
const input = `
COMMA\tCHOC NAPPA
COMMA\tLIPSTICK SUEDE
COMMA\tROYAL SUEDE
COMMA\tCLOUD SUEDE
COMMA\tMIDNIGHT SUEDE
COMMA\tPURPLE SUEDE
COMMA\tVINO SUEDE
COMMA\tRED SUEDE
COMMA\tGREY SUEDE
CHELSEA\tBLOSSOM NAPPA
CHELSEA\tVANILLA NAPPA
CHELSEA\tCLOUD NAPPA
CHELSEA\tMINT NAPPA
CAPPA\tBLK NAPPA A/O
CHERRY\tCLOUD SUEDE
CHERRY\tSTONE SUEDE
CHERRY\tBLOSSOM SUEDE
CHERRY\tVIPER SNAKE
CHERRY\tVINO CRINKLE
DIXON\tVIPER SNAKE
DIXON\tSERPE SNAKE
DIMA\tSTONE SUEDE/VIPER SNAKE
DIMA\tESPRESSO SUEDE/SERPE SNAKE
DIMA\tCLOUD SUEDE/CLOUD SNAKE
DIMA\tVINO SUEDE/VINO SNAKE
DELUXE\tVINO NYLON/VINO SNAKE
DELUXE\tGEM NYLON/GEM SNAKE
DELUXE\tCLOUD NYLON/CLOUD SNAKE
DIXIE\tCLOUD SUEDE
DIXIE\tBLOSSOM SUEDE
DIXIE\tRED SUEDE
DONTE\tVINO NYLON/VINO SNAKE
DONTE\tSKIN NYLON/VIPER SNAKE
DAZIE\tBLACK NAPPA
DAZIE\tDOVE NAPPA
DAZIE\tCHOC NAPPA
DAZIE\tBLOSSOM NAPPA
KASSY\tVIPER SNAKE/STONE SUEDE
KASSY\tCLOUD SNAKE/CLOUD SUEDE
KASSY\tVINO SNAKE/VINO SUEDE
ENVY\tRED SUEDE
ENVY\tPURPLE SUEDE
ENVY\tLIPSTICK SUEDE
ENVY\tROYAL SUEDE
ESQUIRE\tCLOUD SUEDE
ESQUIRE\tBLOSSOM SUEDE
ESQUIRE\tFOREST SUEDE
ESQUIRE\tGREY SUEDE
EMILY\tESPRESSO VINTAGE/ESPRESSO SUEDE
EMILY\tVANILLA VINTAGE/STONE SUEDE
EMILY\tBLACK VINTAGE/BLACK SUEDE
MADDI\tMINT NAPPA
MADDI\tBLOSSOM NAPPA
MADDI\tCLOUD NAPPA
MOMA\tGREY SUEDE
MOMA\tCLOUD SUEDE
MOMA\tESPRESSO SUEDE
MOMA\tBLOSSOM SUEDE
MOMA\tLIPSTICK SUEDE
MOMA\tROYAL SUEDE
MOMA\tMIDNIGHT SUEDE
SAMMY\tDOVE NAPPA
SAMMY\tCHOCOLATE VENICE
SAMMY\tBLACK COMO
`.trim();

function parseComponent(style, description) {
  const normalized = description.trim().replace(/^BLK\b/, "BLACK");
  const tokens = normalized.split(/\s+/);
  if (tokens.length < 2) {
    throw new Error(`Cannot split colour and leather for ${style}: ${description}`);
  }
  const [colour, ...leather] = tokens;
  if (leather.join(" ") === "NAPPA A O") {
    return { colour, leather: "NAPPA" };
  }
  return { colour, leather: leather.join(" ") };
}

function parseSku(style, description) {
  const normalizedDescription = description.trim().replace(/\s+A\/O$/i, "");
  const [primaryDescription, secondaryDescription] = normalizedDescription.split("/").map((part) => part.trim());
  const primary = parseComponent(style, primaryDescription);
  const secondary = secondaryDescription ? parseComponent(style, secondaryDescription) : null;
  return {
    style: style.trim().toUpperCase(),
    colour: primary.colour,
    leather: primary.leather,
    colour2: secondary?.colour ?? null,
    leather2: secondary?.leather ?? null,
    originalDescription: description,
  };
}

const requested = input.split("\n").map((line) => {
  const [style, description] = line.split("\t");
  return parseSku(style, description);
});

const staticSource = await readFile(new URL("../client/src/lib/skuData.ts", import.meta.url), "utf8");
const staticSkus = new Set();
for (const match of staticSource.matchAll(/\{"style":"([^"]+)","colour":"([^"]*)","leather":"([^"]*)"[^}]*\}/g)) {
  staticSkus.add(`${match[1].toUpperCase()}|${match[2].toUpperCase()}|${match[3].toUpperCase()}`);
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [customSkus] = await connection.execute(
    "SELECT style, colour, leather, colour2, leather2 FROM custom_skus WHERE season = ?",
    [season],
  );
  const [cancelledSkus] = await connection.execute(
    "SELECT style, colour, leather FROM cancelled_skus WHERE season = ?",
    [season],
  );
  const [cancelledStyles] = await connection.execute(
    "SELECT style FROM cancelled_styles WHERE season = ?",
    [season],
  );

  const customSkuSet = new Set(customSkus.map((row) => `${row.style.toUpperCase()}|${row.colour.toUpperCase()}|${row.leather.toUpperCase()}|${(row.colour2 ?? "").toUpperCase()}|${(row.leather2 ?? "").toUpperCase()}`));
  const cancelledSkuSet = new Set(cancelledSkus.map((row) => `${row.style.toUpperCase()}|${row.colour.toUpperCase()}|${row.leather.toUpperCase()}`));
  const cancelledStyleSet = new Set(cancelledStyles.map((row) => row.style.toUpperCase()));

  const plan = requested.map((sku) => {
    const key = `${sku.style}|${sku.colour}|${sku.leather}`;
    const fullKey = `${key}|${sku.colour2 ?? ""}|${sku.leather2 ?? ""}`;
    const status = cancelledStyleSet.has(sku.style)
      ? "SKIP_CANCELLED_STYLE"
      : cancelledSkuSet.has(key)
        ? "SKIP_CANCELLED_SKU"
        : staticSkus.has(key) && !sku.colour2
          ? "SKIP_ALREADY_STATIC"
          : customSkuSet.has(fullKey)
            ? "SKIP_ALREADY_CUSTOM"
            : "ADD";
    return { ...sku, status };
  });

  const summary = plan.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {});

  if (process.argv.includes("--apply")) {
    const addRows = plan.filter((row) => row.status === "ADD");
    await connection.beginTransaction();
    try {
      for (const row of addRows) {
        await connection.execute(
          "INSERT INTO custom_skus (style, colour, leather, colour2, leather2, season, is_new) VALUES (?, ?, ?, ?, ?, ?, TRUE)",
          [row.style, row.colour, row.leather, row.colour2, row.leather2, season],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  console.log(JSON.stringify({
    season,
    mode: process.argv.includes("--apply") ? "apply" : "dry-run",
    requestedCount: requested.length,
    summary,
    plan,
  }, null, 2));
} finally {
  await connection.end();
}
