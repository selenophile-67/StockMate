import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Plus, Printer, Target, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';
import { formatCompactINR, formatINR, formatPct } from '../lib/finance';

export function ReportsView() {
  const {
    user,
    portfolios,
    quotes,
    calculations,
    goals,
    refreshUserData,
    notify,
    setAuthModalOpen,
  } = useApp();

  const [goalForm, setGoalForm] = useState({
    title: 'Retirement Equity Fund',
    targetAmount: 5000000,
    currentAmount: 650000,
    monthlyContribution: 30000,
    expectedReturnPct: 12,
    targetDate: '2035-12-31',
  });

  const reportRows = useMemo(() => {
    return portfolios.flatMap((pf) =>
      pf.holdings.map((h) => {
        const cmp = h.manualPrice ?? quotes[h.symbol]?.price ?? h.averagePrice;
        const invested = h.quantity * h.averagePrice;
        const currentValue = h.quantity * cmp;
        const unrealized = currentValue - invested;
        const retPct = invested > 0 ? (unrealized / invested) * 100 : 0;
        const dividends = h.dividends.reduce((s, d) => s + d.totalAmount, 0);
        const totalCharges = h.transactions.reduce((s, t) => s + (t.charges || 0), 0);
        return {
          portfolio: pf.name,
          symbol: h.symbol,
          name: h.name,
          quantity: h.quantity,
          avgPrice: h.averagePrice,
          cmp,
          invested,
          currentValue,
          unrealized,
          realized: h.realizedPnL || 0,
          dividends,
          charges: totalCharges,
          retPct,
        };
      })
    );
  }, [portfolios, quotes]);

  const summary = useMemo(() => {
    let invested = 0;
    let current = 0;
    let realized = 0;
    let dividends = 0;
    let charges = 0;
    for (const r of reportRows) {
      invested += r.invested;
      current += r.currentValue;
      realized += r.realized;
      dividends += r.dividends;
      charges += r.charges;
    }
    const unrealized = current - invested;
    // Indicative Indian STCG (20% under Finance Act 2024) on positive realized gains
    const estStcgTax = realized > 0 ? realized * 0.2 : 0;
    const estLtcgTax = unrealized > 125000 ? (unrealized - 125000) * 0.125 : 0;
    return {
      invested,
      current,
      unrealized,
      realized,
      dividends,
      charges,
      estStcgTax,
      estLtcgTax,
      returnPct: invested > 0 ? (unrealized / invested) * 100 : 0,
    };
  }, [reportRows]);

  const exportCsv = () => {
    const headers = [
      'Portfolio',
      'Symbol',
      'Name',
      'Qty',
      'Avg Price',
      'CMP',
      'Invested',
      'Current Value',
      'Unrealized P/L',
      'Return %',
      'Realized P/L',
      'Dividends',
      'Charges',
    ];
    const lines = reportRows.map((r) => [
      `"${r.portfolio}"`,
      r.symbol,
      `"${r.name}"`,
      r.quantity,
      r.avgPrice.toFixed(2),
      r.cmp.toFixed(2),
      r.invested.toFixed(2),
      r.currentValue.toFixed(2),
      r.unrealized.toFixed(2),
      r.retPct.toFixed(2),
      r.realized.toFixed(2),
      r.dividends.toFixed(2),
      r.charges.toFixed(2),
    ]);
    const csv = [headers.join(','), ...lines.map((l) => l.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockmate-portfolio-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'CSV report downloaded');
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const holdingsSheet = XLSX.utils.json_to_sheet(
      reportRows.map((r) => ({
        Portfolio: r.portfolio,
        Symbol: r.symbol,
        Stock: r.name,
        Quantity: r.quantity,
        'Avg Price (INR)': r.avgPrice,
        'CMP (INR)': r.cmp,
        'Invested (INR)': r.invested,
        'Current Value (INR)': r.currentValue,
        'Unrealized P/L (INR)': r.unrealized,
        'Return %': r.retPct,
        'Realized P/L (INR)': r.realized,
        'Dividends (INR)': r.dividends,
        'Brokerage & Charges (INR)': r.charges,
      }))
    );
    const historySheet = XLSX.utils.json_to_sheet(
      calculations.map((c) => ({
        Timestamp: new Date(c.createdAt).toLocaleString('en-IN'),
        Calculator: c.calculatorName,
        Category: c.category,
        Summary: c.summary,
      }))
    );
    XLSX.utils.book_append_sheet(wb, holdingsSheet, 'Holdings & Returns');
    XLSX.utils.book_append_sheet(wb, historySheet, 'Calculation History');
    XLSX.writeFile(wb, `stockmate-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify('success', 'Excel (.xlsx) report downloaded');
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('StockMate — Portfolio & Investment Summary Report', 14, 16);
    doc.setFontSize(10);
    doc.text(
      `Investor: ${user?.name || 'Guest'} | Generated: ${new Date().toLocaleString('en-IN')}`,
      14,
      23
    );
    doc.text(
      `Invested: ${formatINR(summary.invested)} | Current Value: ${formatINR(
        summary.current
      )} | Unrealized P/L: ${formatINR(summary.unrealized)} (${formatPct(summary.returnPct)})`,
      14,
      30
    );

    autoTable(doc, {
      startY: 36,
      head: [
        [
          'Portfolio',
          'Symbol',
          'Qty',
          'Avg Buy',
          'CMP',
          'Invested',
          'Current Value',
          'Unrealized P/L',
          'Return %',
        ],
      ],
      body: reportRows.map((r) => [
        r.portfolio,
        r.symbol,
        String(r.quantity),
        formatINR(r.avgPrice),
        formatINR(r.cmp),
        formatINR(r.invested),
        formatINR(r.currentValue),
        formatINR(r.unrealized),
        formatPct(r.retPct),
      ]),
      styles: { fontSize: 8 },
    });

    doc.save(`stockmate-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    notify('success', 'PDF report downloaded');
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAuthModalOpen(true);
      notify('info', 'Please sign in to save financial goals');
      return;
    }
    try {
      await apiRequest('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          ...goalForm,
          targetAmount: Number(goalForm.targetAmount),
          currentAmount: Number(goalForm.currentAmount),
          monthlyContribution: Number(goalForm.monthlyContribution),
          expectedReturnPct: Number(goalForm.expectedReturnPct),
        }),
      });
      await refreshUserData();
      notify('success', 'Financial goal saved');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed saving goal');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await apiRequest(`/api/goals/${id}`, { method: 'DELETE' });
      await refreshUserData();
      notify('info', 'Goal removed');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed deleting goal');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Reports, Exports & Financial Goals
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Export PDF, Excel, and CSV portfolio statements, review indicative Indian capital gains, and track wealth goals
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
          >
            <FileText className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button
            type="button"
            onClick={exportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-medium"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-medium"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-medium"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      {/* Print-Friendly Portfolio & Tax Summary */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Portfolio & Capital Gains Summary</h2>
            <p className="text-xs text-slate-500">
              Investor: {user?.name || 'Guest'} · Generated {new Date().toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono tabular-nums">
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-sans text-slate-500">Total Invested</div>
            <div className="text-lg font-bold mt-1">{formatINR(summary.invested)}</div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-sans text-slate-500">Current Portfolio Value</div>
            <div className="text-lg font-bold mt-1">{formatINR(summary.current)}</div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-sans text-slate-500">Realized P/L & Dividends</div>
            <div className="text-lg font-bold mt-1 text-emerald-600 dark:text-[#22C55E]">
              {formatINR(summary.realized + summary.dividends)}
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-sans text-slate-500">Indicative STCG / LTCG Est.</div>
            <div className="text-lg font-bold mt-1">
              {formatINR(summary.estStcgTax + summary.estLtcgTax)}
            </div>
            <div className="text-[10px] font-sans text-slate-500 mt-0.5">
              20% STCG on realized · 12.5% LTCG &gt; ₹1.25L
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-[#0B1120] text-slate-500">
              <tr>
                <th className="text-left px-3 py-2.5">Portfolio</th>
                <th className="text-left px-3 py-2.5">Symbol</th>
                <th className="text-right px-3 py-2.5">Qty</th>
                <th className="text-right px-3 py-2.5">Avg Buy</th>
                <th className="text-right px-3 py-2.5">CMP</th>
                <th className="text-right px-3 py-2.5">Invested</th>
                <th className="text-right px-3 py-2.5">Current</th>
                <th className="text-right px-3 py-2.5">P/L</th>
                <th className="text-right px-3 py-2.5">Charges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
              {reportRows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-sans">{r.portfolio}</td>
                  <td className="px-3 py-2">{r.symbol}</td>
                  <td className="px-3 py-2 text-right">{r.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatINR(r.avgPrice)}</td>
                  <td className="px-3 py-2 text-right">{formatINR(r.cmp)}</td>
                  <td className="px-3 py-2 text-right">{formatINR(r.invested)}</td>
                  <td className="px-3 py-2 text-right">{formatINR(r.currentValue)}</td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      r.unrealized >= 0
                        ? 'text-emerald-600 dark:text-[#22C55E]'
                        : 'text-red-600 dark:text-[#EF4444]'
                    }`}
                  >
                    {formatINR(r.unrealized)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatINR(r.charges)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Financial Goals Tracker */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-500" /> Financial Goal Tracking
          </h3>
          {goals.length > 0 ? (
            <div className="space-y-4">
              {goals.map((g) => {
                const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
                return (
                  <div
                    key={g.id}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{g.title}</div>
                        <div className="text-[11px] text-slate-500">
                          Target by {g.targetDate} · {formatINR(g.monthlyContribution)}/mo @{' '}
                          {g.expectedReturnPct}% est.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteGoal(g.id)}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-mono tabular-nums">
                      <span>{formatCompactINR(g.currentAmount)} funded</span>
                      <span>
                        {pct.toFixed(1)}% of {formatCompactINR(g.targetAmount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6">No financial goals added yet.</p>
          )}
        </div>

        <form
          onSubmit={handleAddGoal}
          className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3 text-xs"
        >
          <h3 className="text-sm font-semibold">Add Wealth Goal</h3>
          <div>
            <label className="block mb-1 font-medium">Goal Name</label>
            <input
              type="text"
              required
              value={goalForm.title}
              onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 font-medium">Target Corpus (₹)</label>
              <input
                type="number"
                required
                min={1000}
                value={goalForm.targetAmount}
                onChange={(e) => setGoalForm({ ...goalForm, targetAmount: Number(e.target.value) })}
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Current Saved (₹)</label>
              <input
                type="number"
                required
                min={0}
                value={goalForm.currentAmount}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, currentAmount: Number(e.target.value) })
                }
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Monthly SIP (₹)</label>
              <input
                type="number"
                required
                min={0}
                value={goalForm.monthlyContribution}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, monthlyContribution: Number(e.target.value) })
                }
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Target Date</label>
              <input
                type="date"
                required
                value={goalForm.targetDate}
                onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Goal
          </button>
        </form>
      </section>
    </div>
  );
}
