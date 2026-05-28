import re

with open("/Users/chanhojung/.gemini/antigravity/brain/0c2b519e-2c5e-4728-88db-c7f894facf22/.system_generated/steps/1828/content.md", "r", encoding="utf-8") as f:
    content = f.read()

# Find any unicode escape sequences like \u1234
escapes = re.findall(r'\\u[0-9a-fA-F]{4}', content)
print(f"Found {len(escapes)} unicode escapes.")

# Try to decode those escape sequences to see if they contain Korean text
decoded = bytes(content, "utf-8").decode("unicode_escape", errors="ignore")

# Find any Korean characters in the decoded text
korean_text = re.findall(r'[ㄱ-ㅣ가-힣]+', decoded)
print(f"Found {len(korean_text)} Korean words in decoded text.")
if korean_text:
    print("Sample words:", korean_text[:50])

# Let's search for some specific English terms that might be in the discussion
terms = ["ETF", "NAV", "price", "disparity", "premium", "discount", "tracking", "close", "open"]
for t in terms:
    matches = re.findall(rf'\b{t}\b', decoded, re.IGNORECASE)
    print(f"Term '{t}': {len(matches)} matches")
