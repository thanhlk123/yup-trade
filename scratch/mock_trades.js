import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const setups = ['#Breakout', '#FBO', '#Keylevel', '#LHRetest', '#FOMO', '#Trend'];
const times = ['#London', '#NewYork', '#Asian'];
const strengths = ['#HighVolume', '#StrongMomentum'];
const weaknesses = ['#LowVolume', '#NewsImpact', '#Hesitation'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function run() {
  const db = await open({
    filename: path.join(process.cwd(), 'trades.db'),
    driver: sqlite3.Database
  });

  const stmt = await db.prepare(`
    INSERT INTO trades (
      asset, side, entry_price, exit_price, stop_loss, take_profit, 
      size, pnl, status, trade_time, exit_time, user_notes, trade_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'LIVE')
  `);

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);
  const endDate = new Date();

  let count = 0;

  for (let i = 0; i < 200; i++) {
    const setup = randomChoice(setups);
    const time = randomChoice(times);
    
    // Create some bias so the stats are interesting
    let winProb = 0.5;
    if (setup === '#Breakout' || setup === '#Keylevel') winProb += 0.15;
    if (setup === '#FOMO') winProb -= 0.3;
    
    const modifier = randomChoice([...strengths, ...weaknesses]);
    if (strengths.includes(modifier)) winProb += 0.1;
    if (weaknesses.includes(modifier)) winProb -= 0.1;

    const isWin = Math.random() < winProb;
    
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const entryPrice = 2400 + Math.random() * 100;
    
    let pnl, exitPrice, status;
    const size = (0.1 + Math.random() * 1.9).toFixed(2); // 0.1 to 2.0 lots
    
    if (isWin) {
      status = 'WIN';
      pnl = Math.random() * 500 + 50; // Win $50 to $550
      exitPrice = side === 'BUY' ? entryPrice + (pnl / (size * 100)) : entryPrice - (pnl / (size * 100));
    } else {
      status = 'LOSS';
      pnl = -(Math.random() * 300 + 50); // Lose $50 to $350
      exitPrice = side === 'BUY' ? entryPrice + (pnl / (size * 100)) : entryPrice - (pnl / (size * 100));
    }

    const tradeTime = generateRandomDate(startDate, endDate);
    // Exit time is 1 to 4 hours later
    const exitTime = new Date(tradeTime.getTime() + (1 + Math.random() * 3) * 3600000);

    const notes = `Vào lệnh theo setup ${setup} phiên ${time}. Cấu trúc thị trường có đặc điểm ${modifier}.`;

    await stmt.run(
      'XAUUSD',
      side,
      entryPrice.toFixed(2),
      exitPrice.toFixed(2),
      (side === 'BUY' ? entryPrice - 5 : entryPrice + 5).toFixed(2), // Mock SL
      (side === 'BUY' ? entryPrice + 10 : entryPrice - 10).toFixed(2), // Mock TP
      size,
      pnl.toFixed(2),
      status,
      tradeTime.toISOString(),
      exitTime.toISOString(),
      notes
    );
    count++;
  }

  await stmt.finalize();
  await db.close();
  console.log(`Successfully generated ${count} mock trades for XAUUSD.`);
}

run().catch(console.error);
