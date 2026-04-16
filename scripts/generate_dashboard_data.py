#!/usr/bin/env python3
"""
Generate the TypeScript data file for the SKU dashboard.
Outputs: /home/ubuntu/sku-dashboard/client/src/lib/skuData.ts
"""

import json
import re
from collections import defaultdict

with open('/home/ubuntu/clean_sku_data.json') as f:
    styles = json.load(f)

# Load CDN image URLs
try:
    with open('/home/ubuntu/style_cdn_urls.json') as f:
        cdn_urls = json.load(f)
except FileNotFoundError:
    cdn_urls = {}

# Normalise leather names - clean up minor variations
LEATHER_ALIASES = {
    'HI SHINE': 'HI-SHINE',
    'H SHINE': 'HI-SHINE',
    'CROC': 'CROCO',
}

def norm_leather(l):
    if not l:
        return l
    l = l.strip().upper()
    return LEATHER_ALIASES.get(l, l)

def norm_colour(c):
    if not c:
        return c
    c = c.strip().upper()
    # Fix typos
    if c == 'BLK':
        return 'BLACK'
    if c == 'BOURDEUX':
        return 'BORDEAUX'
    if c == 'CHOCOLAT':
        return 'CHOCOLATE'
    if c == 'CHOCLATE':
        return 'CHOCOLATE'
    if c == 'CINNABAR':
        return 'CINNABAR'
    if c == 'ADD':
        return None  # skip "ADD" - it's a note
    return c

# Normalise all SKUs
for style in styles:
    cleaned_skus = []
    for sku in style['skus']:
        colour = norm_colour(sku['colour'])
        leather = norm_leather(sku['leather'])
        if colour is None:
            continue
        sku['colour'] = colour
        sku['leather'] = leather
        cleaned_skus.append(sku)
    style['skus'] = cleaned_skus
    style['total_skus'] = len(cleaned_skus)
    style['new_skus'] = sum(1 for s in cleaned_skus if s['is_new'])
    style['existing_skus'] = sum(1 for s in cleaned_skus if not s['is_new'])
    style['leathers'] = sorted(set(s['leather'] for s in cleaned_skus if s['leather']))
    style['colours'] = sorted(set(s['colour'] for s in cleaned_skus))

# ============================================================
# COMPUTE ANALYTICS
# ============================================================
categories = ['Dress Shoe', 'Dress Sandal', 'Ballet Flat', 'Loafer', 'Wedge', 'Sandal', 'Ankle Boot', 'Calf Boot']

# Summary stats
total_skus = sum(s['total_skus'] for s in styles)
new_skus = sum(s['new_skus'] for s in styles)
existing_skus = sum(s['existing_skus'] for s in styles)
total_styles = len(styles)
brand_new_styles = sum(1 for s in styles if s['new_skus'] == s['total_skus'] and s['total_skus'] > 0)
styles_with_new = sum(1 for s in styles if s['new_skus'] > 0)

# Unique leathers and colours (all SKUs)
all_leathers_all = defaultdict(int)
all_colours_all = defaultdict(int)
all_leathers_new = defaultdict(int)
all_colours_new = defaultdict(int)

for s in styles:
    for sku in s['skus']:
        l = sku['leather']
        c = sku['colour']
        if l:
            all_leathers_all[l] += 1
            if sku['is_new']:
                all_leathers_new[l] += 1
        all_colours_all[c] += 1
        if sku['is_new']:
            all_colours_new[c] += 1

# Category breakdown
cat_data = []
for cat in categories:
    cat_styles = [s for s in styles if s['category'] == cat]
    cat_total = sum(s['total_skus'] for s in cat_styles)
    cat_new = sum(s['new_skus'] for s in cat_styles)
    cat_existing = sum(s['existing_skus'] for s in cat_styles)
    cat_data.append({
        'category': cat,
        'totalStyles': len(cat_styles),
        'totalSKUs': cat_total,
        'newSKUs': cat_new,
        'existingSKUs': cat_existing,
        'pctNew': round(cat_new / cat_total * 100, 1) if cat_total > 0 else 0,
    })

# New SKU Expansion Analysis
# For new SKUs only: count how many styles each colour/leather appears in
colour_style_count = defaultdict(set)
leather_style_count = defaultdict(set)

for s in styles:
    for sku in s['skus']:
        if sku['is_new']:
            colour_style_count[sku['colour']].add(s['style'])
            if sku['leather']:
                leather_style_count[sku['leather']].add(s['style'])

