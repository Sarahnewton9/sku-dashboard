import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);
await migrate(db, { migrationsFolder: join(__dirname, 'drizzle') });
await conn.end();
console.log('Migration done');
