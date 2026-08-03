import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGeminiModels } from '@/lib/ai-agent';
import { getTradeTypeFilter } from '@/lib/tradeUtils';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'ALL';
    const dateParam = searchParams.get('date');
    const lang = searchParams.get('lang') || 'vi';

    const langInstruction = {
      en: 'IMPORTANT: Output Language MUST be English. Write all JSON values (summary, strengths, weaknesses, key_lesson, actionable_advice) entirely in natural English.',
      zh: 'IMPORTANT: Output Language MUST be Simplified Chinese. Write all JSON values entirely in natural Chinese.',
      ko: 'IMPORTANT: Output Language MUST be Korean. Write all JSON values entirely in natural Korean.',
      es: 'IMPORTANT: Output Language MUST be Spanish. Write all JSON values entirely in natural Spanish.',
      vi: 'IMPORTANT: Output Language MUST be Vietnamese. Write all JSON values in Vietnamese.'
    }[lang] || 'IMPORTANT: Output Language MUST be Vietnamese.';

    if (!dateParam) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chưa cung cấp tham số ngày (date).' 
      }, { status: 400 });
    }

    const db = await getDb();
    let query = "SELECT * FROM trades WHERE date(datetime(trade_time, '+7 hours')) = ?";
    let params = [dateParam];
    
    const filter = getTradeTypeFilter(type, true);
    query += filter.sql;
    params.push(...filter.params);

    query += ' ORDER BY trade_time ASC';

    const trades = await db.all(query, params);

    if (trades.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Không có giao dịch nào trong ngày hôm nay để phân tích.' 
      });
    }

    // Format trades context for Gemini
    const tradesContext = trades.map(t => ({
      asset: t.asset,
      side: t.side,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      pnl: t.pnl,
      status: t.status,
      trade_type: t.trade_type || 'LIVE',
      setup_tag: t.setup_tag || 'Unclassified',
      notes: t.user_notes || '',
      ai_evaluation: typeof t.ai_evaluation === 'string' ? JSON.parse(t.ai_evaluation) : t.ai_evaluation
    }));

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng thêm key vào file .env.local.' 
      }, { status: 500 });
    }

    const prompt = `
Bạn là một YUP Trade cao cấp chuyên nghiệp. Hãy phân tích và đánh giá toàn bộ các lệnh giao dịch trong ngày HÔM NAY (${dateParam}) của trader dựa trên thông tin chi tiết dưới đây:

Danh sách lệnh giao dịch ngày hôm nay:
${JSON.stringify(tradesContext.map(t => ({
  asset: t.asset,
  side: t.side,
  entry_price: t.entry_price,
  exit_price: t.exit_price,
  pnl: t.pnl,
  status: t.status,
  setup_tag: t.setup_tag,
  notes: t.notes,
  strengths: t.ai_evaluation?.strengths || [],
  weaknesses: t.ai_evaluation?.weaknesses || []
})), null, 2)}

Hãy viết một báo cáo đánh giá ngày hôm nay bằng tiếng Việt định dạng JSON để nhận xét, tập trung vào:
1. Nhận xét chung về hiệu suất giao dịch và trạng thái tâm lý thể hiện qua các lệnh trong ngày.
2. Điểm số kỷ luật của ngày hôm nay (thang điểm 1-10).
3. Các điểm trader đã làm tốt hôm nay (strengths) và các điểm sai lầm hôm nay (weaknesses).
4. Bài học quan trọng nhất cần rút ra từ ngày giao dịch hôm nay.
5. Lời khuyên hành động cụ thể để cải thiện cho ngày giao dịch tiếp theo.

Yêu cầu đầu ra JSON chính xác với cấu trúc:
{
  "summary": "Nhận xét tổng quan về ngày giao dịch hôm nay (khoảng 3-4 câu).",
  "discipline_score": 8.0, // Điểm số kỷ luật của ngày hôm nay từ 1.0 đến 10.0 (số thực)
  "strengths": ["Mảng 2-3 điểm trader làm đúng nhất trong ngày."],
  "weaknesses": ["Mảng 2-3 sai lầm hoặc lỗi cảm xúc xuất hiện trong ngày."],
  "key_lesson": "Bài học lớn nhất rút ra từ ngày giao dịch hôm nay.",
  "actionable_advice": ["Mảng 2-3 lời khuyên hành động thực tế cho ngày mai."]
}

### QUY TẮC CỰC KỲ QUAN TRỌNG:
1. KHÔNG sử dụng dấu nháy kép bên trong chuỗi giá trị. Thay thế bằng dấu nháy đơn (').
2. Nếu cần xuống dòng, dùng \\n.
3. LƯU Ý PHÁP LÝ TỐI QUAN TRỌNG: Bạn chỉ đóng vai trò phân tích lỗi sai kỹ thuật và tâm lý, cải thiện kỷ luật dựa trên dữ liệu quá khứ. NGHIÊM CẤM đưa ra bất kỳ lời khuyên mua bán, gợi ý đầu tư, hay dự báo giá cả tương lai nào. Tuyệt đối không sử dụng các cụm từ như "nên mua", "nên bán", "hãy vào lệnh", "mục tiêu giá". Rule này không có bất kỳ khoan nhượng nào.
4. ${langInstruction}
Chỉ trả về chuỗi JSON thô, không bọc trong markdown hay bất cứ ký tự nào khác.
`;

    const models = getGeminiModels();
    let lastError = null;
    let responseText = null;

    for (const model of models) {
      try {
        console.log(`Today review: attempting with model: ${model}`);
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
          console.log(`Successfully generated today review with model: ${model}`);
          break;
        }
      } catch (err) {
        console.warn(`Model ${model} failed for today review:`, err.message);
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
    console.error('Error generating today review:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
