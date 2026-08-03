import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTradeTypeFilter } from '@/lib/tradeUtils';

function hasContextNotes(trade) {
  const notes = (trade.user_notes || '').trim();
  if (!notes) return false;
  
  // Exclude placeholder notes or extremely short notes (e.g. less than 15 characters)
  if (notes.length < 15) return false;
  
  // Exclude typical bulk/merged trade indicators
  const notesLower = notes.toLowerCase();
  const bulkKeywords = ['gộp lệnh', 'gộp', 'tổng cộng', 'lệnh gộp', 'chia đều', 'thua nhẹ', 'hòa hết', 'note gộp'];
  if (bulkKeywords.some(keyword => notesLower.includes(keyword))) {
    return false;
  }
  
  return true;
}

function normalizeSetupTag(tag) {
  if (!tag) return 'Discretionary';
  const cleanTag = tag.trim().toLowerCase();
  
  if (cleanTag.includes('fbo') || cleanTag.includes('fakeout') || cleanTag.includes('phá vỡ giả')) {
    return 'FBO';
  }
  if (cleanTag.includes('breakout') || cleanTag.includes('phá vỡ')) {
    return 'Breakout';
  }
  if (cleanTag.includes('lhretest') || cleanTag.includes('retest') || cleanTag.includes('pullback') || cleanTag.includes('hồi') || cleanTag.includes('test lại')) {
    return 'LHRetest';
  }
  if (
    cleanTag.includes('keylevel') || 
    cleanTag.includes('bounce') || 
    cleanTag.includes('hỗ trợ') || 
    cleanTag.includes('kháng cự') || 
    cleanTag.includes('cản') || 
    cleanTag.includes('support') || 
    cleanTag.includes('resistance')
  ) {
    return 'Keylevel';
  }
  if (cleanTag.includes('fomo') || cleanTag.includes('cảm xúc') || cleanTag.includes('đuổi')) {
    return 'FOMO';
  }
  if (cleanTag.includes('trend') || cleanTag.includes('xu hướng') || cleanTag.includes('ema') || cleanTag.includes('ma')) {
    return 'Trend Following';
  }
  
  return 'Discretionary';
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const db = await getDb();
    let query = 'SELECT * FROM trades';
    const filter = getTradeTypeFilter(type, false);
    query += filter.sql;
    const params = filter.params;

    const trades = await db.all(query, params);

    if (trades.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalTrades: 0,
            winRate: 0,
            totalPnl: 0,
            avgPnl: 0,
            wins: 0,
            losses: 0,
            breakevens: 0
          },
          setups: []
        }
      });
    }

    const setupGroups = {};
    let totalWins = 0;
    let totalLosses = 0;
    let totalBreakevens = 0;
    let totalPnl = 0;

    trades.forEach(trade => {
      const pnl = trade.pnl;
      const status = trade.status;
      
      // Calculate overall summary metrics based on ALL trades
      if (pnl > 0) {
        totalWins += 1;
      } else if (pnl < 0) {
        totalLosses += 1;
      } else {
        totalBreakevens += 1;
      }
      totalPnl += pnl;

      // Filter: only calculate Setup Performance stats for trades with proper context notes
      if (!hasContextNotes(trade)) {
        return; // Skip this trade for the Setup Leaderboard
      }

      let ai_eval = null;
      try {
        ai_eval = trade.ai_evaluation ? JSON.parse(trade.ai_evaluation) : null;
      } catch (e) {
        console.error('Failed to parse AI evaluation JSON:', e);
      }

      // Normalize and group into standardized methods: Keylevel, Breakout, LHRetest, FBO, FOMO, Trend Following, Discretionary
      const rawTag = (ai_eval && ai_eval.setup_tag && ai_eval.setup_tag !== 'Unclassified') 
        ? ai_eval.setup_tag 
        : (trade.setup_tag || 'Unclassified');
      const tag = normalizeSetupTag(rawTag);

      if (!setupGroups[tag]) {
        setupGroups[tag] = {
          setup: tag,
          total: 0,
          wins: 0,
          losses: 0,
          breakevens: 0,
          totalPnl: 0,
          grossProfit: 0,
          grossLoss: 0,
          totalRating: 0,
          ratingCount: 0,
          trades: []
        };
      }

      const group = setupGroups[tag];
      group.total += 1;
      group.totalPnl += pnl;
      group.trades.push(trade);

      if (pnl > 0) {
        group.wins += 1;
        group.grossProfit += pnl;
      } else if (pnl < 0) {
        group.losses += 1;
        group.grossLoss += Math.abs(pnl);
      } else {
        group.breakevens += 1;
      }

      if (ai_eval && ai_eval.decision_rating !== undefined) {
        group.totalRating += ai_eval.decision_rating;
        group.ratingCount += 1;
      }
    });

    // Format individual setup metrics
    const setupsData = Object.values(setupGroups).map(group => {
      const winRate = group.total > 0 ? (group.wins / group.total) * 100 : 0;
      const avgPnl = group.total > 0 ? group.totalPnl / group.total : 0;
      const profitFactor = group.grossLoss > 0 ? group.grossProfit / group.grossLoss : group.grossProfit > 0 ? 999 : 0; // Avoid divide by zero
      const avgRating = group.ratingCount > 0 ? group.totalRating / group.ratingCount : null;

      const avgWin = group.wins > 0 ? group.grossProfit / group.wins : 0;
      const avgLoss = group.losses > 0 ? group.grossLoss / group.losses : 0;
      const actualRR = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 999 : 0;

      return {
        setup: group.setup,
        total: group.total,
        wins: group.wins,
        losses: group.losses,
        breakevens: group.breakevens,
        winRate: Math.round(winRate * 10) / 10,
        totalPnl: Math.round(group.totalPnl * 100) / 100,
        avgPnl: Math.round(avgPnl * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        actualRR: Math.round(actualRR * 100) / 100
      };
    });

    // Sort: Best setup (winRate & PnL desc) to Worst setup
    setupsData.sort((a, b) => b.winRate - a.winRate || b.totalPnl - a.totalPnl);

    const overallWinRate = trades.length > 0 ? (totalWins / trades.length) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalTrades: trades.length,
          winRate: Math.round(overallWinRate * 10) / 10,
          totalPnl: Math.round(totalPnl * 100) / 100,
          avgPnl: Math.round((totalPnl / trades.length) * 100) / 100,
          wins: totalWins,
          losses: totalLosses,
          breakevens: totalBreakevens
        },
        setups: setupsData
      }
    });
  } catch (error) {
    console.error('Error generating stats:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
