import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGeminiModels } from '@/lib/ai-agent';
import { getTradeTypeFilter } from '@/lib/tradeUtils';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'ALL';
    const lang = searchParams.get('lang') || 'vi';

    const langInstruction = {
      en: 'IMPORTANT: Output Language MUST be English. Write all JSON values (summary, strengths, weaknesses, action_plan, grade) entirely in natural English.',
      zh: 'IMPORTANT: Output Language MUST be Simplified Chinese. Write all JSON values entirely in natural Chinese.',
      ko: 'IMPORTANT: Output Language MUST be Korean. Write all JSON values entirely in natural Korean.',
      es: 'IMPORTANT: Output Language MUST be Spanish. Write all JSON values entirely in natural Spanish.',
      vi: 'IMPORTANT: Output Language MUST be Vietnamese. Write all JSON values in Vietnamese.'
    }[lang] || 'IMPORTANT: Output Language MUST be Vietnamese.';

    const db = await getDb();
    let query = 'SELECT * FROM trades';
    const filter = getTradeTypeFilter(type, false);
    query += filter.sql;
    const params = filter.params;

    query += ' ORDER BY trade_time DESC LIMIT 150';

    const trades = await db.all(query, params);

    if (trades.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Không có giao dịch nào để phân tích tháng.' 
      });
    }

    // Format trades context for Gemini (excluding heavy base64 images)
    const tradesContext = trades.map(t => ({
      asset: t.asset,
      side: t.side,
      pnl: t.pnl,
      status: t.status,
      trade_type: t.trade_type || 'LIVE',
      setup_tag: t.setup_tag || 'Unclassified',
      notes: t.user_notes || ''
    }));

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng thêm key vào file .env.local.' 
      }, { status: 500 });
    }

    const prompt = `
Bạn là một YUP Trade cao cấp. Hãy nhận xét hiệu suất giao dịch tháng vừa qua của trader dựa trên danh sách các lệnh dưới đây:

Danh sách lệnh giao dịch gần đây:
${JSON.stringify(tradesContext, null, 2)}

Hãy viết một báo cáo nhận xét tháng bằng tiếng Việt định dạng JSON. Báo cáo cần bao quát xu hướng tâm lý, tính kỷ luật, điểm mạnh/yếu nổi bật, bài học cốt lõi, và đưa ra kế hoạch hành động cụ thể cho tháng tới.

Yêu cầu đầu ra JSON chính xác với cấu trúc:
{
  "summary": "Nhận xét tổng quan về hiệu suất giao dịch tháng này (khoảng 3-4 câu).",
  "discipline_score": 7.5, // Điểm số kỷ luật tháng này từ 1.0 đến 10.0 (số thực)
  "strengths": ["Mảng 3-4 điểm mạnh/quyết định đúng đắn nổi bật tháng qua."],
  "weaknesses": ["Mảng 3-4 lỗi sai/yếu tố tâm lý cần khắc phục tháng qua."],
  "key_lessons": ["Mảng 3-4 bài học đắt giá rút ra được từ kết quả lệnh."],
  "action_plan": ["Mảng 3-4 hành động cụ thể trader phải tuân thủ trong tháng tiếp theo để cải thiện."]
}

### QUY TẮC PHÒNG TRÁNH LỖI PHÂN TÍCH JSON (CỰC KỲ QUAN TRỌNG):
1. KHÔNG được sử dụng dấu nháy kép lồng nhau bên trong chuỗi giá trị (ví dụ: các trường summary, strengths, weaknesses, key_lessons, action_plan). Nếu có từ ngữ cần nhấn mạnh hoặc trích dẫn, hãy sử dụng dấu nháy đơn (') thay cho dấu nháy kép (").
Ví dụ SAI: "summary": "Trader có xu hướng "Fomo" khi giao dịch..."
Ví dụ ĐÚNG: "summary": "Trader có xu hướng 'Fomo' khi giao dịch..."
2. Nếu bắt buộc phải xuống dòng trong các chuỗi giá trị, hãy sử dụng ký tự xuống dòng đã được escape là \\n (hai dấu gạch chéo ngược kèm chữ n), tuyệt đối KHÔNG được xuống dòng vật lý (Enter trực tiếp) trong chuỗi.
3. LƯU Ý PHÁP LÝ TỐI QUAN TRỌNG: Bạn chỉ đóng vai trò phân tích lỗi sai kỹ thuật và tâm lý, cải thiện kỷ luật dựa trên dữ liệu quá khứ. NGHIÊM CẤM đưa ra bất kỳ lời khuyên mua bán, gợi ý đầu tư, hay dự báo giá cả tương lai nào. Tuyệt đối không sử dụng các cụm từ như "nên mua", "nên bán", "hãy vào lệnh", "mục tiêu giá". Rule này không có bất kỳ khoan nhượng nào.
4. ${langInstruction}
Chỉ trả về chuỗi JSON thô, không bọc trong markdown hay bất cứ ký tự nào khác.
`;

    const models = getGeminiModels();
    let lastError = null;
    let responseText = null;

    for (const model of models) {
      try {
        console.log(`Monthly review: attempting with model: ${model}`);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error?.message || res.statusText;
          throw new Error(`API Status ${res.status}: ${errMsg}`);
        }

        const data = await res.json();
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (responseText) {
          console.log(`Successfully generated weekly review with model: ${model}`);
          break;
        }
      } catch (err) {
        console.warn(`Model ${model} failed for weekly review:`, err.message);
        lastError = err;
      }
    }

    if (responseText) {
      let cleaned = responseText;
      const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      const parsed = JSON.parse(cleaned);
      return NextResponse.json({ success: true, data: parsed });
    } else {
      throw lastError || new Error("Failed to get response from any Gemini model");
    }
  } catch (error) {
    console.error('Error generating weekly review:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
