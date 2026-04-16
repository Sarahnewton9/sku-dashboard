#!/usr/bin/env python3
"""
Apply all confirmed data corrections to clean_sku_data.json
"""
import json

with open('/home/ubuntu/clean_sku_data.json') as f:
    styles = json.load(f)

corrections_applied = []

for s in styles:
    name = s['style']
    original_last = s['last']

    # ── LAST NAME CORRECTIONS ──────────────────────────────────────────────

    # AVANTI: remove size note, last = AVANTI
    if name == 'AVANTI':
        s['last'] = 'AVANTI'

    # WILLOW NAPPA → CHEEKY/CUBA
    elif s['last'] and 'WILLOW' in s['last'].upper():
        s['last'] = 'CHEEKY/CUBA'

    # CHARLIE (without PENNY) → CHARLIE/PENNY
    elif s['last'] and s['last'].upper().strip() == 'CHARLIE':
        s['last'] = 'CHARLIE/PENNY'

    # CORSO: CLEO → CLEO/CORSO
    elif name == 'CORSO' and s['last'] and 'CLEO' in s['last'].upper():
        s['last'] = 'CLEO/CORSO'

    # DELTA last (DAISY, DANA): DELTA → DELTA/ALLURE
    elif s['last'] and s['last'].upper().strip() == 'DELTA':
        s['last'] = 'DELTA/ALLURE'

    # EMBER last: EMBER → EDGY/EMBER
    elif name == 'EMBER' and s['last'] and s['last'].upper().strip() == 'EMBER':
        s['last'] = 'EDGY/EMBER'

    # FIFI 5-9 → FIFI (FIFI, FIDDY, FINESSE, FAYE)
    elif s['last'] and s['last'].upper().startswith('FIFI'):
        s['last'] = 'FIFI'

    # GRAND: GIGI → GIGI/GRAND
    elif name == 'GRAND' and s['last'] and s['last'].upper().strip() == 'GIGI':
        s['last'] = 'GIGI/GRAND'

    # JETTA: SIZES 36-41 → JASPER/JETTA
    elif name == 'JETTA':
        s['last'] = 'JASPER/JETTA'

    # KYLA: KOMMA → KOMMA/KEIKI
    elif name == 'KYLA' and s['last'] and 'KOMMA' in s['last'].upper():
        s['last'] = 'KOMMA/KEIKI'

    # MARIAH: MINOGUE → MINOGUE/MILLER
    elif name == 'MARIAH' and s['last'] and 'MINOGUE' in s['last'].upper():
        s['last'] = 'MINOGUE/MILLER'

    # ROSA: RANCHER ?? → RANCHER
    elif name == 'ROSA' and s['last'] and '??' in s['last']:
        s['last'] = 'RANCHER'

    if s['last'] != original_last:
        corrections_applied.append(f"  {name}: last '{original_last}' → '{s['last']}'")

    # ── SKU / LEATHER CORRECTIONS ──────────────────────────────────────────

    # ARLA: WOVEN - BISCUIT → WOVEN (colour=GOLD), WOVEN - SILVER → WOVEN (colour=SILVER)
    if name == 'ARLA':
        for sku in s['skus']:
            if 'WOVEN' in (sku['leather'] or '').upper():
                old_leather = sku['leather']
                sku['leather'] = 'WOVEN'
                corrections_applied.append(f"  ARLA sku colour={sku['colour']}: leather '{old_leather}' → 'WOVEN'")

    # SALLY: strip extra text from RED SUEDE row
    if name == 'SALLY':
        for sku in s['skus']:
            if sku['colour'] == 'RED' and sku['leather'] and '–' in sku['leather']:
                old_leather = sku['leather']
                sku['leather'] = 'SUEDE'
                corrections_applied.append(f"  SALLY RED sku: leather '{old_leather}' → 'SUEDE'")

    # SIA: keep only first word of leather (already clean from inspection, but apply defensively)
    if name == 'SIA':
        for sku in s['skus']:
            if sku['leather']:
                first_word = sku['leather'].split()[0]
                if first_word != sku['leather']:
                    old_leather = sku['leather']
                    sku['leather'] = first_word
                    corrections_applied.append(f"  SIA sku colour={sku['colour']}: leather '{old_leather}' → '{first_word}'")

    # Recompute aggregates for this style
    s['leathers'] = sorted(set(sku['leather'] for sku in s['skus'] if sku['leather']))
    s['colours'] = sorted(set(sku['colour'] for sku in s['skus']))
    s['total_skus'] = len(s['skus'])
    s['new_skus'] = sum(1 for sku in s['skus'] if sku['is_new'])
    s['existing_skus'] = sum(1 for sku in s['skus'] if not sku['is_new'])

print(f"Applied {len(corrections_applied)} corrections:")
for c in corrections_applied:
    print(c)

# Save corrected data
with open('/home/ubuntu/clean_sku_data.json', 'w') as f:
    json.dump(styles, f, indent=2)

print("\nSaved corrected clean_sku_data.json")
