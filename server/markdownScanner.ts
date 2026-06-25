/**
 * Markdown Scanner — fetches all sale products from tonybianco.com.au
 * using the Shopify collection JSON API and extracts style code + colour
 * from product tags (StyleCode~XXX and Name~XXX).
 */

const SALE_COLLECTION_URL = "https://tonybianco.com.au/collections/womens-shoe-sale/products.json";

export interface SaleProduct {
  styleCode: string;
  colour: string;
  productTitle: string;
  sourceUrl: string;
}

function extractTag(tags: string[], prefix: string): string | null {
  const tag = tags.find((t) => t.startsWith(prefix));
  return tag ? tag.slice(prefix.length).trim() : null;
}

async function fetchPage(page: number): Promise<any[]> {
  const url = `${SALE_COLLECTION_URL}?limit=250&page=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SKUDash/1.0 (internal tool)" },
  });
  if (!res.ok) throw new Error(`Failed to fetch sale products: ${res.status}`);
  const data = await res.json() as { products: any[] };
  return data.products ?? [];
}

export async function fetchSaleProducts(): Promise<SaleProduct[]> {
  const results: SaleProduct[] = [];
  let page = 1;

  while (true) {
    const products = await fetchPage(page);
    if (products.length === 0) break;

    for (const product of products) {
      const tags: string[] = product.tags ?? [];
      const styleCode = extractTag(tags, "StyleCode~");
      const colourName = extractTag(tags, "Name~");

      if (!styleCode || !colourName) continue;

      results.push({
        styleCode: styleCode.toUpperCase(),
        colour: colourName.toUpperCase(),
        productTitle: product.title ?? "",
        sourceUrl: `https://tonybianco.com.au/products/${product.handle}`,
      });
    }

    if (products.length < 250) break;
    page++;
  }

  return results;
}
