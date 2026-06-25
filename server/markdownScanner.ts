/**
 * Markdown Scanner — fetches all sale products from tonybianco.com.au
 * using the Shopify collection JSON API and extracts style code + colour.
 *
 * Style code: derived from the FIRST WORD of the product title (uppercased).
 *   e.g. "Bettina Black Suede" → styleCode = "BETTINA"
 *   This is more reliable than the StyleCode~ tag which sometimes has prefixes (B-MABEL etc.)
 *
 * Colour: derived from the Name~ tag (e.g. "Name~Black Suede" → "BLACK SUEDE")
 *   Falls back to title words after the first word if the tag is missing.
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
      const title: string = product.title ?? "";

      // Extract style code from the first word of the product title (most reliable)
      const titleWords = title.trim().split(/\s+/);
      const styleCode = titleWords[0]?.toUpperCase();

      // Extract colour from the Name~ tag; fall back to all words after the first
      const colourTag = extractTag(tags, "Name~");
      const colour = colourTag
        ? colourTag.toUpperCase()
        : titleWords.slice(1).join(" ").toUpperCase();

      if (!styleCode || !colour) continue;

      results.push({
        styleCode,
        colour,
        productTitle: title,
        sourceUrl: `https://tonybianco.com.au/products/${product.handle}`,
      });
    }

    if (products.length < 250) break;
    page++;
  }

  return results;
}
