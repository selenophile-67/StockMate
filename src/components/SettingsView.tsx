import React, { useState } from 'react';
import { CheckCircle2, Keyboard, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Exchange } from '../types/stockmate';

export function SettingsView() {
  const {
    user,
    pendingVerificationToken,
    verifyEmail,
    updateProfile,
    logout,
    setAuthModalOpen,
    theme,
    toggleTheme,
  } = useApp();

  const [name, setName] = useState(user?.name || '');
  const [defaultExchange, setDefaultExchange] = useState<Exchange>(
    user?.preferences?.defaultExchange || 'NSE'
  );
  const [brokerageFlat, setBrokerageFlat] = useState(user?.preferences?.brokerageFlat ?? 20);
  const [brokeragePct, setBrokeragePct] = useState(user?.preferences?.brokeragePct ?? 0.03);
  const [dpCharges, setDpCharges] = useState(user?.preferences?.dpCharges ?? 15.93);
  const [chargeEffectiveDate, setChargeEffectiveDate] = useState<'2024-10-01' | '2023-04-01'>(
    user?.preferences?.chargeEffectiveDate || '2024-10-01'
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name,
        preferences: {
          theme,
          defaultExchange,
          brokerageFlat: Number(brokerageFlat),
          brokeragePct: Number(brokeragePct),
          dpCharges: Number(dpCharges),
          chargeEffectiveDate,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          Account & Brokerage Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure user profile, email verification, default NSE/BSE brokerage rates, and interface theme
        </p>
      </div>

      {/* Account Status Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {user ? (
          <>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">{user.name}</span>
                {user.emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-[#22C55E] font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <span className="text-xs text-amber-500 font-medium">
                    Email Verification Pending
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 font-mono">{user.email}</div>
              {!user.emailVerified && pendingVerificationToken && (
                <button
                  type="button"
                  onClick={() => verifyEmail(pendingVerificationToken)}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Verify Email Now
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Switch Account
              </button>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-500/10"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-500">
              Sign in to save personal portfolios, watchlists, and calculation history.
            </div>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium"
            >
              Sign In / Register
            </button>
          </div>
        )}
      </div>

      {/* Theme & Preferences Form */}
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5 text-xs"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-sm font-semibold">Appearance Theme</div>
            <div className="text-slate-500 mt-0.5">
              Default dark mode (#0B1120) or high-contrast light mode
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" /> Switch to Light Mode
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-600" /> Switch to Dark Mode
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Default Exchange</label>
            <select
              value={defaultExchange}
              onChange={(e) => setDefaultExchange(e.target.value as Exchange)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
            >
              <option value="NSE">NSE (National Stock Exchange)</option>
              <option value="BSE">BSE (Bombay Stock Exchange)</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Default Flat Brokerage Cap (₹/order)</label>
            <input
              type="number"
              min={0}
              step="any"
              value={brokerageFlat}
              onChange={(e) => setBrokerageFlat(Number(e.target.value))}
              className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Default Brokerage Rate (%)</label>
            <input
              type="number"
              min={0}
              step="any"
              value={brokeragePct}
              onChange={(e) => setBrokeragePct(Number(e.target.value))}
              className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">DP Charges on Delivery Sell (₹)</label>
            <input
              type="number"
              min={0}
              step="any"
              value={dpCharges}
              onChange={(e) => setDpCharges(Number(e.target.value))}
              className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Statutory Rate Schedule</label>
            <select
              value={chargeEffectiveDate}
              onChange={(e) =>
                setChargeEffectiveDate(e.target.value as '2024-10-01' | '2023-04-01')
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937]"
            >
              <option value="2024-10-01">Effective Oct 1, 2024+ (Current)</option>
              <option value="2023-04-01">Pre-Oct 2024 Schedule</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </form>

      {/* Keyboard Shortcuts Reference */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-blue-500" /> Keyboard Shortcuts
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            ['Alt + 1', 'Dashboard'],
            ['Alt + 2', 'Calculators'],
            ['Alt + 3', 'Portfolio'],
            ['Alt + 4', 'Watchlist'],
            ['Alt + 5', 'Market & Charts'],
            ['Alt + 6', 'History'],
            ['Alt + 7', 'Reports'],
            ['Alt + 8', 'Settings'],
            ['Alt + 9', 'Stock Advisor'],
          ].map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-800"
            >
              <span className="text-slate-600 dark:text-slate-400">{label}</span>
              <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
