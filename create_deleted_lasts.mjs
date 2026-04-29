import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';

config();

const conn = await createConnection(process.env.DATABASE_URL);
await conn.execute(`CREATE TABLE IF NOT EXISTS \`deleted_lasts\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`lastName\` varchar(128) NOT NULL,
  \`deletedAt\` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT \`deleted_lasts_id\` PRIMARY KEY(\`id\`),
  CONSTRAINT \`deleted_lasts_lastName_unique\` UNIQUE(\`lastName\`)
)`);
console.log('deleted_lasts table created successfully');
await conn.end();
