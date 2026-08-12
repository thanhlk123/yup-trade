'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { useLanguageStore } from '@/app/core/i18n/store';
import { useDashboardStore } from '@/app/features/dashboard/store/dashboardStore';

export default function ExportHTMLModal() {
  const t = useLanguageStore(state => state.t);
  const trades = useDashboardStore(state => state.trades) || [];
  const activeTab = useDashboardStore(state => state.activeTab);
  const accountTabs = useDashboardStore(state => state.accountTabs);
  const stats = useDashboardStore(state => state.stats);
  
  const isExportModalOpen = useDashboardStore(state => state.isExportModalOpen);
  const setIsExportModalOpen = useDashboardStore(state => state.setIsExportModalOpen);

  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [localRecentReview, setLocalRecentReview] = useState(null);
  const [localWeeklyReview, setLocalWeeklyReview] = useState(null);

  const [weeklyTradeCount, setWeeklyTradeCount] = useState(0);
  const [monthlyTradeCount, setMonthlyTradeCount] = useState(0);

  useEffect(() => {
    const now = Date.now();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeeklyTradeCount(trades.filter(t => new Date(t.trade_time) >= weekAgo).length);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonthlyTradeCount(trades.filter(t => new Date(t.trade_time) >= monthAgo).length);
  }, [trades]);

  const exportToHTML = async (range = 'ALL') => {
    if (trades.length === 0) return;

    let filteredTrades = [...trades];
    const now = new Date();

    if (range === 'WEEK') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredTrades = trades.filter(t => new Date(t.trade_time) >= sevenDaysAgo);
    } else if (range === 'MONTH') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredTrades = trades.filter(t => new Date(t.trade_time) >= thirtyDaysAgo);
    } else if (range === 'RECENT') {
      filteredTrades = trades.slice(0, 20);
    } else if (range === 'TODAY') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filteredTrades = trades.filter(t => new Date(t.trade_time) >= startOfDay);
    } else if (range === 'YESTERDAY') {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      filteredTrades = trades.filter(t => {
        const d = new Date(t.trade_time);
        return d >= startOfYesterday && d <= endOfYesterday;
      });
    } else if (range === 'CUSTOM') {
      if (!exportStartDate || !exportEndDate) {
        alert('Vui lòng chọn đầy đủ Từ ngày và Đến ngày!');
        return;
      }
      const start = new Date(exportStartDate);
      const end = new Date(exportEndDate);
      end.setHours(23, 59, 59, 999);
      filteredTrades = trades.filter(t => {
        const d = new Date(t.trade_time);
        return d >= start && d <= end;
      });
    }

    if (filteredTrades.length === 0) {
      alert('Không có giao dịch nào trong khoảng thời gian đã chọn để xuất báo cáo.');
      return;
    }

    setIsExporting(true);

    try {
      // 1. Fetch AI review corresponding to the range if not already fetched
      let targetReview = null;
      let isRecentType = range === 'RECENT';

      if (isRecentType) {
        if (localRecentReview) {
          targetReview = localRecentReview;
        } else {
          const res = await fetch(`/api/recent-review?type=${activeTab}`);
          const result = await res.json();
          if (result.success) {
            targetReview = result.data;
            setLocalRecentReview(result.data);
          }
        }
      } else {
        if (localWeeklyReview) {
          targetReview = localWeeklyReview;
        } else {
          const res = await fetch(`/api/weekly-review?type=${activeTab}`);
          const result = await res.json();
          if (result.success) {
            targetReview = result.data;
            setLocalWeeklyReview(result.data);
          }
        }
      }

      // 2. Generate HTML structure with targetReview
      let tabName = 'Tất cả Lệnh';
      if (activeTab !== 'ALL') {
        const found = accountTabs.find(t => t.key === activeTab);
        tabName = found ? found.label : activeTab;
      }
      const totalTrades = filteredTrades.length;
      const wins = filteredTrades.filter(t => t.status === 'WIN').length;
      const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
      const netPnL = filteredTrades.reduce((acc, t) => acc + t.pnl, 0);

      let aiReviewSection = '';
      if (isRecentType && targetReview) {
        aiReviewSection = `
          <div class="ai-summary-box recent">
              <h3 class="ai-summary-title">${t('htmlReportRecent')}</h3>
              <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 20px; line-height: 1.6;">
                  <strong>🎯 Tổng quan (Summary):</strong> ${targetReview.summary}
              </p>
              
              <div class="ai-summary-grid">
                  <div class="ai-summary-col mistake">
                      <h4>📉 Góc Nhìn Kỹ Thuật (Technical Insight)</h4>
                      <p style="font-size: 12px; line-height: 1.6; color: #cbd5e1; padding-top: 8px;">
                          ${targetReview.technical_insight || 'N/A'}
                      </p>
                  </div>
                  <div class="ai-summary-col weakness">
                      <h4>🧠 Bắt Mạch Tâm Lý (Psychological Insight)</h4>
                      <p style="font-size: 12px; line-height: 1.6; color: #cbd5e1; padding-top: 8px;">
                          ${targetReview.psychological_insight || 'N/A'}
                      </p>
                  </div>
              </div>

              <div class="ai-summary-grid" style="margin-top: 15px;">
                  <div class="ai-summary-col strength">
                      <h4>🛡 Quản Trị Rủi Ro (Risk Insight)</h4>
                      <p style="font-size: 12px; line-height: 1.6; color: #cbd5e1; padding-top: 8px;">
                          ${targetReview.risk_insight || 'N/A'}
                      </p>
                  </div>
                  <div class="ai-summary-col advice">
                      <h4>🎯 Bài Tập & Hành Động (Micro-Goals)</h4>
                      <ul style="padding-top: 8px; list-style-type: disc; margin-left: 20px;">
                          ${targetReview.micro_goals?.map(a => `<li style="font-size: 12px; margin-bottom: 4px; color: #cbd5e1;">${a}</li>`).join('') || '<li>N/A</li>'}
                      </ul>
                  </div>
              </div>
          </div>
        `;
      } else if (targetReview) {
        aiReviewSection = `
          <div class="ai-summary-box">
              <h3 class="ai-summary-title">${t('htmlReportWeekly')}</h3>
              <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(168,85,247,0.1); padding-bottom: 15px;">
                  <div style="text-align: center; background-color: rgba(168,85,247,0.1); padding: 10px 20px; border-radius: 12px; border: 1px solid rgba(168,85,247,0.2);">
                      <div style="font-size: 9px; color: #a855f7; font-weight: bold; text-transform: uppercase;">Điểm Kỷ Luật</div>
                      <div style="font-size: 24px; font-weight: bold; color: #c084fc; font-family: monospace;">${targetReview.discipline_score}/10</div>
                  </div>
                  <div style="flex: 1; font-size: 13px; color: #cbd5e1; line-height: 1.6; font-style: italic;">
                      &ldquo;${targetReview.summary}&rdquo;
                  </div>
              </div>

              <div class="ai-summary-grid">
                  <div class="ai-summary-col strength">
                      <h4>${t('strengthsDecisions')}</h4>
                      <ul>
                          ${targetReview.strengths?.map(s => `<li>${s}</li>`).join('') || '<li>N/A</li>'}
                      </ul>
                  </div>
                  <div class="ai-summary-col weakness">
                      <h4>${t('weaknessesRepeats')}</h4>
                      <ul>
                          ${targetReview.weaknesses?.map(w => `<li>${w}</li>`).join('') || '<li>N/A</li>'}
                      </ul>
                  </div>
              </div>

              <div class="ai-summary-grid" style="margin-top: 15px;">
                  <div class="ai-summary-col advice">
                      <h4>${t('actionPlanCompliance')}</h4>
                      <ul>
                          ${targetReview.action_plan?.map(a => `<li>${a}</li>`).join('') || '<li>N/A</li>'}
                      </ul>
                  </div>
                  <div class="ai-summary-col" style="background-color: rgba(15,23,42,0.4); border: 1px solid #1e293b; padding: 15px; border-radius: 10px; color: #cbd5e1;">
                      <h4 style="color: #60a5fa;">${t('coreLessons')}</h4>
                      <ul style="list-style-type: decimal;">
                          ${targetReview.key_lessons?.map(l => `<li>${l}</li>`).join('') || '<li>N/A</li>'}
                      </ul>
                  </div>
              </div>
          </div>
        `;
      }

      let htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('htmlReportTitle')} - ${tabName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #030712;
            color: #f3f4f6;
            margin: 0;
            padding: 40px 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }
        header {
            border-bottom: 1px solid #1f2937;
            padding-bottom: 24px;
            margin-bottom: 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        header h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
            background: linear-gradient(to right, #10b981, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        header p {
            margin: 6px 0 0 0;
            color: #9ca3af;
            font-size: 13px;
        }
        .meta-tag {
            background: linear-gradient(135deg, #1f2937, #111827);
            color: #f9fafb;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            border: 1px solid #374151;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }
        .stats-card {
            background-color: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 16px;
            padding: 20px;
            text-align: left;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .stats-card .title {
            color: #94a3b8;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .stats-card .value {
            font-size: 24px;
            font-weight: 800;
            font-family: monospace;
        }
        .text-green { color: #34d399; }
        .text-red { color: #f87171; }
        .text-gray { color: #94a3b8; }
        
        /* AI Summary Box Styling */
        .ai-summary-box {
            background: linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.03));
            border: 1px solid rgba(168,85,247,0.25);
            border-radius: 24px;
            padding: 24px;
            margin-bottom: 32px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .ai-summary-box.recent {
            background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.03));
            border: 1px solid rgba(245,158,11,0.25);
        }
        .ai-summary-title {
            font-size: 14px;
            font-weight: 800;
            color: #c084fc;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 0;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .ai-summary-box.recent .ai-summary-title {
            color: #fbbf24;
        }
        .ai-summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
            margin-top: 16px;
        }
        .ai-summary-col {
            background-color: rgba(17, 24, 39, 0.6);
            border: 1px solid rgba(31, 41, 55, 0.8);
            padding: 18px;
            border-radius: 14px;
        }
        .ai-summary-col h4 {
            margin: 0 0 10px 0;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 700;
        }
        .ai-summary-col.strength h4 { color: #34d399; }
        .ai-summary-col.weakness h4 { color: #f87171; }
        .ai-summary-col.mistake h4 { color: #fbbf24; }
        .ai-summary-col.advice h4 { color: #c084fc; }
        
        .ai-summary-col ul, .ai-col ul {
            margin: 0;
            padding-left: 20px;
            font-size: 12px;
            color: #d1d5db;
        }
        .ai-summary-col ul li, .ai-col ul li {
            margin-bottom: 6px;
        }

        /* Trade Cards */
        .trade-card {
            background-color: #0b1329;
            border: 1px solid #1e293b;
            border-radius: 20px;
            padding: 24px;
            margin-bottom: 32px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .trade-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #1e293b;
            padding-bottom: 16px;
            margin-bottom: 20px;
        }
        .trade-title {
            font-size: 16px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .trade-side-buy {
            color: #10b981;
            background-color: rgba(16, 185, 129, 0.1);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .trade-side-sell {
            color: #ef4444;
            background-color: rgba(239, 68, 68, 0.1);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .trade-pnl {
            font-size: 20px;
            font-weight: 800;
            font-family: monospace;
        }
        .trade-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            background-color: #030712;
            padding: 14px;
            border-radius: 12px;
            font-family: monospace;
            font-size: 13px;
            text-align: center;
            margin-bottom: 20px;
            border: 1px solid #1f2937;
        }
        .trade-grid div {
            border-right: 1px solid #1f2937;
        }
        .trade-grid div:last-child {
            border-right: none;
        }
        .trade-grid span {
            color: #9ca3af;
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        /* Notes Box (Preserving exact whitespace) */
        .notes-box {
            background-color: rgba(17, 24, 39, 0.5);
            border: 1px dashed #374151;
            padding: 16px;
            border-radius: 12px;
            font-size: 13px;
            color: #e5e7eb;
            margin-bottom: 20px;
            white-space: pre-wrap;
            line-height: 1.6;
        }
        
        .ai-section {
            border-top: 1px solid #1f2937;
            padding-top: 20px;
            margin-top: 20px;
        }
        .ai-header {
            font-weight: 700;
            color: #34d399;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
        }
        .ai-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 16px;
        }
        .ai-col {
            background-color: rgba(17, 24, 39, 0.4);
            border: 1px solid rgba(55, 65, 81, 0.5);
            padding: 14px;
            border-radius: 10px;
        }
        .ai-col h5 {
            margin: 0 0 8px 0;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .ai-advice {
            background-color: rgba(16, 185, 129, 0.04);
            border-left: 4px solid #10b981;
            padding: 14px;
            border-radius: 0 10px 10px 0;
            font-size: 12px;
            color: #34d399;
            font-style: italic;
            border: 1px solid rgba(16, 185, 129, 0.08);
        }
        .charts-container {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 20px;
        }
        .chart-img {
            max-width: 280px;
            max-height: 180px;
            object-fit: contain;
            border: 1px solid #1f2937;
            border-radius: 12px;
            background-color: #030712;
            cursor: zoom-in;
            transition: transform 0.2s, border-color 0.2s;
        }
        .chart-img:hover {
            transform: scale(1.03);
            border-color: #10b981;
        }
        
        @media print {
            body { background-color: #ffffff; color: #000000; padding: 0; }
            .trade-card { page-break-inside: avoid; border: 1px solid #cbd5e1; background-color: #ffffff; }
            .stats-card, .trade-grid, .notes-box, .ai-col, .ai-advice, .ai-summary-box, .ai-summary-col { background-color: #f8fafc; border: 1px solid #cbd5e1; color: #000000; }
            .text-green { color: #047857; }
            .text-red { color: #b91c1c; }
            header h1 { color: #047857; }
            .chart-img { border: 1px solid #cbd5e1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>${t('htmlReportTitle')}</h1>
                <p>Xuất báo cáo tự động ngày: ${new Date().toLocaleDateString('vi-VN')} | Khoảng thời gian: ${range === 'ALL' ? 'Tất cả' : range === 'WEEK' ? 'Tuần qua' : range === 'MONTH' ? 'Tháng qua' : 'Chuỗi 20 lệnh gần đây'}</p>
            </div>
            <div class="meta-tag">${tabName}</div>
        </header>

        <div class="stats-grid">
            <div class="stats-card">
                <div class="title">Tổng Giao Dịch</div>
                <div class="value">${totalTrades}</div>
            </div>
            <div class="stats-card">
                <div class="title">Win Rate</div>
                <div class="value text-green">${winRate}%</div>
            </div>
            <div class="stats-card">
                <div class="title">Tổng PnL</div>
                <div class="value ${netPnL >= 0 ? 'text-green' : 'text-red'}">
                    ${netPnL >= 0 ? '+' : ''}${netPnL.toLocaleString()} USD
                </div>
            </div>
            <div class="stats-card">
                <div class="title">Expectancy</div>
                <div class="value">${stats.summary?.avgPnl >= 0 ? '+' : ''}${stats.summary?.avgPnl?.toLocaleString() || 0} USD</div>
            </div>
        </div>

        ${aiReviewSection}

        <div class="trades-list">
`;

      filteredTrades.forEach((trade, idx) => {
        let images = [];
        if (trade.image_url) {
          try {
            const parsed = JSON.parse(trade.image_url);
            images = Array.isArray(parsed) ? parsed : [trade.image_url];
          } catch (e) {
            images = [trade.image_url];
          }
        }

        let ai = null;
        if (trade.ai_evaluation) {
          try {
            ai = typeof trade.ai_evaluation === 'string' ? JSON.parse(trade.ai_evaluation) : trade.ai_evaluation;
          } catch (e) {
            ai = trade.ai_evaluation;
          }
        }

        htmlContent += `
              <div class="trade-card">
                  <div class="trade-header">
                      <div class="trade-title">
                          ${t('tradeLabel', { num: totalTrades - idx })}: ${trade.asset}
                          <span class="${trade.side === 'BUY' ? 'trade-side-buy' : 'trade-side-sell'}">${trade.side}</span>
                      </div>
                      <div class="trade-pnl ${trade.status === 'WIN' ? 'text-green' : trade.status === 'LOSS' ? 'text-red' : 'text-gray'}">
                          ${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString()} USD
                      </div>
                  </div>

                  <div class="trade-grid">
                      <div><span>Giá vào</span>${trade.entry_price}</div>
                      <div><span>Giá ra</span>${trade.exit_price}</div>
                      <div><span>Khối lượng</span>${trade.size}</div>
                      <div><span>Setup</span>${trade.setup_tag || 'N/A'}</div>
                  </div>

                  ${trade.user_notes ? `<div class="notes-box"><strong>${t('tradeNotes')}:</strong>\n${trade.user_notes}</div>` : ''}

                  ${ai ? `
                  <div class="ai-section">
                      <div class="ai-header">
                          <span>${t('recentReviewTitle')}</span>
                          <span style="font-weight: bold; color: #fbbf24;">${t('decisionScore')}: ${ai.decision_rating || 5}/10</span>
                      </div>
                      <div class="ai-grid">
                          <div class="ai-col">
                              <ul>
                                  ${ai.strengths?.map(s => `<li>${s}</li>`).join('') || '<li>Không ghi nhận</li>'}
                              </ul>
                          </div>
                          <div class="ai-col">
                              <h5 style="color: #f87171;">⚠️ Điểm sai (Weaknesses)</h5>
                              <ul>
                                  ${ai.weaknesses?.map(w => `<li>${w}</li>`).join('') || '<li>Không ghi nhận</li>'}
                              </ul>
                          </div>
                      </div>
                      ${ai.advice ? `<div class="ai-advice"><strong>Lời khuyên Coach:</strong> ${ai.advice}</div>` : ''}
                  </div>
                  ` : ''}

                  ${images.length > 0 ? `
                  <div class="charts-container">
                      ${images.map((imgUrl, imgIdx) => `<img src="${imgUrl}" class="chart-img" alt="Chart ${imgIdx + 1}" onclick="showModalImage('${imgUrl}')" />`).join('')}
                  </div>
                  ` : ''}
              </div>
        `;
      });

      htmlContent += `
        </div>
      </div>

      <!-- Lightbox for print view or browser view -->
      <div id="imageModal" style="display: none; position: fixed; inset: 0; background-color: rgba(2,6,23,0.95); z-index: 1000; justify-content: center; align-items: center; cursor: zoom-out;">
          <img id="modalImage" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);" />
      </div>

      <script>
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        
        window.showModalImage = function(url) {
          modalImg.src = url;
          modal.style.display = 'flex';
        };
        
        modal.addEventListener('click', () => {
          modal.style.display = 'none';
          modalImg.src = '';
        });
      </script>
  </body>
  </html>
  `;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `nhat-ky-giao-dich-${activeTab}-${range}-${new Date().toISOString().split('T')[0]}.html`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Error during HTML export:', e);
      alert('Đã xảy ra lỗi khi tạo báo cáo xuất khẩu.');
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <>
      {isExporting && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="flex flex-col items-center bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-sm space-y-4 shadow-2xl">
            <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Đang khởi tạo báo cáo AI...</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Hệ thống đang trích xuất dữ liệu giao dịch và chạy AI Coach phân tích chuyên sâu. Báo cáo HTML của bạn sẽ được tải xuống tự động sau vài giây.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {isExportModalOpen && (
        <div 
          onClick={() => setIsExportModalOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div 
            className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-sm font-bold text-white uppercase tracking-wider">Xuất Nhật Ký Giao Dịch</span>
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Chọn khoảng thời gian của các giao dịch bạn muốn xuất ra file báo cáo HTML (đã bao gồm phân tích AI và hình ảnh đính kèm offline).
            </p>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  exportToHTML('TODAY');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
              >
                <span>☀️ Hôm nay</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportToHTML('YESTERDAY');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
              >
                <span>🌙 Hôm qua</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportToHTML('WEEK');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
              >
                <span>📅 7 ngày gần nhất (Tuần)</span>
                <span className="text-[10px] text-emerald-450 font-mono">
                  {weeklyTradeCount} lệnh
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportToHTML('MONTH');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
              >
                <span>📅 30 ngày gần nhất (Tháng)</span>
                <span className="text-[10px] text-emerald-450 font-mono">
                  {monthlyTradeCount} lệnh
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportToHTML('RECENT');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
              >
                <span>⚡ 20 lệnh gần nhất (Chuỗi lệnh)</span>
                <span className="text-[10px] text-amber-400 font-mono">
                  {Math.min(20, trades.length)} lệnh
                </span>
              </button>

              <div className="w-full border border-slate-850 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowCustomDate(!showCustomDate)}
                  className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 transition text-xs font-bold text-white flex items-center justify-between cursor-pointer"
                >
                  <span>🗓️ Tuỳ chọn ngày (Từ ngày - Đến ngày)</span>
                  {showCustomDate ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {showCustomDate && (
                  <div className="p-4 bg-slate-900 border-t border-slate-850 flex flex-col gap-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase">Từ ngày</label>
                        <input 
                          type="date" 
                          value={exportStartDate}
                          onChange={(e) => setExportStartDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase">Đến ngày</label>
                        <input 
                          type="date" 
                          value={exportEndDate}
                          onChange={(e) => setExportEndDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportToHTML('CUSTOM');
                        if (exportStartDate && exportEndDate) {
                          setIsExportModalOpen(false);
                        }
                      }}
                      className="w-full mt-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      Xác nhận xuất
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  exportToHTML('ALL');
                  setIsExportModalOpen(false);
                }}
                className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl transition text-xs font-bold text-white flex items-center justify-between cursor-pointer mt-2"
              >
                <span>📦 Xuất toàn bộ lệnh ({trades.length})</span>
                <span className="text-[10px] text-slate-500 font-semibold">Tất cả</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
