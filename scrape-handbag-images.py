#!/usr/bin/env python3
"""
Scrape handbag product images from tonybianco.com.au and match them to
the handbag_styles table in the DB.

For each style+colour in the DB, we:
1. Build a candidate URL slug: bag{style}-{colour}-{material} (lowercase, spaces→hyphens)
2. Try to fetch the product page and extract the first product image
3. If found, update the DB row with the image URL
"""

import re
import json
import time
import urllib.request
import urllib.parse
import os

# ── DB styles from the query output above ──────────────────────────────────────
STYLES = [
    {"id": 18, "style": "AIMEE", "colour": "Black", "material": None},
    {"id": 8, "style": "ALYS", "colour": "Black", "material": None},
    {"id": 6, "style": "ALYS", "colour": "Espresso", "material": None},
    {"id": 9, "style": "ALYS", "colour": "Red", "material": "Suede"},
    {"id": 11, "style": "ALYS", "colour": "Sky", "material": "Suede"},
    {"id": 10, "style": "ALYS", "colour": "Taupe", "material": "Suede"},
    {"id": 7, "style": "ALYS", "colour": "Wheat", "material": "Suede"},
    {"id": 27, "style": "CAITLIN", "colour": "Espresso", "material": "Suede"},
    {"id": 26, "style": "CAITLIN", "colour": "Red", "material": "Suede"},
    {"id": 16, "style": "ELARA", "colour": "Black", "material": None},
    {"id": 17, "style": "ELARA", "colour": "Vestra", "material": "Croco"},
    {"id": 30, "style": "FLORA", "colour": "Vino", "material": "Smooth"},
    {"id": 23, "style": "JOELY", "colour": "Petal", "material": "Suede"},
    {"id": 21, "style": "JOELY", "colour": "Sky", "material": "Suede"},
    {"id": 22, "style": "JOELY", "colour": "Stone", "material": "Suede"},
    {"id": 1, "style": "KATIE", "colour": "Black", "material": "Crinkle"},
    {"id": 2, "style": "KATIE", "colour": "Vino", "material": "Crinkle"},
    {"id": 3, "style": "KIKI", "colour": "Black", "material": "Vintage"},
    {"id": 4, "style": "KIKI", "colour": "Choc", "material": "Vintage"},
    {"id": 5, "style": "KIKI", "colour": "Tan", "material": "Vintage"},
    {"id": 25, "style": "LESLEY", "colour": "Black", "material": "Vintage"},
    {"id": 24, "style": "LESLEY", "colour": "Choc", "material": "Vintage"},
    {"id": 28, "style": "LIZZIE", "colour": "Choc", "material": "Smooth"},
    {"id": 29, "style": "LIZZIE", "colour": "Vino", "material": "Smooth"},
    {"id": 14, "style": "TIFF", "colour": "Black", "material": "Soft Vintage"},
    {"id": 13, "style": "TIFF", "colour": "Dove", "material": "Soft Crinkle"},
    {"id": 12, "style": "TIFF", "colour": "Silver", "material": "Vintage Metal"},
    {"id": 15, "style": "TIFF", "colour": "Sky", "material": "Crinkle"},
    {"id": 19, "style": "WHIMSY", "colour": "Black", "material": "Hi Shine"},
    {"id": 20, "style": "WHIMSY", "colour": "White", "material": "Hi Shine"},
]

