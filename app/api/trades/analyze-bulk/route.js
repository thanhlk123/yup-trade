import { NextResponse } from 'next/server';
import { analyzeTradeWithAI } from '@/lib/ai-agent';

export async function POST(request) {
  try {
    const { trades, lang } = await request.json();

    if (!trades || !Array.isArray(trades)) {
      return NextResponse.json({ success: false, error: 'Danh sách giao dịch trống hoặc không hợp lệ.' }, { status: 400 });
    }

    console.log(`Starting bulk AI analysis for ${trades.length} trades with language: ${lang}`);

    // Use Promise.all to run analysis in parallel
    const analyzedTrades = await Promise.all(
      trades.map(async (trade) => {
        try {
          const aiResult = await analyzeTradeWithAI(trade, lang);
          return {
            ...trade,
            setup_tag: aiResult.setup_tag || trade.setup_tag || 'Unclassified',
            ai_evaluation: aiResult
          };
        } catch (err) {
          console.error(`Error analyzing trade ${trade.asset} (${trade.side}):`, err);
          // Return trade with a default fallback evaluation if AI call fails completely
          return {
            ...trade,
            setup_tag: trade.setup_tag || 'Unclassified',
            ai_evaluation: {
              setup_tag: trade.setup_tag || 'Unclassified',
              strengths: [],
              weaknesses: [],
              decision_rating: trade.pnl >= 0 ? 7.0 : 5.0,
              advice: 'Không thể tải đánh giá từ AI cho lệnh này. Vui lòng kiểm tra lại.'
            }
          };
        }
      })
    );

    return NextResponse.json({ success: true, trades: analyzedTrades });
  } catch (error) {
    console.error('Error in analyze-bulk API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