def bucket(count):
    if count >= 10:
        return 'Well covered'
    elif count >= 5:
        return 'Good coverage'
    elif count >= 3:
        return 'Expand'
    else:
        return 'Priority expand'

def action(item_type, name, count):
    if count >= 10:
        return f'{name} is well represented across new SKUs — maintain current range'
    elif count >= 5:
        return f'{name} has good coverage — consider selective additions'
    elif count >= 3:
        return f'{name} has moderate coverage — expand to more styles'
    else:
        return f'{name} appears in very few new SKUs — prioritise adding to more styles'

colour_expansion = []
for colour, style_set in sorted(colour_style_count.items(), key=lambda x: -len(x[1])):
    count = len(style_set)
    colour_expansion.append({
        'name': colour,
        'styleCount': count,
        'bucket': bucket(count),
        'action': action('colour', colour, count),
    })

leather_expansion = []
for leather, style_set in sorted(leather_style_count.items(), key=lambda x: -len(x[1])):
    count = len(style_set)
    leather_expansion.append({
        'name': leather,
        'styleCount': count,
        'bucket': bucket(count),
        'action': action('leather', leather, count),
    })

# ============================================================
# STYLES TABLE DATA (simplified for the table view)
# ============================================================
styles_table = []
for s in styles:
    styles_table.append({
        'style': s['style'],
        'category': s['category'],
        'last': s['last'],
        'totalSKUs': s['total_skus'],
        'newSKUs': s['new_skus'],
        'existingSKUs': s['existing_skus'],
        'leathers': s['leathers'],
        'colours': s['colours'],
        'isAllNew': s['new_skus'] == s['total_skus'] and s['total_skus'] > 0,
        'hasNew': s['new_skus'] > 0,
        'imageUrl': cdn_urls.get(s['style'], None),
    })

# ============================================================
# RAW SKU ROWS (for export)
# ============================================================
raw_skus = []
for s in styles:
    for sku in s['skus']:
        raw_skus.append({
            'category': s['category'],
            'style': s['style'],
            'last': s['last'],
            'colour': sku['colour'],
            'leather': sku['leather'],
            'is_new': sku['is_new'],
        })

# ============================================================
# LEATHERS AND COLOURS TABS
# ============================================================
leathers_tab = []
for leather, count in sorted(all_leathers_all.items(), key=lambda x: -x[1]):
    leathers_tab.append({
        'name': leather,
        'allCount': count,
        'newCount': all_leathers_new.get(leather, 0),
    })

colours_tab = []
for colour, count in sorted(all_colours_all.items(), key=lambda x: -x[1]):
    colours_tab.append({
        'name': colour,
        'allCount': count,
        'newCount': all_colours_new.get(colour, 0),
    })

# ============================================================
# WRITE TYPESCRIPT DATA FILE
# ============================================================
output = {
    'summary': {
        'totalSKUs': total_skus,
        'newSKUs': new_skus,
        'existingSKUs': existing_skus,
        'totalStyles': total_styles,
        'brandNewStyles': brand_new_styles,
        'stylesWithNew': styles_with_new,
        'uniqueLeathers': len(all_leathers_all),
        'uniqueColours': len(all_colours_all),
    },
    'categories': cat_data,
    'styles': styles_table,
    'leathers': leathers_tab,
    'colours': colours_tab,
    'expansion': {
        'colours': colour_expansion,
        'leathers': leather_expansion,
    },
    'rawSkus': raw_skus,
}

ts_content = f"""// AUTO-GENERATED from PDF parse — do not edit manually
// Generated: SKU Analysis Dashboard Data

export const skuData = {json.dumps(output, indent=2)} as const;

export type SKUData = typeof skuData;
export type CategoryData = typeof skuData.categories[number];
export type StyleData = typeof skuData.styles[number];
export type LeatherData = typeof skuData.leathers[number];
export type ColourData = typeof skuData.colours[number];
export type ExpansionItem = typeof skuData.expansion.colours[number];
"""

with open('/home/ubuntu/sku-dashboard/client/src/lib/skuData.ts', 'w') as f:
    f.write(ts_content)

print("Generated skuData.ts successfully")
print(f"Summary: {output['summary']}")
print(f"Categories: {len(output['categories'])}")
print(f"Styles: {len(output['styles'])}")
print(f"Leathers: {len(output['leathers'])}")
print(f"Colours: {len(output['colours'])}")
print(f"Colour expansion items: {len(output['expansion']['colours'])}")
print(f"Leather expansion items: {len(output['expansion']['leathers'])}")