# ── Mapping from website product listing (from the collection page) ────────────
# Format: "STYLE COLOUR MATERIAL" → product URL slug on tonybianco.com.au
# Collected from the collection page scrape
WEBSITE_PRODUCTS = [
    ("soho", "espresso", "suede", "bagsoho-espresso-suede-13969"),
    ("caitlin", "espresso", "suede", "bagcaitlin-espresso-suede-15609"),
    ("caitlin", "red", "suede", "bagcaitlin-red-suede-15609"),
    ("lula", "espresso", "suede", "baglula-espresso-suede-14812"),
    ("flora", "vino", "smooth", "bagflora-vino-smooth-15612"),
    ("soho", "wheat", "suede", "bagsoho-wheat-suede-13969"),
    ("lula", "wheat", "suede", "baglula-wheat-suede-14812"),
    ("flora", "black", "smooth", "bagflora-black-smooth-15612"),
    ("alys", "espresso", "suede", "bagalys-espresso-suede-14769"),
    ("lizzie", "black", "smooth", "baglizzie-black-smooth-15611"),
    ("alys", "wheat", "suede", "bagalys-wheat-suede-14769"),
    ("caitlin", "black", "suede", "bagcaitlin-black-suede-15609"),
    ("lizzie", "vino", "smooth", "baglizzie-vino-smooth-15611"),
    ("lula", "black", "vintage", "baglula-black-vintage-14812"),
    ("lesley", "choc", "vintage", "baglesley-choc-vintage-15610"),
    ("lesley", "black", "vintage", "baglesley-black-vintage-15610"),
    ("lesley", "espresso", "suede", "baglesley-espresso-suede-15610"),
    ("alys", "red", "suede", "bagalys-red-suede-14769"),
    ("mabel", "black", "soft vintage", "bagmabel-black-soft-vintage-14811"),
    ("mily", "black", "suede", "bagmily-black-suede-13410"),
    ("evie", "wheat", "suede", "bagevie-wheat-suede-14815"),
    ("evie", "black", "suede", "bagevie-black-suede-14815"),
    ("mabel", "dove", "soft vintage", "bagmabel-dove-soft-vintage-14811"),
    ("evie", "dove", "soft vintage", "bagevie-dove-soft-vintage-14815"),
    ("breezy", "natural", "crochet", "bagbreezy-natural-crochet-14958"),
    ("avva", "white", "nappa", "avva-white-nappa-clutch"),
    ("chill", "natural", "raffia", "bagchill-natural-raffia-14959"),
]

def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def fetch_product_image(slug):
    """Fetch the first product image from a tonybianco.com.au product page."""
    url = f"https://tonybianco.com.au/collections/handbags/products/{slug}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
        # Look for og:image meta tag first (most reliable)
        m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\'](https?://[^"\']+)["\']', html)
        if m:
            return m.group(1)
        # Fallback: look for cdn/shop/files image in a product-media context
        m = re.search(r'(https://tonybianco\.com\.au/cdn/shop/files/[^"\'?\s]+)', html)
        if m:
            img = m.group(1)
            # Make sure it's a product image not a logo
            if 'bag' in img.lower() or any(s["style"].lower() in img.lower() for s in STYLES):
                return img
        return None
    except Exception as e:
        print(f"  ERROR fetching {url}: {e}")
        return None

def match_style(db_style, db_colour, db_material):
    """Find the best matching website product for a DB style+colour+material."""
    style_l = db_style.lower()
    colour_l = db_colour.lower()
    mat_l = (db_material or "").lower()
    
    best = None
    for (ws, wc, wm, slug) in WEBSITE_PRODUCTS:
        if ws != style_l:
            continue
        if wc != colour_l:
            continue
        # Material match: if we have material, try to match; if not, any material is ok
        if mat_l and wm and mat_l not in wm and wm not in mat_l:
            continue
        best = slug
        break
    
    # Looser match: style + colour only (ignore material)
    if not best:
        for (ws, wc, wm, slug) in WEBSITE_PRODUCTS:
            if ws == style_l and wc == colour_l:
                best = slug
                break
    
    return best

results = []
for row in STYLES:
    style = row["style"]
    colour = row["colour"]
    material = row["material"]
    
    slug = match_style(style, colour, material)
    if not slug:
        print(f"  NO MATCH: {style} {colour} {material}")
        results.append({"id": row["id"], "style": style, "colour": colour, "imageUrl": None, "matched": False})
        continue
    
    print(f"  Fetching: {style} {colour} → {slug}")
    img_url = fetch_product_image(slug)
    print(f"    → {img_url}")
    results.append({"id": row["id"], "style": style, "colour": colour, "imageUrl": img_url, "matched": True, "slug": slug})
    time.sleep(0.5)

# Save results
with open('/tmp/handbag-images.json', 'w') as f:
    json.dump(results, f, indent=2)

print(f"\nDone. {sum(1 for r in results if r.get('imageUrl'))} images found out of {len(results)} styles.")
print("Results saved to /tmp/handbag-images.json")
