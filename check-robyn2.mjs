import { config } from "dotenv";
config();
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all session IDs that have ROBYN BLACK SPECKLE or BLACK SUEDE
const [sessions] = await conn.execute(`
  SELECT DISTINCT bs.id, bs.name, bsi.colour, bsi.leather, bsi.auQty, bsi.usaQty, bsi.nycQty, bsi.qty
  FROM buy_sessions bs
  JOIN buy_session_items bsi ON bsi.sessionId = bs.id
  WHERE bsi.style = 'ROBYN' AND bsi.colour = 'BLACK' AND bsi.leather IN ('SPECKLE', 'SUEDE')
  ORDER BY bs.id
`);
console.log('Sessions with ROBYN BLACK SPECKLE/SUEDE:');
sessions.forEach(s => console.log(JSON.stringify(s)));

await conn.end();
