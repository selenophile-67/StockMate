import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api';
import {
  CalculationRecord,
  FinancialGoal,
  IndexOverview,
  MarketQuote,
  NewsArticle,
  Portfolio,
  PriceAlert,
  UserProfile,
  Watchlist,
} from '../types/stockmate';

export type NavSection =
  | 'dashboard'
  | 'calculators'
  | 'portfolio'
  | 'watchlist'
  | 'market'
  | 'advisor'
  | 'history'
  | 'reports'
  | 'settings';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface AppContextValue {
  user: UserProfile | null;
  pendingVerificationToken: string | null;
  authLoading: boolean;
  activeNav: NavSection;
  setActiveNav: (nav: NavSection) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  // Market
  indices: IndexOverview[];
  marketStatus: { isOpen: boolean; label: 'Open' | 'Closed'; sessionNote: string };
  quotes: Record<string, MarketQuote>;
  news: NewsArticle[];
  marketLoading: boolean;
  refreshMarketData: (extraSymbols?: string[]) => Promise<void>;
  // User Data
  portfolios: Portfolio[];
  activePortfolioId: string;
  setActivePortfolioId: (id: string) => void;
  watchlists: Watchlist[];
  alerts: PriceAlert[];
  calculations: CalculationRecord[];
  goals: FinancialGoal[];
  refreshUserData: () => Promise<void>;
  // Auth Actions
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ verificationToken?: string }>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  updateProfile: (payload: { name?: string; preferences?: Partial<UserProfile['preferences']> }) => Promise<void>;
  // Reopen calculation
  reopenCalc: CalculationRecord | null;
  setReopenCalc: (rec: CalculationRecord | null) => void;
  selectedCalcId: string;
  setSelectedCalcId: (id: string) => void;
  selectedChartSymbol: string;
  setSelectedChartSymbol: (symbol: string) => void;
  // Toasts
  toasts: ToastMessage[];
  notify: (type: ToastMessage['type'], text: string) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pendingVerificationToken, setPendingVerificationToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('stockmate_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [indices, setIndices] = useState<IndexOverview[]>([]);
  const [marketStatus, setMarketStatus] = useState<{
    isOpen: boolean;
    label: 'Open' | 'Closed';
    sessionNote: string;
  }>({
    isOpen: false,
    label: 'Closed',
    sessionNote: 'Regular Trading Hours: Mon–Fri 09:15–15:30 IST',
  });
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string>('');
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [calculations, setCalculations] = useState<CalculationRecord[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);

  const [reopenCalc, setReopenCalc] = useState<CalculationRecord | null>(null);
  const [selectedCalcId, setSelectedCalcId] = useState<string>('profit-loss');
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string>('RELIANCE.NS');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((type: ToastMessage['type'], text: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('stockmate_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const refreshMarketData = useCallback(
    async (extraSymbols: string[] = []) => {
      try {
        setMarketLoading(true);
        const overview = await apiRequest<{
          indices: IndexOverview[];
          marketStatus: { isOpen: boolean; label: 'Open' | 'Closed'; sessionNote: string };
        }>('/api/market/overview');
        setIndices(overview.indices);
        setMarketStatus(overview.marketStatus);

        const defaultSyms = [
          'RELIANCE.NS',
          'TCS.NS',
          'HDFCBANK.NS',
          'INFY.NS',
          'ICICIBANK.NS',
          'ITC.NS',
          'HAL.NS',
          'TATAMOTORS.NS',
        ];
        const allSyms = Array.from(new Set([...defaultSyms, ...extraSymbols]));
        if (allSyms.length > 0) {
          const qRes = await apiRequest<{ quotes: Record<string, MarketQuote> }>(
            `/api/market/quotes?symbols=${encodeURIComponent(allSyms.join(','))}`
          );
          setQuotes((prev) => ({ ...prev, ...qRes.quotes }));
        }
      } catch (err) {
        console.error('Market data refresh error:', err);
      } finally {
        setMarketLoading(false);
      }
    },
    []
  );

  const refreshUserData = useCallback(async () => {
    try {
      const [pfRes, wlRes, histRes, goalRes] = await Promise.all([
        apiRequest<{ portfolios: Portfolio[] }>('/api/portfolios'),
        apiRequest<{ watchlists: Watchlist[]; alerts: PriceAlert[] }>('/api/watchlists'),
        apiRequest<{ calculations: CalculationRecord[] }>('/api/history'),
        apiRequest<{ goals: FinancialGoal[] }>('/api/goals'),
      ]);
      setPortfolios(pfRes.portfolios);
      setActivePortfolioId((curr) =>
        pfRes.portfolios.some((p) => p.id === curr)
          ? curr
          : pfRes.portfolios[0]?.id || ''
      );
      setWatchlists(wlRes.watchlists);
      setAlerts(wlRes.alerts);
      setCalculations(histRes.calculations);
      setGoals(goalRes.goals);

      const symbolsToFetch: string[] = [];
      pfRes.portfolios.forEach((p) => p.holdings.forEach((h) => symbolsToFetch.push(h.symbol)));
      wlRes.watchlists.forEach((w) => w.items.forEach((i) => symbolsToFetch.push(i.symbol)));
      if (symbolsToFetch.length > 0) {
        const qRes = await apiRequest<{ quotes: Record<string, MarketQuote> }>(
          `/api/market/quotes?symbols=${encodeURIComponent(
            Array.from(new Set(symbolsToFetch)).join(',')
          )}`
        );
        setQuotes((prev) => ({ ...prev, ...qRes.quotes }));
      }
    } catch (err) {
      console.error('Failed loading user workspace:', err);
    }
  }, []);

  // Bootstrap session on mount: if existing token, load user; else auto-connect demo workspace or leave ready
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const token = getStoredToken();
        if (token) {
          const me = await apiRequest<{
            user: UserProfile;
            pendingVerificationToken: string | null;
          }>('/api/auth/me');
          if (!active) return;
          setUser(me.user);
          setPendingVerificationToken(me.pendingVerificationToken);
          await refreshUserData();
        } else {
          // Sign in to seeded demo workspace by default so first-time users immediately see rich portfolio/watchlist data
          const demo = await apiRequest<{ token: string; user: UserProfile }>(
            '/api/auth/demo',
            { method: 'POST' }
          );
          if (!active) return;
          setStoredToken(demo.token);
          setUser(demo.user);
          await refreshUserData();
        }
      } catch {
        setStoredToken(null);
        setUser(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    init();
    refreshMarketData();
    apiRequest<{ articles: NewsArticle[] }>('/api/market/news')
      .then((res) => {
        if (active) setNews(res.articles || []);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [refreshMarketData, refreshUserData]);

  // Global keyboard shortcuts (Alt+1..8 for sections)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const map: Record<string, NavSection> = {
        '1': 'dashboard',
        '2': 'calculators',
        '3': 'portfolio',
        '4': 'watchlist',
        '5': 'market',
        '6': 'history',
        '7': 'reports',
        '8': 'settings',
        '9': 'advisor',
      };
      if (map[e.key]) {
        e.preventDefault();
        setActiveNav(map[e.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    setUser(res.user);
    setPendingVerificationToken(null);
    await refreshUserData();
    notify('success', `Welcome back, ${res.user.name}`);
  };

  const loginDemo = async () => {
    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/demo', {
      method: 'POST',
    });
    setStoredToken(res.token);
    setUser(res.user);
    setPendingVerificationToken(null);
    await refreshUserData();
    notify('info', 'Signed in with Demo Investor Workspace');
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await apiRequest<{
      token: string;
      user: UserProfile;
      verificationToken?: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setStoredToken(res.token);
    setUser(res.user);
    setPendingVerificationToken(res.verificationToken || null);
    await refreshUserData();
    notify('success', 'Account created! Please verify your email in Settings or header.');
    return { verificationToken: res.verificationToken };
  };

  const logout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setStoredToken(null);
    setUser(null);
    setPortfolios([]);
    setWatchlists([]);
    setAlerts([]);
    setCalculations([]);
    setGoals([]);
    notify('info', 'Signed out of StockMate');
  };

  const verifyEmail = async (token: string) => {
    const res = await apiRequest<{ user: UserProfile }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    setUser(res.user);
    setPendingVerificationToken(null);
    notify('success', 'Email address verified');
  };

  const updateProfile = async (payload: {
    name?: string;
    preferences?: Partial<UserProfile['preferences']>;
  }) => {
    const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    setUser(res.user);
    if (payload.preferences?.theme) {
      setTheme(payload.preferences.theme);
    }
    notify('success', 'Settings saved');
  };

  return (
    <AppContext.Provider
      value={{
        user,
        pendingVerificationToken,
        authLoading,
        activeNav,
        setActiveNav,
        theme,
        toggleTheme,
        authModalOpen,
        setAuthModalOpen,
        indices,
        marketStatus,
        quotes,
        news,
        marketLoading,
        refreshMarketData,
        portfolios,
        activePortfolioId,
        setActivePortfolioId,
        watchlists,
        alerts,
        calculations,
        goals,
        refreshUserData,
        login,
        loginDemo,
        register,
        logout,
        verifyEmail,
        updateProfile,
        reopenCalc,
        setReopenCalc,
        selectedCalcId,
        setSelectedCalcId,
        selectedChartSymbol,
        setSelectedChartSymbol,
        toasts,
        notify,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
