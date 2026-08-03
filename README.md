# 📈 AI Trading Journal - Feature Specification & E2E Context

Tài liệu này đóng vai trò là "Đặc tả tính năng" (Feature Specification) và **Bối cảnh (Context) phục vụ cho quá trình tự động hóa kiểm thử E2E (End-to-End Testing)**. Nó liệt kê chi tiết mọi tương tác, chức năng và luồng dữ liệu trên 2 màn hình chính của ứng dụng: `Dashboard` và `Studio`.

---

## 1. Màn hình Bảng Điều Khiển (Dashboard / Home)
Đây là màn hình trung tâm, nơi quản lý toàn bộ dữ liệu giao dịch và cung cấp các báo cáo hiệu suất tài chính.

### 1.1. Hệ thống Toàn cục (Global System)
- **Đa ngôn ngữ (i18n):** Nút chuyển đổi (Toggle) giữa Tiếng Anh và Tiếng Việt. Giao diện phải thay đổi text lập tức mà không cần reload trang.
- **Chế độ Giao diện (Theme):** Nút chuyển đổi Light Mode / Dark Mode. Yêu cầu đổi màu nền, màu chữ, viền border đồng bộ toàn trang.
- **Quản lý Tài khoản:** Tabs chuyển đổi độc lập giữa `Live Account` (Tài khoản thật) và `Demo Account` (Tài khoản thử nghiệm). Dữ liệu của 2 tab này phải được lưu vào 2 bảng/phân vùng riêng biệt trong Database (SQLite), không được rò rỉ dữ liệu chéo.

### 1.2. Nhập liệu & Đồng bộ Dữ liệu (Data Import)
- **Import CSV/Excel:** Form cho phép tải lên file CSV chứa lịch sử giao dịch (từ MT4/MT5/Exness). Hệ thống cần xử lý bóc tách các cột (Ngày giờ, Ticker, Buy/Sell, Volume, Entry, SL, TP, Profit...).
- **Nhập liệu AI (OCR Parsing):** Tính năng `Parse Trade Table Screenshot`.
  - Người dùng tải lên (Upload) một bức ảnh chụp màn hình lịch sử giao dịch.
  - Hệ thống bóc tách số liệu và tự động tạo các bản ghi (Trade Record) vào danh sách mà không cần nhập tay.

### 1.3. Báo cáo Hiệu suất & Phân tích (Analytics)
- **Thẻ KPI cốt lõi (KPI Cards):** Tính toán toán học và hiển thị các thông số:
  - Tổng lợi nhuận ròng (Net PnL).
  - Tỷ lệ Thắng (Win Rate %).
  - Tỷ lệ Lợi nhuận/Rủi ro trung bình (Average R:R).
  - Mức sụt giảm tài khoản tối đa (Max Drawdown).
- **Phân tích Chi phí (Trade Cost Optimization):** Thống kê chi tiết số tiền bị thâm hụt do Phí giao dịch (Commission), Phí qua đêm (Swap), và Trượt giá (Spread).
- **Biểu đồ Trực quan:** Biểu đồ Bar Chart (Lợi nhuận theo tháng/tuần), Pie Chart (Tỷ trọng giao dịch theo mã tài sản). *Click vào một cột trên biểu đồ phải filter (lọc) danh sách giao dịch phía dưới tương ứng.*

### 1.4. Quản lý Nhật ký Giao dịch (Trade Journaling)
- **Danh sách Giao dịch:** Hiển thị dạng bảng (Table) hoặc thẻ (Cards) danh sách các lệnh. Có phân trang (Pagination) hoặc cuộn vô hạn (Infinite Scroll).
- **Chi tiết Giao dịch (Trade Modal):**
  - **CRUD:** Tạo mới, Cập nhật, Xóa giao dịch.
  - Tải lên (Upload) ảnh chụp màn hình biểu đồ vào một giao dịch cụ thể để làm bằng chứng.
  - Ghi chú (Notes) và Đánh giá (Review) nguyên nhân Thắng/Thua.
- **Hệ thống Hashtag & Chú giải (Glossary):**
  - Gắn thẻ (Tag) chiến lược (Ví dụ: `#breakout`, `#fomo`).
  - Lọc (Filter) danh sách giao dịch theo Hashtag.
  - **Tooltip Glossary:** Khi rê chuột (hover) vào một Hashtag trong bảng thuật ngữ, popup (tooltip) sẽ hiện ra giải thích nguyên tắc của chiến lược đó.

---

## 2. Màn hình Phân Tích Kỹ Thuật (Studio Chart)
Đường dẫn: `/studio`. Đây là màn hình giả lập biểu đồ chuyên nghiệp (tương tự TradingView), dùng để review lại điểm vào lệnh của một giao dịch cụ thể.

