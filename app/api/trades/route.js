import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { analyzeTradeWithAI } from '@/lib/ai-agent';
import { getTradeTypeFilter } from '@/lib/tradeUtils';

const getContractSize = (asset) => {
  const a = (asset || '').toUpperCase();
  if (a.includes('XAU') || a.includes('GOLD')) return 100;
  if (a.includes('XAG') || a.includes('SILVER')) return 5000;
  if (a.includes('BTC')) return 1;
  if (a.includes('ETH')) return 1;
  // Assume standard forex pairs are 6 characters long (e.g. EURUSD, GBPJPY) or have suffix like EURUSD+
  if ((a.length >= 6 && a.length <= 8) && !a.includes('BTC') && !a.includes('ETH') && !a.includes('XAU')) return 100000; 
  return 1;
};

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
      is_lesson = 0,
      market_trend,
      entry_trigger,
      execution_quality,
      trade_management,
      poi,
      htf_context,
      confluences,
      exit_reason,
      risk_plan,
      setup_grade,
      risk_amount,
      emotions,
      mistakes
    } = body;

    // Validate required fields
    if (!asset || !side || !entry_price || !exit_price || !size) {
      return NextResponse.json({ success: false, error: 'Missing required trade details' }, { status: 400 });
    }

    // Calculate PnL and Status
    const entry = parseFloat(entry_price);
    const exit = parseFloat(exit_price);
    const sz = parseFloat(size);
    
    if (isNaN(entry) || isNaN(exit) || isNaN(sz) || entry <= 0 || exit <= 0 || sz <= 0) {
      return NextResponse.json({ success: false, error: 'Giá hoặc khối lượng không hợp lệ' }, { status: 400 });
    }
    
    let pnl = body_pnl === '' || body_pnl === null || body_pnl === undefined ? NaN : parseFloat(body_pnl);
    if (isNaN(pnl)) {
      const contractSize = getContractSize(asset);
      if (side.toUpperCase() === 'BUY') {
        pnl = (exit - entry) * sz * contractSize;
      } else if (side.toUpperCase() === 'SELL') {
        pnl = (entry - exit) * sz * contractSize;
      }
      // Round PnL to 2 decimal places if auto-calculated
      pnl = Math.round(pnl * 100) / 100;
    }

    let status = 'BREAKEVEN';
    if (pnl > 0) status = 'WIN';
    else if (pnl < 0) status = 'LOSS';

    let final_trade_time = trade_time;
    if (!final_trade_time) {
      // Generate UTC now: YYYY-MM-DD HH:mm:ss
      final_trade_time = new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    const rawTrade = {
      asset,
      side,
      entry_price: entry,
      exit_price: exit,
      stop_loss: stop_loss !== '' && stop_loss !== null && stop_loss !== undefined ? parseFloat(stop_loss) : null,
      take_profit: take_profit !== '' && take_profit !== null && take_profit !== undefined ? parseFloat(take_profit) : null,
      size: sz,
      pnl,
      status,
      trade_time: final_trade_time,
      exit_time: exit_time || null,
      user_notes,
      trade_type: trade_type || 'LIVE',
      image_url: image_url || null,
      setup_tag: body.setup_tag,
      market_trend,
      htf_context,
      poi,
      confluences,
      entry_trigger,
      execution_quality,
      risk_plan,
      trade_management,
      exit_reason,
      emotions,
      mistakes
    };

    // Analyze with AI Agent if not skipped
    let aiResult = {};
    if (!body.skip_ai) {
      aiResult = await analyzeTradeWithAI(rawTrade);
    }

    const db = await getDb();
    
    // Insert into DB
    const result = await db.run(
      `INSERT INTO trades (
        asset, side, entry_price, exit_price, stop_loss, take_profit, 
        size, pnl, status, trade_time, exit_time, user_notes, setup_tag, ai_evaluation,
        trade_type, image_url, is_lesson,
        market_trend, entry_trigger, execution_quality, trade_management,
        poi, htf_context, confluences, exit_reason, risk_plan, setup_grade, risk_amount, emotions, mistakes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        final_trade_time,
        rawTrade.exit_time,
        user_notes || '',
        body.setup_tag || aiResult.setup_tag || 'Unclassified',
        JSON.stringify(aiResult),
        rawTrade.trade_type,
        rawTrade.image_url,
        is_lesson ? 1 : 0,
        market_trend || null,
        entry_trigger || null,
        execution_quality || null,
        trade_management || null,
        poi || null,
        htf_context || null,
        confluences || null,
        exit_reason || null,
        risk_plan || null,
        setup_grade || null,
        risk_amount ? parseFloat(risk_amount) : null,
        emotions || null,
        mistakes || null
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
    fs.appendFileSync('api_put_log.txt', new Date().toISOString() + ' PUT payload: ' + JSON.stringify(body) + '\n');
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
    
    // New Taxonomy Columns
    const setup_tag = body.setup_tag !== undefined ? body.setup_tag : existing.setup_tag;
    const market_trend = body.market_trend !== undefined ? body.market_trend : existing.market_trend;
    const entry_trigger = body.entry_trigger !== undefined ? body.entry_trigger : existing.entry_trigger;
    const execution_quality = body.execution_quality !== undefined ? body.execution_quality : existing.execution_quality;
    const trade_management = body.trade_management !== undefined ? body.trade_management : existing.trade_management;
    const poi = body.poi !== undefined ? body.poi : existing.poi;
    const htf_context = body.htf_context !== undefined ? body.htf_context : existing.htf_context;
    const confluences = body.confluences !== undefined ? body.confluences : existing.confluences;
    const exit_reason = body.exit_reason !== undefined ? body.exit_reason : existing.exit_reason;
    const risk_plan = body.risk_plan !== undefined ? body.risk_plan : existing.risk_plan;
    const setup_grade = body.setup_grade !== undefined ? body.setup_grade : existing.setup_grade;
    const risk_amount = body.risk_amount !== undefined ? body.risk_amount : existing.risk_amount;
    const emotions = body.emotions !== undefined ? body.emotions : existing.emotions;
    const mistakes = body.mistakes !== undefined ? body.mistakes : existing.mistakes;
    
    console.log('PUT /api/trades -> id:', id, 'body.drawings_data:', body.drawings_data, 'final drawings_data:', drawings_data);

    // Convert prices and values
    const entry = parseFloat(entry_price);
    const exit = parseFloat(exit_price);
    const sz = parseFloat(size);
    
    if (isNaN(entry) || isNaN(exit) || isNaN(sz) || entry <= 0 || exit <= 0 || sz <= 0) {
      return NextResponse.json({ success: false, error: 'Giá hoặc khối lượng không hợp lệ' }, { status: 400 });
    }
    
    let pnl = body.pnl !== undefined ? (body.pnl === '' || body.pnl === null ? NaN : parseFloat(body.pnl)) : parseFloat(existing.pnl);
    if (isNaN(pnl)) {
      const contractSize = getContractSize(asset);
      if (side.toUpperCase() === 'BUY') {
        pnl = (exit - entry) * sz * contractSize;
      } else if (side.toUpperCase() === 'SELL') {
        pnl = (entry - exit) * sz * contractSize;
      }
      pnl = Math.round(pnl * 100) / 100;
    }

    const status = body.status || existing.status || (pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN');

    let final_trade_time = trade_time;
    if (!final_trade_time) {
      final_trade_time = existing.trade_time || new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    const rawTrade = {
      asset,
      side,
      entry_price: entry,
      exit_price: exit,
      stop_loss: stop_loss !== '' && stop_loss !== null && stop_loss !== undefined ? parseFloat(stop_loss) : null,
      take_profit: take_profit !== '' && take_profit !== null && take_profit !== undefined ? parseFloat(take_profit) : null,
      size: sz,
      pnl,
      status,
      trade_time: final_trade_time,
      exit_time: exit_time || null,
      user_notes,
      trade_type: trade_type || 'LIVE',
      image_url: image_url || null,
      setup_tag,
      market_trend,
      htf_context,
      poi,
      confluences,
      entry_trigger,
      execution_quality,
      risk_plan,
      trade_management,
      exit_reason,
      emotions,
      mistakes
    };

    let aiResult = body.ai_evaluation !== undefined ? body.ai_evaluation : existing.ai_evaluation;
    if (typeof aiResult === 'string') {
      try {
        aiResult = JSON.parse(aiResult);
      } catch (e) {
        aiResult = null;
      }
    }

    const notesChanged = existing && existing.user_notes !== (user_notes || '');
    const metricsChanged = existing && (
      existing.asset !== asset ||
      existing.side !== side ||
      existing.entry_price !== entry ||
      existing.exit_price !== exit ||
      existing.size !== sz ||
      existing.pnl !== pnl
    );

    const isAiMissingOrEmpty = !aiResult || Object.keys(aiResult).length === 0 || !aiResult.setup_tag;

    if (!body.skip_ai && (isAiMissingOrEmpty || notesChanged || metricsChanged)) {
      console.log('PUT API: Re-running AI analysis because key data changed or AI missing.');
      aiResult = await analyzeTradeWithAI(rawTrade);
    } else {
      console.log('PUT API: Reusing existing AI analysis.');
    }

    const lessonFlag = is_lesson !== undefined ? (is_lesson ? 1 : 0) : (existing ? existing.is_lesson : 0);

    await db.run(
      `UPDATE trades SET 
        asset = ?, side = ?, entry_price = ?, exit_price = ?, stop_loss = ?, take_profit = ?, 
        size = ?, pnl = ?, status = ?, trade_time = ?, exit_time = ?, user_notes = ?, setup_tag = ?, ai_evaluation = ?,
        trade_type = ?, image_url = ?, is_lesson = ?, drawings_data = ?, session = ?, duration = ?, planned_rr = ?, actual_rr = ?,
        market_trend = ?, entry_trigger = ?, execution_quality = ?, trade_management = ?,
        poi = ?, htf_context = ?, confluences = ?, exit_reason = ?, risk_plan = ?, setup_grade = ?,
        risk_amount = ?, emotions = ?, mistakes = ?
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
        final_trade_time,
        exit_time || null,
        user_notes || '',
        setup_tag !== undefined ? setup_tag : (typeof aiResult === 'object' ? (aiResult?.setup_tag || 'Unclassified') : existing?.setup_tag),
        typeof aiResult === 'object' ? JSON.stringify(aiResult) : aiResult,
        trade_type || 'LIVE',
        image_url || null,
        lessonFlag,
        drawings_data || null,
        body.session !== undefined ? body.session : existing.session,
        body.duration !== undefined ? body.duration : existing.duration,
        body.planned_rr !== undefined ? body.planned_rr : existing.planned_rr,
        body.actual_rr !== undefined ? body.actual_rr : existing.actual_rr,
        market_trend || null,
        entry_trigger || null,
        execution_quality || null,
        trade_management || null,
        poi || null,
        htf_context || null,
        confluences || null,
        exit_reason || null,
        risk_plan || null,
        setup_grade || null,
        risk_amount ? parseFloat(risk_amount) : null,
        emotions || null,
        mistakes || null,
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
