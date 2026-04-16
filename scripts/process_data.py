#!/usr/bin/env python3
"""
Process the raw parsed SKU data applying all confirmed user decisions:
- New styles: DONTE, DRAY → Dress Shoe; JANET, LUNA, LAVA → Sandal
- KARMA, KRISTA W/ TILDA TOE → excluded (on hold)
- KIMBA 2 → renamed to KALI (Dress Sandal)
- Style variants merged into parent: ENVY/NO TRIM→ENVY, ELIZA–ADD2MM→ELIZA,
  GLORIA–UNLINED→GLORIA, GOMEZ–SACHETTO→GOMEZ, KASSY–OPTION 2→KASSY,
  LAMORE–SOFT COUNTER→LAMORE, MOMA–UNLINED→MOMA, PORSHA–UNLINED LEG→PORSHA
- Red highlights, FMD/greyed, dash-suffix items, reference pages → excluded
"""

import json
import re
from collections import defaultdict

# Load raw parsed data
with open('/home/ubuntu/parsed_sku_data.json') as f:
    raw_data = json.load(f)

# ============================================================
# CATEGORY MAPPINGS (from briefing notes + user confirmations)
# ============================================================
CATEGORY_MAP = {
    # Dress Shoe
    'ANJA': 'Dress Shoe', 'ALYX': 'Dress Shoe', 'ARLA': 'Dress Shoe', 'ASTI': 'Dress Shoe',
    'AVI': 'Dress Shoe', 'BABE': 'Dress Shoe', 'BAKER': 'Dress Shoe', 'BAZ': 'Dress Shoe',
    'BILLIE': 'Dress Shoe', 'BOHO': 'Dress Shoe', 'BREEZE': 'Dress Shoe', 'CAMEO': 'Dress Shoe',
    'CHERRY': 'Dress Shoe', 'COLLETTE': 'Dress Shoe', 'CONNIE': 'Dress Shoe', 'COSTA': 'Dress Shoe',
    'CRUSH': 'Dress Shoe', 'DARCY': 'Dress Shoe', 'DAZIE': 'Dress Shoe', 'DIXIE': 'Dress Shoe',
    'EMBLA': 'Dress Shoe', 'EMILY': 'Dress Shoe', 'ENVY': 'Dress Shoe', 'ESQUIRE': 'Dress Shoe',
    'ETRO': 'Dress Shoe', 'FENIX': 'Dress Shoe', 'FIFI': 'Dress Shoe', 'FINCH': 'Dress Shoe',
    'GLIDE': 'Dress Shoe', 'JAQ': 'Dress Shoe', 'JUNIPER': 'Dress Shoe', 'KIMCHI': 'Dress Shoe',
    'LEGACY': 'Dress Shoe', 'LEROUX': 'Dress Shoe', 'LILA': 'Dress Shoe', 'LILI': 'Dress Shoe',
    'LUCA': 'Dress Shoe', 'MADDI': 'Dress Shoe', 'MAXY': 'Dress Shoe', 'NELLIE': 'Dress Shoe',
    'NESSA': 'Dress Shoe', 'NESTA': 'Dress Shoe', 'NEXA': 'Dress Shoe', 'NIFTY': 'Dress Shoe',
    'NIKI': 'Dress Shoe', 'NINA': 'Dress Shoe', 'NONI': 'Dress Shoe', 'PALAIS': 'Dress Shoe',
    'PARIS': 'Dress Shoe', 'PENELOPE': 'Dress Shoe', 'PETA': 'Dress Shoe', 'PHOEBE': 'Dress Shoe',
    'PIPER': 'Dress Shoe', 'PRANCE': 'Dress Shoe', 'PRESH': 'Dress Shoe', 'SAKAI': 'Dress Shoe',
    'SAMAR': 'Dress Shoe', 'SARAH': 'Dress Shoe', 'SASSY': 'Dress Shoe', 'SAVANT': 'Dress Shoe',
    'SHAE': 'Dress Shoe', 'SIA': 'Dress Shoe', 'SICILY': 'Dress Shoe', 'SOPHIE': 'Dress Shoe',
    'SPOILT': 'Dress Shoe', 'STEVIE': 'Dress Shoe', 'SWEETIE': 'Dress Shoe',
    # Confirmed new Dress Shoe styles
    'DONTE': 'Dress Shoe', 'DRAY': 'Dress Shoe',
    # Dress Sandal
    'BLESS': 'Dress Sandal', 'CAPRICE': 'Dress Sandal', 'CHICAGO': 'Dress Sandal',
    'CORSO': 'Dress Sandal', 'DAISY': 'Dress Sandal', 'DANA': 'Dress Sandal',
    'DEMURE': 'Dress Sandal', 'DIMA': 'Dress Sandal', 'DIXON': 'Dress Sandal',
    'DOLLI': 'Dress Sandal', 'DYNASTY': 'Dress Sandal', 'FARRAH': 'Dress Sandal',
    'FLASH': 'Dress Sandal', 'FLUKE': 'Dress Sandal', 'FREYA': 'Dress Sandal',
    'HAILEY': 'Dress Sandal', 'HALLIE': 'Dress Sandal', 'HYPE': 'Dress Sandal',
    'JANE': 'Dress Sandal', 'JAYDE': 'Dress Sandal', 'JOELLE': 'Dress Sandal',
    'JOSS': 'Dress Sandal', 'KASSY': 'Dress Sandal', 'KERI': 'Dress Sandal',
    'KIMBA': 'Dress Sandal', 'KIMA': 'Dress Sandal', 'KRISTA': 'Dress Sandal',
    'KYLA': 'Dress Sandal', 'LIA': 'Dress Sandal', 'LUANA': 'Dress Sandal',
    'LUCY': 'Dress Sandal', 'MALIBU': 'Dress Sandal', 'MARAMEO': 'Dress Sandal',
    'MARCEL': 'Dress Sandal', 'MARCY': 'Dress Sandal', 'MARIAH': 'Dress Sandal',
    'MARLEY': 'Dress Sandal', 'MATRIX': 'Dress Sandal', 'MAXOS': 'Dress Sandal',
    'METRO': 'Dress Sandal', 'MILEY': 'Dress Sandal', 'MIXA': 'Dress Sandal',
    'MOLLY': 'Dress Sandal', 'ROBBIE': 'Dress Sandal', 'ROSA': 'Dress Sandal',
    'ROXTA': 'Dress Sandal', 'SAGE': 'Dress Sandal', 'SAINT': 'Dress Sandal',
    'SEZ': 'Dress Sandal', 'SILVIA': 'Dress Sandal', 'SKYE': 'Dress Sandal',
    'SOFIA': 'Dress Sandal', 'STARR': 'Dress Sandal', 'STASSIE': 'Dress Sandal',
    'SUNNY': 'Dress Sandal', 'SWAY': 'Dress Sandal', 'TIANA': 'Dress Sandal',
    'TILDA': 'Dress Sandal', 'TOPAZ': 'Dress Sandal', 'TREVI': 'Dress Sandal',
    'TROPIC': 'Dress Sandal', 'TUSCANY': 'Dress Sandal', 'VICTORIA': 'Dress Sandal',
    'VIOLET': 'Dress Sandal', 'SANDRA': 'Dress Sandal',
    # KIMBA 2 is now KALI (confirmed by user)
    'KALI': 'Dress Sandal',
    # Ballet Flat
    'BAMBI': 'Ballet Flat', 'BETTINA': 'Ballet Flat', 'BIANCA': 'Ballet Flat',
    'BOBBI': 'Ballet Flat', 'BOSCO': 'Ballet Flat', 'BRASH': 'Ballet Flat',
    'CAMILLE': 'Ballet Flat', 'CAPPA': 'Ballet Flat', 'CAPPI': 'Ballet Flat',
    'CARLA': 'Ballet Flat', 'CASPIAN': 'Ballet Flat', 'CELESTE': 'Ballet Flat',
    'CHARLI': 'Ballet Flat', 'CHEEKY': 'Ballet Flat', 'CHELSEA': 'Ballet Flat',
    'CHILLI': 'Ballet Flat', 'CIRCA': 'Ballet Flat', 'CITY': 'Ballet Flat',
    'CLOVER': 'Ballet Flat', 'COMMA': 'Ballet Flat', 'CUBA': 'Ballet Flat',
    'CURIOUS': 'Ballet Flat', 'JAVIER': 'Ballet Flat', 'JESSE': 'Ballet Flat',
    'JOOP': 'Ballet Flat', 'MAMZELLE': 'Ballet Flat', 'MARTINEZ': 'Ballet Flat',
    'MAZEY': 'Ballet Flat', 'MOMA': 'Ballet Flat', 'ROBYN': 'Ballet Flat',
    'RORY': 'Ballet Flat', 'ROXIE': 'Ballet Flat', 'SAMMY': 'Ballet Flat',
    # Loafer
    'CREW': 'Loafer', 'ERES': 'Loafer', 'EVIE': 'Loafer', 'GATSBY': 'Loafer',
    'GEZZA': 'Loafer', 'GIGI': 'Loafer', 'GLACIER': 'Loafer', 'GLORIA': 'Loafer',
    'GOMEZ': 'Loafer', 'GRAND': 'Loafer', 'LAMORE': 'Loafer', 'LIBBY': 'Loafer',
    'LONDON': 'Loafer', 'LUXURY': 'Loafer', 'VIN': 'Loafer', 'VIXEN': 'Loafer',
    'ZAC': 'Loafer', 'ZEPHYR': 'Loafer', 'ZOE': 'Loafer',
    # Wedge
    'AVANTI': 'Wedge', 'EDGY': 'Wedge', 'ELIZA': 'Wedge', 'EMBER': 'Wedge',
    'HARLEY': 'Wedge', 'HILTON': 'Wedge', 'MATISSE': 'Wedge', 'MILAN': 'Wedge',
    'MINTY': 'Wedge', 'MISTY': 'Wedge', 'SALLY': 'Wedge', 'SWIFT': 'Wedge',
    'VAMORE': 'Wedge', 'VALERIE': 'Wedge', 'VILLA': 'Wedge', 'VOGUE': 'Wedge',
    'VOLLI': 'Wedge',
    # Sandal
    'BLAIRE': 'Sandal', 'ISABEL': 'Sandal', 'IVES': 'Sandal', 'JAGGER': 'Sandal',
    'JASPER': 'Sandal', 'JAZZY': 'Sandal', 'JERRY': 'Sandal', 'JETT': 'Sandal',
    'JETTA': 'Sandal', 'JOKER': 'Sandal', 'KAILA': 'Sandal', 'KYRA': 'Sandal',
    'LOOP': 'Sandal', 'LUCIE': 'Sandal',
    # Confirmed new Sandal styles
    'JANET': 'Sandal', 'LUNA': 'Sandal', 'LAVA': 'Sandal',
    # Ankle Boot
    'FAVE': 'Ankle Boot', 'FAYE': 'Ankle Boot', 'FIDDY': 'Ankle Boot',
    # Calf Boot
    'FINESSE': 'Calf Boot', 'NAXOS': 'Calf Boot', 'PORSHA': 'Calf Boot',
    'SHAQ': 'Calf Boot', 'SHEBA': 'Calf Boot',
}

