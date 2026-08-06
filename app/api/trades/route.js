import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { analyzeTradeWithAI } from '@/lib/ai-agent';
import { getTradeTypeFilter } from '@/lib/tradeUtils';

// GET all trades
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const db = await getDb();
    let query = 'SELECT * FROM trades';
    const filter = getTradeTypeFilter(type, false);
    query += filter.sql;
    const params = filter.params;

    query += ' ORDER BY trade_time DESC, id DESC';
    const trades = await db.all(query, params);
    
    // Parse JSON field for evaluations
    const formattedTrades = trades.map(trade => ({
      ...trade,
      ai_evaluation: trade.ai_evaluation ? JSON.parse(trade.ai_evaluation) : null
    }));

    return NextResponse.json({ success: true, data: formattedTrades });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST a new trade
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      asset,
      side,
      entry_price,
      exit_price,
      stop_loss,
      take_profit,
      size,
      trade_time,
      exit_time,
      user_notes,
      trade_type,
      image_url,
      pnl: body_pnl,
      is_lesson = 0
    } = body;

    // Validate required fields
    if (!asset || !side || !entry_price || !exit_price || !size) {
      return NextResponse.json({ success: false, error: 'Missing required trade details' }, { status: 400 });
    }

    // Calculate PnL and Status
    const entry = parseFloat(entry_price);
    const exit = parseFloat(exit_price);
    const sz = parseFloat(size);
    
    let pnl = parseFloat(body_pnl);
    if (isNaN(pnl)) {
      if (side.toUpperCase() === 'BUY') {
        pnl = (exit - entry) * sz;
      } else if (side.toUpperCase() === 'SELL') {
        pnl = (entry - exit) * sz;
      }
      // Round PnL to 2 decimal places if auto-calculated
      pnl = Math.round(pnl * 100) / 100;
    }

    let status = 'BREAKEVEN';
    if (pnl > 0) status = 'WIN';
    else if (pnl < 0) status = 'LOSS';

    const rawTrade = {
      asset,
      side,
      entry_price: entry,
      exit_price: exit,
      stop_loss: stop_loss ? parseFloat(stop_loss) : null,
      take_profit: take_profit ? parseFloat(take_profit) : null,
      size: sz,
      pnl,
      status,
      trade_time: trade_time || null,
      exit_time: exit_time || null,
      user_notes,
      trade_type: trade_type || 'LIVE',
      image_url: image_url || null
    };

    // Analyze with AI Agent
    const aiResult = await analyzeTradeWithAI(rawTrade);

    const db = await getDb();
    
    // Insert into DB
    const result = await db.run(
      `INSERT INTO trades (
        asset, side, entry_price, exit_price, stop_loss, take_profit, 
        size, pnl, status, trade_time, exit_time, user_notes, setup_tag, ai_evaluation,
        trade_type, image_url, is_lesson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        asset,
        side.toUpperCase(),
        entry,
        exit,
        rawTrade.stop_loss,
        rawTrade.take_profit,
        sz,
        pnl,
        status,
        rawTrade.trade_time,
        rawTrade.exit_time,
        user_notes || '',
        aiResult.setup_tag || 'Unclassified',
        JSON.stringify(aiResult),
        rawTrade.trade_type,
        rawTrade.image_url,
        is_lesson ? 1 : 0
      ]
    );

    const newTradeId = result.lastID;
    const insertedTrade = await db.get('SELECT * FROM trades WHERE id = ?', [newTradeId]);
    insertedTrade.ai_evaluation = JSON.parse(insertedTrade.ai_evaluation);

    return NextResponse.json({ success: true, data: insertedTrade });
  } catch (error) {
    console.error('Error inserting trade:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE trades (all or individual)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const db = await getDb();
    if (id) {
      await db.run('DELETE FROM trades WHERE id = ?', [id]);
      return NextResponse.json({ success: true, message: `Deleted trade ID ${id}` });
    } else {
      await db.run('DELETE FROM trades');
      
      // Clear all images in public/uploads/charts when resetting history
      try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'charts');
        if (fs.existsSync(uploadDir)) {
          const files = fs.readdirSync(uploadDir);
          for (const file of files) {
            fs.unlinkSync(path.join(uploadDir, file));
          }
        }
      } catch (fsError) {
        console.error('Error clearing upload directory:', fsError);
        // Continue even if image deletion fails
      }
      
      return NextResponse.json({ success: true, message: 'All trades deleted' });
    }
  } catch (error) {
    console.error('Error deleting trades:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT to update an individual trade
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing trade ID' }, { status: 400 });
    }

    const db = await getDb();
    const existing = await db.get('SELECT * FROM trades WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
    }

    const asset = body.asset !== undefined ? body.asset : existing.asset;
    const side = body.side !== undefined ? body.side : (existing.side || 'BUY');
    const entry_price = body.entry_price !== undefined ? body.entry_price : existing.entry_price;
    const exit_price = body.exit_price !== undefined ? body.exit_price : existing.exit_price;
    const stop_loss = body.stop_loss !== undefined ? body.stop_loss : existing.stop_loss;
    const take_profit = body.take_profit !== undefined ? body.take_profit : existing.take_profit;
    const size = body.size !== undefined ? body.size : existing.size;
    const trade_time = body.trade_time !== undefined ? body.trade_time : existing.trade_time;
    const exit_time = body.exit_time !== undefined ? body.exit_time : existing.exit_time;
    const user_notes = body.user_notes !== undefined ? body.user_notes : existing.user_notes;
    const trade_type = body.trade_type !== undefined ? body.trade_type : existing.trade_type;
    const image_url = body.image_url !== undefined ? body.image_url : existing.image_url;
    const is_lesson = body.is_lesson !== undefined ? body.is_lesson : existing.is_lesson;
    const drawings_data = body.drawings_data !== undefined ? body.drawings_data : existing.drawings_data;
    
    console.log('PUT /api/trades -> id:', id, 'body.drawings_data:', body.drawings_data, 'final drawings_data:', drawings_data);

    // Convert prices and values
    const entry = parseFloat(entry_price);
    const exit = parseFloat(exit_price);
    const sz = parseFloat(size);
    
    let pnl = body.pnl !== undefined ? parseFloat(body.pnl) : parseFloat(existing.pnl);
    if (isNaN(pnl)) {
      pnl = side.toUpperCase() === 'BUY' ? (exit - entry) * sz : (entry - exit) * sz;
    }
    pnl = Math.round(pnl * 100) / 100;

    const status = body.status || existing.status || (pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN');

    const rawTrade = {
      asset,
      side,
      entry_price: entry,
      exit_price: exit,
      stop_loss: stop_loss ? parseFloat(stop_loss) : null,
      take_profit: take_profit ? parseFloat(take_profit) : null,
      size: sz,
      pnl,
      status,
      trade_time: trade_time || null,
      exit_time: exit_time || null,
      user_notes,
      trade_type: trade_type || 'LIVE',
      image_url: image_url || null
    };

    let aiResult = body.ai_evaluation !== undefined ? body.ai_evaluation : existing.ai_evaluation;
    const notesChanged = existing && existing.user_notes !== (user_notes || '');
    const metricsChanged = existing && (
      existing.asset !== asset ||
      existing.side !== side ||
      existing.entry_price !== entry ||
      existing.exit_price !== exit ||
      existing.size !== sz ||
      existing.pnl !== pnl
    );

    if (!aiResult || notesChanged || metricsChanged) {
      console.log('PUT API: Re-running AI analysis because key data changed.');
      aiResult = await analyzeTradeWithAI(rawTrade);
    } else {
      console.log('PUT API: Reusing existing AI analysis.');
      if (typeof aiResult === 'string') {
        try {
          aiResult = JSON.parse(aiResult);
        } catch (e) {
          // ignore
        }
      }
    }

    const lessonFlag = is_lesson !== undefined ? (is_lesson ? 1 : 0) : (existing ? existing.is_lesson : 0);

    await db.run(
      `UPDATE trades SET 
        asset = ?, side = ?, entry_price = ?, exit_price = ?, stop_loss = ?, take_profit = ?, 
        size = ?, pnl = ?, status = ?, trade_time = ?, exit_time = ?, user_notes = ?, setup_tag = ?, ai_evaluation = ?,
        trade_type = ?, image_url = ?, is_lesson = ?, drawings_data = ?
      WHERE id = ?`,
      [
        asset,
        side.toUpperCase(),
        entry,
        exit,
        stop_loss ? parseFloat(stop_loss) : null,
        take_profit ? parseFloat(take_profit) : null,
        sz,
        pnl,
        status,
        trade_time || null,
        exit_time || null,
        user_notes || '',
        typeof aiResult === 'object' ? (aiResult?.setup_tag || existing?.setup_tag || 'Unclassified') : existing?.setup_tag,
        typeof aiResult === 'object' ? JSON.stringify(aiResult) : aiResult,
        trade_type || 'LIVE',
        image_url || null,
        lessonFlag,
        drawings_data || null,
        id
      ]
    );

    const updatedTrade = await db.get('SELECT * FROM trades WHERE id = ?', [id]);
    updatedTrade.ai_evaluation = JSON.parse(updatedTrade.ai_evaluation);

    return NextResponse.json({ success: true, data: updatedTrade });
  } catch (error) {
    console.error('Error updating trade:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
