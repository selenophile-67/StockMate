import React, { useState } from 'react';
import {
  Bookmark,
  Briefcase,
  Calculator,
  CandlestickChart,
  FileBarChart2,
  History,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Moon,
  Settings,
  Sun,
  UserCircle2,
  X,
} from 'lucide-react';
import { AppProvider, NavSection, useApp } from './context/AppContext';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { CalculatorsView } from './components/CalculatorsView';
import { PortfolioView } from './components/PortfolioView';
import { WatchlistView } from './components/WatchlistView';
import { MarketChartsView } from './components/MarketChartsView';
import { HistoryView } from './components/HistoryView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { StockAdvisorChat } from './components/StockAdvisorChat';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'calculators', label: 'Calculators', icon: Calculator },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'market', label: 'Market Overview', icon: CandlestickChart },
  { id: 'advisor', label: 'Stock Advisor', icon: MessageSquareText },
  { id: 'history', label: 'Calculation History', icon: History },
  { id: 'reports', label: 'Reports', icon: FileBarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function StockMateShell() {
  const {
    user,
    pendingVerificationToken,
    verifyEmail,
    activeNav,
    setActiveNav,
    theme,
    toggleTheme,
    setAuthModalOpen,
    toasts,
    dismissToast,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [advisorDrawerOpen, setAdvisorDrawerOpen] = useState(false);

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeNav) || NAV_ITEMS[0];

  const handleNavClick = (id: NavSection) => {
    setActiveNav(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-[#0B1120] dark:text-[#F9FAFB]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] no-print">
        <div className="h-16 px-6 flex items-center border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap"
          >
            StockMate
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {user ? (
            <button
              type="button"
              onClick={() => handleNavClick('settings')}
              className="w-full flex items-center gap-2.5 text-left p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
            >
              <UserCircle2 className="w-7 h-7 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{user.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
            >
              Sign In / Register
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 flex flex-col h-full">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <span className="text-base font-extrabold">StockMate</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-500"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              StockMate <span aria-hidden="true">/</span>{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {activeNavMeta.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {pendingVerificationToken && (
              <button
                type="button"
                onClick={() => verifyEmail(pendingVerificationToken)}
                className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300 text-xs font-medium whitespace-nowrap"
              >
                Verify Email
              </button>
            )}
            <button
              type="button"
              onClick={() => setAdvisorDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] hover:border-blue-500 text-slate-700 dark:text-slate-200 text-xs font-medium whitespace-nowrap"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Ask Advisor</span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap"
            >
              {user?.name ? user.name.split(' ')[0] : user ? 'Account' : 'Sign In'}
            </button>
          </div>
        </header>

        {/* Active Viewport */}
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {activeNav === 'dashboard' && <DashboardView />}
          {activeNav === 'calculators' && <CalculatorsView />}
          {activeNav === 'portfolio' && <PortfolioView />}
          {activeNav === 'watchlist' && <WatchlistView />}
          {activeNav === 'market' && <MarketChartsView />}
          {activeNav === 'advisor' && <StockAdvisorChat mode="page" />}
          {activeNav === 'history' && <HistoryView />}
          {activeNav === 'reports' && <ReportsView />}
          {activeNav === 'settings' && <SettingsView />}
        </main>

        {/* Footer with Mandatory Disclaimer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-5 text-xs text-slate-500 dark:text-slate-400">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="max-w-4xl leading-relaxed">
              StockMate is an educational and calculation tool. It does not provide investment advice, stock recommendations, or guaranteed returns. Market data and calculated projections may be subject to delays or estimation. Please verify applicable charges and consult qualified financial professionals before making investment decisions.
            </p>
            <span className="shrink-0 font-mono text-[11px]">INR (₹) · NSE / BSE</span>
          </div>
        </footer>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border px-4 py-3 text-xs shadow-lg flex items-center justify-between gap-3 ${
              t.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-700 text-emerald-100'
                : t.type === 'error'
                  ? 'bg-red-950/95 border-red-700 text-red-100'
                  : 'bg-slate-900 border-slate-700 text-slate-100'
            }`}
          >
            <span>{t.text}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <AuthModal />

      {/* Slide-over Stock Research Advisor Drawer */}
      {advisorDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-[2px] no-print"
          role="dialog"
          aria-modal="true"
          aria-label="AI Stock Research Advisor"
        >
          <div className="flex-1" onClick={() => setAdvisorDrawerOpen(false)} />
          <div className="w-full max-w-xl h-full border-l border-slate-200 dark:border-slate-800 shadow-2xl">
            <StockAdvisorChat
              mode="drawer"
              onClose={() => setAdvisorDrawerOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <StockMateShell />
    </AppProvider>
  );
}
