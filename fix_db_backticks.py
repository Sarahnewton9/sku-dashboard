"""Fix escaped backticks in the checkAllSpecsFilled function in server/db.ts"""

with open('server/db.ts', 'rb') as f:
    content = f.read()

# The issue: the Python heredoc script wrote \` (backslash + backtick) instead of just backtick
# Find the checkAllSpecsFilled function
idx = content.find(b'export async function checkAllSpecsFilled')
print(f"Found checkAllSpecsFilled at byte {idx}")

before = content[:idx]
after = content[idx:]

# Show what's in the problematic area
sql_idx = after.find(b'sql')
print(f"Bytes around sql: {repr(after[sql_idx:sql_idx+80])}")

# The escaped backtick is b'\\`' (two bytes: 0x5c 0x60)
# It should be just b'`' (one byte: 0x60)
backslash_backtick = bytes([0x5c, 0x60])  # \`
backtick = bytes([0x60])  # `

# Also fix \$ -> $
backslash_dollar = bytes([0x5c, 0x24])  # \$
dollar = bytes([0x24])  # $

after_fixed = after.replace(backslash_backtick, backtick).replace(backslash_dollar, dollar)

print(f"\nAfter fix - bytes around sql: {repr(after_fixed[sql_idx:sql_idx+80])}")

# Verify the fix looks correct
if b'sql`' in after_fixed:
    print("SUCCESS: sql template literal looks correct")
else:
    print("WARNING: sql template literal may still have issues")

content_fixed = before + after_fixed

with open('server/db.ts', 'wb') as f:
    f.write(content_fixed)

print("File written successfully")
