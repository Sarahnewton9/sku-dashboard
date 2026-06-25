/**
 * Re-scans tonybianco.com.au sale collection and fixes markdown_skus table
 * to use style codes from product titles (first word) instead of StyleCode~ tags.
 */
import { config } from "dotenv";
config();
import mysql from "mysql2/promise";

const SALE_URL = "https://tonybianco.com.au/collections/womens-shoe-sale/products.json";

async function fetchPage(page) {
  const res = await fetch(`${SALE_URL}?limit=250&page=${page}`, {
    headers: { "User-Agent": "SKUDash/1.0 (internal tool)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.products ?? [];
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Fetch all sale products
  const allProducts = [];
  let page = 1;
  while (true) {
    const products = await fetchPage(page);
    if (products.length === 0) break;
    allProducts.push(...products);
    if (products.length < 250) break;
    page++;
  }
  console.log(`Fetched ${allProducts.length} sale products`);

  // Clear the table and re-insert with correct style codes
  await conn.query("DELETE FROM markdown_skus");
  console.log("Cleared markdown_skus table");

  let inserted = 0;
  for (const product of allProducts) {
    const tags = product.tags ?? [];
    const title = product.title ?? "";
    const titleWords = title.trim().split(/\s+/);
    const styleCode = titleWords[0]?.toUpperCase();
    const colourTag = tags.find((t) => t.startsWith("Name~"));
    const colour = colourTag
      ? colourTag.slice(5).trim().toUpperCase()
      : titleWords.slice(1).join(" ").toUpperCase();

    if (!styleCode || !colour) continue;

    await conn.query(
      `INSERT INTO markdown_skus (style_code, colour, product_title, source_url, status)
       VALUES (?, ?, ?, ?, 'pending')
       ON DUPLICATE KEY UPDATE product_title = VALUES(product_title), source_url = VALUES(source_url), status = 'pending'`,
      [styleCode, colour, title, `https://tonybianco.com.au/products/${product.handle}`]
    );
    inserted++;
  }

  console.log(`Inserted/updated ${inserted} markdown SKU rows`);

  // Show sample
  const [rows] = await conn.query("SELECT style_code, colour, status FROM markdown_skus ORDER BY style_code, colour LIMIT 20");
  console.log("Sample rows:", JSON.stringify(rows, null, 2));

  await conn.end();
}

main().catch(console.error);
