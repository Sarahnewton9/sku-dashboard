"""
Extract shoe images from the PDF, matching each image to its style name.

Improved strategy:
- For each image on a page, find the closest text block that contains a known style name
- Search both above AND below the image
- Handle dollar sign prices, plain prices, and style names without prices
- Use a scoring system: prefer closer matches, prefer exact style name matches
"""
import fitz  # pymupdf
import json
import re
from pathlib import Path
from PIL import Image
import io

# Load the processed SKU data to get all known style names
with open("/home/ubuntu/clean_sku_data.json") as f:
    processed = json.load(f)  # list of style objects

# Build a set of all canonical style names (uppercase)
all_styles = set()
for style_obj in processed:
    all_styles.add(style_obj["style"].upper())

print(f"Total canonical styles: {len(all_styles)}")

# Output directory
out_dir = Path("/home/ubuntu/style_images")
out_dir.mkdir(exist_ok=True)

pdf_path = "/home/ubuntu/upload/ss261404.pdf"
doc = fitz.open(pdf_path)

# Variant map: PDF style names → canonical style names
VARIANT_MAP = {
    "ENVY / NO TRIM": "ENVY",
    "ENVY/NO TRIM": "ENVY",
    "ELIZA – ADD2 MM ON VAMP": "ELIZA",
    "ELIZA - ADD2 MM ON VAMP": "ELIZA",
    "GLORIA – UNLINED": "GLORIA",
    "GLORIA - UNLINED": "GLORIA",
    "GOMEZ – SACHETTO": "GOMEZ",
    "GOMEZ - SACHETTO": "GOMEZ",
    "KASSY – OPTION 2 (ACNE UPPER)": "KASSY",
    "KASSY - OPTION 2 (ACNE UPPER)": "KASSY",
    "KASSY OPTION 2": "KASSY",
    "LAMORE – SOFT COUNTER / SOFT TOE PUFF": "LAMORE",
    "LAMORE - SOFT COUNTER / SOFT TOE PUFF": "LAMORE",
    "MOMA – UNLINED": "MOMA",
    "MOMA - UNLINED": "MOMA",
    "PORSHA – UNLINED LEG": "PORSHA",
    "PORSHA - UNLINED LEG": "PORSHA",
    "STASSIE – OPTION 2": "STASSIE",
    "STASSIE - OPTION 2": "STASSIE",
    "KIMBA 2": "KALI",
    "KRISTA W/ TILDA TOE": None,
    "KARMA": None,
}

# Pages to skip (reference/mood pages, 1-indexed)
SKIP_PAGES = {41, 63, 64, 77, 78, 82, 83}

def clean_style_name(raw: str) -> str:
    """Remove price and other suffixes from a style name candidate."""
    raw = raw.strip()
    # Remove dollar price: "BLAIRE $179.95" → "BLAIRE"
    raw = re.sub(r'\s*\$\d+[\.\d]*.*$', '', raw).strip()
    # Remove plain price: "AVI 189.95" → "AVI"
    raw = re.sub(r'\s+\d{2,3}[\.\d]*$', '', raw).strip()
    # Remove "LAST -" prefix
    raw = re.sub(r'^LAST\s*[-–]\s*', '', raw, flags=re.IGNORECASE).strip()
    # Remove " – SIZE XX" suffix
    raw = re.sub(r'\s*[-–]\s*SIZE\s+\d+.*$', '', raw, flags=re.IGNORECASE).strip()
    return raw

def extract_first_word_candidates(text: str) -> list[str]:
    """Get candidate style names from text - first word, first two words, etc."""
    text = text.strip()
    candidates = []
    # Full cleaned text
    cleaned = clean_style_name(text)
    candidates.append(cleaned)
    # First word only
    first_word = text.split()[0] if text.split() else ""
    candidates.append(first_word)
    # First two words
    words = text.split()
    if len(words) >= 2:
        candidates.append(words[0] + " " + words[1])
    return [c for c in candidates if c]

def normalize_style_name(raw: str) -> str | None:
    """Normalize a raw style name from PDF text to canonical form."""
    raw = raw.strip().upper()
    if not raw:
        return None
    # Check variant map first
    if raw in VARIANT_MAP:
        return VARIANT_MAP[raw]
    # Check if it's a known style
    if raw in all_styles:
        return raw
    # Try stripping trailing notes after dash/slash
    for sep in [' – ', ' - ', ' / ']:
        if sep in raw:
            base = raw.split(sep)[0].strip()
            if base in VARIANT_MAP:
                return VARIANT_MAP[base]
            if base in all_styles:
                return base
    return None

def find_style_in_text(text: str) -> str | None:
    """Try to find a canonical style name in a text block."""
    candidates = extract_first_word_candidates(text)
    for c in candidates:
        result = normalize_style_name(c)
        if result is not None:
            return result
    return None

def extract_image_bytes(doc, xref):
    """Extract image bytes from PDF xref, return as PNG bytes."""
    img_dict = doc.extract_image(xref)
    img_bytes = img_dict["image"]
    ext = img_dict["ext"]
    if ext.lower() == "png":
        return img_bytes
    # Convert to PNG
    pil_img = Image.open(io.BytesIO(img_bytes))
    buf = io.BytesIO()
    pil_img.save(buf, "PNG")
    return buf.getvalue()

