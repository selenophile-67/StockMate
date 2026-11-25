import React, { useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookmarkCheck,
  Calculator,
  Clock,
  ExternalLink,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { formatCompactINR, formatINR, formatPct } from '../lib/finance';

const CHART_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#A855F7', '#06B6D4', '#EC4899'];

export function DashboardView() {
  const {
    indices,
    marketStatus,
    marketLoading,
    refreshMarketData,
    portfolios,
    activePortfolioId,
    quotes,
    watchlists,
    calculations,
    news,
    setActiveNav,
    setSelectedCalcId,
    setSelectedChartSymbol,
  } = useApp();

  const activePortfolio =
    portfolios.find((p) => p.id === activePortfolioId) || portfolios[0] || null;

  const portfolioStats = useMemo(() => {
    const allHoldings = portfolios.flatMap((p) => p.holdings);
    let invested = 0;
    let current = 0;
    let realized = 0;
    let dividends = 0;

    const evaluated = allHoldings.map((h) => {
      const q = quotes[h.symbol];
      const liveOrManual = h.manualPrice ?? q?.price ?? h.averagePrice;
      const inv = h.quantity * h.averagePrice;
      const val = h.quantity * liveOrManual;
      const pnl = val - inv;
      const retPct = inv > 0 ? (pnl / inv) * 100 : 0;
      invested += inv;
      current += val;
      realized += h.realizedPnL || 0;
      dividends += h.dividends.reduce((s, d) => s + d.totalAmount, 0);
      return {
        symbol: h.symbol,
        ticker: h.symbol.replace(/\.(NS|BO)$/, ''),
        name: h.name,
        sector: h.sector,
        invested: inv,
        currentValue: val,
        pnl,
        retPct,
      };
    });

    const totalPnL = current - invested;
    const totalReturnPct = invested > 0 ? (totalPnL / invested) * 100 : 0;
    const sortedByRet = [...evaluated].sort((a, b) => b.retPct - a.retPct);

    // Sector allocation
    const sectorMap = new Map<string, number>();
    for (const item of evaluated) {
      sectorMap.set(item.sector, (sectorMap.get(item.sector) || 0) + item.currentValue);
    }
    const allocationData = Array.from(sectorMap.entries()).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));

    return {
      invested,
      current,
      totalPnL,
      realized,
      dividends,
      totalReturnPct,
      holdingsCount: allHoldings.length,
      best: sortedByRet[0] || null,
      worst: sortedByRet[sortedByRet.length - 1] || null,
      allocationData,
      pnlChartData: evaluated.slice(0, 7).map((e) => ({
        ticker: e.ticker,
        pnl: Number(e.pnl.toFixed(2)),
        value: Number(e.currentValue.toFixed(2)),
      })),
    };
  }, [portfolios, quotes]);

  const popularCalculators = [
    { id: 'profit-loss', name: 'Profit & Loss', desc: 'Net returns after charges & break-even' },
    { id: 'brokerage', name: 'Brokerage & Taxes', desc: 'NSE/BSE STT, Stamp Duty, SEBI & GST' },
    { id: 'average-price', name: 'Average Stock Price', desc: 'Weighted entry across multiple buys' },
    { id: 'sip', name: 'Stock SIP Planner', desc: 'Compounding projection & growth curve' },
    { id: 'target-price', name: 'Target & Stop-Loss', desc: 'Risk-to-reward & expected outcome' },
    { id: 'xirr', name: 'XIRR Solver', desc: 'Annualized return for dated cash flows' },
  ];

  const firstWatchlist = watchlists[0]?.items || [];

  return (
    <div className="space-y-8">
      {/* Hero / Workspace Summary Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>NSE & BSE Equity Suite</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                marketStatus.isOpen
                  ? 'text-emerald-600 dark:text-[#22C55E] font-medium'
                  : 'text-slate-600 dark:text-slate-300 font-medium'
              }
            >
              Market {marketStatus.label}
            </span>
            <span aria-hidden="true">·</span>
            <span>{marketStatus.sessionNote}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#F9FAFB] [text-wrap:balance]">
            Investment Command & Stock Calculators
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Track your Indian equity holdings, compute statutory NSE/BSE charges with decimal precision, and analyze compounding returns across 26 financial calculators.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => refreshMarketData()}
            disabled={marketLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${marketLoading ? 'animate-spin' : ''}`} />
            Refresh Quotes
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('calculators')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Calculator className="w-3.5 h-3.5" />
            Open Calculators
          </button>
        </div>
      </section>

      {/* Market Overview Strip */}
      <section aria-label="Indian Market Indices">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Market Overview
          </h2>
          {indices[0] && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {indices[0].source === 'delayed' ? 'Delayed Market Feed' : 'Reference Snapshot'} · Updated{' '}
              {new Date(indices[0].lastUpdated).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {indices.map((idx) => {
            const pos = idx.change >= 0;
            return (
              <div
                key={idx.symbol}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{idx.name}</span>
                  <span
                    className={`inline-flex items-center gap-0.5 font-mono font-medium tabular-nums ${
                      pos
                        ? 'text-emerald-600 dark:text-[#22C55E]'
                        : 'text-red-600 dark:text-[#EF4444]'
                    }`}
                  >
                    {pos ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {formatPct(idx.changePercent)}
                  </span>
                </div>
                <div className="mt-2 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                  {idx.price.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  <span>H: {idx.dayHigh.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  <span>L: {idx.dayLow.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Portfolio KPI Summary Row */}
      <section aria-label="Portfolio Statistics">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Portfolio Summary {activePortfolio ? `· ${activePortfolio.name}` : ''}
          </h2>
          <button
            type="button"
            onClick={() => setActiveNav('portfolio')}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Manage holdings
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Invested</div>
            <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
              {formatINR(portfolioStats.invested)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {portfolioStats.holdingsCount} active stock{portfolioStats.holdingsCount === 1 ? '' : 's'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Current Portfolio Value</div>
            <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
              {formatINR(portfolioStats.current)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Dividends logged: <span className="font-mono">{formatINR(portfolioStats.dividends)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Unrealized P/L & Return</div>
            <div
              className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
                portfolioStats.totalPnL >= 0
                  ? 'text-emerald-600 dark:text-[#22C55E]'
                  : 'text-red-600 dark:text-[#EF4444]'
              }`}
            >
              {portfolioStats.totalPnL >= 0 ? '+' : ''}
              {formatINR(portfolioStats.totalPnL)}
            </div>
            <div
              className={`mt-1 text-xs font-mono font-medium tabular-nums ${
                portfolioStats.totalReturnPct >= 0
                  ? 'text-emerald-600 dark:text-[#22C55E]'
                  : 'text-red-600 dark:text-[#EF4444]'
              }`}
            >
              {formatPct(portfolioStats.totalReturnPct)} overall · Realized{' '}
              {formatCompactINR(portfolioStats.realized)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Best & Worst Performer</div>
            {portfolioStats.best ? (
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    Best: {portfolioStats.best.ticker}
                  </span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-[#22C55E] tabular-nums">
                    {formatPct(portfolioStats.best.retPct)}
                  </span>
                </div>
                {portfolioStats.worst && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      Lagging: {portfolioStats.worst.ticker}
                    </span>
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        portfolioStats.worst.retPct >= 0
                          ? 'text-emerald-600 dark:text-[#22C55E]'
                          : 'text-red-600 dark:text-[#EF4444]'
                      }`}
                    >
                      {formatPct(portfolioStats.worst.retPct)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500">Add holdings to track performance</div>
            )}
          </div>
        </div>
      </section>

      {/* Interactive Portfolio Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Sector Allocation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Diversification by current market value
              </p>
            </div>
          </div>
          {portfolioStats.allocationData.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portfolioStats.allocationData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                    >
                      {portfolioStats.allocationData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => formatINR(Number(val ?? 0))}
                      contentStyle={{
                        backgroundColor: '#111827',
                        borderColor: '#374151',
                        borderRadius: '8px',
                        color: '#F9FAFB',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {portfolioStats.allocationData.map((item, idx) => {
                  const pct =
                    portfolioStats.current > 0
                      ? (item.value / portfolioStats.current) * 100
                      : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="truncate text-slate-700 dark:text-slate-300">
                          {item.name}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100 shrink-0">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
              <p>No holdings in portfolio yet.</p>
              <button
                type="button"
                onClick={() => setActiveNav('portfolio')}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium"
              >
                Add First Holding
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Holdings Profit / Loss Breakdown
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unrealized gain or loss per position (INR)
              </p>
            </div>
          </div>
          {portfolioStats.pnlChartData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={portfolioStats.pnlChartData}>
                  <XAxis
                    dataKey="ticker"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(val) => formatINR(Number(val ?? 0))}
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderColor: '#374151',
                      borderRadius: '8px',
                      color: '#F9FAFB',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {portfolioStats.pnlChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.pnl >= 0 ? '#22C55E' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              Profit & loss bars will appear once stocks are added.
            </div>
          )}
        </div>
      </section>

      {/* Popular Calculators Quick Access */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Popular Calculators
          </h2>
          <button
            type="button"
            onClick={() => setActiveNav('calculators')}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all 26 calculators
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {popularCalculators.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedCalcId(c.id);
                setActiveNav('calculators');
              }}
              className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-blue-500/60 dark:hover:border-blue-500/60 p-4 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-500 transition-colors">
                  {c.name}
                </span>
                <TrendingUp className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{c.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Watchlist, Recent Calculations & Market News */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Watchlist Snapshot */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-blue-500" />
              Watchlist
            </h3>
            <button
              type="button"
              onClick={() => setActiveNav('watchlist')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Manage
            </button>
          </div>
          {firstWatchlist.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {firstWatchlist.slice(0, 5).map((item) => {
                const q = quotes[item.symbol];
                const price = item.manualPrice ?? q?.price ?? 0;
                const pct = q?.changePercent ?? 0;
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => {
                      setSelectedChartSymbol(item.symbol);
                      setActiveNav('market');
                    }}
                    className="w-full py-2.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 px-1 rounded transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {item.symbol.replace(/\.(NS|BO)$/, '')}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                        {item.name}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {formatINR(price)}
                      </div>
                      <div
                        className={`text-[11px] ${
                          pct >= 0
                            ? 'text-emerald-600 dark:text-[#22C55E]'
                            : 'text-red-600 dark:text-[#EF4444]'
                        }`}
                      >
                        {formatPct(pct)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">Your watchlist is empty.</p>
          )}
        </div>

        {/* Recent Calculations */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Recent Calculations
            </h3>
            <button
              type="button"
              onClick={() => setActiveNav('history')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all
            </button>
          </div>
          {calculations.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {calculations.slice(0, 4).map((calc) => (
                <div key={calc.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {calc.calculatorName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(calc.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                    {calc.summary}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">
              Save calculations to revisit them anytime.
            </p>
          )}
        </div>

        {/* Market News Feed */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Indian Market Headlines
            </h3>
            <button
              type="button"
              onClick={() => setActiveNav('market')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Charts & News
            </button>
          </div>
          {news.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {news.slice(0, 4).map((item) => (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-2.5 group"
                >
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-500 line-clamp-2 flex items-start justify-between gap-2">
                    <span>{item.title}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 opacity-60" />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {item.publisher} · {new Date(item.publishedAt).toLocaleDateString('en-IN')}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="py-6 text-xs text-slate-500 text-center">
              Live RSS headlines unavailable in offline sandbox. Open Market & Charts for full technical analysis.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
