import { NextResponse } from 'next/server';
import { getGeminiModels } from '@/lib/ai-agent';

export const maxDuration = 60; // Allow more time for AI processing

export async function POST(request) {
  try {
    const { behaviorId, behaviorName, occurrences, tradesData, behaviorEvidence, dataQuality } = await request.json();

    if (!tradesData || !tradesData.length) {
      return NextResponse.json({ error: 'No trades data provided' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu API Key của Gemini.' }, { status: 500 });
    }

    // Prepare compact data for prompt to save tokens
    const compactTrades = tradesData.map(t => ({
      date: t.trade_time,
      asset: t.asset,
      pnl: t.pnl,
      size: t.size,
      notes: t.user_notes,
      tags: t.setup_tag
    }));

    const prompt = `
Bạn là chuyên gia phân tích dữ liệu giao dịch (Data Scientist & Trading Analyst).
Hệ thống Rule Engine (Deterministic Layer) vừa quét qua tập dữ liệu và KẾT LUẬN phát hiện ra lỗi hành vi: "${behaviorName}" (ID: ${behaviorId}).
Lỗi này xảy ra ${occurrences} lần.
Điểm chất lượng dữ liệu (Data Quality Score): ${dataQuality ? (dataQuality * 100).toFixed(0) : 'Chưa xác định'}%.
Bằng chứng (Evidence): ${behaviorEvidence ? behaviorEvidence.join(' | ') : 'Phân tích từ dữ liệu lịch sử.'}

BẠN ĐANG Ở TẦNG ENRICHMENT. BẠN BỊ NGHIÊM CẤM TẠO RA LỖI MỚI HOẶC TỰ KẾT LUẬN LỖI. 
Nhiệm vụ của bạn là TÓM TẮT & TÌM SỰ TƯƠNG QUAN (Correlate) dựa trên kết luận có sẵn của Rule Engine.

Chỉ trả lời NGẮN GỌN (tối đa 4-5 dòng) tập trung vào các insight:
- Bạn thấy gì từ các bằng chứng (Evidence) và điểm chất lượng dữ liệu?
- Lỗi này thường xảy ra ở hoàn cảnh nào dựa trên tập lệnh? (ví dụ: đánh cặp vàng, phiên Á, sau khi thua...)
- Hậu quả (Impact) lớn nhất từ tập lệnh này là gì?
- 1 Lời khuyên hành động (Actionable advice) cụ thể để khắc phục.

Dữ liệu lệnh liên quan (JSON):
${JSON.stringify(compactTrades, null, 2)}

Trả về BẰNG TIẾNG VIỆT, định dạng plain text ngắn gọn, dùng gạch đầu dòng rõ ràng. KHÔNG ĐƯỢC TRẢ VỀ JSON, trả về nguyên văn text insight để hiển thị trực tiếp lên UI.
`;

    const models = getGeminiModels();
    let lastError = null;
    let responseText = null;

    for (const model of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP error ${res.status}`);
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          responseText = text.trim();
          break; // Success
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error('Gemini không phản hồi.');
    }

    return NextResponse.json({ insight: responseText });
  } catch (error) {
    console.error('AI Enrichment Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
