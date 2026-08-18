# AI Trading Agent Rules

1. Tuyệt đối focus vào prompt, không lan man. Điểm nào chưa rõ thì phải hỏi lại trước khi làm.

## BEHAVIOR ENGINE V2 (Data-Driven & Cross-Validation)

Khi nhận yêu cầu phân tích, refactor hoặc viết mới một logic phát hiện Hành vi Giao dịch (Bad/Good Behaviors) trong thư mục `lib/behaviors/`, BẮT BUỘC tuân thủ các quy tắc sau:

1. **Trade Data Schema:**
   - Dữ liệu luôn có: `pnl`, `stop_loss`, `take_profit`, `size`, `user_notes`, `mistakes` (Array of tags), `emotions` (Array of tags), `risk_plan`.

2. **Cross-Validation (Toán học hóa / Kiểm chứng chéo):**
   - KHÔNG bao giờ tin tưởng mù quáng vào tag thủ công của user hoặc chuỗi text trong `user_notes`. 
   - Nếu user tag `#Mistake_NoSl` hoặc nói "Mental Stop", phải dùng Toán học để kiểm chứng (Ví dụ: Tính `effectiveR`, kiểm tra `pnl` có âm nặng hơn baseline hay không). Nếu user nói dối hoặc bao biện, phạt bằng cách đẩy `Severity` lên cao nhất (9.5+).
   - Mọi logic phải bóc tách thành 4 lớp: `Context Extraction`, `Mathematical Validation`, `Impact/Edge Degradation`, `Evidence Generation`.

3. **Tính toán Impact (Edge Degradation):**
   - Phải chứng minh được Behavior đó gây thiệt hại như thế nào. (Ví dụ: Trung bình lệnh CÓ behavior này lỗ/lãi bao nhiêu so với lệnh KHÔNG CÓ behavior này).
   - Đưa ra Coaching Message cực kỳ sát thương, chọc thẳng vào dòng tiền ("Việc thả rông SL làm trung bình lỗ phình to gấp X lần").

4. **Tận dụng tối đa Tags (`lib/behaviors/tags.js`):**
   - Khai thác triệt để các tags cảm xúc (`#Emotion_Hope`, `#Emotion_Fear`, v.v.) và bối cảnh để làm phong phú Evidence báo cáo cho user.

5. **Nguyên tắc "Isolation" (Không tác động chéo):**
   - Khi fix, refactor hoặc nâng cấp 1 Behavior cụ thể, TUYỆT ĐỐI không được làm ảnh hưởng đến logic của các Behavior khác.
   - Tránh việc sửa đổi các helper dùng chung làm phá vỡ kiến trúc cũ, dẫn đến rà đi rà lại. Mỗi Behavior phải là một khối độc lập và tuân thủ chặt chẽ ranh giới của mình (Không tranh công attribution).
