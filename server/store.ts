import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  CalculationRecord,
  FinancialGoal,
  Portfolio,
  PriceAlert,
  UserProfile,
  Watchlist,
} from '../src/types/stockmate';

export interface StoredUser extends UserProfile {
  passwordHash: string;
  verificationToken?: string | null;
  resetToken?: string | null;
  resetTokenExpiresAt?: string | null;
}

export interface StockMateDatabase {
  users: StoredUser[];
  portfolios: Portfolio[];
  watchlists: Watchlist[];
  alerts: PriceAlert[];
  calculations: CalculationRecord[];
  goals: FinancialGoal[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'stockmate-db.json');

let writeQueue: Promise<void> = Promise.resolve();
let memoryCache: StockMateDatabase | null = null;

function createSeedDatabase(): StockMateDatabase {
  const demoUserId = 'usr_demo_investor';
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync('Demo@1234', 10);

  const users: StoredUser[] = [
    {
      id: demoUserId,
      name: 'Aarav Mehta',
      email: 'demo@stockmate.in',
      emailVerified: true,
      role: 'user',
      createdAt: '2025-04-10T09:30:00.000Z',
      passwordHash,
      preferences: {
        theme: 'dark',
        defaultExchange: 'NSE',
        currency: 'INR',
        brokerageFlat: 20,
        brokeragePct: 0.03,
        dpCharges: 15.93,
        chargeEffectiveDate: '2024-10-01',
      },
    },
  ];

  const portfolios: Portfolio[] = [
    {
      id: 'pf_core_longterm',
      userId: demoUserId,
      name: 'Core Long-Term Equity',
      description: 'Large-cap NSE compounders for 5+ year wealth creation',
      createdAt: '2025-04-12T10:00:00.000Z',
      holdings: [
        {
          id: 'hld_reliance',
          symbol: 'RELIANCE.NS',
          name: 'Reliance Industries Ltd',
          exchange: 'NSE',
          sector: 'Energy & Conglomerate',
          quantity: 65,
          averagePrice: 1184.5,
          realizedPnL: 4250,
          transactions: [
            {
              id: 'tx_rel_1',
              type: 'BUY',
              date: '2025-05-14',
              quantity: 40,
              price: 1150,
              charges: 68.4,
              notes: 'Initial core allocation',
            },
            {
              id: 'tx_rel_2',
              type: 'BUY',
              date: '2025-09-02',
              quantity: 25,
              price: 1239.7,
              charges: 45.2,
              notes: 'Dip accumulation',
            },
          ],
          dividends: [
            {
              id: 'div_rel_1',
              date: '2025-08-22',
              amountPerShare: 10,
              totalAmount: 650,
              notes: 'FY25 Annual Dividend',
            },
          ],
        },
        {
          id: 'hld_tcs',
          symbol: 'TCS.NS',
          name: 'Tata Consultancy Services Ltd',
          exchange: 'NSE',
          sector: 'Information Technology',
          quantity: 22,
          averagePrice: 3890.0,
          realizedPnL: 0,
          transactions: [
            {
              id: 'tx_tcs_1',
              type: 'BUY',
              date: '2025-06-18',
              quantity: 22,
              price: 3890,
              charges: 112.6,
              notes: 'IT export cycle entry',
            },
          ],
          dividends: [
            {
              id: 'div_tcs_1',
              date: '2025-10-18',
              amountPerShare: 28,
              totalAmount: 616,
              notes: 'Interim dividend',
            },
          ],
        },
        {
          id: 'hld_hdfc',
          symbol: 'HDFCBANK.NS',
          name: 'HDFC Bank Ltd',
          exchange: 'NSE',
          sector: 'Banking & Finance',
          quantity: 55,
          averagePrice: 1580.0,
          realizedPnL: 0,
          transactions: [
            {
              id: 'tx_hdfc_1',
              type: 'BUY',
              date: '2025-07-04',
              quantity: 55,
              price: 1580,
              charges: 118.4,
            },
          ],
          dividends: [
            {
              id: 'div_hdfc_1',
              date: '2025-07-24',
              amountPerShare: 19.5,
              totalAmount: 1072.5,
            },
          ],
        },
        {
          id: 'hld_infy',
          symbol: 'INFY.NS',
          name: 'Infosys Ltd',
          exchange: 'NSE',
          sector: 'Information Technology',
          quantity: 45,
          averagePrice: 1695.0,
          realizedPnL: 2800,
          transactions: [
            {
              id: 'tx_infy_1',
              type: 'BUY',
              date: '2025-05-20',
              quantity: 45,
              price: 1695,
              charges: 98.2,
            },
          ],
          dividends: [
            {
              id: 'div_infy_1',
              date: '2025-10-29',
              amountPerShare: 21,
              totalAmount: 945,
            },
          ],
        },
        {
          id: 'hld_itc',
          symbol: 'ITC.NS',
          name: 'ITC Ltd',
          exchange: 'NSE',
          sector: 'FMCG',
          quantity: 150,
          averagePrice: 482.0,
          realizedPnL: 0,
          transactions: [
            {
              id: 'tx_itc_1',
              type: 'BUY',
              date: '2025-08-11',
              quantity: 150,
              price: 482,
              charges: 94.1,
            },
          ],
          dividends: [
            {
              id: 'div_itc_1',
              date: '2025-06-05',
              amountPerShare: 7.5,
              totalAmount: 1125,
            },
          ],
        },
      ],
    },
    {
      id: 'pf_swing_momentum',
      userId: demoUserId,
      name: 'Swing & Momentum',
      description: 'Medium-term positional trades across defence & auto',
      createdAt: '2025-09-01T11:15:00.000Z',
      holdings: [
        {
          id: 'hld_hal',
          symbol: 'HAL.NS',
          name: 'Hindustan Aeronautics Ltd',
          exchange: 'NSE',
          sector: 'Aerospace & Defence',
          quantity: 18,
          averagePrice: 3980.0,
          realizedPnL: 6400,
          transactions: [
            {
              id: 'tx_hal_1',
              type: 'BUY',
              date: '2025-10-08',
              quantity: 18,
              price: 3980,
              charges: 92.8,
            },
          ],
          dividends: [],
        },
        {
          id: 'hld_tatamotors',
          symbol: 'TATAMOTORS.NS',
          name: 'Tata Motors Ltd',
          exchange: 'NSE',
          sector: 'Automobiles',
          quantity: 60,
          averagePrice: 845.0,
          realizedPnL: 0,
          transactions: [
            {
              id: 'tx_tatam_1',
              type: 'BUY',
              date: '2025-11-12',
              quantity: 60,
              price: 845,
              charges: 74.3,
            },
          ],
          dividends: [],
        },
      ],
    },
  ];

  const watchlists: Watchlist[] = [
    {
      id: 'wl_nifty_leaders',
      userId: demoUserId,
      name: 'Nifty 50 Focus',
      items: [
        {
          symbol: 'RELIANCE.NS',
          name: 'Reliance Industries Ltd',
          exchange: 'NSE',
          sector: 'Energy & Conglomerate',
          addedAt: now,
        },
        {
          symbol: 'TCS.NS',
          name: 'Tata Consultancy Services Ltd',
          exchange: 'NSE',
          sector: 'Information Technology',
          addedAt: now,
        },
        {
          symbol: 'ICICIBANK.NS',
          name: 'ICICI Bank Ltd',
          exchange: 'NSE',
          sector: 'Banking & Finance',
          addedAt: now,
        },
        {
          symbol: 'BHARTIARTL.NS',
          name: 'Bharti Airtel Ltd',
          exchange: 'NSE',
          sector: 'Telecom',
          addedAt: now,
        },
        {
          symbol: 'LT.NS',
          name: 'Larsen & Toubro Ltd',
          exchange: 'NSE',
          sector: 'Infrastructure & Engineering',
          addedAt: now,
        },
      ],
    },
    {
      id: 'wl_high_beta',
      userId: demoUserId,
      name: 'Auto & Financials',
      items: [
        {
          symbol: 'BAJFINANCE.NS',
          name: 'Bajaj Finance Ltd',
          exchange: 'NSE',
          sector: 'Banking & Finance',
          addedAt: now,
        },
        {
          symbol: 'MARUTI.NS',
          name: 'Maruti Suzuki India Ltd',
          exchange: 'NSE',
          sector: 'Automobiles',
          addedAt: now,
        },
        {
          symbol: 'TITAN.NS',
          name: 'Titan Company Ltd',
          exchange: 'NSE',
          sector: 'Consumer Discretionary',
          addedAt: now,
        },
      ],
    },
  ];

  const alerts: PriceAlert[] = [
    {
      id: 'al_1',
      userId: demoUserId,
      symbol: 'RELIANCE.NS',
      stockName: 'Reliance Industries Ltd',
      alertType: 'TARGET_ABOVE',
      targetValue: 1350,
      active: true,
      triggeredAt: null,
      createdAt: '2026-11-10T09:15:00.000Z',
    },
    {
      id: 'al_2',
      userId: demoUserId,
      symbol: 'TATAMOTORS.NS',
      stockName: 'Tata Motors Ltd',
      alertType: 'STOPLOSS_BELOW',
      targetValue: 760,
      active: true,
      triggeredAt: null,
      createdAt: '2026-11-12T14:20:00.000Z',
    },
    {
      id: 'al_3',
      userId: demoUserId,
      symbol: 'TCS.NS',
      stockName: 'Tata Consultancy Services Ltd',
      alertType: 'TARGET_ABOVE',
      targetValue: 4100,
      active: true,
      triggeredAt: now,
      createdAt: '2026-11-01T10:00:00.000Z',
    },
  ];

  const calculations: CalculationRecord[] = [
    {
      id: 'calc_1',
      userId: demoUserId,
      calculatorId: 'brokerage',
      calculatorName: 'Brokerage & Charges',
      category: 'core',
      inputs: {
        segment: 'delivery',
        exchange: 'NSE',
        buyPrice: 1200,
        sellPrice: 1320,
        quantity: 50,
        brokerageMode: 'flat',
        brokerageFlatPerOrder: 20,
        brokeragePct: 0,
      },
      results: {
        grossPnL: 6000,
        totalCharges: 211.79,
        netPnL: 5788.21,
        breakEvenPrice: 1204.24,
      },
      summary: 'NSE Delivery · 50 shares · Net P/L +₹5,788.21',
      createdAt: '2026-11-13T16:40:00.000Z',
    },
    {
      id: 'calc_2',
      userId: demoUserId,
      calculatorId: 'sip',
      calculatorName: 'Stock SIP Calculator',
      category: 'core',
      inputs: {
        amount: 25000,
        years: 10,
        annualReturnPct: 14,
        frequency: 'monthly',
      },
      results: {
        totalInvested: 3000000,
        estimatedReturns: 3552130.72,
        totalFutureValue: 6552130.72,
      },
      summary: '₹25,000/mo · 10 Yrs @ 14% · Est. ₹65.52 L',
      createdAt: '2026-11-12T11:20:00.000Z',
    },
    {
      id: 'calc_3',
      userId: demoUserId,
      calculatorId: 'average-price',
      calculatorName: 'Average Stock Price',
      category: 'core',
      inputs: {
        lots: [
          { price: 1150, quantity: 40 },
          { price: 1239.7, quantity: 25 },
        ],
        currentPrice: 1267.6,
      },
      results: {
        totalQuantity: 65,
        totalInvestment: 76992.5,
        averagePrice: 1184.5,
        unrealizedPnL: 5401.5,
      },
      summary: '65 shares @ Avg ₹1,184.50 · Unrealized +₹5,401.50',
      createdAt: '2026-11-11T15:10:00.000Z',
    },
  ];

  const goals: FinancialGoal[] = [
    {
      id: 'goal_1',
      userId: demoUserId,
      title: 'Long-Term Equity Corpus',
      targetAmount: 2500000,
      currentAmount: 558000,
      monthlyContribution: 25000,
      expectedReturnPct: 13,
      targetDate: '2031-12-31',
      createdAt: '2025-05-01T09:00:00.000Z',
    },
    {
      id: 'goal_2',
      userId: demoUserId,
      title: 'Dividend Income Reserve',
      targetAmount: 1000000,
      currentAmount: 215000,
      monthlyContribution: 12000,
      expectedReturnPct: 11,
      targetDate: '2030-03-31',
      createdAt: '2025-08-15T09:00:00.000Z',
    },
  ];

  return { users, portfolios, watchlists, alerts, calculations, goals };
}

export async function readDb(): Promise<StockMateDatabase> {
  if (memoryCache) return memoryCache;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    memoryCache = JSON.parse(raw) as StockMateDatabase;
    return memoryCache;
  } catch {
    memoryCache = createSeedDatabase();
    await persistDb(memoryCache);
    return memoryCache;
  }
}

