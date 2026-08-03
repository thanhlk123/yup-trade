/**
 * AI Agent for Trading Setup Analysis
 * Detects trade setups, evaluates strengths and weaknesses, and gives optimizing advice.
 */

export function getGeminiModels() {
  const envModel = process.env.GEMINI_MODEL || process.env.NEXT_PUBLIC_GEMINI_MODEL;
  const defaultModels = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  
  if (envModel) {
    const customModels = envModel.split(',').map(m => m.trim()).filter(Boolean);
    const allModels = [...customModels, ...defaultModels];
    return Array.from(new Set(allModels));
  }
  
  return defaultModels;
}

// Simple, high-quality rule-based fallback analyzer
function analyzeLocalHeuristics(trade) {
  const notes = (trade.user_notes || '').toLowerCase();
  let setup_tag = 'Unclassified';
  
  // 1. Detect Setup based on notes keywords
  if (notes.includes('fomo') || notes.includes('chạy mất') || notes.includes('đuổi') || notes.includes('chasing') || notes.includes('sợ lỡ')) {
    setup_tag = 'FOMO Trade';
  } else if (notes.includes('breakout') || notes.includes('phá vỡ') || notes.includes('phá kháng cự') || notes.includes('phá hỗ trợ')) {
    setup_tag = 'Breakout';
  } else if (notes.includes('retest') || notes.includes('pullback') || notes.includes('hồi') || notes.includes('test lại')) {
    setup_tag = 'Pullback / Retest';
  } else if (notes.includes('hỗ trợ') || notes.includes('kháng cự') || notes.includes('bounce') || notes.includes('cản') || notes.includes('support') || notes.includes('resistance')) {
    setup_tag = 'Support / Resistance Bounce';
  } else if (notes.includes('trend') || notes.includes('xu hướng') || notes.includes('ema') || notes.includes('ma') || notes.includes('dòng tiền')) {
    setup_tag = 'Trend Following';
  } else if (notes.includes('phân kỳ') || notes.includes('divergence') || notes.includes('đảo chiều') || notes.includes('reversal') || notes.includes('đỉnh') || notes.includes('đáy')) {
    setup_tag = 'Reversal';
  } else if (notes.includes('tin tức') || notes.includes('news') || notes.includes('fomc') || notes.includes('cpi')) {
    setup_tag = 'News Trading';
  } else {
    setup_tag = 'Discretionary Trade';
  }

  // 2. Evaluate strengths, weaknesses & advice
  const strengths = [];
  const weaknesses = [];
  let decision_rating = 5;
  let advice = '';

  const isWin = trade.pnl > 0;
  const isLoss = trade.pnl < 0;

  // Evaluate risk management
  const hasSL = trade.stop_loss && trade.stop_loss > 0;
  const hasTP = trade.take_profit && trade.take_profit > 0;

  if (hasSL) {
    strengths.push("Có đặt Stop Loss để quản trị rủi ro tối đa.");
    decision_rating += 1.5;
  } else {
    weaknesses.push("Không đặt Stop Loss rõ ràng, rủi ro cháy tài khoản rất cao.");
    decision_rating -= 2.5;
  }

  if (hasTP) {
    strengths.push("Có mục tiêu chốt lời (Take Profit) xác định trước.");
  }

  // Setup specific insights
  if (setup_tag === 'FOMO Trade') {
    weaknesses.push("Vào lệnh do cảm xúc chi phối (FOMO), không theo kế hoạch.");
    decision_rating -= 2.0;
    advice = "Tuyệt đối không vào lệnh khi giá đã chạy xa điểm entry tối ưu. Hãy ghi danh sách quy tắc vào lệnh và đọc lại trước khi click chuột.";
  } else if (setup_tag === 'Breakout') {
    if (isWin) {
      strengths.push("Kiên nhẫn đợi nến đóng cửa xác nhận phá vỡ thành công.");
      decision_rating += 1.0;
      advice = "Giao dịch breakout tốt. Tiếp tục giữ quy tắc kiên nhẫn đợi xác nhận, tránh mua đuổi khi chưa đóng nến.";
    } else {
      weaknesses.push("Giao dịch phá vỡ giả (Fakeout) hoặc mua đúng đỉnh sóng hồi.");
      decision_rating -= 1.0;
      advice = "Để tối ưu Breakout, hãy chia nhỏ volume vào lệnh hoặc đợi giá retest cản rồi mới vào full lệnh.";
    }
  } else if (setup_tag === 'Support / Resistance Bounce') {
    if (isWin) {
      strengths.push("Xác định vùng cản chính xác và có phản ứng giá tốt.");
      decision_rating += 1.5;
      advice = "Rất tốt, setup mua tại hỗ trợ / bán tại kháng cự có xác suất thắng cao. Nên duy trì kỷ luật này.";
    } else {
      weaknesses.push("Bắt dao rơi khi lực bán/mua quá mạnh phá vỡ cản.");
      decision_rating -= 1.0;
      advice = "Hãy đợi nến rút chân hoặc các mô hình đảo chiều (Pinbar, Engulfing) xuất hiện tại vùng cản rồi mới vào lệnh thay vì đặt lệnh limit thụ động.";
    }
  } else if (setup_tag === 'Trend Following') {
    strengths.push("Giao dịch thuận xu hướng chính, tận dụng dòng tiền lớn.");
    decision_rating += 1.0;
    advice = "Trend is your friend. Nên ưu tiên duy trì setup này vì nó cho tỷ lệ R:R (Risk/Reward) tốt nhất.";
  }

  // General win/loss evaluations
  if (isWin) {
    if (decision_rating < 6) decision_rating = 6.5; // override for lucky wins
  }

  // Final advice polish
  if (!advice) {
    if (isWin) {
      advice = "Lệnh thắng tốt. Tiếp tục phát huy đúng kỷ luật và quản lý vốn.";
    } else {
      advice = "Hãy xem lại nhật ký giao dịch xem lệnh này có phạm phải sai lầm lặp lại nào không. Rút kinh nghiệm về điểm dừng lỗ.";
    }
  }

  // Parse custom user-written strengths and weaknesses from user_notes
  const strengthsFromNotes = [];
  const weaknessesFromNotes = [];
  if (trade.user_notes) {
    const noteLines = trade.user_notes.split('\n');
    noteLines.forEach(line => {
      const trimmed = line.trim();
      const strengthMatch = trimmed.match(/^(làm đúng|đúng|điểm mạnh|strength)\s*:\s*(.+)$/i);
      if (strengthMatch) {
        strengthsFromNotes.push(strengthMatch[2].trim());
      }
      const weaknessMatch = trimmed.match(/^(làm sai|sai|điểm yếu|lỗi|khắc phục|sửa|weakness)\s*:\s*(.+)$/i);
      if (weaknessMatch) {
        weaknessesFromNotes.push(weaknessMatch[2].trim());
      }
    });
  }

  const finalStrengths = strengthsFromNotes.length > 0 ? strengthsFromNotes : strengths;
  const finalWeaknesses = weaknessesFromNotes.length > 0 ? weaknessesFromNotes : weaknesses;

  // Ensure decision rating stays in 1-10 range
  decision_rating = Math.max(1, Math.min(10, Math.round(decision_rating * 10) / 10));

  return {
    setup_tag,
    strengths: finalStrengths,
    weaknesses: finalWeaknesses,
    decision_rating,
    advice,
    is_fallback: true
  };
}

