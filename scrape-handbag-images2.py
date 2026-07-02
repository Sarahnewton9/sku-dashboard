#!/usr/bin/env python3
"""
Scrape handbag product images from tonybianco.com.au and match to DB styles.
Uses the full product list from the collection page HTML.
"""

import re
import json
import time
import urllib.request

# ── All products found on the website ─────────────────────────────────────────
WEBSITE_PRODUCTS = [
    ("soho", "espresso suede", "bagsoho-espresso-suede-13969"),
    ("caitlin", "espresso suede", "bagcaitlin-espresso-suede-15609"),
    ("caitlin", "red suede", "bagcaitlin-red-suede-15609"),
    ("lula", "espresso suede", "baglula-espresso-suede-14812"),
    ("flora", "vino smooth", "bagflora-vino-smooth-15612"),
    ("soho", "wheat suede", "bagsoho-wheat-suede-13969"),
    ("lula", "wheat suede", "baglula-wheat-suede-14812"),
    ("flora", "black smooth", "bagflora-black-smooth-15612"),
    ("alys", "espresso suede", "bagalys-espresso-suede-14769"),
    ("lizzie", "black smooth", "baglizzie-black-smooth-15611"),
    ("alys", "wheat suede", "bagalys-wheat-suede-14769"),
    ("caitlin", "black suede", "bagcaitlin-black-suede-15609"),
    ("lizzie", "vino smooth", "baglizzie-vino-smooth-15611"),
    ("lula", "black vintage", "baglula-black-vintage-14812"),
    ("lizzie", "choc smooth", "baglizzie-choc-smooth-15611"),
    ("lesley", "choc vintage", "baglesley-choc-vintage-15610"),
    ("tiff", "silver vintage metal", "bagtiff-silver-vintage-metal-14809"),
    ("tiff", "dove soft vintage", "bagtiff-dove-soft-vintage-14809"),
    ("alys", "black suede", "bagalys-black-suede-14769"),
    ("lesley", "black vintage", "baglesley-black-vintage-15610"),
    ("lesley", "espresso suede", "baglesley-espresso-suede-15610"),
    ("alys", "red suede", "bagalys-red-suede-14769"),
    ("tiff", "black soft vintage", "bagtiff-black-soft-vintage-14809"),
    ("avva", "white nappa", "avva-white-nappa-clutch"),
    ("chill", "natural raffia", "bagchill-natural-raffia-14959"),
    ("mabel", "black soft vintage", "bagmabel-black-soft-vintage-14811"),
    ("mily", "black suede", "bagmily-black-suede-13410"),
    ("evie", "wheat suede", "bagevie-wheat-suede-14815"),
    ("evie", "black suede", "bagevie-black-suede-14815"),
    ("mabel", "dove soft vintage", "bagmabel-dove-soft-vintage-14811"),
    ("evie", "dove soft vintage", "bagevie-dove-soft-vintage-14815"),
    ("breezy", "natural crochet", "bagbreezy-natural-crochet-14958"),
    ("roxie", "milk capretto black", "roxie-milk-caprettoblack-15813"),
    ("legacy", "dove nappa black", "legacy-dove-nappablack-15793"),
    ("cappa", "dove nappa black", "cappa-dove-nappablack-15811"),
    ("comma", "petal nappa", "comma-petal-nappa-15309"),
    ("moma", "petal suede", "moma-petal-suede-15796"),
]

# ── DB styles ──────────────────────────────────────────────────────────────────
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

def build_search_key(style, colour, material):
    """Build a normalised search key from DB fields."""
    parts = [style.lower(), colour.lower()]
    if material:
        parts.append(material.lower())
    return " ".join(parts)

def match_style(db_style, db_colour, db_material):
    """Find the best matching website product slug."""
    style_l = db_style.lower()
    colour_l = db_colour.lower()
    mat_l = (db_material or "").lower()
    
    # Build a combined search string from DB fields
    combined = f"{colour_l} {mat_l}".strip()
    
    for (ws, wdesc, slug) in WEBSITE_PRODUCTS:
        if ws != style_l:
            continue
        # Check if colour is in the website description
        if colour_l not in wdesc:
            continue
        # If we have material, check it's in the description (or close enough)
        if mat_l:
            # Allow partial matches (e.g. "soft vintage" matches "soft vintage")
            mat_words = mat_l.split()
            if any(w in wdesc for w in mat_words):
                return slug
        else:
            return slug
    
    # Looser: just style + colour
    for (ws, wdesc, slug) in WEBSITE_PRODUCTS:
        if ws == style_l and colour_l in wdesc:
            return slug
    
    return None

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
        # og:image is most reliable
        m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\'](https?://[^"\']+)["\']', html)
        if m:
            return m.group(1)
        # Fallback: first cdn/shop/files image
        m = re.search(r'(https://tonybianco\.com\.au/cdn/shop/files/[^"\'?\s]+)', html)
        if m:
            return m.group(1)
        return None
    except Exception as e:
        print(f"  ERROR fetching {url}: {e}")
        return None

results = []
for row in STYLES:
    style = row["style"]
    colour = row["colour"]
    material = row["material"]
    
    slug = match_style(style, colour, material)
    if not slug:
        print(f"  NO MATCH: {style} {colour} {material or ''}")
        results.append({"id": row["id"], "style": style, "colour": colour, "imageUrl": None})
        continue
    
    print(f"  Fetching: {style} {colour} → {slug}")
    img_url = fetch_product_image(slug)
    if img_url:
        # Ensure https
        if img_url.startswith('//'):
            img_url = 'https:' + img_url
        print(f"    → {img_url[:80]}...")
    else:
        print(f"    → no image found")
    results.append({"id": row["id"], "style": style, "colour": colour, "imageUrl": img_url})
    time.sleep(0.4)

with open('/tmp/handbag-images2.json', 'w') as f:
    json.dump(results, f, indent=2)

found = sum(1 for r in results if r.get('imageUrl'))
print(f"\nDone. {found} images found out of {len(results)} styles.")
print("Results saved to /tmp/handbag-images2.json")
