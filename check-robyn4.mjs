import { config } from "dotenv";
config();
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// All buy entries for ROBYN BLACK (both leathers)
const [rows] = await conn.execute(`
  SELECT bs.id, bs.name, bsi.colour, bsi.leather, bsi.auQty, bsi.usaQty, bsi.nycQty, bsi.qty
  FROM buy_sessions bs
  JOIN buy_session_items bsi ON bsi.sessionId = bs.id
  WHERE bsi.style = 'ROBYN' AND bsi.colour = 'BLACK'
  ORDER BY bs.id
`);
console.log('All ROBYN BLACK buy entries:');
rows.forEach(r => console.log(JSON.stringify(r)));

await conn.end();
