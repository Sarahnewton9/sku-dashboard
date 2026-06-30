import { config } from "dotenv";
config();
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get full cancelled_skus row for ROBYN BLACK SPECKLE
const [rows] = await conn.execute(`
  SELECT * FROM cancelled_skus
  WHERE style = 'ROBYN' AND colour = 'BLACK' AND leather = 'SPECKLE'
`);
console.log('cancelled_skus row:');
rows.forEach(r => console.log(JSON.stringify(r, null, 2)));

// Check if there are any notes/reason columns
const [cols] = await conn.execute("DESCRIBE cancelled_skus");
console.log('\nAll columns:', cols.map(c => `${c.Field} (${c.Type})`));

await conn.end();
