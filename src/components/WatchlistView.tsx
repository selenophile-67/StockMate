import React, { useMemo, useState } from 'react';
import { Bell, Plus, Search, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';
import { formatINR, formatPct } from '../lib/finance';
import { INDIAN_STOCK_DIRECTORY } from '../lib/indianStocks';

export function WatchlistView() {
  const {
    user,
    watchlists,
    alerts,
    quotes,
    refreshUserData,
    refreshMarketData,
    notify,
    setAuthModalOpen,
    setSelectedChartSymbol,
    setActiveNav,
  } = useApp();

  const [selectedWlId, setSelectedWlId] = useState<string>('');
  const [newWlName, setNewWlName] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [alertForm, setAlertForm] = useState({
    symbol: 'RELIANCE.NS',
    stockName: 'Reliance Industries Ltd',
    alertType: 'TARGET_ABOVE' as 'TARGET_ABOVE' | 'STOPLOSS_BELOW',
    targetValue: 1350,
  });

  const activeWatchlist =
    watchlists.find((w) => w.id === selectedWlId) || watchlists[0] || null;

  const searchResults = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return INDIAN_STOCK_DIRECTORY.slice(0, 10);
    return INDIAN_STOCK_DIRECTORY.filter(
      (s) =>
        s.baseTicker.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q)
    );
  }, [stockSearch]);

  const requireUser = () => {
    if (!user) {
      setAuthModalOpen(true);
      notify('info', 'Please sign in to manage watchlists & alerts');
      return false;
    }
    return true;
  };

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUser() || !newWlName.trim()) return;
    try {
      const res = await apiRequest<{ watchlist: { id: string } }>('/api/watchlists', {
        method: 'POST',
        body: JSON.stringify({ name: newWlName.trim() }),
      });
      await refreshUserData();
      setSelectedWlId(res.watchlist.id);
      setNewWlName('');
      notify('success', 'Watchlist created');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed creating watchlist');
    }
  };

  const handleAddStock = async (entry: (typeof INDIAN_STOCK_DIRECTORY)[number]) => {
    if (!requireUser() || !activeWatchlist) return;
    try {
      await apiRequest(`/api/watchlists/${activeWatchlist.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          symbol: entry.symbol,
          name: entry.name,
          exchange: entry.exchange,
          sector: entry.sector,
        }),
      });
      await refreshUserData();
      await refreshMarketData([entry.symbol]);
      notify('success', `Added ${entry.baseTicker} to ${activeWatchlist.name}`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed adding stock');
    }
  };

  const handleRemoveStock = async (symbol: string) => {
    if (!requireUser() || !activeWatchlist) return;
    try {
      await apiRequest(
        `/api/watchlists/${activeWatchlist.id}/items/${encodeURIComponent(symbol)}`,
        { method: 'DELETE' }
      );
      await refreshUserData();
      notify('info', `Removed ${symbol} from watchlist`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed removing stock');
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUser()) return;
    try {
      await apiRequest('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          ...alertForm,
          targetValue: Number(alertForm.targetValue),
        }),
      });
      await refreshUserData();
      notify('success', 'Price alert created');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed creating alert');
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!requireUser()) return;
    try {
      await apiRequest(`/api/alerts/${id}`, { method: 'DELETE' });
      await refreshUserData();
      notify('info', 'Alert removed');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed removing alert');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Watchlists & Price Alerts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor NSE/BSE stocks with 52-week range tracking, explicit feed timestamps & target/stop-loss alerts
          </p>
        </div>
        <form onSubmit={handleCreateWatchlist} className="flex items-center gap-2">
          <input
            type="text"
            value={newWlName}
            onChange={(e) => setNewWlName(e.target.value)}
            placeholder="New watchlist name..."
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827]"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> Create
          </button>
        </form>
      </div>

      {/* Watchlist tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {watchlists.map((wl) => (
          <button
            key={wl.id}
            type="button"
            onClick={() => setSelectedWlId(wl.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              wl.id === activeWatchlist?.id
                ? 'border-blue-500 bg-blue-600 text-white'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-300'
            }`}
          >
            {wl.name} ({wl.items.length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Watchlist Table */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          {activeWatchlist && activeWatchlist.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-[#0B1120] border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-3">Stock</th>
                    <th className="text-right px-3 py-3">Price</th>
                    <th className="text-right px-3 py-3">Day Change</th>
                    <th className="text-left px-3 py-3">52-Week Range</th>
                    <th className="text-left px-3 py-3">Data Source</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeWatchlist.items.map((item) => {
                    const q = quotes[item.symbol];
                    const price = item.manualPrice ?? q?.price ?? 0;
                    const chgPct = q?.changePercent ?? 0;
                    const pos = chgPct >= 0;
                    const low52 = q?.week52Low ?? price * 0.85;
                    const high52 = q?.week52High ?? price * 1.15;
                    const rangePct =
                      high52 > low52
                        ? Math.max(0, Math.min(100, ((price - low52) / (high52 - low52)) * 100))
                        : 50;

                    return (
                      <tr key={item.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChartSymbol(item.symbol);
                              setActiveNav('market');
                            }}
                            className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-500 text-left"
                          >
                            {item.symbol.replace(/\.(NS|BO)$/, '')} · {item.exchange}
                          </button>
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {item.name}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold">
                          {formatINR(price)}
                        </td>
                        <td
                          className={`px-3 py-3 text-right font-mono tabular-nums font-medium ${
                            pos
                              ? 'text-emerald-600 dark:text-[#22C55E]'
                              : 'text-red-600 dark:text-[#EF4444]'
                          }`}
                        >
                          {formatPct(chgPct)}
                        </td>
                        <td className="px-3 py-3 min-w-[140px]">
                          <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                            <span>{formatINR(low52, 0)}</span>
                            <span>{formatINR(high52, 0)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 relative">
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500"
                              style={{ left: `calc(${rangePct}% - 4px)` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-slate-500">
                          {item.manualPrice
                            ? 'Manual Override'
                            : q?.source === 'delayed'
                              ? 'Delayed Feed'
                              : 'Ref Snapshot'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setAlertForm({
                                  symbol: item.symbol,
                                  stockName: item.name,
                                  alertType: 'TARGET_ABOVE',
                                  targetValue: Number((price * 1.08).toFixed(2)),
                                })
                              }
                              className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-blue-500"
                              title="Set Price Alert"
                            >
                              <Bell className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStock(item.symbol)}
                              className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-red-500"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Add stocks from the NSE/BSE search panel on the right.
            </div>
          )}
        </div>

        {/* Right Column: Search & Price Alerts */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3">
            <h3 className="text-sm font-semibold">Add NSE / BSE Stocks</h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Search symbol or sector..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
              />
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.map((entry) => (
                <div key={entry.symbol} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">
                      {entry.baseTicker} · {entry.exchange}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{entry.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddStock(entry)}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium shrink-0"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-500" />
              Target & Stop-Loss Alerts
            </h3>
            <form onSubmit={handleCreateAlert} className="space-y-2.5 text-xs">
              <select
                value={alertForm.symbol}
                onChange={(e) => {
                  const found = INDIAN_STOCK_DIRECTORY.find((s) => s.symbol === e.target.value);
                  setAlertForm({
                    ...alertForm,
                    symbol: e.target.value,
                    stockName: found?.name || e.target.value,
                  });
                }}
                className="w-full py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
              >
                {INDIAN_STOCK_DIRECTORY.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.baseTicker} ({s.exchange})
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={alertForm.alertType}
                  onChange={(e) =>
                    setAlertForm({
                      ...alertForm,
                      alertType: e.target.value as 'TARGET_ABOVE' | 'STOPLOSS_BELOW',
                    })
                  }
                  className="py-1.5 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
                >
                  <option value="TARGET_ABOVE">Target Above (≥)</option>
                  <option value="STOPLOSS_BELOW">Stop-Loss Below (≤)</option>
                </select>
                <input
                  type="number"
                  step="any"
                  min={0.01}
                  value={alertForm.targetValue}
                  onChange={(e) =>
                    setAlertForm({ ...alertForm, targetValue: Number(e.target.value) })
                  }
                  className="py-1.5 px-2.5 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Save Alert
              </button>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
              {alerts.map((a) => {
                const cmp = quotes[a.symbol]?.price ?? 0;
                const triggered =
                  cmp > 0 &&
                  ((a.alertType === 'TARGET_ABOVE' && cmp >= a.targetValue) ||
                    (a.alertType === 'STOPLOSS_BELOW' && cmp <= a.targetValue));
                return (
                  <div key={a.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-semibold">
                        {a.symbol.replace(/\.(NS|BO)$/, '')}{' '}
                        <span className="font-mono text-slate-500">
                          {a.alertType === 'TARGET_ABOVE' ? '≥' : '≤'} {formatINR(a.targetValue)}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] ${
                          triggered
                            ? 'text-emerald-600 dark:text-[#22C55E] font-medium'
                            : 'text-slate-500'
                        }`}
                      >
                        {triggered ? 'Condition Reached' : 'Monitoring'} · CMP {formatINR(cmp)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAlert(a.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