export async function analyzeTradeWithAI(trade, lang = 'vi') {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  if (!apiKey) {
    // If no API Key is provided, fallback to the local heuristics engine.
    return analyzeLocalHeuristics(trade);
  }

  const cleanNotes = (trade.user_notes || '').replace(/"/g, "'").replace(/\n/g, ' ');

  const prompt = `
Bạn là một YUP Trade chuyên phân tích nhật ký giao dịch (Trading Journal).
Hãy phân tích giao dịch sau và trả về kết quả định dạng JSON.

Thông tin giao dịch:
- Cặp tài sản: ${trade.asset}
- Chiều: ${trade.side} (BUY/SELL)
- Giá vào (Entry): ${trade.entry_price}
- Giá ra (Exit): ${trade.exit_price}
- Cắt lỗ (Stop Loss): ${trade.stop_loss || 'Không đặt'}
- Chốt lời (Take Profit): ${trade.take_profit || 'Không đặt'}
- Khối lượng: ${trade.size}
- Lợi nhuận/Thua lỗ (PnL): ${trade.pnl} USD
- Nhật ký ghi chú của trader: "${cleanNotes}"

Yêu cầu đầu ra dạng JSON chính xác với cấu trúc:
{
  "setup_tag": "Tên setup giao dịch bắt buộc thuộc một trong các phương pháp sau: 'Keylevel' (cho các lệnh Hỗ trợ/Kháng cự/Keylevel Bounce), 'Breakout' (phá vỡ cản), 'LHRetest' (retest cấu trúc/đỉnh/đáy cục bộ), 'FBO' (Fake Breakout - phá vỡ giả), 'FOMO' (giao dịch do cảm xúc/mua đuổi), 'Trend Following' (giao dịch thuận xu hướng/EMA), hoặc 'Discretionary' (ngẫu hứng/khác)",
  "strengths": ["Mảng các điểm mạnh/quyết định đúng đắn của trader trong lệnh này. Ví dụ: Đặt SL đầy đủ, Kiên nhẫn chờ hồi quy..."],
  "weaknesses": ["Mảng các điểm yếu/sai lầm/lỗi cảm xúc trong lệnh này. Ví dụ: FOMO mua đuổi, Gồng lỗ quá sâu, Chốt non..."],
  "decision_rating": 8.5, // Điểm số chấm cho tính kỷ luật và kỹ thuật của lệnh từ 1.0 đến 10.0
  "advice": "Lời khuyên chi tiết, thực tế bằng ngôn ngữ ${lang === 'vi' ? 'Tiếng Việt' : 'English'} để tối ưu hóa hiệu suất giao dịch và chi phí/tỷ lệ thắng cho setup này lần sau."
}

### QUY TẮC PHÒNG TRÁNH LỖI PHÂN TÍCH JSON & ĐỌC GHI CHÚ (CỰC KỲ QUAN TRỌNG):
1. KHÔNG được sử dụng dấu nháy kép lồng nhau bên trong chuỗi giá trị (ví dụ: các trường strengths, weaknesses, advice). Nếu có từ ngữ cần nhấn mạnh hoặc trích dẫn, hãy sử dụng dấu nháy đơn (') thay cho dấu nháy kép (").
Ví dụ SAI: "advice": "Lệnh này do trader "Fomo" vào..."
Ví dụ ĐÚNG: "advice": "Lệnh này do trader 'Fomo' vào..."
2. Nếu bắt buộc phải xuống dòng trong các chuỗi giá trị, hãy sử dụng ký tự xuống dòng đã được escape là \\n (hai dấu gạch chéo ngược kèm chữ n), tuyệt đối KHÔNG được xuống dòng vật lý (Enter trực tiếp) trong chuỗi.
3. Không trả về dấu phẩy thừa ở cuối phần tử JSON.
4. ĐẶC BIỆT LƯU Ý: Nếu trong ghi chú nhật ký của trader có ghi dòng "Làm đúng: [nội dung]" hoặc "Làm sai: [nội dung]", hãy ưu tiên đưa chính xác các nội dung này vào mảng "strengths" và "weaknesses" tương ứng trong JSON kết quả.
5. LƯU Ý PHÁP LÝ TỐI QUAN TRỌNG: Bạn chỉ đóng vai trò phân tích lỗi sai kỹ thuật và tâm lý, cải thiện kỷ luật dựa trên dữ liệu quá khứ. NGHIÊM CẤM đưa ra bất kỳ lời khuyên mua bán, gợi ý đầu tư, hay dự báo giá cả tương lai nào. Tuyệt đối không sử dụng các cụm từ như "nên mua", "nên bán", "hãy vào lệnh", "mục tiêu giá". Rule này không có bất kỳ khoan nhượng nào.
`;

  const models = getGeminiModels();
  let lastError = null;
  let responseText = null;

  for (const model of models) {
    try {
      console.log(`Attempting trade analysis with model: ${model}`);
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
        console.log(`Successfully analyzed trade with model: ${model}`);
        break; // Exit loop on success
      }
    } catch (err) {
      console.warn(`Model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  if (responseText) {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        ...parsed,
        is_fallback: false
      };
    } catch (parseErr) {
      console.error("Error parsing AI JSON response, falling back to heuristics:", parseErr);
      return analyzeLocalHeuristics(trade);
    }
  } else {
    console.error("Error calling Gemini API, falling back to local heuristics. Last error:", lastError ? lastError.message : 'No active model responded');
    return analyzeLocalHeuristics(trade);
  }
}
