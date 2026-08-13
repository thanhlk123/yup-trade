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

  // 1. DATA PIPELINE (Normalized Context)
  const cleanNotes = (trade.user_notes || '').replace(/"/g, "'").replace(/\n/g, ' ');
  const t = {
    execution: {
      side: trade.side,
      entryPrice: trade.entry_price,
      exitPrice: trade.exit_price || null,
      stopLoss: trade.stop_loss || null,
      takeProfit: trade.take_profit || null,
      volume: trade.size,
      pnl: trade.pnl
    },
    setup: {
      setupTag: trade.setup_tag || null,
      entryTrigger: trade.entry_trigger || null,
      executionQuality: trade.execution_quality || null
    },
    marketContext: {
      trend: trade.market_trend || null,
      htf: trade.htf_context || null,
      poi: trade.poi || null,
      confluences: trade.confluences || null
    },
    risk: {
      riskPlan: trade.risk_plan || null
    },
    management: {
      tradeManagement: trade.trade_management || null,
      exitReason: trade.exit_reason || null
    },
    psychology: {
      emotions: trade.emotions || null,
      mistakes: trade.mistakes || null
    }
  };

  // 2. RULE & SIGNAL ENGINE
  const system_inconsistencies = [];
  const rp = t.risk.riskPlan || '';
  const sl = t.execution.stopLoss;

  if (rp.includes('Risk Followed') && !sl) {
    system_inconsistencies.push('Data Inconsistency: User claims Risk Followed, but SL is completely missing.');
  }

  const ruleEngineOutput = `
[RULE ENGINE - HARD FACTS]
- DATA INCONSISTENCIES: ${system_inconsistencies.length > 0 ? system_inconsistencies.join(' | ') : 'None'}
`;

  // 3. GEMINI PROMPT
  const prompt = `Bạn là một AI Trading Coach chuyên nghiệp. Nhiệm vụ của bạn là đọc toàn bộ dữ liệu giao dịch và trả về MỘT Insight Trung Tâm (Core Insight), KHÔNG lặp lại dữ liệu vô nghĩa.

## TONE & PERSONA (TRADING COACH)
- Xưng hô "bạn" hoặc không nhân xưng. Dùng giọng điệu hỗ trợ, khách quan, truyền cảm hứng.
- KHÔNG dạy đời, KHÔNG dùng từ ngữ cực đoan.
- KHÔNG khuyên những câu chung chung. Hãy đưa ra hành động cụ thể.

## MASTER PRINCIPLES (MUST FOLLOW)
1. THE CORE INSIGHT RULE: Mỗi lệnh giao dịch chỉ có DUY NHẤT 1 vấn đề (hoặc điểm tốt) cốt lõi nhất làm "North Star". Headline của bạn phải thể hiện Insight này.
2. SELECTIVITY: AI must consume all available user inputs, but only surface information that materially contributes to the diagnosis. Không liệt kê P/L, Volume, Entry, Exit nếu không dùng để chẩn đoán.
3. OBSERVED VS INFERRED CAUSALITY: User-provided labels are evidence, not proof of causality. (VD: Hãy nói "Giao dịch đồng thời được ghi nhận với FOMO và vi phạm kế hoạch rủi ro", KHÔNG nói "FOMO khiến bạn bỏ qua Stop Loss" trừ khi có bằng chứng rõ ràng).
4. MISSING DATA IS UNKNOWN, NOT NEGATIVE EVIDENCE: Nếu TP, Invalidation Point, hoặc Exit Price bị trống, tuyệt đối KHÔNG tự suy diễn là "Bạn không có kế hoạch thoát".
5. COUNTER-TREND IS NOT INHERENTLY WRONG: Giao dịch ngược xu hướng không mặc định là lỗi. Đừng đánh giá nó là "Rủi ro nghiêm trọng" (Màu Đỏ). Hãy xem nó là "Điểm cần lưu ý" (Màu Cam).
6. EVIDENCE IS PROOF, NOT SUMMARY: Trong mảng evidence, cột reason (WHY) chỉ mô tả Observation (VD: 'User ghi nhận trạng thái FOMO'), TUYỆT ĐỐI KHÔNG tự suy diễn nhân quả (VD: 'FOMO là nguyên nhân làm bạn thua').
7. NEVER EXPOSE RAW NULL/UNDEFINED: Tuyệt đối không trả về chuỗi "null", "undefined", "NaN" ra UI. Nếu field bị trống, hãy dùng "Not set" hoặc "Chưa đặt".

${ruleEngineOutput}

## RAW TRADE CONTEXT
${JSON.stringify(t, null, 2)}
User Note: "${cleanNotes}"

## REQUIRED JSON OUTPUT SCHEMA
Trả về ĐÚNG cấu trúc JSON sau:
{
  "summary": {
    "headline": "1 câu tổng kết sắc bén đại diện cho CORE INSIGHT",
    "explanation": "1-2 câu giải thích."
  },
  "diagnoses": [
    {
      "category": "Risk Management | Entry Discipline | Trade Management | Psychology",
      "severity": "critical | warning | info | success",
      "title": "Tiêu đề cực ngắn",
      "explanation": "Giải thích ngắn gọn."
    }
  ],
  "coaching": [
    "Hành động cụ thể."
  ],
  "evidence": [
    // BẮT BUỘC. Trả về đúng các FACT mà bạn đã dùng làm cơ sở chẩn đoán. Evidence is selective, not exhaustive.
    // VD1: { "field": "Stop Loss", "value": "Not set", "reason": "Không có mức dừng lỗ được ghi nhận." }
    // VD2: { "field": "Risk Plan", "value": "#Risk_Violated", "reason": "User ghi nhận giao dịch vi phạm kế hoạch quản trị rủi ro." }
    // VD3: { "field": "Emotion", "value": "#Emotion_FOMO", "reason": "User ghi nhận trạng thái FOMO khi thực hiện giao dịch." }
    // VD4: { "field": "Trend / Side", "value": "Down / BUY", "reason": "Vị thế BUY đang ngược với xu hướng được ghi nhận." }
    {
      "field": "Tên Dữ Liệu Thực Tế",
      "value": "Giá Trị Thực Tế (Tuyệt đối không dùng chữ 'null')",
      "reason": "Mô tả Fact khách quan, KHÔNG suy diễn nhân quả."
    }
  ]
}
}
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
