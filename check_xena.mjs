import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await createConnection(process.env.DATABASE_URL);
const [customSkus] = await conn.execute('SELECT * FROM custom_skus WHERE style = ?', ['XENA']);
console.log('XENA custom_skus:', JSON.stringify(customSkus, null, 2));
const [cancelledSkus] = await conn.execute('SELECT * FROM cancelled_skus WHERE style = ?', ['XENA']);
console.log('XENA cancelled_skus:', JSON.stringify(cancelledSkus, null, 2));
await conn.end();