### 2.1. Cấu hình Nguồn Dữ liệu (Market Data Feed)
- Hệ thống tự động nhận diện mã tài sản (Ticker).
- **API Routing:**
  - Nếu mã là Crypto/Kim loại (XAUUSD, XAGUSD, BTCUSDT), gọi API Binance / Bybit để lấy nến (Klines).
  - Nếu mã là Forex/Chứng khoán (EURUSD, AAPL), tự động định tuyến sang API Yahoo Finance.
- Xử lý mượt mà khi đổi khung thời gian (Timeframes): 1m, 5m, 15m, 1H, 1D.

### 2.2. Biểu đồ Nến & Tương tác (Main Chart)
- Xây dựng bằng `lightweight-charts` (Không dùng thư viện nặng).
- Hỗ trợ cuộn chuột zoom-in/zoom-out, kéo thả chảo (pan).
- Hỗ trợ Pagination (Fetch thêm dữ liệu nến cũ khi kéo kịch sang trái).
- Sync Dark/Light mode của hệ thống vào màu nền, lưới (grid) và màu nến (Đỏ/Xanh).

### 2.3. Kho Chỉ báo Kỹ thuật (Technical Indicators)
Toàn bộ thuật toán (Math) đã được trích xuất ra `lib/utils/technicalIndicators.js` và được bao phủ 100% bằng **Unit Test (Jest)**, có cơ chế chặn lỗi `NaN`.

- **Chỉ báo Overlay (Vẽ đè lên Nến chính):**
  - Simple Moving Average (SMA).
  - Exponential Moving Average (EMA).
  - Bollinger Bands (BB): Gồm 3 đường (Upper, Middle, Lower).
- **Chỉ báo Oscillator (Vẽ ở các cửa sổ phụ bên dưới):**
  - Volume (Tự động tính tick-volume nội suy nếu sàn trả về volume = 0). Có 2 màu Đỏ/Xanh đồng bộ với nến.
  - Relative Strength Index (RSI): Có 2 đường line biên giới (30, 70).
  - MACD (Moving Average Convergence Divergence): Gồm MACD Line, Signal Line và Histogram (có xử lý 4 sắc thái màu theo gia tốc động lượng).
  - Stochastic Oscillator: Gồm %K và %D, biên giới (20, 80).
  - Average True Range (ATR).
- **Quản lý Chỉ báo (Indicator Legend):**
  - Dropdown Menu: Chọn để thêm chỉ báo vào biểu đồ.
  - Hover chuột vào Legend: Hiện các nút chức năng:
    - **Hide/Show (Hình con mắt):** Ẩn/hiện series.
    - **Settings (Hình bánh răng):** Chỉnh sửa chu kỳ (Length), màu sắc. Biểu đồ phải render lại tức thì (Real-time).
    - **Delete (Dấu X):** Xóa hoàn toàn chỉ báo khỏi bộ nhớ, biểu đồ layout lại không gian.
- **Dynamic Layout Engine (Thuật toán xếp chồng Oscillator):**
  - Nếu bật nhiều Oscillator cùng lúc (RSI, MACD, Stoch, ATR), hệ thống tự động chia đều không gian.
  - Giới hạn (Cap) tổng chiều cao của tất cả Oscillator không được vượt quá **60%** chiều cao màn hình, bảo vệ vùng Nến chính không bị nén mất dạng.

### 2.4. Thanh Công cụ Vẽ (Drawing Toolbar)
- **Trendline (Đường xu hướng):** Kéo thả điểm đầu, điểm cuối.
- **Fibonacci Retracement:** Vẽ thang đo hồi quy tự động hiển thị các mốc (0, 0.236, 0.382, 0.5, 0.618, 1).
- **Text Annotation:** Viết chữ trực tiếp lên không gian biểu đồ để đánh dấu vùng Supply/Demand.
- **Clear All:** Xóa toàn bộ các nét vẽ.

### 2.5. Chụp ảnh (Export / Screenshot)
- Nút "Camera": Bắt sự kiện xuất vùng Canvas của biểu đồ thành file ảnh JPEG/PNG để đính kèm ngược lại vào màn hình Dashboard (Nhật ký giao dịch).

---

## 3. Tech Stack & Test Environment
- **Core:** Next.js (App Router), React 19.
- **DB:** SQLite cục bộ (bảo vệ quyền riêng tư 100%).
- **E2E Testing Setup (Planned):** Playwright hoặc Cypress. Các ID của các nút bấm cần được gán thẻ `data-testid` để phục vụ tự động hóa kiểm thử click.
- **Unit Testing:** Jest (Thực thi cho toàn bộ hàm tính toán Toán học tài chính).
- **Build Target:** Web Browser & macOS Desktop App (Electron DMG).

> **Ghi chú cho QA/Automation Tester:** Tài liệu này phản ánh chính xác cấu trúc luồng của phiên bản hiện tại. Hãy sử dụng nó để lên các kịch bản BDD (Behavior-Driven Development) và viết test script chính xác.
