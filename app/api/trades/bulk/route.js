import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request) {
  try {
    const { trades } = await request.json();

    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({ success: false, error: 'Danh sách lệnh trống hoặc không hợp lệ.' }, { status: 400 });
    }

    const db = await getDb();

    // Start a transaction for efficient and safe bulk insertion
    await db.run('BEGIN TRANSACTION');

    try {
      let insertedCount = 0;
      let skippedCount = 0;

      for (const trade of trades) {
        const {
          asset,
          side,
          size,
          pnl,
          status,
          trade_time,
          exit_time,
          user_notes,
          setup_tag,
          entry_price = 0,
          exit_price = 0,
          stop_loss = null,
          take_profit = null,
          ai_evaluation = null,
          trade_type = 'LIVE',
          image_url = null
        } = trade;

        // Perform basic validations
        if (!asset || !side || size === undefined || pnl === undefined) {
          throw new Error('Thiếu thông tin bắt buộc trong một số lệnh.');
        }

        // Check for duplicates
        const existing = await db.get(
          `SELECT id FROM trades 
           WHERE asset = ? 
             AND side = ? 
             AND ABS(strftime('%s', trade_time) - strftime('%s', ?)) < 60 
             AND ABS(size - ?) < 0.0001 
             AND ABS(pnl - ?) < 0.01`,
          [asset, side.toUpperCase(), trade_time, parseFloat(size), parseFloat(pnl)]
        );

        if (existing) {
          skippedCount++;
          continue;
        }

        // Format ai_evaluation if present, otherwise build a simple default
        const aiResult = ai_evaluation || {
          setup_tag: setup_tag || 'Unclassified',
          strengths: [],
          weaknesses: [],
          decision_rating: pnl >= 0 ? 7 : 5,
          advice: pnl >= 0 ? 'Lệnh thắng. Tiếp tục duy trì kỷ luật.' : 'Xem xét lại điểm dừng lỗ và bối cảnh vào lệnh.'
        };

        await db.run(
          `INSERT INTO trades (
            asset, side, entry_price, exit_price, stop_loss, take_profit, 
            size, pnl, status, trade_time, exit_time, user_notes, setup_tag, ai_evaluation,
            trade_type, image_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            asset,
            side.toUpperCase(),
            parseFloat(entry_price),
            parseFloat(exit_price),
            stop_loss ? parseFloat(stop_loss) : null,
            take_profit ? parseFloat(take_profit) : null,
            parseFloat(size),
            parseFloat(pnl),
            status ? status.toUpperCase() : (pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN'),
            trade_time || null,
            exit_time || null,
            user_notes || '',
            setup_tag || aiResult.setup_tag || 'Unclassified',
            JSON.stringify(aiResult),
            trade_type || 'LIVE',
            image_url || null
          ]
        );

        insertedCount++;
      }

      await db.run('COMMIT');
      return NextResponse.json({ success: true, count: insertedCount, skipped: skippedCount });
    } catch (dbErr) {
      // Rollback transaction on any error during loop
      await db.run('ROLLBACK');
      throw dbErr;
    }
  } catch (error) {
    console.error('Error in bulk inserting trades:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
