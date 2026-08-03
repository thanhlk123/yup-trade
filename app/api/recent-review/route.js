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
      en: 'IMPORTANT: Output Language MUST be English. Write all values (summary, insights, micro_goals) entirely in natural English.',
      zh: 'IMPORTANT: Output Language MUST be Simplified Chinese. Write all values entirely in natural Chinese.',
      ko: 'IMPORTANT: Output Language MUST be Korean. Write all values entirely in natural Korean.',
      es: 'IMPORTANT: Output Language MUST be Spanish. Write all values entirely in natural Spanish.',
      vi: 'IMPORTANT: Output Language MUST be Vietnamese. Write all values in Vietnamese.'
    }[lang] || 'IMPORTANT: Output Language MUST be Vietnamese.';

    const db = await getDb();
    let query = 'SELECT * FROM trades';
    const filter = getTradeTypeFilter(type, false);
    query += filter.sql;
    const params = filter.params;

    query += ' ORDER BY trade_time DESC';

    const allTrades = await db.all(query, params);

    if (allTrades.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Không có giao dịch nào để phân tích chuỗi lệnh.' 
      });
    }

    // Lấy 20 lệnh gần nhất để làm Context phân tích
    const trades = allTrades.slice(0, 20);

    // BƯỚC 1: TÍNH TOÁN BASELINE (Context Injection)
    const totalTrades = allTrades.length;
    const allWins = allTrades.filter(t => t.status === 'WIN');
    const allLosses = allTrades.filter(t => t.status === 'LOSS');
    
    const overallWinrate = totalTrades > 0 ? Math.round((allWins.length / totalTrades) * 100) : 0;
    
    // Tính trung bình khối lượng (size) của lệnh thắng và thua
    const avgWinSize = allWins.length > 0 ? allWins.reduce((sum, t) => sum + (parseFloat(t.size) || 0), 0) / allWins.length : 0;
    const avgLossSize = allLosses.length > 0 ? allLosses.reduce((sum, t) => sum + (parseFloat(t.size) || 0), 0) / allLosses.length : 0;

    // Tính Winrate theo từng Setup (chỉ tính các setup xuất hiện trong 20 lệnh gần nhất)
    const recentSetups = [...new Set(trades.map(t => t.setup_tag || 'Unclassified'))];
    const setupBaselines = {};
    recentSetups.forEach(setup => {
      const setupTrades = allTrades.filter(t => (t.setup_tag || 'Unclassified') === setup);
      const setupWins = setupTrades.filter(t => t.status === 'WIN').length;
      setupBaselines[setup] = {
        total: setupTrades.length,
        winrate: setupTrades.length > 0 ? Math.round((setupWins / setupTrades.length) * 100) : 0
      };
    });

    // Format trades context for Gemini
    const tradesContext = trades.map(t => ({
      asset: t.asset,
      side: t.side,
      size: t.size,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      pnl: t.pnl,
      status: t.status,
      trade_time: t.trade_time,
      setup_tag: t.setup_tag || 'Unclassified',
      notes: t.user_notes || '',
      ai_evaluation: typeof t.ai_evaluation === 'string' ? JSON.parse(t.ai_evaluation) : t.ai_evaluation
    }));

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      // Local fallback calculation
      const fallbackReport = generateLocalRecentReport(tradesContext, setupBaselines);
      return NextResponse.json({ success: true, data: fallbackReport, is_fallback: true });
    }

    const prompt = `
Bạn là một YUP Trade cấp cao (Phong cách: Chuyên nghiệp, Nghiêm khắc, Dựa trên Dữ liệu - "Tough Love"). Nhiệm vụ của bạn là đánh giá chuỗi ${tradesContext.length} lệnh giao dịch gần đây nhất.

### 1. DỮ LIỆU ĐỐI CHIẾU (HISTORICAL BASELINES):
Đây là phong độ tổng thể của Trader này, hãy dùng nó làm mốc so sánh để phát hiện bất thường trong chuỗi lệnh gần đây:
- Tỷ lệ Thắng (Winrate) Tổng Thể: ${overallWinrate}%
- Khối lượng (Volume/Size) trung bình lệnh Thắng: ${avgWinSize.toFixed(2)}
- Khối lượng trung bình lệnh Thua: ${avgLossSize.toFixed(2)}
- Phong độ các Setup Trader đang dùng gần đây:
${Object.entries(setupBaselines).map(([setup, stats]) => `  + Setup [${setup}]: Đã đánh ${stats.total} lệnh, Winrate: ${stats.winrate}%`).join('\\n')}

### 2. DANH SÁCH LỆNH GIAO DỊCH GẦN NHẤT (Sắp xếp từ mới nhất về trước):
${JSON.stringify(tradesContext.map(t => ({
  asset: t.asset,
  side: t.side,
  size: t.size,
  pnl: t.pnl,
  status: t.status,
  setup_tag: t.setup_tag,
  notes: t.notes
})), null, 2)}

Hãy viết báo cáo phân tích theo chuẩn Production, tập trung bóc tách vấn đề dựa trên so sánh số liệu (ví dụ: "Bạn đang đánh volume lớn hơn mức trung bình lệnh thua", "Bạn tiếp tục đánh setup có winrate thấp"). Trả về chính xác định dạng JSON sau:

{
  "summary": "Nhận xét tổng quan cực kỳ súc tích, chỉ thẳng vào phong độ chuỗi lệnh hiện tại và sự chênh lệch so với Baseline.",
  "technical_insight": "Phân tích KỸ THUẬT: Đánh giá cách vào lệnh, chọn setup, thời điểm giao dịch. Chỉ ra lỗi sai hệ thống.",
  "psychological_insight": "Phân tích TÂM LÝ: Dựa trên hành vi (nhồi lệnh, Fomo, trả thù) và tần suất vào lệnh. Có dấu hiệu Tilt không?",
  "risk_insight": "Phân tích QUẢN TRỊ RỦI RO: Đánh giá Volume so với mức trung bình, tỷ lệ PnL của chuỗi lệnh.",
  "micro_goals": [
    "Mục tiêu 1: Cụ thể, đo lường được, làm ngay trong lệnh tới (vd: Chỉ đi vol 0.1, set SL tự động).",
    "Mục tiêu 2: Thay đổi thói quen..."
  ]
}

### QUY TẮC PHÒNG TRÁNH LỖI PHÂN TÍCH JSON (CỰC KỲ QUAN TRỌNG):
1. KHÔNG được sử dụng dấu nháy kép lồng nhau bên trong chuỗi giá trị. Sử dụng dấu nháy đơn (') thay cho dấu nháy kép (") khi muốn trích dẫn.
2. Bắt buộc dùng \\n để xuống dòng trong các đoạn text dài.
3. LƯU Ý PHÁP LÝ TỐI QUAN TRỌNG: Bạn chỉ đóng vai trò phân tích lỗi sai kỹ thuật và tâm lý, cải thiện kỷ luật dựa trên dữ liệu quá khứ. NGHIÊM CẤM đưa ra bất kỳ lời khuyên mua bán, gợi ý đầu tư, hay dự báo giá cả tương lai nào. Tuyệt đối không sử dụng các cụm từ như "nên mua", "nên bán", "hãy vào lệnh", "mục tiêu giá". Rule này không có bất kỳ khoan nhượng nào.
4. ${langInstruction}
Chỉ trả về chuỗi JSON thô, không bọc trong markdown hay thẻ code.
`;

    const models = getGeminiModels();
    let lastError = null;
    let responseText = null;

    for (const model of models) {
      try {
        console.log(`Recent review: attempting with model: ${model}`);
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
          console.log(`Successfully generated recent review with model: ${model}`);
          break;
        }
      } catch (err) {
        console.warn(`Model ${model} failed for recent review:`, err.message);
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
    console.error('Error generating recent review:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Helper to generate a robust local fallback analysis
function generateLocalRecentReport(trades, setupBaselines = {}) {
  const total = trades.length;
  const wins = trades.filter(t => t.status === 'WIN').length;
  const losses = trades.filter(t => t.status === 'LOSS').length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const totalPnl = Math.round(trades.reduce((sum, t) => sum + t.pnl, 0) * 100) / 100;

  // Aggregate weaknesses for psychology
  const weaknessCounts = {};
  trades.forEach(t => {
    const ai = t.ai_evaluation;
    if (ai && ai.weaknesses) {
      ai.weaknesses.forEach(w => {
        weaknessCounts[w] = (weaknessCounts[w] || 0) + 1;
      });
    }
  });

  const repeating_mistakes = Object.entries(weaknessCounts)
    .filter(e => e[1] > 1)
    .sort((a, b) => b[1] - a[1])
    .map(e => `Lỗi '${e[0]}' lặp lại ${e[1]} lần.`)
    .join(' ');

  const bestSetup = Object.keys(setupBaselines).sort((a, b) => (setupBaselines[b].winrate - setupBaselines[a].winrate))[0];

  return {
    summary: `Chuỗi ${total} lệnh gần nhất: Tổng PnL ròng là ${totalPnl >= 0 ? '+' : ''}${totalPnl} USD (Winrate ${winRate}%). Tín hiệu cảnh báo: ${winRate < 40 ? 'Phong độ đang suy giảm mạnh.' : 'Vẫn đang duy trì kỷ luật cơ bản.'}`,
    technical_insight: `Phân tích Setup: Hầu hết các lệnh tập trung vào các mô hình quen thuộc. Setup tốt nhất của bạn hiện tại là [${bestSetup || 'Không rõ'}]. Hãy hạn chế giao dịch các mô hình khác cho đến khi phong độ ổn định.`,
    psychological_insight: repeating_mistakes ? `Dấu hiệu tâm lý bất ổn: Phát hiện ${repeating_mistakes} Cần nghỉ ngơi ngay lập tức nếu cảm thấy bứt rứt.` : `Tâm lý hiện tại có vẻ ổn định, không ghi nhận các lỗi lặp lại nghiêm trọng.`,
    risk_insight: `Khối lượng giao dịch: ${losses > 2 ? 'Chuỗi thua đang kéo dài, bạn cần bắt buộc phải giảm volume ở lệnh tiếp theo.' : 'Volume đang ở mức an toàn định mức.'}`,
    micro_goals: [
      "Nghỉ ngơi ít nhất 2 giờ trước khi vào lệnh tiếp theo.",
      "Chỉ vào lệnh khi có tín hiệu hội tụ đủ 3 yếu tố xác nhận.",
      "Đặt Stop Loss ngay lập tức khi vào lệnh, tuyệt đối không dịch SL gồng lỗ."
    ]
  };
}
