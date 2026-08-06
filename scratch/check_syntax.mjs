import fs from 'fs';
import path from 'path';

const dirs = ['execution', 'risk', 'sequence', 'context', 'good'];
const base = './lib/behaviors';

async function check() {
  let hasError = false;
  for (const dir of dirs) {
    const dirPath = path.join(base, dir);
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const fullPath = path.resolve(dirPath, file);
      try {
        await import(fullPath);
      } catch (e) {
        console.error(`Syntax error in ${file}:`, e.message);
        hasError = true;
      }
    }
  }
  if (hasError) process.exit(1);
  console.log("All files imported successfully.");
}

check();