# Style variants → merge into parent style name
# Key = raw style name (after basic clean), Value = canonical style name
VARIANT_MAP = {
    'ENVY / NO TRIM': 'ENVY',
    'ENVY/NO TRIM': 'ENVY',
    'ELIZA – ADD2 MM ON VAMP': 'ELIZA',
    'ELIZA – ADD 2 MM ON VAMP': 'ELIZA',
    'ELIZA - ADD2 MM ON VAMP': 'ELIZA',
    'GLORIA – UNLINED': 'GLORIA',
    'GLORIA - UNLINED': 'GLORIA',
    'GLORIA – UNLINED': 'GLORIA',
    'GOMEZ – SACHETTO': 'GOMEZ',
    'GOMEZ - SACHETTO': 'GOMEZ',
    'KASSY – OPTION 2 (ACNE UPPER)': 'KASSY',
    'KASSY - OPTION 2 (ACNE UPPER)': 'KASSY',
    'KASSY – OPTION 2': 'KASSY',
    'LAMORE – SOFT COUNTER / SOFT TOE PUFF': 'LAMORE',
    'LAMORE - SOFT COUNTER / SOFT TOE PUFF': 'LAMORE',
    'LAMORE – SOFT COUNTER': 'LAMORE',
    'MOMA – UNLINED': 'MOMA',
    'MOMA - UNLINED': 'MOMA',
    'PORSHA – UNLINED LEG': 'PORSHA',
    'PORSHA - UNLINED LEG': 'PORSHA',
    # KIMBA 2 → KALI (user confirmed)
    'KIMBA 2': 'KALI',
    # SARAH variant
    'SARAH – PLAIN MULE WITH T/C AS YSL': 'SARAH',
    'SARAH - PLAIN MULE WITH T/C AS YSL': 'SARAH',
    # LAVA variant
    'LAVA – JAZZY UPPER': 'LAVA',
    'LAVA - JAZZY UPPER': 'LAVA',
    'LAVA – JAZZY UPPER MAKE UPPER SOFT': 'LAVA',
    # STASSIE variant
    'STASSIE – REDUCE BOW BY 20%': 'STASSIE',
    'STASSIE - REDUCE BOW BY 20%': 'STASSIE',
    'STASSIE – REDUCE BOW': 'STASSIE',
}

