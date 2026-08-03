<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Electron DMG Build Guidelines (1-Shot Build Protocol)
When building or modifying the Electron desktop app for this repository:
1. Always refer to [BUILD.md](file:///Users/duyenpt/WorkPlace/ai-trading%202%20copy%202/BUILD.md) for detailed architecture and issue resolution matrix.
2. Build command must always be `npm run electron:build`.
3. Never use Turbopack for standalone builds with native C++ modules (`sqlite3`); always use `next build --webpack` with `serverExternalPackages: ['sqlite3', 'sqlite']`.
4. Always build native dependencies specifically for Electron ARM64 using `npx electron-builder install-app-deps --arch arm64` before copying to `.next/standalone/node_modules/sqlite3`.
5. Ensure `standaloneDir` in `electron/main.js` resolves via `app.asar.unpacked`.

