import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Download, Search, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';

export function HistoryView() {
  const {
    calculations,
    refreshUserData,
    setReopenCalc,
    setActiveNav,
    notify,
  } = useApp();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | 'core' | 'advanced'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calculations.filter((c) => {
      const catOk = catFilter === 'all' || c.category === catFilter;
      const textOk =
        !q ||
        c.calculatorName.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q);
      return catOk && textOk;
    });
  }, [calculations, search, catFilter]);

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/history/${id}`, { method: 'DELETE' });
      await refreshUserData();
      notify('info', 'Calculation deleted from history');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed deleting item');
    }
  };

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Calculator', 'Category', 'Summary'];
    const rows = filtered.map((c) => [
      new Date(c.createdAt).toISOString(),
      `"${c.calculatorName.replace(/"/g, '""')}"`,
      c.category,
      `"${c.summary.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockmate-calculation-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Calculation History
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Reopen previous calculations with saved inputs, filter records, or export CSV logs
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-medium disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          Export History CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved calculations..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] w-64"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
          {(['all', 'core', 'advanced'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setCatFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${
                catFilter === f
                  ? 'bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-50'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] divide-y divide-slate-100 dark:divide-slate-800">
        {filtered.length > 0 ? (
          filtered.map((rec) => (
            <div
              key={rec.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {rec.calculatorName}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">
                    ·
                  </span>
                  <span className="capitalize text-slate-500">{rec.category}</span>
                  <span aria-hidden="true" className="text-slate-400">
                    ·
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {new Date(rec.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                  {rec.summary}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setReopenCalc(rec);
                    setActiveNav('calculators');
                    notify('info', `Loaded ${rec.calculatorName} inputs`);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  Reopen <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rec.id)}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-red-500"
                  aria-label="Delete calculation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-xs text-slate-500">
            No saved calculations yet. Use the &ldquo;Save&rdquo; button inside any calculator.
          </div>
        )}
      </div>
    </div>
  );
}
