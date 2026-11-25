import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';
import { formatCompactINR, formatINR, formatPct } from '../lib/finance';
import { INDIAN_STOCK_DIRECTORY } from '../lib/indianStocks';
import { CandlePoint, ChartType, MarketQuote, TimeInterval } from '../types/stockmate';

function CandlestickSvgChart({
  candles,
  showSma,
  showEma,
  showBb,
}: {
  candles: CandlePoint[];
  showSma: boolean;
  showEma: boolean;
  showBb: boolean;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 920;
  const height = 320;
  const padL = 62;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const { minPrice, maxPrice } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (showBb && c.bbLower != null && c.bbLower < min) min = c.bbLower;
      if (showBb && c.bbUpper != null && c.bbUpper > max) max = c.bbUpper;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) {
      return { minPrice: 0, maxPrice: 100 };
    }
    const pad = (max - min) * 0.06;
    return { minPrice: min - pad, maxPrice: max + pad };
  }, [candles, showBb]);

  const yFor = (price: number) =>
    padT + ((maxPrice - price) / (maxPrice - minPrice)) * plotH;
  const stepX = candles.length > 0 ? plotW / candles.length : plotW;
  const candleW = Math.max(2, Math.min(12, stepX * 0.62));

  const buildPath = (key: 'sma20' | 'ema20' | 'bbUpper' | 'bbLower') => {
    let dStr = '';
    candles.forEach((c, i) => {
      const v = c[key];
      if (v == null) return;
      const x = padL + i * stepX + stepX / 2;
      const y = yFor(v);
      dStr += dStr === '' ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });
    return dStr;
  };

  const hovered = hoverIdx !== null ? candles[hoverIdx] : candles[candles.length - 1];

  return (
    <div className="space-y-2">
      {hovered && (
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300 px-1">
          <span className="text-slate-500">{hovered.date}</span>
          <span>O: {formatINR(hovered.open)}</span>
          <span>H: {formatINR(hovered.high)}</span>
          <span>L: {formatINR(hovered.low)}</span>
          <span>C: {formatINR(hovered.close)}</span>
          <span>Vol: {hovered.volume.toLocaleString('en-IN')}</span>
        </div>
      )}
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-72 select-none">
          {/* Y-axis Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const val = maxPrice - t * (maxPrice - minPrice);
            const y = padT + t * plotH;
            return (
              <g key={t}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Bollinger Bands */}
          {showBb && (
            <>
              <path
                d={buildPath('bbUpper')}
                fill="none"
                stroke="#A855F7"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <path
                d={buildPath('bbLower')}
                fill="none"
                stroke="#A855F7"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
            </>
          )}

          {/* Candles */}
          {candles.map((c, i) => {
            const xCenter = padL + i * stepX + stepX / 2;
            const bull = c.close >= c.open;
            const color = bull ? '#22C55E' : '#EF4444';
            const yHigh = yFor(c.high);
            const yLow = yFor(c.low);
            const yOpen = yFor(c.open);
            const yClose = yFor(c.close);
            const bodyTop = Math.min(yOpen, yClose);
            const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));
            return (
              <g
                key={c.timestamp + '_' + i}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <rect
                  x={padL + i * stepX}
                  y={padT}
                  width={stepX}
                  height={plotH}
                  fill="transparent"
                />
                <line x1={xCenter} x2={xCenter} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1.2} />
                <rect
                  x={xCenter - candleW / 2}
                  y={bodyTop}
                  width={candleW}
                  height={bodyH}
                  fill={color}
                  rx={1}
                />
              </g>
            );
          })}

          {/* SMA & EMA overlays */}
          {showSma && (
            <path d={buildPath('sma20')} fill="none" stroke="#3B82F6" strokeWidth="1.5" />
          )}
          {showEma && (
            <path d={buildPath('ema20')} fill="none" stroke="#F59E0B" strokeWidth="1.5" />
          )}

          {/* X-axis sample labels */}
          {candles
            .filter((_, i) => i % Math.max(1, Math.floor(candles.length / 6)) === 0)
            .map((c) => {
              const idx = candles.indexOf(c);
              const x = padL + idx * stepX + stepX / 2;
              return (
                <text
                  key={idx}
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  {c.date}
                </text>
              );
            })}
        </svg>
      </div>
    </div>
  );
}

