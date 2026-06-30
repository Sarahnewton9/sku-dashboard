import { config } from "dotenv";
config();
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check cancelled_styles (column is 'style')
const [cs] = await conn.execute("SELECT * FROM cancelled_styles WHERE style = 'ROBYN'");
console.log('cancelled_styles:', JSON.stringify(cs));

// Check cancelled_skus
const [csk] = await conn.execute("SELECT * FROM cancelled_skus WHERE style = 'ROBYN'");
console.log('cancelled_skus:', JSON.stringify(csk));

// Check markdown_skus
const [ms] = await conn.execute("SELECT * FROM markdown_skus WHERE style_code = 'ROBYN'");
console.log('markdown_skus:', JSON.stringify(ms));

// Check buy_session_items
const [bsi] = await conn.execute("SELECT * FROM buy_session_items WHERE style = 'ROBYN'");
console.log('buy_session_items:', JSON.stringify(bsi));

await conn.end();
