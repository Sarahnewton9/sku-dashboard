"""
Directly extract the 13 remaining missing style images using known xrefs.
Based on inspection output, we know exactly which xref maps to which style.
"""
import fitz
from PIL import Image
from pathlib import Path
import io
import json

out_dir = Path("/home/ubuntu/style_images")
pdf_path = "/home/ubuntu/upload/ss261404.pdf"
doc = fitz.open(pdf_path)

def save_embedded_image(page_0idx, xref, style_name):
    img_dict = doc.extract_image(xref)
    img_bytes = img_dict["image"]
    ext = img_dict["ext"]
    if ext.lower() == "png":
        png_bytes = img_bytes
    else:
        pil_img = Image.open(io.BytesIO(img_bytes))
        buf = io.BytesIO()
        pil_img.save(buf, "PNG")
        png_bytes = buf.getvalue()
    out_path = out_dir / f"{style_name}.png"
    with open(str(out_path), "wb") as f:
        f.write(png_bytes)
    pil_img = Image.open(io.BytesIO(png_bytes))
    print(f"  Saved: {style_name} ({pil_img.width}x{pil_img.height})")

# BIANCA already extracted in previous run
# Now extract the rest

# Page 13 (index 12): COLLETTE
# Text: cx=542.2 y0=107.4 "COLLETTE $199.95"
# Images: xref=119 cx=715.6, xref=120 cx=876.7, xref=121 cx=389.4, xref=122 cx=64.4, xref=124 cx=216.4
# COLLETTE text cx=542.2 → closest image is xref=121 cx=389.4 (dist=152) or xref=119 cx=715.6 (dist=173)
# Looking at page image: COLLETTE is 5th column, so xref=119 at cx=715.6 seems too far right
# Let me check: page width is ~960pts. COLLETTE at cx=542 → 5th of 6 columns
# Images from left: xref=122(64), xref=124(216), xref=121(389), xref=?(missing?), xref=119(715), xref=120(876)
# There should be an image around cx=540 for COLLETTE. Let me check all images on page 13
page13 = doc[12]
all_imgs13 = page13.get_images(full=True)
print("All images on page 13:")
for img in all_imgs13:
    xref = img[0]
    rects = page13.get_image_rects(xref)
    if rects:
        r = rects[0]
        w = r.x1-r.x0; h = r.y1-r.y0
        print(f"  xref={xref} cx={round((r.x0+r.x1)/2,1)} size={round(w,1)}x{round(h,1)}")

# Page 58 (index 57): MAXOS
# Text: cx=54.9 y0=154.0 "MAXOS 219.95"
# Images: xref=371 cx=81.8 (y0=43, y1=130) → MAXOS text at y0=154 is 24pts below image y1=130 ✓
# But xref=371 was not matched — why? Let me check: MAXOS text cx=54.9, image cx=81.8
# x_tol = max(106.9*0.6, 40) = 64.1
# image x range: 28.4-64.1=(-35.7) to 135.3+64.1=199.4
# text cx=54.9 is within range ✓
# v_dist = 154.0 - 130.0 = 24 ✓
# h_offset = |54.9-81.8| = 26.9
# score = 24 + 26.9*0.3 = 32.1
# But MILEY: text cx=287.9, image xref=370 cx=308.8
# For MAXOS image (xref=371 cx=81.8): MILEY text cx=287.9 is outside x range (199.4 max) ✓
# So MAXOS should have been matched... unless xref=371 was already taken by another style
# Check if MAXOS image file exists
import os
print(f"\nMAXOS image exists: {os.path.exists('/home/ubuntu/style_images/MAXOS.png')}")
# Extract directly
save_embedded_image(57, 371, "MAXOS")

# Page 63 (index 62): PORSHA, PRANCE, PENELOPE
# Images: xref=402 cx=69.0, xref=404 cx=286.2, xref=403 cx=538.5
# Text: PORSHA-UNLINED LEG cx=76.9, PRANCE cx=255.0, PENELOPE© cx=502.4
# PORSHA: image cx=69, text cx=76.9 → variant "PORSHA – UNLINED LEG" → canonical PORSHA
# PRANCE: image cx=286.2, text cx=255.0 → "PRANCE" → canonical PRANCE
# PENELOPE: image cx=538.5, text cx=502.4 → "PENELOPE ©" → need to strip ©
save_embedded_image(62, 402, "PORSHA")
save_embedded_image(62, 404, "PRANCE")
save_embedded_image(62, 403, "PENELOPE")

# Page 77 (index 76): TROPIC, TUSCANY
# Images: xref=501 cx=87.8 (y1=112.3), xref=502 cx=271.4 (y1=116.4)
# Text: TROPIC 179.95 cx=57.8 y0=126.9 → v_dist=126.9-112.3=14.6 ✓
#        TUSCANY 179.95 cx=253.4 y0=126.9 → v_dist=126.9-116.4=10.5 ✓
# These should have matched... but they didn't. Perhaps the "NO DEVELOPMENT" stamp image
# was being matched instead? Let me just extract directly.
save_embedded_image(76, 501, "TROPIC")
save_embedded_image(76, 502, "TUSCANY")

# Page 82 (index 81): VALERIE, VAMORE, VILLA, VOGUE, VOLLI
# Images: xref=527 cx=75.8, xref=528 cx=268.8, xref=529 cx=508.0, xref=530 cx=785.7, xref=531 cx=93.3
# Text:
#   VOGUE 219.95 cx=63.2 → image xref=527 cx=75.8 ✓
#   VALERIE cx=250.2 → image xref=528 cx=268.8 ✓
#   VAMORE cx=481.1 → image xref=529 cx=508.0 ✓
#   VILLA cx=726.5 → image xref=530 cx=785.7 ✓
#   VOLLI cx=51.0 y0=395.8 → image xref=531 cx=93.3 (y1=379.7) → v_dist=395.8-379.7=16.1 ✓
# VALERIE/VAMORE/VILLA have no price → "VALERIE" alone → find_style_in_text should find it
# But VOGUE has price "219.95" → should be found
# Let me just extract all directly
save_embedded_image(81, 527, "VOGUE")
save_embedded_image(81, 528, "VALERIE")
save_embedded_image(81, 529, "VAMORE")
save_embedded_image(81, 530, "VILLA")
save_embedded_image(81, 531, "VOLLI")

doc.close()

# Update the style_image_map.json
with open("/home/ubuntu/style_image_map.json") as f:
    image_map = json.load(f)

newly_extracted = ["BIANCA", "MAXOS", "PORSHA", "PRANCE", "PENELOPE", "TROPIC", "TUSCANY",
                   "VOGUE", "VALERIE", "VAMORE", "VILLA", "VOLLI"]
for style in newly_extracted:
    path = f"/home/ubuntu/style_images/{style}.png"
    if os.path.exists(path):
        image_map[style] = path

# COLLETTE - need to check
page13_check = doc if False else None  # doc already closed

with open("/home/ubuntu/style_image_map.json", "w") as f:
    json.dump(image_map, f, indent=2)

print(f"\nTotal in image map: {len(image_map)}")
missing_final = set()
with open("/home/ubuntu/clean_sku_data.json") as f:
    styles = json.load(f)
all_style_names = {s["style"] for s in styles}
for s in all_style_names:
    if s not in image_map:
        missing_final.add(s)
print(f"Still missing: {sorted(missing_final)}")
