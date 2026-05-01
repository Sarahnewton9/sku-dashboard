import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Create pptx_imports table if it doesn't exist
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`pptx_imports\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`file_key\` varchar(512) NOT NULL,
    \`file_name\` varchar(256) NOT NULL DEFAULT '',
    \`uploadedAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`pptx_imports_id\` PRIMARY KEY(\`id\`)
  )
`);

console.log('pptx_imports table created (or already exists)');
await conn.end();
