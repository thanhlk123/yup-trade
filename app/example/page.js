'use client';

import { 
  Target, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, 
  BrainCircuit, Calendar, Activity, ArrowRight, Zap, Target as TargetIcon,
  PlayCircle, ShieldCheck, Download, Plus, LayoutDashboard, History, Settings,
  Flame, ListChecks, DollarSign, BarChart3, Clock, AlertCircle
} from 'lucide-react';

export default function ProfessionalDashboardMockup() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans pb-32">
      
      {/* GLOBAL NAVIGATION */}
      <nav className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-xl tracking-tighter">
              <BrainCircuit className="w-6 h-6" />
              AI.TRADING
            </div>
            {/* Account Tabs */}
            <div className="hidden md:flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/5">
              <button className="px-4 py-1.5 rounded-lg bg-slate-800 text-white font-semibold shadow-sm text-sm">Tất cả lệnh</button>
              <button className="px-4 py-1.5 rounded-lg text-slate-400 hover:text-white font-medium text-sm transition">Live Account 1</button>
              <button className="px-4 py-1.5 rounded-lg text-slate-400 hover:text-white font-medium text-sm transition">Live Account 2</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl border border-white/5 transition flex items-center gap-2">
              <Download className="w-4 h-4" /> Import CSV
            </button>
            <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Thêm lệnh
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition ml-2">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        
        {/* ROW 1: KPI OVERVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="theme-card bg-slate-900/40 border border-white/5 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign className="w-16 h-16 text-emerald-500" /></div>
            <p className="text-sm text-slate-400 font-medium">Lợi nhuận ròng</p>
            <div className="mt-2">
              <h3 className="text-3xl font-black text-white">+$2,450.00</h3>
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +12.5% so với tuần trước</p>
            </div>
          </div>
          <div className="theme-card bg-slate-900/40 border border-white/5 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Target className="w-16 h-16 text-sky-500" /></div>
            <p className="text-sm text-slate-400 font-medium">Win Rate</p>
            <div className="mt-2">
              <h3 className="text-3xl font-black text-white">68.5%</h3>
              <p className="text-xs text-slate-500 mt-1">Từ 343 lệnh giao dịch</p>
            </div>
          </div>
          <div className="theme-card bg-slate-900/40 border border-white/5 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 className="w-16 h-16 text-purple-500" /></div>
            <p className="text-sm text-slate-400 font-medium">Profit Factor</p>
            <div className="mt-2">
              <h3 className="text-3xl font-black text-white">1.84</h3>
              <p className="text-xs text-slate-500 mt-1">Kỳ vọng: +$14.2/lệnh</p>
            </div>
          </div>
          <div className="theme-card bg-slate-900/40 border border-white/5 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><AlertCircle className="w-16 h-16 text-rose-500" /></div>
            <p className="text-sm text-slate-400 font-medium">Max Drawdown</p>
            <div className="mt-2">
              <h3 className="text-3xl font-black text-white">-$540.00</h3>
              <p className="text-xs text-rose-400 mt-1 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Chuỗi thua dài nhất: 4</p>
            </div>
          </div>
        </div>

        {/* SPRINT REVIEW BANNER (Pops up when 20 trades are reached) */}
        <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 rounded-3xl p-1 flex items-center justify-between relative overflow-hidden">
           <div className="absolute top-0 left-0 w-64 h-full bg-emerald-500/20 blur-3xl rounded-full"></div>
           <div className="p-4 px-6 flex items-center gap-5 relative z-10">
             <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
               <TrendingUp className="w-6 h-6" />
             </div>
             <div>
               <div className="flex items-center gap-2 mb-1">
                 <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">Sprint 12</span>
                 <h3 className="text-white font-bold text-lg">Chu kỳ 20 lệnh gần nhất đã hoàn thành!</h3>
               </div>
               <p className="text-sm text-emerald-100/70">AI đã tổng hợp phong độ tâm lý & kỹ thuật của bạn trong chu kỳ này.</p>
             </div>
           </div>
           <div className="pr-5 relative z-10">
             <button className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition shadow-lg">
               Xem Đánh Giá Chu Kỳ <ArrowRight className="w-4 h-4" />
             </button>
           </div>
        </div>

        {/* ROW 2: DISCIPLINE & AI COACHING */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Daily Rules & Checklist (Tier 1) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="theme-card bg-slate-900/60 border border-white/5 rounded-3xl p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-sky-400" /> Kỷ luật hôm nay
                </h3>
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  <Flame className="w-3.5 h-3.5" /> 12 Days Streak
                </div>
              </div>

              <div className="space-y-3 flex-1">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-emerald-500/20 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400"><CheckCircle2 className="w-4 h-4" /></div>
                    <span className="text-sm text-slate-200">Tối đa 3 lệnh/ngày</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">2/3</span>
                </div>
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-rose-500/20 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400"><AlertTriangle className="w-4 h-4" /></div>
                    <span className="text-sm text-slate-200">Không DCA/Nhồi lệnh</span>
                  </div>
                  <span className="text-xs font-bold text-rose-400">Vi phạm (1)</span>
                </div>
                <div className="p-3 bg-slate-800/50 border border-white/5 rounded-2xl flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center"></div>
                    <span className="text-sm text-slate-400">Luôn đặt Stoploss</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500">Chưa có lệnh</span>
                </div>
              </div>

              {/* End of day checklist / report summary */}
              <div className="mt-6 pt-5 border-t border-white/5">
                <button className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-sm text-white font-semibold rounded-xl transition border border-white/10 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> Đóng máy & Chốt ngày
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: AI Coach Mission (Tier 3) */}
          <div className="lg:col-span-8">
            <div className="theme-card border border-white/5 rounded-3xl p-1 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 h-full">
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="p-7">
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-500/20 rounded-2xl text-purple-400 border border-purple-500/30">
                      <TargetIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-[11px] text-purple-400 font-bold tracking-wider uppercase mb-0.5 flex items-center gap-1.5"><BrainCircuit className="w-3 h-3"/> AI Coach • Nhiệm vụ Tuần</h3>
                      <p className="text-xl font-black text-white">Kiểm soát Hội chứng FOMO đuổi giá</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition border border-white/5">
                    Phân tích lại
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  {/* Case Study */}
                  <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-300">Bằng chứng (Case Study)</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">
                      "Tôi thấy bạn mua <strong className="text-white">XAUUSD ngày 02/08</strong>. Bạn ghi chú <em className="text-rose-400">'Thấy giá chạy mạnh nên nhảy vào đuổi'</em> và lỗ -$150. Hành động mua không setup này cộng với 4 lệnh tương tự đã đốt sạch lãi của bạn."
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1.5 rounded-lg border border-slate-700">Lệnh #1042</span>
                      <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-1.5 rounded-lg border border-rose-500/20">PnL: -$150.00</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1.5 rounded-lg border border-slate-700">Tag: #FOMO</span>
                    </div>
                  </div>

                  {/* Mission Checklist */}
                  <div className="flex flex-col gap-2.5">
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Hành động cần làm</h4>
                    {[
                      "Chỉ vào lệnh khi giá chạm đúng Keylevel đã vẽ.",
                      "Tuyệt đối không Mua/Bán đuổi giá ở lưng chừng.",
                      "Ghi chú rủi ro trước khi bấm nút Entry."
                    ].map((task, i) => (
                      <div key={i} className="flex items-center gap-3 p-3.5 bg-slate-800/40 border border-white/5 rounded-2xl hover:bg-slate-800 transition cursor-pointer group">
                        <div className="w-5 h-5 shrink-0 rounded-full border-2 border-slate-600 group-hover:border-purple-400 transition flex items-center justify-center">
                        </div>
                        <span className="text-sm text-slate-300 leading-tight">{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: CHARTS & LOGS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 theme-card bg-slate-900/40 border border-white/5 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Đường cong vốn
              </h3>
              <select className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 outline-none">
                <option>All Time</option>
                <option>Tháng này</option>
                <option>Tuần này</option>
              </select>
            </div>
            {/* Mock Chart Area */}
            <div className="w-full h-64 bg-gradient-to-t from-emerald-500/10 to-transparent border-b border-emerald-500/30 relative flex items-end">
              <svg className="w-full h-48 text-emerald-500" preserveAspectRatio="none" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M0,100 L5,90 L10,95 L20,70 L30,80 L50,40 L70,50 L90,20 L100,10" />
              </svg>
            </div>
          </div>

          <div className="lg:col-span-1 theme-card bg-slate-900/40 border border-white/5 rounded-3xl p-6 flex flex-col">
            <h3 className="text-white font-bold flex items-center gap-2 mb-6">
              <History className="w-5 h-5 text-sky-400" /> Lịch sử gần đây
            </h3>
            <div className="space-y-3 flex-1">
              {[
                { pair: 'XAUUSD', type: 'Long', pnl: '+$45.00', date: 'Hôm nay, 14:30', status: 'win' },
                { pair: 'EURUSD', type: 'Short', pnl: '-$12.50', date: 'Hôm nay, 09:15', status: 'loss' },
                { pair: 'BTCUSD', type: 'Long', pnl: '+$120.00', date: 'Hôm qua, 20:00', status: 'win' },
                { pair: 'GBPUSD', type: 'Short', pnl: '-$30.00', date: 'Hôm qua, 15:45', status: 'loss' },
              ].map((trade, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-800/50 transition cursor-pointer border border-transparent hover:border-white/5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${trade.type === 'Long' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{trade.type}</span>
                      <span className="text-sm font-bold text-slate-200">{trade.pair}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{trade.date}</p>
                  </div>
                  <div className={`font-bold ${trade.status === 'win' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {trade.pnl}
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 text-xs text-slate-400 hover:text-white font-medium transition flex items-center justify-center gap-1">
              Xem tất cả <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