export async function persistDb(db: StockMateDatabase): Promise<void> {
  memoryCache = db;
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmpPath = `${DB_PATH}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
    await fs.rename(tmpPath, DB_PATH);
  });
  await writeQueue;
}

export function sanitizeUser(user: StoredUser): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    role: user.role,
    createdAt: user.createdAt,
    preferences: user.preferences,
  };
}

export function createStarterUserWorkspace(userId: string): {
  portfolio: Portfolio;
  watchlist: Watchlist;
} {
  const now = new Date().toISOString();
  return {
    portfolio: {
      id: `pf_${crypto.randomUUID().slice(0, 8)}`,
      userId,
      name: 'My Primary Portfolio',
      description: 'Default equity portfolio',
      createdAt: now,
      holdings: [],
    },
    watchlist: {
      id: `wl_${crypto.randomUUID().slice(0, 8)}`,
      userId,
      name: 'My Watchlist',
      items: [
        {
          symbol: 'RELIANCE.NS',
          name: 'Reliance Industries Ltd',
          exchange: 'NSE',
          sector: 'Energy & Conglomerate',
          addedAt: now,
        },
        {
          symbol: 'TCS.NS',
          name: 'Tata Consultancy Services Ltd',
          exchange: 'NSE',
          sector: 'Information Technology',
          addedAt: now,
        },
        {
          symbol: 'HDFCBANK.NS',
          name: 'HDFC Bank Ltd',
          exchange: 'NSE',
          sector: 'Banking & Finance',
          addedAt: now,
        },
      ],
    },
  };
}
