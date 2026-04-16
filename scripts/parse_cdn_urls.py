#!/usr/bin/env python3
"""
Parse CDN URLs from manus-upload-file --webdev output and update style_cdn_urls.json.
Usage:
  manus-upload-file --webdev *.png > upload_output.txt
  python3.11 parse_cdn_urls.py upload_output.txt
"""
import re
import json
import sys
import os

input_file = sys.argv[1] if len(sys.argv) > 1 else 'upload_output.txt'

with open(input_file) as f:
    content = f.read()

# Extract URLs like https://d2xsxph8kpxj0f.cloudfront.net/.../STYLENAME_hash.png
url_pattern = r'(https://[^\s]+\.png)'
urls = re.findall(url_pattern, content)

cdn_map = {}
for url in urls:
    filename = url.split('/')[-1]
    # Remove hash suffix: STYLENAME_abc123.png -> STYLENAME
    style_name = re.sub(r'_[a-zA-Z0-9]{8,}\.png$', '', filename)
    style_name = style_name.replace('_', ' ').upper().strip()
    cdn_map[style_name] = url

# Merge with existing map
existing_path = os.path.join(os.path.dirname(__file__), 'style_cdn_urls.json')
if os.path.exists(existing_path):
    with open(existing_path) as f:
        existing = json.load(f)
    existing.update(cdn_map)
    cdn_map = existing

with open(existing_path, 'w') as f:
    json.dump(cdn_map, f, indent=2, sort_keys=True)

print(f"Updated style_cdn_urls.json with {len(cdn_map)} entries")