# Styles to EXCLUDE entirely (on hold, reference, brand names)
EXCLUDE_STYLES = {
    'KARMA',           # on hold
    'KRISTA W/ TILDA TOE',  # on hold
    'KRISTA W/TILDA TOE',   # on hold variant
    # Reference/brand labels
    'DELIA', 'PIXIE', 'THE ROW', 'KHAITE', 'REPETTO', 'PRADA',
    'JEFFREY CAMPBELL', 'KIVRA SANDAL JEFFREY CAMPBELL',
    'CHRISTIAN LOUBOUTIN JANOTONGA LEATHER SANDALS', 'CHRISTIAN LOUBOUTIN',
    'METALLICS NAPPAS', 'POSSIBLE ADD', 'LEOLA',
    # Size/note labels
    'SIZES 36-41', 'SIZE 11', 'HEEL HEIGHT',
}

# Pages to EXCLUDE entirely (reference/inspiration pages)
EXCLUDE_PAGES = {83, 64, 78}


def normalize_style(raw_name):
    """Normalize a raw style name: clean, check variant map, return canonical name."""
    if not raw_name:
        return None
    name = raw_name.strip()
    # Check variant map first (before uppercasing to preserve dash variants)
    name_upper = name.upper()
    for variant_key, canonical in VARIANT_MAP.items():
        if name_upper == variant_key.upper():
            return canonical
    # General cleaning
    name = name_upper
    # Remove trailing notes after common separators
    # But be careful not to strip things like "ENVY / NO TRIM" before variant check
    # Remove price patterns
    name = re.sub(r'\s*\$?\d+\.\d{2}\s*$', '', name).strip()
    # Remove trailing dashes
    name = name.rstrip(' –-').strip()
    return name if name else None


