import re

def check_jsx_balance(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # remove jsx comments
    content = re.sub(r'\{\/\*.*?\*\/\}', '', content, flags=re.DOTALL)
    
    tag_pattern = re.compile(r'</?([a-zA-Z][a-zA-Z0-9]*)[^>]*>')
    stack = []
    
    for match in tag_pattern.finditer(content):
        tag_text = match.group(0)
        tag_name = match.group(1)
        start_index = match.start()
        line_num = content.count('\n', 0, start_index) + 1
        
        if tag_text.endswith('/>'):
            continue
            
        if tag_name.lower() in ['input', 'img', 'br', 'hr', 'meta', 'link', 'path', 'circle', 'rect']:
            continue
            
        if tag_text.startswith('</'):
            if not stack:
                print(f"Error at line {line_num}: Close tag </{tag_name}> with no open tag.")
                return
            last_open_tag, open_line = stack.pop()
            if last_open_tag != tag_name:
                print(f"Error at line {line_num}: Mismatched tags. Expected </{last_open_tag}> (from line {open_line}), but found </{tag_name}>.")
                return
        else:
            stack.append((tag_name, line_num))
            
    if stack:
        print("Unclosed tags remaining:")
        for tag, line in stack[::-1]:
            print(f"<{tag}> opened at line {line}")
    else:
        print("All tags matched (naively).")

check_jsx_balance('/Users/chanhojung/ETF_One/dashboard/src/app/page.tsx')
