import mysql2 from '/home/ubuntu/sku-dashboard/node_modules/mysql2/index.js';
const { createConnection } = mysql2.createPool ? mysql2 : (await import('/home/ubuntu/sku-dashboard/node_modules/mysql2/promise.js')).default;
import { readFileSync } from 'fs';

const envContent = readFileSync('/home/ubuntu/sku-dashboard/.env', 'utf8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL='))?.replace('DATABASE_URL=', '').trim();
if (!dbUrl) throw new Error('DATABASE_URL not found in .env');

const conn = await createConnection(dbUrl);

const [customStyles] = await conn.execute("SELECT style FROM custom_styles WHERE season = 'SS26'");
const customStyleNames = customStyles.map(r => r.style);
console.log('All SS26 custom styles:', customStyleNames.length, customStyleNames);

if (customStyleNames.length === 0) { await conn.end(); process.exit(0); }

const placeholders = customStyleNames.map(() => '?').join(',');
const [specStyles] = await conn.execute(
  `SELECT DISTINCT style FROM style_specs WHERE value IS NOT NULL AND value != '' AND style IN (${placeholders})`,
  customStyleNames
);
const stylesWithSpecs = specStyles.map(r => r.style);

const [customRowStyles] = await conn.execute(
  `SELECT DISTINCT style FROM spec_custom_rows WHERE value IS NOT NULL AND value != '' AND style IN (${placeholders})`,
  customStyleNames
);
const stylesWithCustomRows = customRowStyles.map(r => r.style);

const allCarryOvers = [...new Set([...stylesWithSpecs, ...stylesWithCustomRows])];
console.log('\nCarry-overs to mark complete:', allCarryOvers);

for (const style of allCarryOvers) {
  await conn.execute(
    "INSERT INTO style_spec_meta (style, specStatus) VALUES (?, 'complete') ON DUPLICATE KEY UPDATE specStatus = 'complete'",
    [style]
  );
  console.log(`  done: ${style}`);
}

await conn.end();
console.log(`\nDone! Marked ${allCarryOvers.length} styles as complete.`);
