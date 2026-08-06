const fs = require('fs');
const path = require('path');

const libDir = path.join(__dirname, '../lib/behaviors');
const dirs = ['execution', 'risk', 'sequence', 'context', 'good'];

dirs.forEach(dir => {
  const dirPath = path.join(libDir, dir);
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
  
  files.forEach(file => {
    // Skip ones already done manually
    if (['noSl.js', 'noTp.js', 'exitTooEarly.js'].includes(file)) return;
    
    const filePath = path.join(dirPath, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Remove baseConfidence
    content = content.replace(/\s*baseConfidence:\s*\d+,/g, '');

    // 2. Change detect(trades) to detect(trades, config)
    if (content.includes('detect(trades) {')) {
      content = content.replace('detect(trades) {', 'detect(trades, config) {\n    const evidence = [];\n    let confidence = 0.85;\n');
    }

    // 3. Replace confidence: this.baseConfidence with confidence, evidence,
    content = content.replace(/confidence:\s*(this\.baseConfidence|.*?\?.*?:\s*this\.baseConfidence|.*?),/g, 'confidence,\n      evidence,\n      ');
    // If no confidence field existed (some good behaviors might not use baseConfidence), just add it if missing?
    if (!content.includes('evidence,')) {
      content = content.replace('coverage:', 'confidence,\n      evidence,\n      coverage:');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated schema for ${file}`);
  });
});
