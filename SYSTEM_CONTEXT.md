# AI Trading Application - System Context

Tài liệu này mô tả cấu trúc, luồng dữ liệu chuẩn, các quy chuẩn về hashtag trong hệ thống để AI đọc và nắm rõ bối cảnh trước khi code hoặc review.

## 1. Nguồn Dữ Liệu và Chuẩn Đầu Vào

Dữ liệu giao dịch (Trades) đi vào hệ thống qua 2 đường chính:
1. **Import qua file CSV** (`components/ImportCSVModal.js`)
2. **Nhập thủ công (Manual Input)** (`components/TradeForm.js` -> `app/api/trades/route.js`)

**Trade Data Schema chuẩn trong CSDL (`lib/db.js`)**:
- `asset` (VD: XAUUSD, EURUSD)
- `side` (BUY / SELL)
- `entry_price`, `exit_price`, `stop_loss`, `take_profit`
- `size` (Khối lượng - Lot)
- `pnl` (Profit/Loss bằng USD)
- `status` (WIN / LOSS / BREAKEVEN)
- `trade_time`, `exit_time` (Định dạng: `YYYY-MM-DD HH:mm:ss` UTC)
- `user_notes` (Ghi chú của người dùng, chứa các diễn giải)
- **Taxonomy (Phân loại chi tiết, lưu dưới dạng text, thường là mảng các Tags)**: `setup_tag`, `market_trend`, `entry_trigger`, `execution_quality`, `trade_management`, `poi`, `htf_context`, `confluences`, `exit_reason`, `risk_plan`, `setup_grade`, `risk_amount`, `emotions`, `mistakes`.

## 2. Chuẩn hoá dữ liệu CSV (CSV Normalization)

Quá trình import CSV trong `ImportCSVModal.js` xử lý dữ liệu qua các bước:
1. **Mapping Header Tự động**: Phân tích các cột dựa vào keywords (VD: `asset` ánh xạ từ 'symbol', 'pair', 'tài sản'; `pnl` ánh xạ từ 'profit', 'lợi nhuận').
2. **Chuẩn hoá Timezone**: Giao diện cho phép user nhập Timezone offset. Hệ thống sẽ tự động trừ đi offset này và lưu vào DB chuẩn thời gian **UTC**.
3. **Tính toán PnL tự động**: Nếu thiếu PnL, tính dựa vào `(exit - entry) * size * contractSize` (Contract Size: XAU=100, XAG=5000, Forex=100000, Crypto=1).
4. **Auto-Grouping DCA (Gộp lệnh)**: Thuật toán quét các lệnh cùng `asset`, cùng chiều, có thời gian nắm giữ giao nhau để gộp thành 1 lệnh tổng. 
   - Lệnh tổng sẽ có Entry/Exit trung bình tính theo trọng số Volume.
   - PnL và Size được cộng dồn.
   - `user_notes` sẽ có nội dung tự động: `[Giao dịch DCA gộp từ X lệnh ngày Y] - Lệnh #1...`.

## 3. Nhập liệu thủ công (Manual Input / Web Form)

Quá trình nhập qua `TradeForm` vào `app/api/trades/route.js`:
- Tính PnL tương tự CSV nếu user để trống.
- `status` được tự động gán dựa vào dấu của `pnl` (Dương = WIN, Âm = LOSS).
- Mọi dữ liệu đi qua API POST/PUT đều sẽ được đẩy xuống database `trades.db`.
- Tùy vào giá trị `skip_ai`, nếu `false`, trade sẽ tự động qua hệ thống **Gemini AI Coach** (`lib/ai-agent.js`) để đánh giá và gắn thêm `ai_evaluation`.

## 4. Định nghĩa Tags & Hashtags (`lib/behaviors/tags.js`)

Hệ thống Behavior Engine V2 yêu cầu Cross-Validation cực kỳ nghiêm ngặt giữa Data và Tags. Các hashtag cố định được hệ thống hiểu bao gồm:

**Mistakes (Sai lầm):**
- `#Mistake_GreedHolding` (Gồng lỗ/Cố chấp)
- `#Mistake_NoSl` (Thả rông Stop Loss)
- `#Mistake_DCA` (Nhồi lệnh, Averaging Down)
- `#Mistake_FOMO` (Vào lệnh sợ lỡ cơ hội)
- `#Mistake_RevengeTrade` (Trả thù thị trường)
- `#Mistake_OverTrade` (Vào quá nhiều lệnh)
- `#Mistake_OverRisk` (Rủi ro quá lớn)
- `#Mistake_MovedSL` (Dời SL ra xa)
- `#Mistake_EarlyExit` / `#Mistake_EarlyEntry` / `#Mistake_LateEntry`
- `#Mistake_CounterTrend` (Cản tàu)
- `#Mistake_NewsTrading` (Đánh tin)

**Emotions (Cảm xúc):**
- `#Emotion_Hope` (Hy vọng hão huyền)
- `#Emotion_FOMO` (Sợ lỡ kèo)
- `#Emotion_Anger` (Giận dữ)
- `#Emotion_Fear` (Sợ hãi)
- `#Emotion_Greed` (Tham lam)
- `#Emotion_Frustration` (Ức chế)

**Quy tắc cho Behavior Engine V2**: 
1. Không tin tưởng mù quáng vào Tags. Phải dùng Toán học kiểm chứng.
2. Nếu user có biểu hiện sai lầm (ví dụ DCA) thông qua dữ liệu toán (Entry sau tệ hơn Entry trước, Volume lớn) nhưng KHÔNG tự giác gắn Tag `#Mistake_DCA` -> Hệ thống sẽ tính đây là thái độ che giấu/bao biện và **cộng thêm điểm Severity** để răn đe mạnh tay.
3. Khi phân tích, phải lôi các Tag Cảm xúc ra để đối chiếu (ví dụ: gồng lỗ kèm tag `#Emotion_Hope`).

## 5. Nguyên tắc Bất Khả Xâm Phạm (Isolation & Backward Compatibility)
Khi tiến hành phát triển bất kỳ tính năng nào hoặc logic lỗi hành vi mới:
- **Tuyệt đối KHÔNG ĐƯỢC làm ảnh hưởng (impact) tới các function/logic đã được tạo trước đó.** Mọi code mới phải được đóng gói gọn gàng, tôn trọng ranh giới của các component cũ.
- Nếu trong quá trình đọc hiểu/viết code phát hiện function cũ có điểm bất hợp lý hoặc rủi ro, **BẮT BUỘC phải báo cáo lại cho User ngay lập tức** để User quyết định có sửa hay không. Tuyệt đối không tự ý refactor hay sửa đổi logic cũ gây side-effect.