export function MarketChartsView() {
  const { selectedChartSymbol, setSelectedChartSymbol, news, indices, marketStatus } = useApp();
  const [symbolInput, setSymbolInput] = useState(selectedChartSymbol);
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [interval, setInterval] = useState<TimeInterval>('6M');
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [histSource, setHistSource] = useState<'delayed' | 'reference-snapshot'>('delayed');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Indicators
  const [showSma, setShowSma] = useState(true);
  const [showEma, setShowEma] = useState(false);
  const [showBb, setShowBb] = useState(false);
  const [showRsi, setShowRsi] = useState(true);
  const [showMacd, setShowMacd] = useState(false);

  useEffect(() => {
    setSymbolInput(selectedChartSymbol);
  }, [selectedChartSymbol]);

  const loadSymbolData = async (sym: string, intv: TimeInterval) => {
    setLoading(true);
    try {
      const [qRes, hRes] = await Promise.all([
        apiRequest<{ quote: MarketQuote }>(`/api/market/quote/${encodeURIComponent(sym)}`),
        apiRequest<{
          candles: CandlePoint[];
          source: 'delayed' | 'reference-snapshot';
          lastUpdated: string;
        }>(`/api/market/history/${encodeURIComponent(sym)}?interval=${intv}`),
      ]);
      setQuote(qRes.quote);
      setCandles(hRes.candles);
      setHistSource(hRes.source);
      setLastUpdated(hRes.lastUpdated);
    } catch (err) {
      console.error('Chart fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSymbolData(selectedChartSymbol, interval);
  }, [selectedChartSymbol, interval]);

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = symbolInput.trim().toUpperCase();
    if (!clean) return;
    const normalized =
      clean.endsWith('.NS') || clean.endsWith('.BO') || clean.startsWith('^')
        ? clean
        : `${clean}.NS`;
    setSelectedChartSymbol(normalized);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Market Overview & Interactive Charts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            NSE/BSE historical OHLCV price charts, Candlestick/Line/Area/Bar modes, SMA/EMA/RSI/MACD/Bollinger indicators & news
          </p>
        </div>

        <form onSubmit={handleSymbolSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              placeholder="RELIANCE.NS or TCS.BO"
              className="pl-8 pr-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] w-48"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
          >
            Load Chart
          </button>
          <button
            type="button"
            onClick={() => loadSymbolData(selectedChartSymbol, interval)}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Refresh chart"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </form>
      </div>

      {/* Quick Stock Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {INDIAN_STOCK_DIRECTORY.slice(0, 12).map((s) => (
          <button
            key={s.symbol}
            type="button"
            onClick={() => setSelectedChartSymbol(s.symbol)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border whitespace-nowrap shrink-0 ${
              selectedChartSymbol === s.symbol
                ? 'border-blue-500 bg-blue-600 text-white'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-300'
            }`}
          >
            {s.baseTicker}
          </button>
        ))}
      </div>

      {/* Main Chart Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-5">
        {/* Quote Header */}
        {quote && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{quote.exchange}</span>
                <span aria-hidden="true">·</span>
                <span>{quote.sector}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {histSource === 'delayed' ? 'Delayed Market Feed' : 'Reference Snapshot'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Updated{' '}
                  {lastUpdated
                    ? new Date(lastUpdated).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '--'}
                </span>
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                  {quote.name} ({quote.symbol})
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-4 font-mono tabular-nums">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                {formatINR(quote.price)}
              </span>
              <span
                className={`text-sm font-semibold ${
                  quote.change >= 0
                    ? 'text-emerald-600 dark:text-[#22C55E]'
                    : 'text-red-600 dark:text-[#EF4444]'
                }`}
              >
                {quote.change >= 0 ? '+' : ''}
                {formatINR(quote.change)} ({formatPct(quote.changePercent)})
              </span>
            </div>
          </div>
        )}

        {/* OHLCV Metrics Strip */}
        {quote && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono tabular-nums">
            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1120] p-2.5">
              <div className="text-[11px] font-sans text-slate-500">Open</div>
              <div className="font-semibold mt-0.5">{formatINR(quote.open)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1120] p-2.5">
              <div className="text-[11px] font-sans text-slate-500">Day High</div>
              <div className="font-semibold mt-0.5">{formatINR(quote.dayHigh)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1120] p-2.5">
              <div className="text-[11px] font-sans text-slate-500">Day Low</div>
              <div className="font-semibold mt-0.5">{formatINR(quote.dayLow)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1120] p-2.5">
              <div className="text-[11px] font-sans text-slate-500">Prev Close</div>
              <div className="font-semibold mt-0.5">{formatINR(quote.previousClose)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1120] p-2.5">
              <div className="text-[11px] font-sans text-slate-500">Volume</div>
              <div className="font-semibold mt-0.5">{quote.volume.toLocaleString('en-IN')}</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1120] p-2.5">
              <div className="text-[11px] font-sans text-slate-500">Market Cap</div>
              <div className="font-semibold mt-0.5">
                {quote.marketCap ? formatCompactINR(quote.marketCap) : 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Controls: Chart Type, Interval & Indicators */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800">
              {(['candlestick', 'line', 'area', 'bar'] as ChartType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setChartType(t)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize ${
                    chartType === t
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800">
              {(['1D', '1W', '1M', '3M', '6M', '1Y', '5Y'] as TimeInterval[]).map((iv) => (
                <button
                  key={iv}
                  type="button"
                  onClick={() => setInterval(iv)}
                  className={`px-2 py-1 rounded-md text-xs font-mono ${
                    interval === iv
                      ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-50 font-semibold'
                      : 'text-slate-500'
                  }`}
                >
                  {iv}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { label: 'SMA 20', active: showSma, toggle: () => setShowSma(!showSma) },
              { label: 'EMA 20', active: showEma, toggle: () => setShowEma(!showEma) },
              { label: 'Bollinger', active: showBb, toggle: () => setShowBb(!showBb) },
              { label: 'RSI 14', active: showRsi, toggle: () => setShowRsi(!showRsi) },
              { label: 'MACD', active: showMacd, toggle: () => setShowMacd(!showMacd) },
            ].map((ind) => (
              <button
                key={ind.label}
                type="button"
                onClick={ind.toggle}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  ind.active
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500'
                }`}
              >
                {ind.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Price Chart */}
        {candles.length > 0 ? (
          <div className="space-y-4">
            {chartType === 'candlestick' ? (
              <CandlestickSvgChart
                candles={candles}
                showSma={showSma}
                showEma={showEma}
                showBb={showBb}
              />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'line' ? (
                    <LineChart data={candles}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.35} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      />
                      <Tooltip
                        formatter={(v) => formatINR(Number(v ?? 0))}
                        contentStyle={{
                          backgroundColor: '#111827',
                          borderColor: '#374151',
                          borderRadius: '8px',
                          color: '#F9FAFB',
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="close"
                        name="Close"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                      />
                      {showSma && (
                        <Line
                          type="monotone"
                          dataKey="sma20"
                          name="SMA 20"
                          stroke="#22C55E"
                          strokeWidth={1.5}
                          dot={false}
                        />
                      )}
                      {showEma && (
                        <Line
                          type="monotone"
                          dataKey="ema20"
                          name="EMA 20"
                          stroke="#F59E0B"
                          strokeWidth={1.5}
                          dot={false}
                        />
                      )}
                      {showBb && (
                        <>
                          <Line
                            type="monotone"
                            dataKey="bbUpper"
                            name="BB Upper"
                            stroke="#A855F7"
                            strokeDasharray="3 3"
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="bbLower"
                            name="BB Lower"
                            stroke="#A855F7"
                            strokeDasharray="3 3"
                            dot={false}
                          />
                        </>
                      )}
                    </LineChart>
                  ) : chartType === 'area' ? (
                    <AreaChart data={candles}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.35} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      />
                      <Tooltip formatter={(v) => formatINR(Number(v ?? 0))} />
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.2}
                      />
                      {showSma && (
                        <Line
                          type="monotone"
                          dataKey="sma20"
                          stroke="#22C55E"
                          dot={false}
                        />
                      )}
                    </AreaChart>
                  ) : (
                    <BarChart data={candles}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.35} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      />
                      <Tooltip formatter={(v) => formatINR(Number(v ?? 0))} />
                      <Bar dataKey="close" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* Volume Sub-chart */}
            <div className="h-24 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 mb-1">Trading Volume</div>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={candles}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v) => Number(v ?? 0).toLocaleString('en-IN')}
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderColor: '#374151',
                      borderRadius: '8px',
                      color: '#F9FAFB',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="volume" fill="#475569" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* RSI Sub-chart */}
            {showRsi && (
              <div className="h-28 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 mb-1">RSI (14)</div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={candles}>
                    <XAxis dataKey="date" hide />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                    <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="3 3" />
                    <ReferenceLine y={30} stroke="#22C55E" strokeDasharray="3 3" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="rsi14"
                      name="RSI 14"
                      stroke="#A855F7"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* MACD Sub-chart */}
            {showMacd && (
              <div className="h-28 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 mb-1">MACD (12, 26, 9)</div>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={candles}>
                    <XAxis dataKey="date" hide />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                    <Tooltip />
                    <Bar dataKey="macdHist" name="Histogram" fill="#64748B" />
                    <Line
                      type="monotone"
                      dataKey="macd"
                      name="MACD"
                      stroke="#3B82F6"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="macdSignal"
                      name="Signal"
                      stroke="#F59E0B"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="h-72 flex items-center justify-center text-xs text-slate-500">
            {loading ? 'Loading market chart...' : 'No chart data available for this symbol.'}
          </div>
        )}
      </div>

      {/* Benchmark Indices & Market News */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Indian Benchmarks</h3>
            <span className="text-xs text-slate-500">Market {marketStatus.label}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {indices.map((idx) => (
              <div key={idx.symbol} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold">{idx.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    H: {idx.dayHigh.toLocaleString('en-IN')} · L: {idx.dayLow.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="font-semibold">{idx.price.toLocaleString('en-IN')}</div>
                  <div
                    className={
                      idx.change >= 0
                        ? 'text-emerald-600 dark:text-[#22C55E]'
                        : 'text-red-600 dark:text-[#EF4444]'
                    }
                  >
                    {formatPct(idx.changePercent)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <h3 className="text-sm font-semibold mb-3">Real-Time Business & Market News</h3>
          {news.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {news.map((item) => (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 flex items-start justify-between gap-3 group"
                >
                  <div>
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-500">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {item.publisher} · {new Date(item.publishedAt).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6">
              RSS news feed unavailable offline. Reconnect network to load live NSE/BSE news headlines.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
