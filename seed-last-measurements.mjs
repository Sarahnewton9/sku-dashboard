import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const SIZES = ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "11"];

// Data from the image (LENGTH measurements in mm)
const LENGTH_DATA = {
  BAMBI:    [238, 242, 246, 250, 254, 258, 262, 266, 270, 274, 278, 282],
  CHEEKY:   [234, 238, 242, 246, 250, 254, 258, 262, 266, 270, 274, 278],
  CELESTE:  [234, 238, 242, 246, 250, 254, 258, 262, 266, 270, 274, 278],
  GATSBY:   [236, 240, 244, 248, 252, 256, 260, 264, 268, 272, 276, 280],
  LUXURY:   [232, 236, 240, 244, 248, 252, 256, 260, 264, 268, 272, 276],
  MARTINEZ: [238, 242, 246, 250, 254, 258, 262, 266, 270, 274, 278, 282],
  ROXIE:    [230, 234, 238, 242, 246, 250, 254, 258, 262, 266, 270, 274],
};

// Data from the image (GIRTH measurements in mm)
const GIRTH_DATA = {
  BAMBI:    [207, 210, 213, 216, 219, 222, 225, 228, 231, 234, 237, 240],
  CHEEKY:   [200, 203, 206, 209, 212, 215, 218, 221, 224, 227, 230, 233],
  CELESTE:  [196, 199, 202, 205, 208, 211, 214, 217, 220, 223, 226, 229],
  GATSBY:   [207, 210, 213, 216, 219, 222, 225, 228, 231, 234, 237, 240],
  LUXURY:   [207, 210, 213, 216, 219, 222, 225, 228, 231, 234, 237, 240],
  MARTINEZ: [206, 209, 212, 215, 218, 221, 224, 227, 230, 233, 236, 239],
  ROXIE:    [193, 196, 199, 202, 205, 208, 211, 214, 217, 220, 223, 226],
};

const conn = await createConnection(process.env.DATABASE_URL);

let inserted = 0;
for (const [lastName, values] of Object.entries(LENGTH_DATA)) {
  for (let i = 0; i < SIZES.length; i++) {
    await conn.execute(
      `INSERT INTO last_measurements (last_name, measure_type, size, value)
       VALUES (?, 'LENGTH', ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [lastName, SIZES[i], values[i]]
    );
    inserted++;
  }
}

for (const [lastName, values] of Object.entries(GIRTH_DATA)) {
  for (let i = 0; i < SIZES.length; i++) {
    await conn.execute(
      `INSERT INTO last_measurements (last_name, measure_type, size, value)
       VALUES (?, 'GIRTH', ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [lastName, SIZES[i], values[i]]
    );
    inserted++;
  }
}

console.log(`✓ Inserted/updated ${inserted} measurement rows`);

const [rows] = await conn.execute(`SELECT COUNT(*) as cnt FROM last_measurements`);
console.log(`Total rows in DB: ${rows[0].cnt}`);

await conn.end();
console.log("Done!");
