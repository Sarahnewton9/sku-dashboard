import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

const [sessions] = await conn.execute('SELECT id, name, isLocked, createdAt FROM buy_sessions ORDER BY createdAt DESC LIMIT 5');
console.log('Sessions:', JSON.stringify(sessions, null, 2));

const [items] = await conn.execute('SELECT sessionId, style, colour, leather, auQty, usaQty FROM buy_session_items WHERE (auQty > 0 OR usaQty > 0) LIMIT 20');
console.log('Items with qty:', JSON.stringify(items, null, 2));

const [count] = await conn.execute('SELECT COUNT(*) as total, SUM(auQty) as totalAu, SUM(usaQty) as totalUsa FROM buy_session_items');
console.log('Totals:', JSON.stringify(count, null, 2));

await conn.end();
