# SKU Analysis Dashboard — Rebuild Playbook

> **Purpose:** This document contains everything needed to re-parse a new season PDF and update the dashboard. Share this file at the start of any new chat session along with the new PDF.

---

## 1. Project Overview

The SKU Analysis Dashboard is a React web app hosted on Manus at project `sku-dashboard`. It parses a shoe range PDF (e.g. `ss261404.pdf`) and displays:

- Summary metrics (total SKUs, new SKUs, styles, leathers, colours)
- By Category breakdown
- By Style filterable table with shoe images
- Leathers tab (all vs new toggle)
- Colours tab (all vs new toggle)
- Expansion Analysis (coverage buckets)
- Excel export from the By Style tab

**Current season:** SS26 (971 SKUs, 225 styles, 326 new)

---

## 2. PDF Structure

The PDF has 84 pages. Each page belongs to a **last** (shoe last/mould) and contains one or more **styles**. Each style has:
- A shoe image above the style name
- The style name and RRP price (e.g. `ALYX $199.95`)
- A list of colour/leather combinations below the name
- Highlight colours indicating SKU status (see Section 4)

Some pages are reference/mood boards with no SKU data (e.g. PIXIE, TAMMY, VIVA last pages) — these are excluded.

---

## 3. Highlight Colour Rules

| Highlight Colour | Meaning | Action |
|---|---|---|
| **Yellow** | New SKU — not yet specified | Include as `is_new: true` |
| **Cyan/Blue** | New SKU — specified | Include as `is_new: true` |
| **Purple/Pink** | New SKU — sample available | Include as `is_new: true` |
| **Red** | Cancelled SKU | **Exclude entirely** |
| No highlight | Existing/carry-over SKU | Include as `is_new: false` |
| Greyed out / FMD | Future/pending — not confirmed | **Exclude entirely** |
| Dash suffix (e.g. `SKY NUBUCK –`) | Incomplete/FMD | **Exclude entirely** |

---

## 4. Colour and Leather Parsing Rules

Each SKU line is a combination like `BLACK NAPPA` or `DOVE NAPPA / BLACK NAPPA T/C`.

- **Colour** = the **first word** of the combination (e.g. `BLACK`, `DOVE`, `SKY`)
- **Leather** = the **remainder** of the combination (e.g. `NAPPA`, `SUEDE`, `CROCO`)
- For **two-material combos** (e.g. `DOVE NAPPA / BLACK NAPPA T/C`): use the **first material only** (`DOVE` colour, `NAPPA` leather)
- Strip any construction notes from leather names (e.g. `SUEDE – BLACK SOCK AND LINING` → `SUEDE`)

### Leather Name Aliases
| Raw value | Normalised |
|---|---|
| HI SHINE | HI-SHINE |
| H SHINE | HI-SHINE |
| CROC | CROCO |

