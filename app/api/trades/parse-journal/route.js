import { NextResponse } from 'next/server';
import { getGeminiModels } from '@/lib/ai-agent';

export async function POST(request) {
  try {
    const { journalText, journalDate } = await request.json();
    
    if (!journalText) {
      return NextResponse.json({ success: false, error: 'Chưa cung cấp nội dung nhật ký.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng kiểm tra file .env.local.' 
      }, { status: 500 });
    }

    const prompt = `
Bạn là một trợ lý AI phân tích dữ liệu giao dịch chuyên nghiệp. Nhiệm vụ của bạn là đọc một nhật ký giao dịch thô (dạng chữ tiếng Việt) của một ngày và phân tích, trích xuất nó thành một danh sách các lệnh giao dịch có cấu trúc JSON sạch sẽ.

Nội dung nhật ký thô được cung cấp dưới đây:
\"\"\"
${journalText}
\"\"\"

Ngày mặc định của các giao dịch (nếu không tự suy luận được từ tiêu đề nhật ký): ${journalDate || new Date().toISOString().split('T')[0]}

### HƯỚNG DẪN TRÍCH XUẤT VÀ PHÂN TÍCH:
1. **Xác định các lệnh giao dịch**:
   - Đối chiếu danh sách tóm tắt (bảng ID | TREND | LỆNH | VOL | KẾT QUẢ | TRẠNG THÁI) với phần chi tiết bên dưới (ví dụ: "LỆNH #1", "LỆNH #2", ...).
   - Hãy trích xuất tất cả các lệnh được đề cập.
   - Nếu một dòng chi tiết gộp nhiều lệnh (ví dụ: "LỆNH #7,8,9: tổng thua nhẹ -30$, 3 lệnh hòa hết"), hãy tự động tách thành 3 lệnh riêng biệt (Lệnh 7, Lệnh 8, Lệnh 9) với PnL chia đều (ví dụ: mỗi lệnh -10 USD), khối lượng và tài sản tương đương.
   - Nếu lệnh #10 ghi nhận: "sell fomo, gồng đứt -400$, vol 0.4 sau đó, lấy 1 tài khoản khác gồng sell tiếp đứt thêm -450$", hãy tách thành 2 lệnh: lệnh 10 (vol 0.4, pnl -400, side SELL) và lệnh 11 (pnl -450, side SELL).

2. **Trích xuất các trường thông tin cho mỗi lệnh**:
   - \`asset\`: Cặp tiền/tài sản (ví dụ: "XAUUSD"). Tìm từ phần chi tiết như "🔴 LỆNH #1: ... - XAUUSD". Nếu không có, điền "XAUUSD" làm mặc định.
   - \`side\`: Hướng lệnh, chỉ nhận giá trị "BUY" hoặc "SELL". Nếu phần tóm tắt ghi "buy" hay "sell" thì lấy. Nếu không ghi, hãy đọc kỹ chi tiết (ví dụ: "entry sell 0.08" -> "SELL", "buy ngược scalp" -> "BUY").
   - \`size\`: Khối lượng giao dịch (VOL/Vol), ví dụ: 0.08, 0.1, 0.2, 0.4. Nhập dạng số thực.
   - \`pnl\`: Lợi nhuận/Thua lỗ ròng bằng USD. Ví dụ: "-$46" -> -46.0, "94$" -> 94.0. Nhập dạng số thực.
   - \`status\`: Trạng thái kết quả, chỉ nhận: "WIN" (nếu pnl > 0), "LOSS" (nếu pnl < 0), "BREAKEVEN" (nếu pnl = 0).
   - \`setup_tag\`: Nhãn chiến thuật/trend. Lấy từ cột TREND (ví dụ: "kororang", "sw", "trengiam"), bỏ dấu #. Nếu không có trong cột, suy luận từ ghi chú (ví dụ: "fomo" -> "FOMO Trade", "pullback" -> "Pullback").
   - \`entry_price\`: Giá vào lệnh. Nếu có đề cập trong văn bản chi tiết (ví dụ: "entry limit 21" hoặc "đỉnh tại 25") thì lấy giá trị số đó. Nếu không có, điền 0.0.
   - \`exit_price\`: Giá đóng lệnh. Nếu có số thì lấy, không có điền 0.0.
   - \`stop_loss\`: Giá cắt lỗ (số thực hoặc null).
   - \`take_profit\`: Giá chốt lời (số thực hoặc null).
   - \`trade_time\`: Thời gian giao dịch dưới định dạng YYYY-MM-DD HH:MM (ví dụ: "2026-07-08 10:00"). Hãy tăng dần thời gian một chút giữa các lệnh (ví dụ: Lệnh 1 lúc 09:00, Lệnh 2 lúc 10:00, Lệnh 3 lúc 11:00...) để chúng xếp đúng thứ tự thời gian trong ngày đó.
   - \`trade_type\`: Loại giao dịch, mặc định hãy đặt là "LIVE" (Tài Khoản Live). Nếu ghi chú có nhắc đến "backtest" thì đặt là "BACKTEST".
   - \`user_notes\`: Ghi chú bối cảnh chi tiết của lệnh đó do người dùng viết. Hãy tổng hợp từ cả bảng tóm tắt và phần chi tiết liên quan (Ví dụ: bao gồm Trend, KL, M1, M5, M15, Entry - SL - TP, Tâm lý & Bài học của lệnh đó). CỰC KỲ QUAN TRỌNG: Phải giữ nguyên cấu trúc ngắt dòng (xuống dòng) ban đầu của người dùng bằng cách sử dụng các ký tự xuống dòng '\\n' trong chuỗi JSON, tuyệt đối không được gộp chúng thành một dòng hay một đoạn văn liền mạch.

3. **Kiểm tra mức độ số hóa của lệnh (digitization & feedback)**:
   - Hãy trích xuất xem ghi chép thô của lệnh có các yếu tố sau không. Nếu có, hãy trích xuất chúng. Nếu không rõ, hãy đặt là "Không rõ":
     - \`session\`: Phiên giao dịch (ví dụ: Á, Âu, Mỹ, hoặc Không rõ)
     - \`key_level\`: Cản nào (ví dụ: KL 25, KL 4061, hoặc Không rõ)
     - \`price_reaction\`: Cách giá phản ứng tại cản (ví dụ: Sweep, Reject, Breakout, FBO, hoặc Không rõ)
     - \`entry_trigger\`: Thế nến/Tín hiệu vào lệnh (ví dụ: Engulfing_M1, Pinbar_M1, Double_Bottom_M1, hoặc Không rõ)
     - \`entry_method\`: Cách vào lệnh (ví dụ: Limit_Touch, Confirm_Market, Retest_Pullback, hoặc Không rõ)
   - Hãy đánh giá mức độ số hóa thông tin của lệnh dưới dạng **\`standardization_feedback\`**:
     - \`score\`: Điểm số hóa (0-100), dựa trên tỷ lệ trường thông tin số hóa được điền đầy đủ (mỗi trường trong 5 trường trên có giá trị số hóa rõ ràng, khác "Không rõ" đóng góp 20% vào điểm).
     - \`missing_fields\`: Mảng các tên trường tiếng Việt bị thiếu hoặc ghi "Không rõ" (chọn từ: ["Phiên giao dịch", "Vị trí Key Level", "Cách giá phản ứng tại cản", "Thế nến vào lệnh", "Cách vào lệnh"]).
     - \`suggested_notes\`: Một đoạn văn bản gợi ý ghi chú đã được chuẩn hóa lại toàn bộ theo cấu trúc chuẩn để người dùng có thể sao chép hoặc áp dụng trực tiếp. Hãy dựng sẵn khung sườn và điền các trường đã biết, các trường chưa biết hãy bọc trong ngoặc vuông dạng "[Điền thế nến vào lệnh...]" để họ tự điền.
       Ví dụ mẫu cấu trúc gợi ý:
       "🔴 LỆNH #[Số ID]:
       - Phiên: [Tên phiên]
       - Vị trí KL: [Tên cản]
       - Phản ứng: [Tên phản ứng]
       - Thế nến Entry: [Thế nến entry]
       - Cách Entry: [Cách entry]
       - Chi tiết: [Tóm tắt bối cảnh và tâm lý]"

4. **Phân tích AI Coach cho mỗi lệnh (ai_evaluation)**:
   - Hãy đóng vai trò AI Coach phân tích lệnh này để điền trực tiếp vào trường \`ai_evaluation\` của lệnh đó. Định dạng \`ai_evaluation\` là một Object chứa:
     - \`setup_tag\`: Phân loại setup bắt buộc thuộc một trong các nhóm: 'Keylevel' (cho các lệnh Hỗ trợ/Kháng cự/Keylevel Bounce), 'Breakout', 'LHRetest' (cho các lệnh retest), 'FBO' (Fake Breakout - phá vỡ giả), 'FOMO' (giao dịch do cảm xúc/mua đuổi), 'Trend Following' (giao dịch thuận xu hướng/EMA), 'Discretionary' (lệnh ngẫu hứng/khác).
     - \`strengths\`: Mảng các điểm mạnh/quyết định đúng đắn của lệnh này.
     - \`weaknesses\`: Mảng các điểm yếu/lỗi của lệnh này.
     - \`decision_rating\`: Điểm số kỷ luật/kỹ thuật từ 1.0 đến 10.0 (số thực).
     - \`advice\`: Lời khuyên của Coach.

### YÊU CẦU ĐẦU RA JSON:
Trả về duy nhất một đối tượng JSON thô có cấu trúc sau, không kèm bất kỳ thẻ markdown hay text giải thích nào khác ngoài JSON:
{
  "success": true,
  "trades": [
    {
      "asset": "XAUUSD",
      "side": "SELL",
      "size": 0.08,
      "pnl": -46.0,
      "status": "LOSS",
      "setup_tag": "kororang",
      "entry_price": 22.0,
      "exit_price": 0.0,
      "stop_loss": null,
      "take_profit": null,
      "trade_time": "2026-07-08 09:00",
      "trade_type": "LIVE",
      "image_url": null,
      "user_notes": "...",
      "digitization": {
        "session": "Á",
        "key_level": "KL 2 đỉnh tại 25",
        "price_reaction": "FBO",
        "entry_trigger": "Không rõ",
        "entry_method": "Confirm_Market"
      },
      "standardization_feedback": {
        "score": 80,
        "missing_fields": ["Thế nến vào lệnh"],
        "suggested_notes": "🔴 LỆNH #1:\\n- Phiên: Á\\n- Vị trí KL: KL 2 đỉnh tại 25\\n- Phản ứng: FBO (Phá vỡ giả)\\n- Thế nến Entry: [Điền thế nến vào lệnh, ví dụ: Engulfing_M1]\\n- Cách Entry: Confirm_Market\\n- Chi tiết: Lệnh này phát hiện bất thường..."
      },
      "ai_evaluation": {
        "setup_tag": "Breakout",
        "strengths": ["..."],
        "weaknesses": ["..."],
        "decision_rating": 5.0,
        "advice": "..."
      }
    }
  ]
}

### QUY TẮC PHÒNG TRÁNH LỖI PHÂN TÍCH JSON (CỰC KỲ QUAN TRỌNG):
1. KHÔNG được sử dụng dấu nháy kép lồng nhau bên trong chuỗi giá trị (ví dụ: các trường user_notes, suggested_notes, advice). Nếu có từ ngữ cần nhấn mạnh hoặc trích dẫn, hãy sử dụng dấu nháy đơn (') thay cho dấu nháy kép (").
Ví dụ SAI: "advice": "Lệnh này do trader "Fomo" vào..."
Ví dụ ĐÚNG: "advice": "Lệnh này do trader 'Fomo' vào..."
2. Nếu bắt buộc phải xuống dòng trong các chuỗi giá trị, hãy sử dụng ký tự xuống dòng đã được escape là \\n (hai dấu gạch chéo ngược kèm chữ n) để phân tách các dòng trong JSON, tuyệt đối KHÔNG được xuống dòng vật lý (Enter trực tiếp) trong chuỗi.
3. Không trả về dấu phẩy thừa ở cuối phần tử JSON.
4. LƯU Ý PHÁP LÝ TỐI QUAN TRỌNG: Bạn chỉ đóng vai trò phân tích lỗi sai kỹ thuật và tâm lý, cải thiện kỷ luật dựa trên dữ liệu quá khứ. NGHIÊM CẤM đưa ra bất kỳ lời khuyên mua bán, gợi ý đầu tư, hay dự báo giá cả tương lai nào. Tuyệt đối không sử dụng các cụm từ như "nên mua", "nên bán", "hãy vào lệnh", "mục tiêu giá". Rule này không có bất kỳ khoan nhượng nào.
`;

    const models = getGeminiModels();
    let lastError = null;
    let responseText = null;

    for (const model of models) {
      try {
        console.log(`Attempting to parse journal with model: ${model}`);
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
          console.log(`Successfully parsed journal with model: ${model}`);
          break; // Exit loop on success
        }
      } catch (err) {
        console.warn(`Model ${model} failed:`, err.message);
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
      return NextResponse.json(parsed);
    } else {
      throw lastError || new Error("Failed to get response from any Gemini model");
    }
  } catch (error) {
    console.error('Error parsing journal text:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
