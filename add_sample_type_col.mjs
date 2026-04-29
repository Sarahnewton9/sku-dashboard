import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await conn.execute("ALTER TABLE `sku_meta` ADD COLUMN IF NOT EXISTS `sampleType` varchar(64)");
  console.log("✓ sampleType column added to sku_meta");
} catch (e) {
  if (e.code === "ER_DUP_FIELDNAME") {
    console.log("Column already exists — skipping");
  } else {
    throw e;
  }
} finally {
  await conn.end();
}
