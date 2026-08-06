/**
 * Trading Improvement Engine — Gemini Coach
 * Sends the pre-computed context JSON to Gemini.
 * Gemini's ONLY jobs: interpret, prioritize 1 issue, create action plan, motivate with data.
 */

import { getGeminiModels } from '@/lib/ai-agent';

/**
 * Calls Gemini with a structured prompt. Returns parsed JSON coaching output.
 */
export async function callGeminiCoach(context, lang = 'vi') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Thiếu GEMINI_API_KEY trong .env');

  const langMap = {
    vi: 'Tiếng Việt (Vietnamese)',
    en: 'English',
    zh: '中文 (Chinese)',
    ko: '한국어 (Korean)',
    es: 'Español (Spanish)'
  };
  const targetLang = langMap[lang] || 'English';

  const systemPrompt = `You are a brilliant, data-driven Trading Diagnostician. 
You do NOT make absolute judgments, but use probabilistic language based on data (e.g. "Data shows an 89% probability...", "AI suspects that...").
Your job: recall past sessions (if any), diagnose the disease, find psychological contradictions, predict future outcomes with probabilities, and assign EXACTLY 1 mission.
IMPORTANT: You MUST generate ALL your text content in ${targetLang}. JSON keys must remain strictly in English as defined in the output format, but their string values MUST be in ${targetLang}.`;

  const rules = `STRICT RULES (Violating these will result in meaningless output):
1. DYNAMIC DISEASE: Do not always diagnose Overtrade. Based on data, diagnose varied issues (Revenge Trading, FOMO, Early exit, Holding losses, Moving SL, Counter-trend, Impatience...).
2. MUST score 4 components (discipline, risk, execution, psychology) out of 100, health_score is average. Include "status".
3. 'diagnosis': MUST have 'disease', 'evidence' (data point), 'reason' (root cause), 'trigger'.
4. 'trading_story': DO NOT use timestamps. MUST use EMOJIS to tell a psychological escalation story (e.g., 😀 Win -> 😎 Confident -> 😡 Lose).
5. 'ai_vs_you': 'ai_sees' MUST contain hard data (% or USD) to debunk 'you_think'.
6. 'prediction': MUST include 'explanation' for the prediction and 'probability_percent'.
7. 'mission': Include 'success_probability' and 'expected_health_improvement'.
8. 'trading_dna': MUST use SPECIFIC DATA-DRIVEN PHRASES (e.g. "You never moved SL in 50 trades" instead of "Good SL"). Analyze 'strength', 'weakness', 'superpower', 'blind_spot', 'ideal_style'.
9. 'coach_conclusion': MUST use a doctor's authoritative tone based on evidence (e.g., "In the last 50 trades, there is no evidence your strategy is flawed... You need to know when to stop.").
10. 'trading_personality': Evaluate MBTI-style personality (e.g., Hunter, Sniper, Action Addict) with Execution, Emotion, Risk styles.
11. 'coach_memory': IF 'previousGeminiOutput' exists in context, compare current vs past. Else null.`;

  const outputFormat = `{
  "trading_personality": {
    "archetype": "Action Addict",
    "execution_style": "Fast",
    "emotion": "High",
    "risk": "Controlled"
  },
  "coach_memory": {
    "last_session_recall": "Tuần trước bạn bị Overtrade nặng (28 lần).",
    "progress_comparison": "Tuần này bạn đã giảm xuống còn 12 lần. Đây là một sự cải thiện lớn, nhưng 84% lỗ vẫn đến từ lệnh thứ 3."
  },
  "health": {
    "current_score": 58,
    "status": "Poor",
    "discipline": 42,
    "risk": 83,
    "execution": 71,
    "psychology": 35
  },
  "diagnosis": {
    "disease": "Overtrade",
    "impact_score": 96,
    "loss_usd": 475,
    "evidence": "28 lần Overtrade chiếm 50% tổng số lệnh.",
    "reason": "Sử dụng giao dịch như một cơ chế giải tỏa cảm xúc thay vì thực thi kế hoạch.",
    "trigger": "Revenge trading sau khi thua hoặc hưng phấn quá mức sau khi thắng."
  },
  "trading_story": "😀 Thắng lệnh đầu tiên -> 😎 Tự tin thái quá -> 🤑 Vào lệnh thứ 3 vì hưng phấn -> 😡 Lệnh thua xuất hiện -> 😤 Cay cú muốn gỡ -> 😵 Mất kiểm soát -> 💥 Cháy tài khoản.",
  "root_cause": "Bạn không thiếu kỹ năng. Dữ liệu chỉ ra bạn thiếu khả năng kết thúc một ngày giao dịch.",
  "hidden_pattern": "Pattern phổ biến nhất là đánh mất lợi nhuận sau 2 lệnh thắng liên tiếp (chiếm 89%).",
  "prediction": {
    "probability_percent": 71,
    "explanation": "Dựa trên dữ liệu lịch sử, nếu bạn tiếp tục duy trì thói quen trade quá 3 lệnh/ngày, xác suất bạn mất thêm 640$ trong 20 lệnh tới là rất cao.",
    "if_ignored_pnl_usd": -640
  },
  "ai_vs_you": {
    "you_think": "Tôi thua vì thị trường biến động mạnh và tin tức.",
    "ai_sees": "Dữ liệu cho thấy tin tức chỉ là yếu tố phụ; 84% khoản lỗ thực tế đến từ việc bạn cố nhồi lệnh thứ 3, gây thiệt hại hơn 400$."
  },
  "mission": {
    "title": "Cắt màn hình ngay sau lệnh thứ 2 trong ngày, bất kể thắng thua.",
    "why_this_mission": "Dữ liệu cho thấy 84% khoản lỗ phát sinh từ lệnh thứ 3 trở đi. Bạn phải chặn đứng sự tự hủy hoại này.",
    "duration_trades": 20,
    "success_probability": 74,
    "expected_health_improvement": 12
  },
  "trading_dna": {
    "strength": "Bạn chưa từng bỏ Stop Loss trong 50 giao dịch vừa qua.",
    "weakness": "Bạn có xu hướng x2 khối lượng ngay sau một lệnh thua lớn.",
    "superpower": "Tỉ lệ win rate đạt 78% khi giao dịch thuận xu hướng H4.",
    "blind_spot": "Bạn chỉ mất tiền khi cố bắt sóng hồi (counter-trend) ở phiên Mỹ.",
    "ideal_style": "Swing Trading",
    "coach_conclusion": "Trong 50 giao dịch vừa qua, AI không tìm thấy bằng chứng nào cho thấy chiến lược của bạn là nguyên nhân gây lỗ. Mọi khoản lỗ lớn đều xuất hiện sau khi kế hoạch giao dịch ban đầu đã hoàn thành. Điều bạn cần cải thiện không phải là cách vào lệnh, mà là biết khi nào nên dừng."
  }
}`;

  const prompt = `${systemPrompt}

${rules}

DỮ LIỆU ĐẦU VÀO / INPUT DATA (System calculated, includes 'previousGeminiOutput' if history exists):
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

Return JSON in exactly the following structure (do NOT add text outside JSON, coach_memory is null if no history exists):
${outputFormat}

CRITICAL LANGUAGE REQUIREMENT: You MUST translate and write ALL string values in ${targetLang}. Do NOT write in English unless ${targetLang} is English. Keep the JSON keys in English as they are shown above.`;

  const models = getGeminiModels();
  let lastError = null;
  let responseText = null;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3,
              maxOutputTokens: 1500,
            },
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`API ${res.status}: ${err.error?.message || res.statusText}`);
      }
      const data = await res.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (responseText) break;
    } catch (err) {
      console.warn(`[GeminiCoach] Model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  if (!responseText) throw lastError || new Error('Gemini không phản hồi.');

  // Clean and parse
  let cleaned = responseText.trim();
  if (cleaned.startsWith('\`\`\`json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('\`\`\`')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('\`\`\`')) cleaned = cleaned.slice(0, -3);

  try {
    return JSON.parse(cleaned.trim());
  } catch (e) {
    console.error('[GeminiCoach] JSON parse failed:', cleaned);
    throw new Error('Gemini trả về JSON không hợp lệ.');
  }
}
