import { config } from "dotenv";
config();
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Create tables
await conn.execute(`
  CREATE TABLE IF NOT EXISTS handbag_styles (
    id int AUTO_INCREMENT NOT NULL,
    style varchar(128) NOT NULL,
    colour varchar(128) NOT NULL,
    material varchar(128),
    section varchar(128),
    notes varchar(512),
    rrp float,
    cost float,
    createdAt timestamp NOT NULL DEFAULT (now()),
    updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT handbag_styles_id PRIMARY KEY(id),
    CONSTRAINT handbag_style_colour_idx UNIQUE(style, colour)
  )
`);
console.log('Created handbag_styles');

await conn.execute(`
  CREATE TABLE IF NOT EXISTS handbag_buy_sessions (
    id int AUTO_INCREMENT NOT NULL,
    name varchar(128) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT handbag_buy_sessions_id PRIMARY KEY(id)
  )
`);
console.log('Created handbag_buy_sessions');

await conn.execute(`
  CREATE TABLE IF NOT EXISTS handbag_buy_items (
    id int AUTO_INCREMENT NOT NULL,
    session_id int NOT NULL,
    style varchar(128) NOT NULL,
    colour varchar(128) NOT NULL,
    au_qty int NOT NULL DEFAULT 0,
    usa_qty int NOT NULL DEFAULT 0,
    nyc_qty int NOT NULL DEFAULT 0,
    updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT handbag_buy_items_id PRIMARY KEY(id),
    CONSTRAINT handbag_buy_item_idx UNIQUE(session_id, style, colour)
  )
`);
console.log('Created handbag_buy_items');

// Seed handbag styles from SS26 linesheet (names and colours only — costs are wholesale placeholders)
const styles = [
  // Core / Carry Over
  { style: 'KATIE',   colour: 'Black',     material: 'Crinkle',       section: 'Core / Carry Over', rrp: 249.95 },
  { style: 'KATIE',   colour: 'Vino',      material: 'Crinkle',       section: 'Core / Carry Over', rrp: 249.95 },
  { style: 'KIKI',    colour: 'Black',     material: 'Vintage',       section: 'Core / Carry Over', rrp: 249.95 },
  { style: 'KIKI',    colour: 'Choc',      material: 'Vintage',       section: 'Core / Carry Over', rrp: 249.95 },
  { style: 'KIKI',    colour: 'Tan',       material: 'Vintage',       section: 'Core / Carry Over', rrp: 249.95 },
  { style: 'ALYS',    colour: 'Espresso',  material: 'Suede',         section: 'Core / Carry Over', rrp: 219.95 },
  { style: 'ALYS',    colour: 'Wheat',     material: 'Suede',         section: 'Core / Carry Over', rrp: 219.95 },
  { style: 'ALYS',    colour: 'Black',     material: 'Suede',         section: 'Core / Carry Over', rrp: 219.95 },
  { style: 'ALYS',    colour: 'Red',       material: 'Suede',         section: 'Core / Carry Over', rrp: 219.95 },
  { style: 'ALYS',    colour: 'Taupe',     material: 'Suede',         section: 'Core / Carry Over', rrp: 219.95, notes: 'NEW COLOR ADD' },
  { style: 'ALYS',    colour: 'Sky',       material: 'Suede',         section: 'Core / Carry Over', rrp: 219.95, notes: 'NEW COLOR ADD, SAMPLE NOT RECEIVED' },
  { style: 'TIFF',    colour: 'Silver',    material: 'Vintage Metal', section: 'Core / Carry Over', rrp: 199.95 },
  { style: 'TIFF',    colour: 'Dove',      material: 'Soft Crinkle',  section: 'Core / Carry Over', rrp: 199.95 },
  { style: 'TIFF',    colour: 'Black',     material: 'Soft Vintage',  section: 'Core / Carry Over', rrp: 199.95 },
  { style: 'TIFF',    colour: 'Sky',       material: 'Crinkle',       section: 'Core / Carry Over', rrp: 199.95, notes: 'NEW COLOR ADD' },
  // New Season
  { style: 'ELARA',   colour: 'Black',     material: 'Croco',         section: 'New Season',        rrp: 249.95, notes: 'NEW' },
  { style: 'ELARA',   colour: 'Vestra',    material: 'Croco',         section: 'New Season',        rrp: 249.95, notes: 'NEW COLOR SAMPLE NOT ARRIVED' },
  { style: 'AIMEE',   colour: 'Black',     material: 'Pebble',        section: 'New Season',        rrp: 229.95, notes: 'NEW' },
  { style: 'WHIMSY',  colour: 'Black',     material: 'Hi Shine',      section: 'New Season',        rrp: 229.95, notes: 'NEW' },
  { style: 'WHIMSY',  colour: 'White',     material: 'Hi Shine',      section: 'New Season',        rrp: 229.95, notes: 'NEW COLOR SAMPLE NOT ARRIVED' },
  { style: 'JOELY',   colour: 'Sky',       material: 'Suede',         section: 'New Season',        rrp: 219.95 },
  { style: 'JOELY',   colour: 'Stone',     material: 'Suede',         section: 'New Season',        rrp: 219.95, notes: 'NEW COLOR SAMPLE NOT ARRIVED' },
  { style: 'JOELY',   colour: 'Petal',     material: 'Suede',         section: 'New Season',        rrp: 219.95, notes: 'NEW COLOR SAMPLE NOT ARRIVED' },
  // Winter Recut
  { style: 'LESLEY',  colour: 'Choc',      material: 'Vintage',       section: 'Winter Recut',      rrp: 219.95 },
  { style: 'LESLEY',  colour: 'Black',     material: 'Vintage',       section: 'Winter Recut',      rrp: 219.95 },
  { style: 'CAITLIN', colour: 'Red',       material: 'Suede',         section: 'Winter Recut',      rrp: 219.95 },
  { style: 'CAITLIN', colour: 'Espresso',  material: 'Suede',         section: 'Winter Recut',      rrp: 219.95 },
  { style: 'LIZZIE',  colour: 'Choc',      material: 'Smooth',        section: 'Winter Recut',      rrp: 219.95 },
  { style: 'LIZZIE',  colour: 'Vino',      material: 'Smooth',        section: 'Winter Recut',      rrp: 219.95 },
  { style: 'FLORA',   colour: 'Vino',      material: 'Smooth',        section: 'Winter Recut',      rrp: 249.95 },
];

let inserted = 0;
for (const s of styles) {
  await conn.execute(
    `INSERT INTO handbag_styles (style, colour, material, section, notes, rrp)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE material=VALUES(material), section=VALUES(section), notes=VALUES(notes), rrp=VALUES(rrp)`,
    [s.style, s.colour, s.material ?? null, s.section ?? null, s.notes ?? null, s.rrp ?? null]
  );
  inserted++;
}
console.log(`Seeded ${inserted} handbag styles`);

await conn.end();
console.log('Done');
