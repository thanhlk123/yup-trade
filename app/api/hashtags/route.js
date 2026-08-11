import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGeminiModels } from '@/lib/ai-agent';
import { OFFICIAL_HASHTAGS } from '@/lib/hashtags';

export function normalizeSlug(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function analyzeNewHashtagLocally(inputText, explicitCategory) {
  const text = inputText.trim();
  const lower = text.toLowerCase();

  let category = explicitCategory || 'setups';
  
  const getPrefixForCategory = (cat) => {
    if (cat === 'setups') return '#Setup_';
    if (cat === 'mistakes') return '#Mistake_';
    if (cat === 'strengths') return '#Strength_';
    if (cat === 'trends') return '#Trend_';
    if (cat === 'sessions') return '#Session_';
    if (cat === 'triggers') return '#Trigger_';
    if (cat === 'management') return '#Mgmt_';
    if (cat === 'confluences') return '#Confluence_';
    return '#Custom_';
  };
  
  let prefix = getPrefixForCategory(category);
  let color = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  let group = 'Setup Phương Pháp';
  let riskLevel = 'Trung Bình';

  // If no explicit category, determine category heuristically
  if (!explicitCategory) {
    if (lower.includes('lỗi') || lower.includes('mistake') || lower.includes('fomo') || lower.includes('dca') || lower.includes('cay cú') || lower.includes('trả thù') || lower.includes('gồng lỗ') || lower.includes('ẩu')) {
      category = 'mistakes';
      prefix = '#Mistake_';
      color = 'text-rose-400 border-rose-500/30 bg-rose-500/10';
      group = 'Lỗi Tâm Lý / Kỹ Thuật';
      riskLevel = 'Cao';
    } else if (lower.includes('kỷ luật') || lower.includes('tốt') || lower.includes('strength') || lower.includes('thói quen') || lower.includes('stop loss') || lower.includes('sl chuẩn') || lower.includes('kiên nhẫn')) {
      category = 'strengths';
      prefix = '#Strength_';
      color = 'text-sky-400 border-sky-500/30 bg-sky-500/10';
      group = 'Thói Quen Tốt & Kỷ Luật';
      riskLevel = 'Thói Quen Tốt';
    } else if (lower.includes('trend') || lower.includes('xu hướng') || lower.includes('sideway') || lower.includes('bullish') || lower.includes('bearish') || lower.includes('sóng')) {
      category = 'trends';
      prefix = '#Trend_';
      color = 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      group = 'Xu Hướng Thị Trường';
      riskLevel = 'Trung Bình';
    } else if (lower.includes('phiên') || lower.includes('session') || lower.includes('á') || lower.includes('âu') || lower.includes('mỹ')) {
      category = 'sessions';
      prefix = '#Session_';
      color = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      group = 'Khung Thời Gian';
      riskLevel = 'Thấp';
    }
  }

  // Format clean tag name
  let cleanName = text
    .replace(/^#/, '')
    .replace(/^(Setup_|Mistake_|Strength_|Trend_|Session_|Trigger_|Mgmt_|Confluence_)/i, '')
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]+/g, '');

  if (!cleanName) cleanName = 'CustomTag_' + Math.floor(Math.random() * 1000);
  // CamelCase cleanName
  cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  const formattedTag = text.startsWith('#') ? text : `${prefix}${cleanName}`;

  return {
    tag: formattedTag,
    label: text.replace(/^#/, ''),
    category: category,
    group: group,
    description: `Hashtag được AI số hóa từ đầu vào "${text}". Mô tả chiến thuật hoặc bài học giao dịch liên quan.`,
    rules: `Quy tắc thực chiến: Tuân thủ điều kiện kích hoạt và quản lý rủi ro nghiêm ngặt cho ${formattedTag}.`,
    riskLevel: riskLevel,
    color: color,
  };
}

export async function GET() {
  try {
    const db = await getDb();
    
    // Auto-migrate OFFICIAL_HASHTAGS into DB if missing
    const existingTags = await db.all('SELECT tag FROM custom_hashtags');
    const existingTagSet = new Set(existingTags.map(r => r.tag));
    
    for (const cat in OFFICIAL_HASHTAGS) {
      for (const t of OFFICIAL_HASHTAGS[cat]) {
         if (!existingTagSet.has(t.tag)) {
            await db.run(
              `INSERT INTO custom_hashtags (tag, label, category, group_name) VALUES (?, ?, ?, ?)`,
              [t.tag, t.label, cat, 'Mặc định']
            );
         }
      }
    }

    const rows = await db.all('SELECT * FROM custom_hashtags WHERE is_deleted = 0 OR is_deleted IS NULL ORDER BY id DESC');
    const customTags = rows.map(r => ({
      id: r.id,
      tag: r.tag,
      slug: r.slug || normalizeSlug(r.label || r.tag),
      label: r.label || r.tag,
      category: r.category,
      group: r.group_name || 'Hashtag Tự Tạo',
      description: r.description,
      rules: r.rules,
      riskLevel: r.risk_level || 'Trung Bình',
      color: r.color || 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      isCustom: true,
    }));

    // Optionally fetch tag aliases to attach to customTags? 
    // For now, returning customTags is enough for client-side fuzzy search.

    return NextResponse.json({ success: true, data: customTags });
  } catch (error) {
    console.error('Error fetching custom hashtags:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { input, category: explicitCategory } = body;

    if (!input || !input.trim()) {
      return NextResponse.json({ success: false, error: 'Thiếu từ khóa hashtag' }, { status: 400 });
    }

    const textInput = input.trim();
    let analyzedHashtag = null;

    // Check if Gemini API Key exists for AI classification
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // Define prefixes based on category
    const getPrefixForCategory = (cat) => {
      if (cat === 'setups') return '#Setup_';
      if (cat === 'mistakes') return '#Mistake_';
      if (cat === 'strengths') return '#Strength_';
      if (cat === 'trends') return '#Trend_';
      if (cat === 'sessions') return '#Session_';
      if (cat === 'triggers') return '#Trigger_';
      if (cat === 'management') return '#Mgmt_';
      if (cat === 'confluences') return '#Confluence_';
      return '#Custom_';
    };

    if (apiKey) {
      try {
        const models = getGeminiModels();
        const expectedCategoryStr = explicitCategory ? `BẮT BUỘC trả về category: "${explicitCategory}".` : '';
        const prompt = `Bạn là chuyên gia số hóa Trading Methodology. Hãy phân tích từ khóa hashtag mới: "${textInput}".
${expectedCategoryStr}
Trả về duy nhất 1 chuỗi JSON theo format sau:
{
  "tag": "#Prefix_Name", (ví dụ: #Setup_, #Mistake_, #Trigger_, #Mgmt_, #Confluence_)
  "label": "Tên Ngắn Gọn Tiếng Việt",
  "category": "setups" | "mistakes" | "strengths" | "trends" | "sessions" | "triggers" | "management" | "confluences",
  "group": "Tên Nhóm Phù Hợp",
  "description": "Giải thích ngắn gọn 1-2 câu ý nghĩa thực chiến",
  "rules": "Quy tắc vào lệnh hoặc bài học phòng tránh ngắn gọn",
  "riskLevel": "Thấp" | "Trung Bình" | "Cao" | "Rất Cao" | "Thói Quen Tốt"
}`;

        const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${models[0]}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        const aiData = await aiRes.json();
        const responseText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (responseText) {
          const parsed = JSON.parse(responseText);
          const colorMap = {
            setups: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
            mistakes: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
            strengths: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
            trends: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
            sessions: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
            triggers: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
            management: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10',
            confluences: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
          };
          
          const finalCategory = explicitCategory || parsed.category || 'setups';
          let finalTag = parsed.tag;
          if (!finalTag.startsWith('#')) finalTag = `#${finalTag}`;
          
          // Force correct prefix if the AI got it wrong
          const correctPrefix = getPrefixForCategory(finalCategory);
          if (!finalTag.startsWith(correctPrefix)) {
            finalTag = correctPrefix + finalTag.replace(/^#([A-Za-z]+_)?/, '');
          }

          analyzedHashtag = {
            tag: finalTag,
            label: parsed.label || textInput,
            category: finalCategory,
            group: parsed.group || 'Setup Tự Tạo',
            description: parsed.description || `Mô tả cho hashtag ${finalTag}`,
            rules: parsed.rules || `Quy tắc giao dịch cho ${finalTag}`,
            riskLevel: parsed.riskLevel || 'Trung Bình',
            color: colorMap[finalCategory] || colorMap.setups,
          };
        }
      } catch (aiErr) {
        console.warn('AI classification failed, falling back to heuristics:', aiErr);
      }
    }

    // Fallback if AI call failed or no API key
    if (!analyzedHashtag) {
      analyzedHashtag = analyzeNewHashtagLocally(textInput);
    }

    // Save to database
    const db = await getDb();
    
    // First check if it exists by slug or alias
    const newSlug = normalizeSlug(analyzedHashtag.label);
    
    // Check aliases first
    const aliasMatch = await db.get(`
      SELECT c.* FROM custom_hashtags c
      JOIN tag_aliases a ON c.id = a.hashtag_id
      WHERE a.alias_slug = ?
    `, [newSlug]);
    
    if (aliasMatch) {
      return NextResponse.json({
        success: true,
        data: {
          tag: aliasMatch.tag,
          label: aliasMatch.label,
          slug: aliasMatch.slug,
          category: aliasMatch.category,
          group: aliasMatch.group_name,
          color: aliasMatch.color,
          isCustom: true
        },
        message: `Đã tự động chuyển về thẻ gốc: ${aliasMatch.label}`
      });
    }

    const existingBySlug = await db.get('SELECT id FROM custom_hashtags WHERE slug = ?', [newSlug]);
    if (existingBySlug) {
       await db.run('UPDATE custom_hashtags SET label = ?, tag = ? WHERE id = ?', [analyzedHashtag.label, analyzedHashtag.tag, existingBySlug.id]);
    } else {
       await db.run(
         `INSERT OR REPLACE INTO custom_hashtags (tag, slug, label, category, group_name, description, rules, risk_level, color)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [
           analyzedHashtag.tag,
           newSlug,
           analyzedHashtag.label,
           analyzedHashtag.category,
           analyzedHashtag.group,
           analyzedHashtag.description,
           analyzedHashtag.rules,
           analyzedHashtag.riskLevel,
           analyzedHashtag.color,
         ]
       );
    }

    return NextResponse.json({
      success: true,
      data: { ...analyzedHashtag, isCustom: true },
      message: `Đã dùng AI phân tích & tạo thành công hashtag ${analyzedHashtag.tag} vào nhóm ${analyzedHashtag.group}`
    });

  } catch (error) {
    console.error('Error creating custom hashtag:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { oldTag, newLabel } = body;

    if (!oldTag || !newLabel) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin cập nhật' }, { status: 400 });
    }

    const match = oldTag.match(/#(Session|Setup|Strength|Mistake)_/);
    const prefix = match ? match[0] : '#';
    let newTagText = newLabel.replace(/\s+/g, '_');
    newTagText = newTagText.replace(/^#/, '');
    const newTag = prefix + newTagText;

    const db = await getDb();

    if (newTag !== oldTag) {
      const existing = await db.get('SELECT id FROM custom_hashtags WHERE tag = ?', [newTag]);
      if (existing) {
        return NextResponse.json({ success: false, error: 'Hashtag với tên này đã tồn tại' }, { status: 400 });
      }
    }

    const currentTag = await db.get('SELECT id, slug, label FROM custom_hashtags WHERE tag = ?', [oldTag]);
    const newSlug = normalizeSlug(newLabel);
    
    await db.run('UPDATE custom_hashtags SET tag = ?, label = ?, slug = ? WHERE tag = ?', [newTag, newLabel, newSlug, oldTag]);
    
    if (currentTag && currentTag.slug && currentTag.slug !== newSlug) {
       // Insert old slug to aliases
       await db.run('INSERT OR IGNORE INTO tag_aliases (hashtag_id, alias_slug) VALUES (?, ?)', [currentTag.id, currentTag.slug]);
       // Maybe also add the old label normalized just in case
       const oldLabelSlug = normalizeSlug(currentTag.label);
       if (oldLabelSlug !== currentTag.slug && oldLabelSlug !== newSlug) {
          await db.run('INSERT OR IGNORE INTO tag_aliases (hashtag_id, alias_slug) VALUES (?, ?)', [currentTag.id, oldLabelSlug]);
       }
    }

    await db.run('UPDATE trades SET setup_tag = ? WHERE setup_tag = ?', [newTag, oldTag]);

    return NextResponse.json({ success: true, message: 'Đã cập nhật hashtag', newTag });
  } catch (error) {
    console.error('Error updating custom hashtag:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tag = searchParams.get('tag');

    if (!tag) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin tag cần xóa' }, { status: 400 });
    }

    const db = await getDb();
    await db.run('UPDATE custom_hashtags SET is_deleted = 1 WHERE tag = ?', [tag]);

    return NextResponse.json({ success: true, message: 'Đã xóa hashtag vĩnh viễn' });
  } catch (error) {
    console.error('Error deleting custom hashtag:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
