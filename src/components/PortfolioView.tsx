import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  DollarSign,
  Edit3,
  FileSpreadsheet,
  GitCompare,
  Plus,
  Search,
  Trash2,
  X,
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
import { apiRequest } from '../lib/api';
import { formatINR, formatPct } from '../lib/finance';
import { INDIAN_STOCK_DIRECTORY } from '../lib/indianStocks';
import { Exchange, StockHolding } from '../types/stockmate';

const COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#A855F7', '#06B6D4', '#EC4899'];

type SortKey = 'name' | 'invested' | 'currentValue' | 'pnlPct';
type FilterMode = 'all' | 'profit' | 'loss';

export function PortfolioView() {
  const {
    user,
    portfolios,
    activePortfolioId,
    setActivePortfolioId,
    quotes,
    refreshUserData,
    refreshMarketData,
    notify,
    setAuthModalOpen,
    setSelectedChartSymbol,
    setActiveNav,
  } = useApp();

  const [tab, setTab] = useState<'holdings' | 'compare'>('holdings');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('currentValue');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Modals
  const [newPfName, setNewPfName] = useState('');
  const [showNewPf, setShowNewPf] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [editingHolding, setEditingHolding] = useState<StockHolding | null>(null);
  const [txHolding, setTxHolding] = useState<StockHolding | null>(null);
  const [divHolding, setDivHolding] = useState<StockHolding | null>(null);

  // Add Holding form
  const [addForm, setAddForm] = useState({
    symbol: 'RELIANCE.NS',
    name: 'Reliance Industries Ltd',
    exchange: 'NSE' as Exchange,
    sector: 'Energy & Conglomerate',
    quantity: 10,
    price: 1265,
    charges: 35,
    date: new Date().toISOString().slice(0, 10),
    manualPrice: '',
  });
  const [stockSearch, setStockSearch] = useState('');

  // Edit Holding form
  const [editForm, setEditForm] = useState({ quantity: 0, averagePrice: 0, manualPrice: '' });

  // Transaction form
  const [txForm, setTxForm] = useState({
    type: 'BUY' as 'BUY' | 'SELL',
    quantity: 5,
    price: 1300,
    charges: 25,
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Dividend form
  const [divForm, setDivForm] = useState({
    amountPerShare: 15,
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // CSV Import text
  const [csvText, setCsvText] = useState(
    'symbol,name,exchange,type,quantity,price,charges,date\nINFY.NS,Infosys Ltd,NSE,BUY,15,1820,42,2026-10-01\nSBIN.NS,State Bank of India,NSE,BUY,40,795,38,2026-10-15'
  );

  // Stock Comparison Tool
  const [compareA, setCompareA] = useState('RELIANCE.NS');
  const [compareB, setCompareB] = useState('TCS.NS');
  const [compareC, setCompareC] = useState('HDFCBANK.NS');

  const activePortfolio =
    portfolios.find((p) => p.id === activePortfolioId) || portfolios[0] || null;

  const evaluatedRows = useMemo(() => {
    if (!activePortfolio) return [];
    return activePortfolio.holdings.map((h) => {
      const q = quotes[h.symbol];
      const currentPrice = h.manualPrice ?? q?.price ?? h.averagePrice;
      const priceSource =
        h.manualPrice !== null && h.manualPrice !== undefined
          ? 'Manual'
          : q?.source === 'delayed'
            ? 'Delayed Feed'
            : 'Ref Snapshot';
      const invested = h.quantity * h.averagePrice;
      const currentValue = h.quantity * currentPrice;
      const pnl = currentValue - invested;
      const returnPct = invested > 0 ? (pnl / invested) * 100 : 0;
      const totalDiv = h.dividends.reduce((s, d) => s + d.totalAmount, 0);
      return {
        holding: h,
        ticker: h.symbol.replace(/\.(NS|BO)$/, ''),
        currentPrice,
        priceSource,
        invested,
        currentValue,
        pnl,
        returnPct,
        totalDiv,
      };
    });
  }, [activePortfolio, quotes]);

  const filteredSortedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = evaluatedRows.filter((row) => {
      const matchesText =
        !q ||
        row.holding.name.toLowerCase().includes(q) ||
        row.holding.symbol.toLowerCase().includes(q) ||
        row.holding.sector.toLowerCase().includes(q);
      const matchesFilter =
        filterMode === 'all' ||
        (filterMode === 'profit' && row.pnl >= 0) ||
        (filterMode === 'loss' && row.pnl < 0);
      return matchesText && matchesFilter;
    });

    filtered.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'name') diff = a.holding.name.localeCompare(b.holding.name);
      else if (sortBy === 'invested') diff = a.invested - b.invested;
      else if (sortBy === 'currentValue') diff = a.currentValue - b.currentValue;
      else diff = a.returnPct - b.returnPct;
      return sortAsc ? diff : -diff;
    });
    return filtered;
  }, [evaluatedRows, searchQuery, filterMode, sortBy, sortAsc]);

  const totals = useMemo(() => {
    let invested = 0;
    let current = 0;
    let realized = 0;
    let dividends = 0;
    for (const r of evaluatedRows) {
      invested += r.invested;
      current += r.currentValue;
      realized += r.holding.realizedPnL || 0;
      dividends += r.totalDiv;
    }
    const unrealized = current - invested;
    const returnPct = invested > 0 ? (unrealized / invested) * 100 : 0;
    return { invested, current, unrealized, realized, dividends, returnPct };
  }, [evaluatedRows]);

  const requireUser = () => {
    if (!user) {
      setAuthModalOpen(true);
      notify('info', 'Please sign in to manage portfolios');
      return false;
    }
    return true;
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUser() || !newPfName.trim()) return;
    try {
      const res = await apiRequest<{ portfolio: { id: string } }>('/api/portfolios', {
        method: 'POST',
        body: JSON.stringify({ name: newPfName.trim() }),
      });
      await refreshUserData();
      setActivePortfolioId(res.portfolio.id);
      setNewPfName('');
      setShowNewPf(false);
      notify('success', 'Portfolio created');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed creating portfolio');
    }
  };

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUser() || !activePortfolio) return;
    try {
      await apiRequest(`/api/portfolios/${activePortfolio.id}/holdings`, {
        method: 'POST',
        body: JSON.stringify({
          symbol: addForm.symbol,
          name: addForm.name,
          exchange: addForm.exchange,
          sector: addForm.sector,
          quantity: Number(addForm.quantity),
          price: Number(addForm.price),
          charges: Number(addForm.charges),
          date: addForm.date,
          manualPrice: addForm.manualPrice ? Number(addForm.manualPrice) : null,
        }),
      });
      await refreshUserData();
      await refreshMarketData([addForm.symbol]);
      setShowAddHolding(false);
      notify('success', `Added ${addForm.symbol} to ${activePortfolio.name}`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed adding holding');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUser() || !activePortfolio || !editingHolding) return;
    try {
      await apiRequest(
        `/api/portfolios/${activePortfolio.id}/holdings/${editingHolding.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            quantity: Number(editForm.quantity),
            averagePrice: Number(editForm.averagePrice),
            manualPrice: editForm.manualPrice ? Number(editForm.manualPrice) : null,
          }),
        }
      );
      await refreshUserData();
      setEditingHolding(null);
      notify('success', 'Holding updated');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleRecordTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUser() || !activePortfolio || !txHolding) return;
    try {
      await apiRequest(
        `/api/portfolios/${activePortfolio.id}/holdings/${txHolding.id}/transactions`,
        {
          method: 'POST',
          body: JSON.stringify({
            type: txForm.type,
            quantity: Number(txForm.quantity),
            price: Number(txForm.price),
            charges: Number(txForm.charges),
            date: txForm.date,
            notes: txForm.notes,
          }),
        }
      );
      await refreshUserData();
      setTxHolding(null);
      notify('success', `${txForm.type} transaction recorded`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Transaction failed');
    }
  };

  const handleAddDividend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUser() || !activePortfolio || !divHolding) return;
    try {
      await apiRequest(
        `/api/portfolios/${activePortfolio.id}/holdings/${divHolding.id}/dividends`,
        {
          method: 'POST',
          body: JSON.stringify({
            amountPerShare: Number(divForm.amountPerShare),
            date: divForm.date,
            notes: divForm.notes,
          }),
        }
      );
      await refreshUserData();
      setDivHolding(null);
      notify('success', 'Dividend recorded');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed adding dividend');
    }
  };

  const handleDeleteHolding = async (holdingId: string) => {
    if (!requireUser() || !activePortfolio) return;
    try {
      await apiRequest(`/api/portfolios/${activePortfolio.id}/holdings/${holdingId}`, {
        method: 'DELETE',
      });
      await refreshUserData();
      notify('info', 'Holding removed');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUser() || !activePortfolio) return;
    try {
      const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) throw new Error('Provide header row + at least 1 trade row');
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = cols[i] || '';
        });
        return {
          symbol: obj.symbol,
          name: obj.name || undefined,
          exchange: (obj.exchange?.toUpperCase() === 'BSE' ? 'BSE' : 'NSE') as Exchange,
          type: (obj.type?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
          quantity: Number(obj.quantity),
          price: Number(obj.price),
          charges: Number(obj.charges || 0),
          date: obj.date || undefined,
        };
      });

      const res = await apiRequest<{ importedCount: number }>(
        `/api/portfolios/${activePortfolio.id}/import-csv`,
        {
          method: 'POST',
          body: JSON.stringify({ rows }),
        }
      );
      await refreshUserData();
      setShowCsvImport(false);
      notify('success', `Imported ${res.importedCount} broker transactions`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'CSV import failed');
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else {
      setSortBy(key);
      setSortAsc(key === 'name');
    }
  };

  const directoryMatches = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return INDIAN_STOCK_DIRECTORY.slice(0, 8);
    return INDIAN_STOCK_DIRECTORY.filter(
      (s) =>
        s.baseTicker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [stockSearch]);

  const pieData = evaluatedRows.map((r) => ({
    name: r.ticker,
    value: Number(r.currentValue.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* Header & Portfolio Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Portfolio Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Multi-portfolio holdings, weighted average cost basis, dividends, CSV broker import & stock comparison
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTab('holdings')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                tab === 'holdings'
                  ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-50'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Holdings & Analytics
            </button>
            <button
              type="button"
              onClick={() => setTab('compare')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                tab === 'compare'
                  ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-50'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              Compare Stocks
            </button>
          </div>
        </div>
      </div>

      {tab === 'holdings' ? (
        <>
          {/* Portfolio selector bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {portfolios.map((pf) => (
                <button
                  key={pf.id}
                  type="button"
                  onClick={() => setActivePortfolioId(pf.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    pf.id === activePortfolio?.id
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {pf.name} ({pf.holdings.length})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowNewPf(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:text-blue-500"
              >
                <Plus className="w-3.5 h-3.5" /> New Portfolio
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCsvImport(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Import CSV
              </button>
              <button
                type="button"
                onClick={() => setShowAddHolding(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Stock
              </button>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Invested Capital</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-1 text-slate-900 dark:text-slate-50">
                {formatINR(totals.invested)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Current Value</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-1 text-slate-900 dark:text-slate-50">
                {formatINR(totals.current)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Unrealized P/L</div>
              <div
                className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                  totals.unrealized >= 0
                    ? 'text-emerald-600 dark:text-[#22C55E]'
                    : 'text-red-600 dark:text-[#EF4444]'
                }`}
              >
                {totals.unrealized >= 0 ? '+' : ''}
                {formatINR(totals.unrealized)} ({formatPct(totals.returnPct)})
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Realized P/L & Dividends
              </div>
              <div className="text-xl font-bold font-mono tabular-nums mt-1 text-slate-900 dark:text-slate-50">
                {formatINR(totals.realized + totals.dividends)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                Realized {formatINR(totals.realized)} · Div {formatINR(totals.dividends)}
              </div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by stock name, ticker, or sector..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 w-72"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
              {(
                [
                  { id: 'all', label: 'All Holdings' },
                  { id: 'profit', label: 'In Profit' },
                  { id: 'loss', label: 'In Loss' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterMode(f.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium ${
                    filterMode === f.id
                      ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-50'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Holdings Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            {filteredSortedRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-[#0B1120] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">
                        <button
                          type="button"
                          onClick={() => toggleSort('name')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          Stock Name <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left px-3 py-3 font-medium">Ticker</th>
                      <th className="text-right px-3 py-3 font-medium">Qty</th>
                      <th className="text-right px-3 py-3 font-medium">Avg Buy</th>
                      <th className="text-right px-3 py-3 font-medium">CMP</th>
                      <th className="text-right px-3 py-3 font-medium">
                        <button
                          type="button"
                          onClick={() => toggleSort('invested')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          Invested <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-right px-3 py-3 font-medium">
                        <button
                          type="button"
                          onClick={() => toggleSort('currentValue')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          Current Value <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-right px-3 py-3 font-medium">Profit / Loss</th>
                      <th className="text-right px-3 py-3 font-medium">
                        <button
                          type="button"
                          onClick={() => toggleSort('pnlPct')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          Return % <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSortedRows.map((r) => {
                      const pos = r.pnl >= 0;
                      return (
                        <tr
                          key={r.holding.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedChartSymbol(r.holding.symbol);
                                setActiveNav('market');
                              }}
                              className="text-left font-medium text-slate-900 dark:text-slate-100 hover:text-blue-500"
                            >
                              {r.holding.name}
                            </button>
                            <div className="text-[11px] text-slate-500">{r.holding.sector}</div>
                          </td>
                          <td className="px-3 py-3 font-mono text-slate-700 dark:text-slate-300">
                            {r.ticker} · {r.holding.exchange}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums">
                            {r.holding.quantity}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums">
                            {formatINR(r.holding.averagePrice)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums">
                            <div>{formatINR(r.currentPrice)}</div>
                            <div className="text-[10px] text-slate-500">{r.priceSource}</div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums">
                            {formatINR(r.invested)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums font-medium">
                            {formatINR(r.currentValue)}
                          </td>
                          <td
                            className={`px-3 py-3 text-right font-mono tabular-nums font-semibold ${
                              pos
                                ? 'text-emerald-600 dark:text-[#22C55E]'
                                : 'text-red-600 dark:text-[#EF4444]'
                            }`}
                          >
                            {pos ? '+' : ''}
                            {formatINR(r.pnl)}
                          </td>
                          <td
                            className={`px-3 py-3 text-right font-mono tabular-nums font-semibold ${
                              pos
                                ? 'text-emerald-600 dark:text-[#22C55E]'
                                : 'text-red-600 dark:text-[#EF4444]'
                            }`}
                          >
                            {formatPct(r.returnPct)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                title="Record Buy/Sell Transaction"
                                onClick={() => {
                                  setTxHolding(r.holding);
                                  setTxForm({
                                    type: 'BUY',
                                    quantity: 5,
                                    price: r.currentPrice,
                                    charges: 25,
                                    date: new Date().toISOString().slice(0, 10),
                                    notes: '',
                                  });
                                }}
                                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-[11px] hover:border-blue-500"
                              >
                                Trade
                              </button>
                              <button
                                type="button"
                                title="Log Dividend"
                                onClick={() => setDivHolding(r.holding)}
                                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-emerald-500"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Edit Holding / Manual Price"
                                onClick={() => {
                                  setEditingHolding(r.holding);
                                  setEditForm({
                                    quantity: r.holding.quantity,
                                    averagePrice: r.holding.averagePrice,
                                    manualPrice: r.holding.manualPrice
                                      ? String(r.holding.manualPrice)
                                      : '',
                                  });
                                }}
                                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-blue-500"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Delete Holding"
                                onClick={() => handleDeleteHolding(r.holding.id)}
                                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-red-500"
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
              <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                <p>No holdings match your current portfolio or filter.</p>
                <button
                  type="button"
                  onClick={() => setShowAddHolding(true)}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 text-white font-medium"
                >
                  Add Your First Stock
                </button>
              </div>
            )}
          </div>

          {/* Interactive Portfolio Allocation & Value Charts */}
          {evaluatedRows.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                  Holdings Weightage
                </h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => formatINR(Number(val ?? 0))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                  Invested vs Current Value
                </h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={evaluatedRows.map((r) => ({
                        ticker: r.ticker,
                        Invested: Number(r.invested.toFixed(0)),
                        Current: Number(r.currentValue.toFixed(0)),
                      }))}
                    >
                      <XAxis dataKey="ticker" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                      <YAxis
                        tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      />
                      <Tooltip formatter={(val) => formatINR(Number(val ?? 0))} />
                      <Bar dataKey="Invested" fill="#64748B" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Current" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* STOCK COMPARISON TOOL */
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Side-by-Side NSE/BSE Stock Comparison
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Compare price levels, daily change, 52-week range position, and volume across 3 equities
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Stock A', val: compareA, set: setCompareA },
              { label: 'Stock B', val: compareB, set: setCompareB },
              { label: 'Stock C', val: compareC, set: setCompareC },
            ].map((slot) => (
              <div key={slot.label}>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {slot.label}
                </label>
                <select
                  value={slot.val}
                  onChange={(e) => {
                    slot.set(e.target.value);
                    refreshMarketData([e.target.value]);
                  }}
                  className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-100"
                >
                  {INDIAN_STOCK_DIRECTORY.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.baseTicker} ({s.exchange}) — {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-[#0B1120] text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">Metric</th>
                  {[compareA, compareB, compareC].map((sym, i) => (
                    <th key={i} className="text-right px-4 py-3 font-mono">
                      {sym.replace(/\.(NS|BO)$/, '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                {[
                  {
                    label: 'Current Price',
                    fn: (sym: string) => formatINR(quotes[sym]?.price || 0),
                  },
                  {
                    label: 'Daily Change %',
                    fn: (sym: string) => formatPct(quotes[sym]?.changePercent || 0),
                  },
                  {
                    label: 'Day High / Low',
                    fn: (sym: string) =>
                      `${formatINR(quotes[sym]?.dayHigh || 0)} / ${formatINR(
                        quotes[sym]?.dayLow || 0
                      )}`,
                  },
                  {
                    label: '52-Week High',
                    fn: (sym: string) => formatINR(quotes[sym]?.week52High || 0),
                  },
                  {
                    label: '52-Week Low',
                    fn: (sym: string) => formatINR(quotes[sym]?.week52Low || 0),
                  },
                  {
                    label: 'Volume',
                    fn: (sym: string) =>
                      (quotes[sym]?.volume || 0).toLocaleString('en-IN'),
                  },
                ].map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 font-sans font-medium text-slate-700 dark:text-slate-300">
                      {row.label}
                    </td>
                    {[compareA, compareB, compareC].map((sym, i) => (
                      <td key={i} className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">
                        {row.fn(sym)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showNewPf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleCreatePortfolio}
            className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Create New Portfolio</h3>
              <button type="button" onClick={() => setShowNewPf(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newPfName}
              onChange={(e) => setNewPfName(e.target.value)}
              placeholder="e.g., Dividend Aristocrats"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-medium"
            >
              Create Portfolio
            </button>
          </form>
        </div>
      )}

      {showAddHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleAddHolding}
            className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Add Stock to {activePortfolio?.name}</h3>
              <button type="button" onClick={() => setShowAddHolding(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Quick Pick NSE/BSE Stock</label>
              <input
                type="text"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Search RELIANCE, TCS, HDFCBANK..."
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] mb-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {directoryMatches.map((s) => (
                  <button
                    key={s.symbol}
                    type="button"
                    onClick={() =>
                      setAddForm({
                        ...addForm,
                        symbol: s.symbol,
                        name: s.name,
                        exchange: s.exchange,
                        sector: s.sector,
                        price: quotes[s.symbol]?.price || s.refPrice,
                      })
                    }
                    className={`px-2 py-1 rounded text-[11px] border ${
                      addForm.symbol === s.symbol
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {s.baseTicker}.{s.exchange}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Symbol</label>
                <input
                  type="text"
                  required
                  value={addForm.symbol}
                  onChange={(e) => setAddForm({ ...addForm, symbol: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  required
                  value={addForm.quantity}
                  onChange={(e) => setAddForm({ ...addForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Buy Price (₹)</label>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  required
                  value={addForm.price}
                  onChange={(e) => setAddForm({ ...addForm, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Manual CMP Override (Opt.)</label>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  value={addForm.manualPrice}
                  onChange={(e) => setAddForm({ ...addForm, manualPrice: e.target.value })}
                  placeholder="Leave blank for market feed"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
            >
              Save Holding
            </button>
          </form>
        </div>
      )}

      {editingHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Edit {editingHolding.name}</h3>
              <button type="button" onClick={() => setEditingHolding(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs mb-1">Quantity</label>
              <input
                type="number"
                min={0}
                step="any"
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Average Buy Price (₹)</label>
              <input
                type="number"
                min={0.01}
                step="any"
                value={editForm.averagePrice}
                onChange={(e) => setEditForm({ ...editForm, averagePrice: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Manual Price Fallback (₹, optional)</label>
              <input
                type="number"
                min={0.01}
                step="any"
                value={editForm.manualPrice}
                onChange={(e) => setEditForm({ ...editForm, manualPrice: e.target.value })}
                placeholder="Blank = use market feed"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-medium"
            >
              Update Holding
            </button>
          </form>
        </div>
      )}

      {txHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleRecordTx}
            className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Record Trade · {txHolding.symbol}</h3>
              <button type="button" onClick={() => setTxHolding(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['BUY', 'SELL'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTxForm({ ...txForm, type: t })}
                  className={`py-2 rounded-lg text-xs font-semibold ${
                    txForm.type === t
                      ? t === 'BUY'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white'
                      : 'border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1">Quantity</label>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  required
                  value={txForm.quantity}
                  onChange={(e) => setTxForm({ ...txForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Price (₹)</label>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  required
                  value={txForm.price}
                  onChange={(e) => setTxForm({ ...txForm, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-medium"
            >
              Submit {txForm.type}
            </button>
          </form>
        </div>
      )}

      {divHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleAddDividend}
            className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Log Dividend · {divHolding.symbol}</h3>
              <button type="button" onClick={() => setDivHolding(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs mb-1">
                Dividend Per Share (₹) × {divHolding.quantity} shares
              </label>
              <input
                type="number"
                min={0.01}
                step="any"
                required
                value={divForm.amountPerShare}
                onChange={(e) =>
                  setDivForm({ ...divForm, amountPerShare: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium"
            >
              Record {formatINR(divForm.amountPerShare * divHolding.quantity)} Dividend
            </button>
          </form>
        </div>
      )}

      {showCsvImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleCsvImport}
            className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Import Broker CSV Statement</h3>
              <button type="button" onClick={() => setShowCsvImport(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Columns: <code className="font-mono">symbol,name,exchange,type,quantity,price,charges,date</code>
            </p>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-3 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-medium"
            >
              Import Transactions
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
