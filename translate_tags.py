import re

with open('/Users/duyenpt/WorkPlace/ai-trading 2/lib/hashtags.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Define common translations
replacements = {
    "'Phiên Á (06:00 - 13:00)'": "'Asian Session (06:00 - 13:00)'",
    "'Phiên Âu (14:00 - 19:00)'": "'London Session (14:00 - 19:00)'",
    "'Phiên Mỹ (19:30 - 03:00)'": "'New York Session (19:30 - 03:00)'",
    "'Khung Thời Gian'": "'Timeframe / Session'",
    "'Thấp'": "'Low'",
    "'Trung Bình'": "'Medium'",
    "'Cao'": "'High'",
    "'Thuận Wave (Trend Following)'": "'Trend Following'",
    "'Đảo Chiều / Range'": "'Reversal / Range'",
    "'LỖI KỸ THUẬT'": "'TECHNICAL MISTAKE'",
    "'LỖI TÂM LÝ'": "'PSYCHOLOGICAL MISTAKE'",
    "'KỸ NĂNG VÀO LỆNH'": "'ENTRY SKILL'",
    "'KỸ NĂNG QUẢN LÝ LỆNH'": "'TRADE MANAGEMENT'",
    "'TÂM LÝ GIAO DỊCH'": "'TRADING PSYCHOLOGY'",
}

def translate_str(s):
    if not s: return s
    for k, v in replacements.items():
        if k.strip("'") in s:
            s = s.replace(k.strip("'"), v.strip("'"))
    
    # Simple fallback translation logic for risk
    if s == 'Thấp': return 'Low'
    if s == 'Trung Bình': return 'Medium'
    if s == 'Cao' or s == 'Cháy': return 'High'
    
    return s

lines = content.split('\n')
new_lines = []

for line in lines:
    new_lines.append(line)
    
    # Match fields to duplicate as en_
    for field in ['label', 'group', 'description', 'rules', 'riskLevel']:
        m = re.match(r'^(\s+)' + field + r':\s*(.*?),?$', line)
        if m:
            indent = m.group(1)
            val = m.group(2)
            
            # Remove trailing comma for parsing
            has_comma = line.endswith(',')
            
            # Extract string content
            str_content = ""
            if val.startswith("'") and val.endswith("'"):
                str_content = val[1:-1]
            elif val.startswith('"') and val.endswith('"'):
                str_content = val[1:-1]
            elif val.startswith('`') and val.endswith('`'):
                str_content = val[1:-1]
            else:
                str_content = val # fallback
                
            en_val = translate_str(str_content)
            
            # We don't have a full AI translation in python, but we can just prepend [EN] to the vietnamese if we don't have a direct translation, or just keep it simple.
            # Actually, I will write a Node script that calls the Gemini API to translate it! 
            # Wait, no API key is available in the terminal unless I use my own tools.

