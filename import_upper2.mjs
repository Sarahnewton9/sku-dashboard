import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");

// Upper 2 data parsed from Excel
const upper2Data = [
  { style: "CAPPA", colour: "DOVE", leather: "NAPPA", colour2: "BLACK", leather2: "NAPPA" },
  { style: "CAPPA", colour: "PERU", leather: "NAPPA", colour2: "BLACK", leather2: "NAPPA" },
  { style: "CAPPA", colour: "SKY", leather: "NAPPA", colour2: "VINO", leather2: "NAPPA" },
  { style: "CAPPA", colour: "PETAL", leather: "NAPPA", colour2: "VINO", leather2: "NAPPA" },
  { style: "DONTE", colour: "VANILLA", leather: "NAPPA", colour2: "BLACK", leather2: "NAPPA" },
  { style: "DONTE", colour: "PERU", leather: "NAPPA", colour2: "BLACK", leather2: "NAPPA" },
  { style: "DONTE", colour: "BLACK", leather: "VENICE", colour2: "BLACK", leather2: "PATENT" },
  { style: "DONTE", colour: "SKY", leather: "NAPPA", colour2: "VINO", leather2: "NAPPA" },
  { style: "DONTE", colour: "BLACK", leather: "NYLON", colour2: "BLACK", leather2: "NAPPA" },
  { style: "DONTE", colour: "CHOC", leather: "NYLON", colour2: "CHOCOLATE", leather2: "VENICE" },
  { style: "EMILY", colour: "MINT", leather: "CROCO", colour2: "BLACK", leather2: "PATENT" },
  { style: "EMILY", colour: "PETAL", leather: "CROCO", colour2: "BLACK", leather2: "PATENT" },
  { style: "EMILY", colour: "BLACK", leather: "CROCO", colour2: "BLACK", leather2: "PATENT" },
  { style: "EMILY", colour: "TAN", leather: "VINTAGE", colour2: "TAUPE", leather2: "SUEDE" },
  { style: "EMILY", colour: "SKY", leather: "VINTAGE", colour2: "SKY", leather2: "SUEDE" },
  { style: "KASSY", colour: "FUCHSIA", leather: "NUBUCK", colour2: "ECRU", leather2: "SNAKE" },
  { style: "KASSY", colour: "TURQUOISE", leather: "SUEDE", colour2: "ECRU", leather2: "SNAKE" },
  { style: "PIXIE", colour: "CHOCOLATE", leather: "VENICE", colour2: "BLACK", leather2: "NAPPA" },
  { style: "PIXIE", colour: "VANILLA", leather: "NAPPA", colour2: "BLACK", leather2: "NAPPA" },
  { style: "PIXIE", colour: "PERU", leather: "NAPPA", colour2: "BLACK", leather2: "GROSGRAIN" },
  { style: "PIXIE", colour: "BLACK", leather: "NAPPA", colour2: "BLACK", leather2: "GROSGRAIN" },
  { style: "PIXIE", colour: "SNOW LEOPARD", leather: "", colour2: "BLACK", leather2: "SPECKLE" },
  { style: "PIXIE", colour: "SAND", leather: "NAPPA", colour2: "BLACK", leather2: "GROSGRAIN" },
  { style: "ROBYN", colour: "MILK", leather: "CAPRETTO", colour2: "BLACK", leather2: "PATENT" },
  { style: "ROBYN", colour: "SILVER", leather: "NAPPA METALLIC", colour2: "BLACK", leather2: "GROSGRAIN" },
  { style: "ROBYN", colour: "GOLD", leather: "NAPPA METALLIC", colour2: "BLACK", leather2: "GROSGRAIN" },
  { style: "ROBYN", colour: "VINO", leather: "NAPPA", colour2: "PETAL", leather2: "NAPPA" },
  { style: "ROBYN", colour: "BLACK", leather: "NAPPA", colour2: "BLACK", leather2: "PATENT" },
  { style: "ROBYN", colour: "BLACK", leather: "SUEDE", colour2: "BLACK", leather2: "SPECKLE" },
  { style: "ROBYN", colour: "VANILLA", leather: "NAPPA", colour2: "BLACK", leather2: "NAPPA" },
  { style: "ROBYN", colour: "SNOW LEOPARD", leather: "", colour2: "BLACK", leather2: "SPECKLE" },
  { style: "ROBYN", colour: "STONE", leather: "SUEDE", colour2: "STONE", leather2: "PATENT" },
  { style: "ROBYN", colour: "ESPRESSO", leather: "SUEDE", colour2: "CHOC", leather2: "VINTAGE" },
  { style: "ROBYN", colour: "TAUPE", leather: "SUEDE", colour2: "TAN", leather2: "VINTAGE" },
  { style: "ROBYN", colour: "PETAL", leather: "SUEDE", colour2: "PETAL", leather2: "VINTAGE" },
  { style: "ROBYN", colour: "SAND", leather: "NAPPA", colour2: "BLACK", leather2: "GROSGRAIN" },
  { style: "ROXIE", colour: "TURQUOISE", leather: "NAPPA", colour2: "BLACK", leather2: "NAPPA" },
  { style: "ROXIE", colour: "PERU", leather: "NAPPA", colour2: "BLACK", leather2: "NAPPA" },
  { style: "ROXIE", colour: "MILK", leather: "CAPRETTO", colour2: "BLACK", leather2: "PATENT" },
  { style: "SARAH", colour: "MILK", leather: "CAPRETTO", colour2: "BLACK", leather2: "NAPPA" },
  { style: "SARAH", colour: "PETAL", leather: "SUEDE", colour2: "PETAL", leather2: "VINTAGE" },
  { style: "SARAH", colour: "SKY", leather: "SUEDE", colour2: "SKY", leather2: "VINTAGE" },
  { style: "SARAH", colour: "ESPRESSO", leather: "SUEDE", colour2: "CHOC", leather2: "VINTAGE" },
  { style: "SAVANT", colour: "TAUPE", leather: "SUEDE", colour2: "TAN", leather2: "VINTAGE" },
  { style: "SAVANT", colour: "WHEAT", leather: "SUEDE", colour2: "VANILLA", leather2: "VINTAGE" },
  { style: "SAVANT", colour: "ESPRESSO", leather: "SUEDE", colour2: "CHOC", leather2: "VINTAGE" },
  { style: "SAVANT", colour: "DENIM", leather: "SUEDE", colour2: "SKY", leather2: "VINTAGE" },
  { style: "SAVANT", colour: "PETAL", leather: "SUEDE", colour2: "PETAL", leather2: "VINTAGE" },
  { style: "SAVANT", colour: "BLACK", leather: "SUEDE", colour2: "BLACK", leather2: "VINTAGE" },
];

const conn = await createConnection(DB_URL);

let updated = 0;
let notFound = [];

for (const row of upper2Data) {
  const [rows] = await conn.execute(
    `SELECT id FROM custom_skus WHERE style = ? AND colour = ? AND (leather = ? OR (leather IS NULL AND ? = '')) AND season = 'SS26'`,
    [row.style, row.colour, row.leather, row.leather]
  );
  
  if (rows.length === 0) {
    console.log(`❌ NOT FOUND: ${row.style} | ${row.colour} | ${row.leather}`);
    notFound.push(row);
    continue;
  }
  
  const id = rows[0].id;
  await conn.execute(
    `UPDATE custom_skus SET colour2 = ?, leather2 = ? WHERE id = ?`,
    [row.colour2, row.leather2, id]
  );
  console.log(`✅ Updated id=${id}: ${row.style} ${row.colour} ${row.leather} → Upper2: ${row.colour2} / ${row.leather2}`);
  updated++;
}

await conn.end();
console.log(`\n✅ Updated: ${updated}`);
console.log(`❌ Not found: ${notFound.length}`);
if (notFound.length > 0) {
  console.log("Not found:", notFound);
}
