import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(
  "SELECT style, colour, leather, createdAt FROM custom_skus WHERE style IN ('DAZIE','ENVY') ORDER BY style, colour"
);
console.log('Custom SKUs for DAZIE and ENVY:');
console.log(JSON.stringify(rows, null, 2));

const [all] = await conn.execute("SELECT style, colour, leather FROM custom_skus ORDER BY style LIMIT 20");
console.log('\nAll custom SKUs (first 20):');
console.log(JSON.stringify(all, null, 2));

await conn.end();
