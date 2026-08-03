# Hướng dẫn Đóng gói & Build Ứng dụng Desktop (.dmg) với Electron

Tài liệu này tổng hợp toàn bộ lịch sử thiết lập, cấu hình kĩ thuật và quy trình chuẩn để đóng gói dự án **AI Trading** (Next.js 16 + SQLite) thành file cài đặt macOS `.dmg` cho chip Apple Silicon (M1/M2/M3/M4) và Intel.

---

## 📌 1. Tổng quan Kiến trúc (Architecture Overview)

Dự án này sử dụng:
- **Frontend & Backend API**: Next.js 16 (App Router) với các API routes truy vấn cơ sở dữ liệu SQLite.
- **Cơ sở dữ liệu**: SQLite (`sqlite3` + `sqlite`).
- **Desktop Runtime**: Electron 34 + `electron-builder`.

### Các vấn đề kỹ thuật quan trọng đã giải quyết:
1. **Next.js Standalone Mode (`output: 'standalone'`)**: Do ứng dụng dùng Node server API & SQLite, không thể export tĩnh (static export). Next.js được cấu hình xuất server độc lập gọn nhẹ.
2. **Xử lý Native C++ Module (`sqlite3`)**:
   - Next 16 dùng Turbopack mặc định sẽ mã hóa tên module native `sqlite3` thành hash file. Ta dùng `next build --webpack` và `serverExternalPackages: ['sqlite3', 'sqlite']` để giữ nguyên module external.
   - **Khác biệt ABI giữa Node.js và Electron**: `next build` cần `sqlite3` theo ABI của Node hệ thống, trong khi Electron cần ABI của Electron V8. Quy trình build bắt buộc tuân theo thứ tự: `npm rebuild` -> `next build` -> `electron-builder install-app-deps` -> `copy-standalone`.
3. **Đường dẫn chạy server trong Electron (`app.asar.unpacked`)**:
   - Node process (`child_process.fork`) không thể thực thi file trực tiếp bên trong nén `app.asar`.
   - Cấu hình `"asarUnpack": [".next/standalone/**/*"]` và trong `electron/main.js` tự động chuyển đường dẫn sang thư mục đĩa thật `app.asar.unpacked`.
4. **Lưu trữ dữ liệu người dùng (`trades.db`)**:
   - Khi chạy đóng gói, file cơ sở dữ liệu được tự động lưu tại `~/Library/Application Support/ai-trading/trades.db` (thư mục `userData` của Electron).
   - Lần đầu chạy app, file `trades.db` mẫu sẽ tự động được copy sang `userData` để đảm bảo dữ liệu giao dịch không bị mất khi cập nhật ứng dụng.

---

## 📁 2. Các File Cấu hình Chính trong Dự án

### 1. `next.config.mjs`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sqlite3', 'sqlite'],
};

export default nextConfig;
```

### 2. `lib/db.js`
Đường dẫn database linh hoạt:
```javascript
function getDbPath() {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  if (process.env.ELECTRON_USER_DATA_PATH) {
    const userDataDir = process.env.ELECTRON_USER_DATA_PATH;
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    const userDbPath = path.join(userDataDir, 'trades.db');
    const sourceDbPath = path.join(process.cwd(), 'trades.db');
    if (!fs.existsSync(userDbPath) && fs.existsSync(sourceDbPath)) {
      try {
        fs.copyFileSync(sourceDbPath, userDbPath);
      } catch (err) {
        console.error('Failed to copy seed trades.db:', err);
      }
    }
    return userDbPath;
  }
  return path.join(process.cwd(), 'trades.db');
}
```

### 3. `electron/main.js`
Quản lý Lifecycle và khởi chạy Standalone Server:
```javascript
function getStandaloneDir() {
  let basePath = app.getAppPath();
  if (basePath.endsWith('app.asar')) {
    basePath = basePath.replace(/app\.asar$/, 'app.asar.unpacked');
  }
  const standaloneDir = path.join(basePath, '.next', 'standalone');
  if (fs.existsSync(standaloneDir)) {
    return standaloneDir;
  }
  return path.join(app.getAppPath(), '.next', 'standalone');
}
```

### 4. `scripts/copy-standalone.mjs`
Tự động copy tài nguyên tĩnh và `sqlite3` native module đã rebuild vào standalone folder:
```javascript
import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const standaloneDir = path.join(cwd, '.next', 'standalone');

if (!fs.existsSync(standaloneDir)) {
  console.error('.next/standalone does not exist. Run "next build" first.');
  process.exit(1);
}

// Copy .next/static
fs.cpSync(path.join(cwd, '.next', 'static'), path.join(standaloneDir, '.next', 'static'), { recursive: true });

// Copy public
fs.cpSync(path.join(cwd, 'public'), path.join(standaloneDir, 'public'), { recursive: true });

// Copy trades.db seed
if (fs.existsSync(path.join(cwd, 'trades.db'))) {
  fs.copyFileSync(path.join(cwd, 'trades.db'), path.join(standaloneDir, 'trades.db'));
}

