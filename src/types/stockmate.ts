export type Exchange = 'NSE' | 'BSE';
export type TradeSegment = 'delivery' | 'intraday' | 'futures' | 'options';
export type PriceSource = 'live' | 'delayed' | 'manual' | 'reference-snapshot';
export type ChartType = 'line' | 'area' | 'bar' | 'candlestick';
export type TimeInterval = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y';

export interface UserPreferences {
  theme: 'dark' | 'light';
  defaultExchange: Exchange;
  currency: 'INR';
  brokerageFlat: number;
  brokeragePct: number;
  dpCharges: number;
  chargeEffectiveDate: '2024-10-01' | '2023-04-01';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: 'user';
  createdAt: string;
  preferences: UserPreferences;
}

export interface TransactionRecord {
  id: string;
  type: 'BUY' | 'SELL';
  date: string;
  quantity: number;
  price: number;
  charges: number;
  notes?: string;
}

export interface DividendRecord {
  id: string;
  date: string;
  amountPerShare: number;
  totalAmount: number;
  notes?: string;
}

export interface StockHolding {
  id: string;
  symbol: string;
  name: string;
  exchange: Exchange;
  sector: string;
  quantity: number;
  averagePrice: number;
  manualPrice?: number | null;
  transactions: TransactionRecord[];
  dividends: DividendRecord[];
  realizedPnL: number;
}

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string;
  holdings: StockHolding[];
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  exchange: Exchange;
  sector: string;
  manualPrice?: number | null;
  addedAt: string;
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  items: WatchlistItem[];
}

export interface PriceAlert {
  id: string;
  userId: string;
  symbol: string;
  stockName: string;
  alertType: 'TARGET_ABOVE' | 'STOPLOSS_BELOW';
  targetValue: number;
  active: boolean;
  triggeredAt?: string | null;
  createdAt: string;
}

export interface FinancialGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  expectedReturnPct: number;
  targetDate: string;
  createdAt: string;
}

export interface CalculationRecord {
  id: string;
  userId: string;
  calculatorId: string;
  calculatorName: string;
  category: 'core' | 'advanced';
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  summary: string;
  createdAt: string;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  exchange: Exchange;
  sector: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  volume: number;
  marketCap?: number | null;
  week52High?: number | null;
  week52Low?: number | null;
  source: PriceSource;
  lastUpdated: string;
}

export interface IndexOverview {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  source: PriceSource;
  lastUpdated: string;
}

export interface CandlePoint {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20?: number | null;
  ema20?: number | null;
  rsi14?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  macdHist?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
}

export interface NewsArticle {
  id: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
  relatedSymbol?: string;
}

export interface BrokerageRateSchedule {
  effectiveLabel: string;
  effectiveDate: string;
  sttBuyPct: Record<TradeSegment, number>;
  sttSellPct: Record<TradeSegment, number>;
  exchangeTxnPct: Record<Exchange, Record<TradeSegment, number>>;
  sebiTurnoverPct: number;
  stampDutyBuyPct: Record<TradeSegment, number>;
  gstPct: number;
  ipftPct: Record<Exchange, number>;
}
