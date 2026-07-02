const mysql = require('./node_modules/mysql2/promise.js');
const dotenv = require('./node_modules/dotenv/lib/main.js');
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query('SELECT id, style, colour, material FROM handbag_styles ORDER BY style, colour');
  console.log(JSON.stringify(rows));
  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