# Track which styles we've already extracted (take first occurrence)
extracted = {}
unmatched_images = []

total_pages = len(doc)
print(f"Processing {total_pages} pages...")

for page_num in range(total_pages):
    page_1indexed = page_num + 1
    if page_1indexed in SKIP_PAGES:
        continue
    
    page = doc[page_num]
    
    # Get all images with their positions
    images = page.get_images(full=True)
    if not images:
        continue
    
    # Get image positions
    img_positions = []
    for img in images:
        xref = img[0]
        rects = page.get_image_rects(xref)
        if rects:
            rect = rects[0]
            w = rect.x1 - rect.x0
            h = rect.y1 - rect.y0
            # Skip tiny images (logos, icons) - must be at least 40x40
            if w < 40 or h < 40:
                continue
            img_positions.append({
                "xref": xref,
                "rect": rect,
                "x0": rect.x0, "y0": rect.y0,
                "x1": rect.x1, "y1": rect.y1,
                "cx": (rect.x0 + rect.x1) / 2,
                "cy": (rect.y0 + rect.y1) / 2,
                "width": w,
                "height": h,
            })
    
    if not img_positions:
        continue
    
    # Get all text blocks
    blocks = page.get_text("dict")["blocks"]
    text_blocks = []
    for b in blocks:
        if b["type"] != 0:
            continue
        lines_text = []
        for line in b["lines"]:
            for span in line["spans"]:
                lines_text.append(span["text"].strip())
        full_text = " ".join(lines_text).strip()
        if not full_text:
            continue
        text_blocks.append({
            "bbox": b["bbox"],
            "text": full_text,
            "x0": b["bbox"][0], "y0": b["bbox"][1],
            "x1": b["bbox"][2], "y1": b["bbox"][3],
            "cx": (b["bbox"][0] + b["bbox"][2]) / 2,
        })
    
    # For each image, find the best matching style name text block
    for img_info in img_positions:
        img_cx = img_info["cx"]
        img_x0 = img_info["x0"]
        img_x1 = img_info["x1"]
        img_y0 = img_info["y0"]
        img_y1 = img_info["y1"]
        img_width = img_info["width"]
        
        # Horizontal tolerance: 60% of image width on each side
        x_tolerance = max(img_width * 0.6, 40)
        
        best_style = None
        best_score = float('inf')  # lower is better
        
        for tb in text_blocks:
            # Must be horizontally aligned
            if tb["cx"] < img_x0 - x_tolerance or tb["cx"] > img_x1 + x_tolerance:
                continue
            
            # Try to find a style name in this text block
            style = find_style_in_text(tb["text"])
            if style is None:
                continue
            
            # Calculate distance score using combined vertical + horizontal distance
            # Horizontal offset: how far the text center is from the image center
            h_offset = abs(tb["cx"] - img_cx)
            
            # Below the image: distance from image bottom to text top
            if tb["y0"] >= img_y1 - 5:
                v_dist = tb["y0"] - img_y1
                # Combined score: vertical distance + small horizontal penalty
                score = v_dist + h_offset * 0.3
            # Above the image: distance from text bottom to image top
            elif tb["y1"] <= img_y0 + 5:
                v_dist = img_y0 - tb["y1"]
                score = v_dist + h_offset * 0.3 + 5  # slight penalty for above
            else:
                # Overlapping - skip
                continue
            
            # Max vertical distance: 100 points
            if v_dist > 100:
                continue
            
            if score < best_score:
                best_score = score
                best_style = style
        
        if best_style is None:
            unmatched_images.append({
                "page": page_1indexed,
                "img": {"x0": round(img_info["x0"],1), "y0": round(img_info["y0"],1),
                        "x1": round(img_info["x1"],1), "y1": round(img_info["y1"],1)},
            })
            continue
        
        # Skip excluded styles (None in variant map)
        if best_style is None:
            continue
        
        # Only extract first occurrence of each style
        if best_style in extracted:
            continue
        
        # Extract the image
        try:
            png_bytes = extract_image_bytes(doc, img_info["xref"])
            out_path = out_dir / f"{best_style}.png"
            with open(str(out_path), "wb") as f:
                f.write(png_bytes)
            extracted[best_style] = str(out_path)
        except Exception as e:
            print(f"  ERROR extracting {best_style} on page {page_1indexed}: {e}")

doc.close()

print(f"\n=== Results ===")
print(f"Successfully extracted: {len(extracted)} styles")
print(f"Unmatched images: {len(unmatched_images)}")

# Which styles are missing?
missing = all_styles - set(extracted.keys())
print(f"Styles without images: {len(missing)}")
if missing:
    print("  Missing:", sorted(missing))

# Save mapping
with open("/home/ubuntu/style_image_map.json", "w") as f:
    json.dump(extracted, f, indent=2)
print(f"\nImage map saved to style_image_map.json")