def parse_colour_leather(colour_leather_str):
    """
    Parse colour and leather from a combined string.
    Rules:
    - Colour = first word
    - Leather = remainder
    - For two-material combos → use first material only
    - Exclude items ending with dash (FMD/pending)
    - Exclude red-highlighted items (already filtered at parse stage)
    """
    s = colour_leather_str.strip()
    if not s:
        return None, None
    # Remove © symbol
    s = s.replace('©', '').strip()
    # Exclude items ending with dash (FMD/pending indicator)
    if re.search(r'\s*[–-]\s*$', s):
        return None, None
    # Exclude items ending with "FMD" or "– FMD"
    if re.search(r'\bFMD\b', s, re.IGNORECASE):
        return None, None

    # Handle two-material combos: use first material only
    if ' / ' in s:
        s = s.split(' / ')[0].strip()
    elif '/' in s and not s.startswith('/'):
        s = s.split('/')[0].strip()

    # Remove (V) variant notation
    s = re.sub(r'\s*\(V\)\s*$', '', s).strip()
    # Remove T/C notation at end
    s = re.sub(r'\s*T/C\s*$', '', s).strip()
    # Remove trailing dashes again after cleaning
    s = s.rstrip(' –-').strip()

    parts = s.split()
    if not parts:
        return None, None

    colour = parts[0].upper()
    leather = ' '.join(parts[1:]).upper() if len(parts) > 1 else ''

    # Skip if colour looks like a note/label
    skip_words = {'POSSIBLE', 'METALLICS', 'NAPPAS', 'FULL', 'SIZE', 'HEEL',
                  'WEDGE', 'SIZES', 'INSOLE', 'SOLE', 'MAKE', 'SEEMS'}
    if colour in skip_words:
        return None, None

    # Skip very short or obviously wrong entries
    if len(colour) < 2:
        return None, None

    return colour, leather


# ============================================================
# PROCESS DATA
# ============================================================
styles_data = []
unknown_styles = []

