#!/usr/bin/env python3
"""
Parse all 84 pages of the shoe range PDF using OpenAI vision API.
Each page is a PNG image. We send each to GPT-4 vision to extract:
- Last name (top-left, red highlight)
- Style names and their colour/leather SKUs
- Whether each SKU is highlighted (new) or not (existing)
"""

import os
import json
import base64
import time
from openai import OpenAI

client = OpenAI()

PDF_PAGES_DIR = "/home/ubuntu/pdf_pages"
OUTPUT_FILE = "/home/ubuntu/parsed_sku_data.json"

def encode_image(image_path):
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def parse_page(image_path, page_num):
    """Send a page image to GPT-4 vision and extract structured SKU data."""
    b64 = encode_image(image_path)
    
    prompt = """You are analyzing a shoe range line sheet page. Please extract ALL information from this page.

INSTRUCTIONS:
1. Find the LAST NAME — it appears in the TOP LEFT corner, highlighted in RED. This is the shoe last/construction base name.
2. Find all STYLE NAMES — these are the style titles (e.g. ANJA, ALYX, ASTI). Each style has a price next to it.
3. For each style, list ALL colour/leather combinations beneath it.
4. For each colour/leather, determine if it is HIGHLIGHTED (new SKU) or NOT HIGHLIGHTED (existing SKU).
   - Highlighted colours: yellow background, cyan/blue background, or purple/pink background = NEW
   - No highlight / plain white/black text = EXISTING
   - Greyed out text = IGNORE (do not include)
   - Items marked FMD = IGNORE (do not include)
5. If a colour/leather has the © symbol, just include it without the © in the name.
6. If a style has a "FULL SIZE ONLY" or similar note, ignore that note.

IMPORTANT: 
- The LAST NAME (red highlighted top-left) is NOT a style — do not include it as a style.
- However, sometimes the last name matches a style name that also appears in the style list — include it only if it appears as a style with its own colour list.
- Return ONLY valid JSON, no other text.

Return JSON in this exact format:
{
  "page": <page_number>,
  "last_name": "<LAST NAME>",
  "styles": [
    {
      "style": "<STYLE NAME>",
      "skus": [
        {
          "colour_leather": "<COLOUR LEATHERTYPE>",
          "is_new": true/false
        }
      ]
    }
  ]
}

If the page has no styles (e.g. it's a cover page or intro page), return:
{
  "page": <page_number>,
  "last_name": null,
  "styles": []
}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{b64}",
                                "detail": "high"
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ],
            max_tokens=4000,
            temperature=0
        )
        
        content = response.choices[0].message.content.strip()
        # Remove markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        content = content.strip()
        
        data = json.loads(content)
        data["page"] = page_num
        return data
        
    except Exception as e:
        print(f"  ERROR on page {page_num}: {e}")
        return {
            "page": page_num,
            "last_name": None,
            "styles": [],
            "error": str(e)
        }

def main():
    pages = sorted([f for f in os.listdir(PDF_PAGES_DIR) if f.endswith(".png")])
    print(f"Found {len(pages)} pages to process")
    
    all_data = []
    
    for i, page_file in enumerate(pages):
        page_num = i + 1
        image_path = os.path.join(PDF_PAGES_DIR, page_file)
        print(f"Processing page {page_num}/{len(pages)}: {page_file}")
        
        result = parse_page(image_path, page_num)
        all_data.append(result)
        
        # Print summary
        if result.get("last_name"):
            style_count = len(result.get("styles", []))
            sku_count = sum(len(s.get("skus", [])) for s in result.get("styles", []))
            new_count = sum(1 for s in result.get("styles", []) for sk in s.get("skus", []) if sk.get("is_new"))
            print(f"  Last: {result['last_name']}, Styles: {style_count}, SKUs: {sku_count}, New: {new_count}")
        
        # Save progress every 10 pages
        if page_num % 10 == 0:
            with open(OUTPUT_FILE, "w") as f:
                json.dump(all_data, f, indent=2)
            print(f"  Progress saved at page {page_num}")
        
        # Small delay to avoid rate limits
        time.sleep(0.5)
    
    # Final save
    with open(OUTPUT_FILE, "w") as f:
        json.dump(all_data, f, indent=2)
    
    print(f"\nDone! Data saved to {OUTPUT_FILE}")
    
    # Summary stats
    total_styles = sum(len(p.get("styles", [])) for p in all_data)
    total_skus = sum(len(s.get("skus", [])) for p in all_data for s in p.get("styles", []))
    total_new = sum(1 for p in all_data for s in p.get("styles", []) for sk in s.get("skus", []) if sk.get("is_new"))
    print(f"Total styles found: {total_styles}")
    print(f"Total SKUs found: {total_skus}")
    print(f"Total new SKUs: {total_new}")

if __name__ == "__main__":
    main()
