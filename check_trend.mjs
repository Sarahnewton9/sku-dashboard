import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("SELECT * FROM style_trend_flags LIMIT 20");
console.log("TrendFlags:", JSON.stringify(rows, null, 2));
const [sub] = await conn.execute("SELECT * FROM style_sub_categories WHERE sub_category IN ('Ballet Flat','Loafer') LIMIT 10");
console.log("SubCats:", JSON.stringify(sub, null, 2));
await conn.end();
