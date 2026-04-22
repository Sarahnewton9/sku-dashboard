import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const balletStyles = ['BAMBI', 'BETTINA', 'BIANCA', 'BOBBI', 'BOSCO', 'BRASH', 'CAMILLE', 'CAPPA', 'CAPPI', 'CARLA', 'CASPIAN', 'CELESTE', 'CHARLI', 'CHEEKY', 'CHELSEA', 'CHILLI', 'CIRCA', 'CITY', 'CLOVER', 'COMMA', 'CUBA', 'CURIOUS', 'JAVIER', 'JESSE', 'JOOP', 'MADDI', 'MAMZELLE', 'MARTINEZ', 'MAXY', 'MAZEY', 'MOMA', 'ROBYN', 'RORY', 'ROXIE'];
const loaferStyles = ['CREW', 'ERES', 'EVIE', 'GATSBY', 'GEZZA', 'GIGI', 'GLACIER', 'GLORIA', 'GOMEZ', 'GRAND', 'LAMORE', 'LIBBY', 'LONDON', 'LUXURY', 'VIN', 'VIXEN', 'ZAC', 'ZEPHYR', 'ZOE'];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Seed trend flags and CASUAL FLAT sub-category for Ballet Flat styles
for (const style of balletStyles) {
  await conn.execute(
    `INSERT INTO style_trend_flags (style, trendFlag) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE trendFlag = VALUES(trendFlag), updatedAt = CURRENT_TIMESTAMP`,
    [style, "Ballet Flat"]
  );
  await conn.execute(
    `INSERT INTO style_sub_categories (style, subCategory) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE subCategory = VALUES(subCategory), updatedAt = CURRENT_TIMESTAMP`,
    [style, "CASUAL FLAT"]
  );
  console.log(`✓ ${style} → trend: Ballet Flat, category: CASUAL FLAT`);
}

// Seed trend flags and CASUAL FLAT sub-category for Loafer styles
for (const style of loaferStyles) {
  await conn.execute(
    `INSERT INTO style_trend_flags (style, trendFlag) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE trendFlag = VALUES(trendFlag), updatedAt = CURRENT_TIMESTAMP`,
    [style, "Loafer"]
  );
  await conn.execute(
    `INSERT INTO style_sub_categories (style, subCategory) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE subCategory = VALUES(subCategory), updatedAt = CURRENT_TIMESTAMP`,
    [style, "CASUAL FLAT"]
  );
  console.log(`✓ ${style} → trend: Loafer, category: CASUAL FLAT`);
}

await conn.end();
console.log(`Done. Seeded ${balletStyles.length} Ballet Flat + ${loaferStyles.length} Loafer styles.`);
