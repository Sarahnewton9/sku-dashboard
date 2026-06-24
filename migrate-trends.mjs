import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

// Load env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const TREND_DATA = {
  "ARLA": ["MESH"],
  "BREEZE": ["MESH"],
  "CAPPA": ["TOE CAP", "BALLET"],
  "CAPPI": ["BALLET"],
  "CARLA": ["MESH", "BALLET"],
  "CASPIAN": ["BALLET"],
  "CELESTE": ["BALLET"],
  "CHEEKY": ["MESH", "BALLET"],
  "CHELSEA": ["BALLET"],
  "CHILLI": ["BALLET"],
  "COMMA": ["BALLET"],
  "CORFU": ["MESH", "BALLET"],
  "CRUSH": ["MESH"],
  "CUBA": ["BALLET"],
  "CURIOUS": ["BALLET"],
  "DONTE": ["TOE CAP", "MESH"],
  "EMILY": ["TOE CAP"],
  "ETRO": ["MESH"],
  "JAYDE": ["ROSETTE"],
  "KIMA": ["ROSETTE"],
  "PIXIE": ["TOE CAP"],
  "ROBYN": ["TOE CAP"],
  "ROXIE": ["TOE CAP"],
  "SARAH": ["TOE CAP"],
  "SAVANT": ["TOE CAP"],
  "STASSIE": ["ROSETTE"],
};

const conn = await createConnection(process.env.DATABASE_URL);

// 1. Add trends column if it doesn't exist
try {
  await conn.execute(`ALTER TABLE style_trend_flags ADD COLUMN trends TEXT NULL`);
  console.log("✓ Added trends column");
} catch (e) {
  if (e.message.includes("Duplicate column")) {
    console.log("✓ trends column already exists");
  } else {
    throw e;
  }
}

// 2. Upsert each style's trends
for (const [style, trends] of Object.entries(TREND_DATA)) {
  const trendsJson = JSON.stringify(trends);
  const primaryTrend = trends[0]; // use first trend as trendFlag for legacy compat
  await conn.execute(
    `INSERT INTO style_trend_flags (style, trendFlag, trends)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE trendFlag = VALUES(trendFlag), trends = VALUES(trends)`,
    [style, primaryTrend, trendsJson]
  );
  console.log(`✓ ${style}: ${trends.join(", ")}`);
}

// 3. Also update any existing rows that have trendFlag but no trends set
const [existing] = await conn.execute(`SELECT style, trendFlag, trends FROM style_trend_flags`);
for (const row of existing) {
  if (row.trends === "[]" && row.trendFlag) {
    const trendsJson = JSON.stringify([row.trendFlag]);
    await conn.execute(`UPDATE style_trend_flags SET trends = ? WHERE style = ?`, [trendsJson, row.style]);
    console.log(`  migrated legacy: ${row.style} → [${row.trendFlag}]`);
  }
}

const [final] = await conn.execute(`SELECT style, trendFlag, trends FROM style_trend_flags ORDER BY style`);
console.log("\nFinal state:");
for (const row of final) {
  console.log(`  ${row.style}: ${row.trends}`);
}

await conn.end();
console.log("\nDone!");
