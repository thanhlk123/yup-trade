import { NextResponse } from 'next/server';
import { getGeminiModels, cleanObject } from '@/lib/ai-agent';

export const maxDuration = 60; 

export async function POST(request) {
  try {
    const payload = await request.json();
    
    // V2 Payload structure
    const { 
      behavior,
      summary,
      evidence,
      trades,
      dataCoverage,
      evidenceQuality,
      tradingMonths
    } = payload;

    if (!behavior || !behavior.id) {
      return NextResponse.json({ error: 'Thiếu thông tin Behavior V2' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu API Key của Gemini.' }, { status: 500 });
    }

    // Clean empty fields from representative trades to save tokens
    const cleanedTrades = (trades || []).map(t => cleanObject(t));

    // Compute data coverage context for AI tone calibration
    const coveragePct = dataCoverage != null ? Math.round(dataCoverage * 100) : null;
    const coverageNote = coveragePct != null
      ? coveragePct >= 70
        ? `Dữ liệu đầy đủ (${coveragePct}% trường được điền) — phân tích có độ tin cậy cao.`
        : coveragePct >= 40
          ? `Dữ liệu trung bình (${coveragePct}% trường được điền) — một số nhận định có thể chưa hoàn toàn chính xác.`
          : `Dữ liệu thưa (${coveragePct}% trường được điền) — hãy thận trọng với kết luận, cần thêm dữ liệu.`
      : '';

    const prompt = `
Bạn là một AI Trading Coach (Huấn luyện viên giao dịch).
Hệ thống Behavior Engine đã phân tích lịch sử giao dịch và tìm ra một Pattern (Mẫu hành vi) quan trọng.

--- THÔNG TIN BEHAVIOR PATTERN ---
Tên lỗi: ${behavior.name} (ID: ${behavior.id} | Mức độ nghiêm trọng: ${behavior.severity || 'Medium'})
Thống kê:
- Tần suất: ${summary?.occurrences || 0} lệnh (${summary?.affectedRatio || 'N/A'} tổng số lệnh)
- Tác động PnL: $${summary?.impact_pnl || 0}
- Winrate khi dính lỗi này: ${summary?.winRate_vs_baseline || 'N/A'}
- Xu hướng hiện tại: ${summary?.trend || 'Không rõ'}
- Độ tự tin của dữ liệu (Data Confidence): ${summary?.confidence || 'N/A'}
${tradingMonths ? `- Dữ liệu trải dài: ${tradingMonths} tháng giao dịch` : ''}

--- CHẤT LƯỢNG DỮ LIỆU ---
${coverageNote || 'Không có thông tin về mức độ đầy đủ dữ liệu.'}
Chất lượng bằng chứng (Evidence Quality): ${evidenceQuality || 'medium'}

--- BẰNG CHỨNG (EVIDENCE) ---
[Quan sát hệ thống đo được - Observed]
${evidence?.observed?.length > 0 ? evidence.observed.map(e => '- ' + e).join('\n') : 'Không có'}

[Người dùng tự khai báo - Declared]
${evidence?.declared?.length > 0 ? evidence.declared.map(e => '- ' + e).join('\n') : 'Không có'}

[Suy luận tương quan - Derived]
${evidence?.derived?.length > 0 ? evidence.derived.map(e => '- ' + e).join('\n') : 'Không có'}

--- VÍ DỤ TIÊU BIỂU ---
${JSON.stringify(cleanedTrades, null, 2)}

--- YÊU CẦU CHO AI COACH ---
BẠN BỊ CẤM "ĐOÁN" LỖI. Rule Engine đã xác định lỗi. Việc của bạn là CHUYỂN HOÁ DỮ LIỆU NÀY THÀNH LỜI KHUYÊN (COACHING).
Không lặp lại những con số thống kê một cách máy móc, hãy tập trung vào Insights và Action.
${coveragePct != null && coveragePct < 40 ? 'Dữ liệu thưa — hãy đưa ra lời khuyên thận trọng hơn, tập trung vào nguyên tắc tổng quát thay vì kết luận cụ thể.' : ''}

Hãy trả về phản hồi theo định dạng sau, KHÔNG dùng Markdown heading (#) mà dùng BOLD (**):

**WHAT TO CHANGE (AI COACHING)**
(Viết 1 đoạn ngắn 2-3 câu giải thích tại sao chuỗi hành vi này nguy hiểm dựa trên dữ liệu tương quan. Ví dụ: "Dữ liệu cho thấy mỗi khi bạn FOMO, bạn có xu hướng vi phạm Risk Plan và chốt tay sớm...")

(Sau đó cung cấp 1 Checklist hành động gồm 3 bước cụ thể để người dùng khắc phục lỗi này trước khi vào lệnh tiếp theo. Dùng checkbox icon ✅)
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
            generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
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
