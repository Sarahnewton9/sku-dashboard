import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");

// Load the colour codes JSON exported from Python
const colourCodes = JSON.parse(readFileSync("/tmp/colour_codes.json", "utf-8"));
const entries = Object.entries(colourCodes); // [[description, code], ...]

console.log(`Seeding ${entries.length} colour codes...`);

const conn = await createConnection(DB_URL);

let inserted = 0;
let skipped = 0;

for (const [desc, code] of entries) {
  try {
    await conn.execute(
      `INSERT INTO colour_codes (colour_description, colour_code) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE colour_code = VALUES(colour_code)`,
      [desc, code]
    );
    inserted++;
  } catch (err) {
    console.error(`Error inserting ${desc}: ${err.message}`);
    skipped++;
  }
}

console.log(`Done. Inserted/updated: ${inserted}, Skipped: ${skipped}`);
await conn.end();