// Copy rebuilt native sqlite3 module
if (fs.existsSync(path.join(cwd, 'node_modules', 'sqlite3'))) {
  fs.cpSync(path.join(cwd, 'node_modules', 'sqlite3'), path.join(standaloneDir, 'node_modules', 'sqlite3'), { recursive: true });
}
```

### 5. `electron-builder.json`
Cấu hình đóng gói Electron:
```json
{
  "$schema": "https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/scheme.json",
  "appId": "com.aitrading.app",
  "productName": "AI Trading",
  "directories": {
    "output": "dist"
  },
  "files": [
    "electron/**/*",
    ".next/standalone/**/*",
    ".next/standalone/node_modules/**/*",
    "package.json"
  ],
  "includeSubNodeModules": true,
  "asar": true,
  "asarUnpack": [
    ".next/standalone/**/*"
  ],
  "mac": {
    "identity": null,
    "target": [
      {
        "target": "dmg",
        "arch": ["arm64"]
      },
      {
        "target": "zip",
        "arch": ["arm64"]
      }
    ],
    "category": "public.app-category.finance"
  }
}
```

---

## ⚡ 3. Các Lệnh Thao Tác (Commands)

### A. Khởi chạy chế độ Phát triển (Dev Mode)
Chạy Next.js dev server đồng thời mở ứng dụng Electron:
```bash
npm run electron:dev
```

### B. Đóng gói ứng dụng thành file `.dmg` (Build Production)
Chạy chuỗi lệnh build tự động:
```bash
npm run electron:build
```
> **Chuỗi lệnh hoạt động bên dưới:**
> `npm rebuild && next build --webpack && npx electron-builder install-app-deps --arch arm64 && node scripts/copy-standalone.mjs && electron-builder --config electron-builder.json`

File đầu ra sẽ nằm tại:
📂 `dist/AI Trading-0.1.0-arm64.dmg`

---

## 🛡️ 4. Khắc phục lỗi macOS Gatekeeper khi mở app lần đầu

Do ứng dụng tự đóng gói cá nhân (chưa mua Apple Developer ID $99/năm), macOS Gatekeeper có thể chặn mở ứng dụng.

### Cách 1: Mở bằng Chuột phải (Đề xuất)
1. Kéo ứng dụng vào thư mục `/Applications`.
2. Giữ phím `Control` + **bấm chuột phải** vào **AI Trading** -> Chọn **Open** (Mở).
3. Nhấn **Open** xác nhận lần đầu.

### Cách 2: Gỡ cờ Quarantine bằng Terminal (Nếu báo "App damaged")
```bash
sudo xattr -rd com.apple.quarantine /Applications/AI\ Trading.app
```

---

## 🔍 5. Bảng tổng hợp Lỗi & Cách xử lý (Troubleshooting Matrix cho AI Agent & Developer)

| # | Hiện tượng (Symptom / Error Log) | Nguyên nhân gốc (Root Cause) | Giải pháp xử lý triệt để (Fix Protocol) |
|---|----------------------------------|------------------------------|------------------------------------------|
| **1** | `Error: spawn ENOTDIR` khi Electron gọi `fork()` | `app.getAppPath()` trả về file nén `app.asar`, Node.js `fork()` không thể chạy file trong file archive. | Sửa `electron/main.js` dùng `app.getAppPath().replace('app.asar', 'app.asar.unpacked')` và đặt `"asarUnpack": [".next/standalone/**/*"]` trong `electron-builder.json`. |
| **2** | `Error: Cannot find module 'next'` khi app chạy | `electron-builder` mặc định bỏ qua các thư mục `node_modules` con trong các thư mục định nghĩa ở `files`. | Đặt `"includeSubNodeModules": true` và thêm `".next/standalone/node_modules/**/*"` vào danh sách `files` trong `electron-builder.json`. |
| **3** | `Error: Cannot find module 'sqlite3-03df7d93c81c1156'` | Turbopack mặc định của Next.js 16 mã hóa tên module native `sqlite3` thành chuỗi hash làm gãy import runtime. | Thêm `serverExternalPackages: ['sqlite3', 'sqlite']` vào `next.config.mjs` và sử dụng cờ `next build --webpack`. |
| **4** | `ERR_DLOPEN_FAILED (mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64'))` | 1. Khi build song song cả `x64` và `arm64`, `sqlite3` bị ghi đè phiên bản Intel `x86_64` cuối cùng.<br>2. Thư mục `.next/standalone` copy file binary `x86_64` cũ trước khi `@electron/rebuild` chạy. | 1. Đặt `"arch": ["arm64"]` chuyên biệt cho Mac M1/M2/M3 trong `electron-builder.json`.<br>2. Chạy `npx electron-builder install-app-deps --arch arm64` **trước** lệnh `node scripts/copy-standalone.mjs`. |
| **5** | Lỗi `Failed to collect page data` trong `next build` | Nếu `install-app-deps` (cho Electron V8 ABI) chạy **trước** `next build`, Node.js hệ thống sẽ từ chối nạp `sqlite3` của Electron khi compile static pages. | Giữ đúng thứ tự chuỗi lệnh: `npm rebuild` (cho Node) -> `next build` -> `electron-builder install-app-deps` (cho Electron) -> `copy-standalone`. |
| **6** | App mở lên có biểu tượng verify rồi tự đóng | Một trong các lỗi server crash im lặng ở trên xảy ra, khiến `electron/main.js` bắt catch block và gọi `app.quit()`. | Chạy ứng dụng từ Terminal: `"dist/mac-arm64/AI Trading.app/Contents/MacOS/AI Trading"` để xem trực tiếp log lỗi console. |

