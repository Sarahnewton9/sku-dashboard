import { config } from "dotenv";
config();
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check DOLLI in markdown_skus
const [rows] = await conn.execute(
  "SELECT id, style_code, colour, status FROM markdown_skus WHERE style_code = 'DOLLI'"
);
console.log('DOLLI in markdown_skus:');
rows.forEach(r => console.log(JSON.stringify(r)));

await conn.end();