for page in raw_data:
    page_num = page.get('page', 0)

    # Skip excluded pages
    if page_num in EXCLUDE_PAGES:
        continue

    last_name = page.get('last_name', '') or ''
    # Clean last name
    last_clean = last_name.split('–')[0].split('/')[0].strip().upper()
    if last_clean.startswith('LAST -') or last_clean.startswith('LAST-'):
        last_clean = last_clean.replace('LAST -', '').replace('LAST-', '').strip()
    last_clean = last_clean.rstrip(' –-').strip()

    for style_entry in page.get('styles', []):
        raw_style_name = style_entry.get('style', '') or ''

        # Normalize style name (handles variants)
        style_name = normalize_style(raw_style_name)
        if not style_name:
            continue

        # Skip excluded styles
        if style_name in EXCLUDE_STYLES:
            continue
        # Also check raw name against exclusions
        if raw_style_name.strip().upper() in EXCLUDE_STYLES:
            continue

        # Parse SKUs
        skus = []
        for sku in style_entry.get('skus', []):
            cl = sku.get('colour_leather', '') or ''
            is_new = sku.get('is_new', False)

            colour, leather = parse_colour_leather(cl)
            if colour is None:
                continue

            skus.append({
                'colour_leather': f"{colour} {leather}".strip(),
                'colour': colour,
                'leather': leather,
                'is_new': is_new
            })

        if not skus:
            continue

        # Look up category
        category = CATEGORY_MAP.get(style_name)
        if category is None:
            unknown_styles.append({
                'style': style_name,
                'raw_style': raw_style_name,
                'last': last_clean,
                'page': page_num,
                'sku_count': len(skus),
                'new_count': sum(1 for s in skus if s['is_new']),
                'sample_skus': [s['colour_leather'] for s in skus[:3]]
            })

        styles_data.append({
            'style': style_name,
            'last': last_clean,
            'page': page_num,
            'category': category,
            'skus': skus,
        })

# ============================================================
# DEDUPLICATE: merge same style from multiple pages
# ============================================================
style_merged = defaultdict(lambda: {
    'style': '', 'last': '', 'page': 0, 'category': None, 'skus': []
})

for entry in styles_data:
    key = entry['style']
    if not style_merged[key]['style']:
        style_merged[key]['style'] = entry['style']
        style_merged[key]['last'] = entry['last']
        style_merged[key]['page'] = entry['page']
        style_merged[key]['category'] = entry['category']
    # Merge SKUs (avoid exact duplicates by colour_leather)
    existing_cls = {s['colour_leather'] for s in style_merged[key]['skus']}
    for sku in entry['skus']:
        if sku['colour_leather'] not in existing_cls:
            style_merged[key]['skus'].append(sku)
            existing_cls.add(sku['colour_leather'])

# Recalculate totals and extract leathers/colours
final_styles = []
for key, entry in style_merged.items():
    skus = entry['skus']
    entry['total_skus'] = len(skus)
    entry['new_skus'] = sum(1 for s in skus if s['is_new'])
    entry['existing_skus'] = sum(1 for s in skus if not s['is_new'])
    entry['leathers'] = sorted(set(s['leather'] for s in skus if s['leather']))
    entry['colours'] = sorted(set(s['colour'] for s in skus))
    final_styles.append(entry)

# Sort by style name
final_styles.sort(key=lambda x: x['style'])

# ============================================================
# SAVE RESULTS
# ============================================================
with open('/home/ubuntu/clean_sku_data.json', 'w') as f:
    json.dump(final_styles, f, indent=2)

with open('/home/ubuntu/unknown_styles.json', 'w') as f:
    json.dump(unknown_styles, f, indent=2)

# ============================================================
# PRINT SUMMARY
# ============================================================
print(f"Total styles (after dedup): {len(final_styles)}")
print(f"Styles with unknown category: {len([s for s in final_styles if not s['category']])}")
print()

total_skus = sum(s['total_skus'] for s in final_styles)
total_new = sum(s['new_skus'] for s in final_styles)
total_existing = sum(s['existing_skus'] for s in final_styles)
print(f"Total SKUs: {total_skus}")
print(f"New SKUs: {total_new}")
print(f"Existing SKUs: {total_existing}")
print()

# Category breakdown
from collections import Counter
cat_counts = Counter(s['category'] for s in final_styles if s['category'])
print("By category:")
for cat, count in sorted(cat_counts.items()):
    cat_styles = [s for s in final_styles if s['category'] == cat]
    cat_skus = sum(s['total_skus'] for s in cat_styles)
    cat_new = sum(s['new_skus'] for s in cat_styles)
    print(f"  {cat:15s}: {count:3d} styles, {cat_skus:4d} SKUs, {cat_new:3d} new")

print()
unknown_with_skus = [s for s in final_styles if not s['category']]
if unknown_with_skus:
    print("REMAINING UNKNOWN STYLES (need category assignment):")
    for us in unknown_with_skus:
        print(f"  Style: {us['style']:30s} | Last: {us['last'][:15]:15s} | SKUs: {us['total_skus']:3d} | New: {us['new_skus']:3d}")
        for sku in us['skus'][:3]:
            print(f"    {sku['colour_leather']}")
else:
    print("All styles have been assigned a category.")
