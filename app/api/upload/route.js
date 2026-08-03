import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const { files } = await req.json();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ success: false, error: 'No files provided' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'charts');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const savedUrls = [];

    for (const file of files) {
      const { filename, base64 } = file;
      
      // Match base64 data URL
      const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        console.warn(`Invalid base64 string for file ${filename}`);
        continue;
      }
      
      const buffer = Buffer.from(matches[2], 'base64');
      const safeFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
      const filePath = path.join(uploadDir, safeFilename);
      
      fs.writeFileSync(filePath, buffer);
      
      // The public URL path (served by Next.js from /public)
      savedUrls.push(`/uploads/charts/${safeFilename}`);
    }

    return NextResponse.json({ success: true, urls: savedUrls });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