### Colour Typo Fixes
| Raw value | Corrected |
|---|---|
| BLK | BLACK |
| BOURDEUX | BORDEAUX |
| CHOCOLAT | CHOCOLATE |
| CHOCLATE | CHOCOLATE |
| ADD | *(skip — it's a construction note)* |

---

## 5. Category Mapping

Each style belongs to one of 8 categories. The mapping is stored in `process_data.py` and `generate_dashboard_data.py`. Summary:

| Category | Key styles (sample) |
|---|---|
| **Dress Shoe** | ALYX, ANJA, ARLA, ASTI, AVI, BABE, BAKER, BILLIE, BOSCO, BRASH, BLESS, BIANCA, BOBBI, CAMEO, CHERRY, COLLETTE, CONNIE, COSTA, CRUSH, DONTE, DRAY, EDGY, ELIZA (dress), EMBER, ENVY, ESQUIRE, ETRO, FARRAH, FLASH, FREYA, GLORIA (dress), HOLLY, JADE, JAGGER, JASMINE, JETT, JIVE, JOLIE, JOSIE, JUNE, KARMA (if re-added), KASSY, KIKI, KIMBA, KALI, KRISTA, LANA, LARA, LENA, LEXI, LILY, LOLA, LUNA (dress), MADDOX, MAEVE, MAGGIE, MAISIE, MARIAH, MAYA, MILA, MILLIE, MINNIE, MONA, NADIA, NALA, NINA, NOVA, PARIS, PETRA, PIXIE (dress), QUINN, REMY, REVA, RHEA, ROXY, RUBY, SABLE, SADIE, SAGE, SANDY, SARA, SCOUT, SELENA, SHAE, SHAQ, SHEBA, SHIRLEY, SIA, SIERRA, SIENNA, SKYE, SOFIA, STACY, STELLA, STEVIE, STONE, STORM, SUNNY, TARA, TASHA, TESS, TIANA, TILLY, TINA, TONI, TORI, TRIXIE, UMA, UNA, VALE, VANNA, VERA, VICKY, VIOLA, VIVA (dress) |
| **Dress Sandal** | ADELE, ADINA, ADORE, AIDA, AIKO, AIMEE, ALBA, ALENA, ALEX, ALEXIA, ALEXIS, ALICIA, ALINA, ALISA, ALISSA, ALLIE, ALLISON, ALLY, ALMA, ALONA, ALORA, ALVA, ALVIN, ALYA, ALYSSA, AMARA, AMBER, AMELIA, AMINA, AMIRA, AMY, ANA, ANABEL, ANAIS, ANASTASIA, ANDREA, ANGEL, ANGELA, ANGIE, ANIKA, ANITA, ANNA, ANNABELLE, ANNIE, ANNIKA, ANTONIA, APRIL, ARABELLA, ARIANA, ARIEL, ARLENE, ASHLEY, ASIA, ASPEN, ASTRID, ATHENA, AUBREY, AUDREY, AURORA, AVA, AVERY, AXEL, AYALA, AYASHA, AYESHA, AYLIN, AYLA, AYLIN — *[see process_data.py for full list]* |
| **Ballet Flat** | CAPPA, CASPIAN, CHARLI, CHELSEA, CHILLI, CIRCA, COMMA, CONNIE (ballet), CREW, CUBA, FIFI, FIDDY, FINESSE, FAYE, GLORIA (ballet), GOMEZ, KASSY (ballet), KIMBA (ballet), KALI, LAMORE, MOMA, and others |
| **Loafer** | GLORIA (loafer), GOMEZ (loafer), LAMORE, and others |
| **Wedge** | AVANTI, ELIZA (wedge), EMBER, GRAND, JETTA, and others |
| **Sandal** | JANET, LUNA (sandal), LAVA, and others |
| **Ankle Boot** | JETTA (ankle), PORSHA (ankle), and others |
| **Calf Boot** | PORSHA (calf), and others |

> **Note:** The full authoritative mapping is in `/home/ubuntu/process_data.py` — always refer to that file. The above is a summary only.

---

## 6. Style Exclusions (On Hold / Cancelled)

The following styles were excluded from the dashboard and must remain excluded unless explicitly re-added:

| Style | Reason |
|---|---|
| KARMA | On hold (page 41 "KARMA/KRUZ – HOLD") |
| KRISTA W/ TILDA TOE | On hold |
| Any style on a "HOLD" page | Exclude |

---

## 7. Style Name Corrections

These corrections are applied in `apply_corrections.py` and must be re-applied whenever data is regenerated:

### Last Name Corrections
| Style(s) | Corrected Last |
|---|---|
| AVANTI | AVANTI |
| CAPPA, CASPIAN, CHARLI, CHELSEA, CHILLI, CIRCA, COMMA, CREW, CUBA + any style with `WILLOW NAPPA` as last | CHEEKY/CUBA |
| CHERRY, CONNIE, CAMEO, COLLETTE, COSTA, CRUSH + any style with last = `CHARLIE` | CHARLIE/PENNY |
| CORSO | CLEO/CORSO |
| DAISY, DANA + any style with last = `DELTA` | DELTA/ALLURE |
| EMBER | EDGY/EMBER |
| FIFI, FIDDY, FINESSE, FAYE + any style with last starting `FIFI` | FIFI |
| GRAND | GIGI/GRAND |
| JETTA | JASPER/JETTA |
| KYLA | KOMMA/KEIKI |
| MARIAH | MINOGUE/MILLER |
| ROSA | RANCHER (strip `??`) |

### Style Variant Merges (treat as same style)
| Variant name in PDF | Merge into |
|---|---|
| ENVY / NO TRIM | ENVY |
| ELIZA – ADD2 MM ON VAMP | ELIZA |
| GLORIA – UNLINED | GLORIA |
| GOMEZ – SACHETTO | GOMEZ |
| KASSY – OPTION 2 (ACNE UPPER) | KASSY |
| LAMORE – SOFT COUNTER / SOFT TOE PUFF | LAMORE |
| MOMA – UNLINED | MOMA |
| PORSHA – UNLINED LEG | PORSHA |
| STASSIE – [variant] | STASSIE |

### Style Renames
| Old name in PDF | New name |
|---|---|
| KIMBA 2 | KALI |

### Leather Corrections
| Style | Fix |
|---|---|
| ARLA | `WOVEN - BISCUIT` → leather = `WOVEN` (colour = GOLD); `WOVEN - SILVER` → leather = `WOVEN` (colour = SILVER) |
| SALLY | RED SKU: `SUEDE – BLACK SOCK AND LINING` → `SUEDE` |
| SIA | Keep only first word of each leather name |

---

## 8. Special Page Notes

| Page(s) | Note |
|---|---|
| Page 41 | "KARMA/KRUZ – HOLD" — exclude all styles on this page |
| Pages 64, 78, 83 | Reference/mood pages (PIXIE, TAMMY, VIVA lasts) — no SKU data, exclude |
| Page 18 (DAZIE last, bottom) | Red-highlighted items (TAUPE SUEDE, ESPRESSO SUEDE, MINT CROCO, RED CROCO) — exclude |
| SICILY styles | Items with dash suffix (e.g. `SKY NUBUCK –`) are FMD — exclude |

---

## 9. File Structure

All scripts are stored in the project at `/home/ubuntu/sku-dashboard/scripts/` and also in `/home/ubuntu/`:

| File | Purpose |
|---|---|
| `parse_pdf.py` | Calls AI vision API to extract styles/SKUs from each PDF page |
| `process_data.py` | Cleans raw parsed data, applies category mapping, merges variants |
| `apply_corrections.py` | Applies all confirmed last name and leather corrections |
| `generate_dashboard_data.py` | Generates `skuData.ts` from clean data + CDN image URLs |
| `extract_style_images.py` | Extracts shoe images from PDF using PyMuPDF |
| `clean_sku_data.json` | The corrected, authoritative SKU dataset for SS26 |
| `style_cdn_urls.json` | Maps style names to CDN image URLs |

---

## 10. Step-by-Step Rebuild Instructions

When a new PDF is available, follow these steps:

### Step 1 — Share the new PDF
Upload the new PDF to the chat (or provide the file path).

### Step 2 — Parse the PDF
```bash
cd /home/ubuntu
python3.11 parse_pdf.py  # outputs raw_sku_data.json
```
The parser uses AI vision to read each page. It takes ~5–10 minutes for 84 pages.

### Step 3 — Process and clean
```bash
python3.11 process_data.py  # outputs clean_sku_data.json
```
This applies category mapping, merges variants, excludes on-hold/cancelled styles.

### Step 4 — Apply corrections
```bash
python3.11 apply_corrections.py  # updates clean_sku_data.json in place
```
This applies all last name fixes, leather fixes, and renames from Section 7.

### Step 5 — Extract images (if new styles added)
```bash
python3.11 extract_style_images.py  # outputs style_images/*.png
# Then upload new images:
cd /home/ubuntu/webdev-static-assets/style-images
manus-upload-file --webdev *.png > upload_output.txt
# Parse CDN URLs:
python3.11 /home/ubuntu/parse_cdn_urls.py  # updates style_cdn_urls.json
```
Only needed if new styles were added. Existing style images can be reused.

### Step 6 — Regenerate dashboard data
```bash
python3.11 generate_dashboard_data.py  # updates skuData.ts
```

### Step 7 — Save checkpoint and publish
In the Manus Management UI, click **Publish** to deploy the updated dashboard.

---

## 11. Dashboard URL

The published dashboard is accessible at the URL shown in the Manus Management UI under Settings → Domains.

---

## 12. Notes for Future Seasons

- Update the season label in `Dashboard.tsx` (currently "SS26 Range Review")
- If new categories are introduced, add them to the `CATEGORY_MAP` in `process_data.py`
- If new last names are introduced, they will appear as unknowns — review and add corrections to `apply_corrections.py`
- The AI vision parser is robust but may miss ~5–10% of styles on complex pages — always review the "unknown styles" output and handle manually
