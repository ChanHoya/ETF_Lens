import re

with open("src/components/DiscoverTab.tsx", "r") as f:
    content = f.read()

# Extract the modal block
modal_pattern = r"( {12}\{activeModal === 'inflation' && \(\n {16}<div className=\"fixed inset-0.*? {12}\)\n {8}\}\n)"
modal_match = re.search(modal_pattern, content, flags=re.DOTALL)
if not modal_match:
    print("Modal block not found")
    exit(1)

modal_block = modal_match.group(1)
content = content.replace(modal_block, "")

# Modify the modal block classes
modal_block = modal_block.replace(
    'className="fixed inset-0 z-[100] flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-[96px] animate-in fade-in duration-300"',
    'className="absolute left-0 right-0 top-full mt-2 z-[110] flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in slide-in-from-top-2 duration-300 rounded-3xl shadow-2xl"'
)
modal_block = modal_block.replace(
    'className="bg-[#0d0d12] border border-white/10 rounded-3xl w-full max-w-4xl p-6 shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative animate-in zoom-in-95 duration-300 overflow-y-auto"',
    'className="bg-[#0d0d12] border border-white/10 rounded-3xl w-full max-w-4xl p-6 relative overflow-y-auto"'
)

# Insert the modal block inside the us-economy-title wrapper
title_pattern = r"( {16}</div>\n {16}</div>\n {12}</div>\n)"
# Wait, let's just insert it after the end of us-economy-title
title_match = re.search(title_pattern, content)
if not title_match:
    print("Title block end not found")
    exit(1)

# we want to insert right after the title div
# the title div has `id="us-economy-title"`
new_title_pattern = r"(<div \n *id=\"us-economy-title\".*?\n {16}</div>\n {16}</div>\n {12}</div>\n)"
new_title_match = re.search(new_title_pattern, content, flags=re.DOTALL)
if new_title_match:
    title_block = new_title_match.group(1)
    new_title_block = '                <div className="relative z-50">\n                    ' + title_block.replace('\n', '\n    ') + '\n    ' + modal_block.replace('\n', '\n    ') + '\n                </div>\n'
    content = content.replace(title_block, new_title_block)
else:
    print("Full title block not found")
    exit(1)

with open("src/components/DiscoverTab.tsx", "w") as f:
    f.write(content)

print("Done")
