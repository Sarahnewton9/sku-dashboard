import mysql from "mysql2/promise";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load env from project
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dotenv = await import("dotenv");
dotenv.default.config({ path: join(__dirname, ".env") });

const assignments = [
  // Wedges
  ["AVANTI", "CASUAL WEDGE"],
  ["EDGY", "CASUAL WEDGE"],
  ["ELIZA", "CASUAL WEDGE"],
  ["EMBER", "CASUAL WEDGE"],
  ["HARLEY", "CASUAL WEDGE"],
  ["HILTON", "CASUAL WEDGE"],
  ["MATISSE", "CASUAL WEDGE"],
  ["MILAN", "CASUAL WEDGE"],
  ["MINTY", "CASUAL WEDGE"],
  ["MISTY", "CASUAL WEDGE"],
  ["SALLY", "CASUAL WEDGE"],
  ["SAMSON", "CASUAL WEDGE"],
  ["SWIFT", "CASUAL WEDGE"],
  ["VALERIE", "CASUAL WEDGE"],
  ["VAMORE", "CASUAL WEDGE"],
  ["VILLA", "CASUAL WEDGE"],
  ["VOGUE", "CASUAL WEDGE"],
  ["VOLLI", "CASUAL WEDGE"],
  // Ankle Boots
  ["FAVE", "DRESS ANKLE BOOT"],
  ["FAYE", "DRESS ANKLE BOOT"],
  ["FIDDY", "DRESS ANKLE BOOT"],
  // Calf Boots
  ["FINESSE", "DRESS CALF BOOT"],
  ["NAXOS", "DRESS CALF BOOT"],
  ["PORSHA", "DRESS CALF BOOT"],
  ["SHAQ", "DRESS CALF BOOT"],
  ["SHEBA", "DRESS CALF BOOT"],
];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

for (const [style, subCategory] of assignments) {
  await conn.execute(
    `INSERT INTO style_sub_categories (style, subCategory) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE subCategory = VALUES(subCategory), updatedAt = CURRENT_TIMESTAMP`,
    [style, subCategory]
  );
  console.log(`✓ ${style} → ${subCategory}`);
}

await conn.end();
console.log("Done seeding sub-categories.");
