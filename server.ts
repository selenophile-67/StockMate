import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  createStarterUserWorkspace,
  persistDb,
  readDb,
  sanitizeUser,
  StoredUser,
} from './server/store';
import {
  getIndianMarketStatus,
  getMarketIndices,
  getMarketNews,
  getMultipleQuotes,
  getStockHistory,
  getStockQuote,
  getStockSpecificNews,
  searchIndianStocks,
} from './server/marketService';
import {
  EnrichedStockResearch,
  explainCalculation,
  stockResearchChat,
} from './server/aiService';
import { INDIAN_STOCK_DIRECTORY } from './src/lib/indianStocks';
import {
  Exchange,
  FinancialGoal,
  Portfolio,
  PriceAlert,
  StockHolding,
  TimeInterval,
  Watchlist,
} from './src/types/stockmate';
import { round2, round4 } from './src/lib/finance';

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET !== 'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET'
    ? process.env.JWT_SECRET
    : crypto.createHash('sha256').update(process.cwd() + '_stockmate_dev').digest('hex');

interface AuthRequest extends Request {
  userId?: string;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function issueToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

function setAuthCookie(res: Response, token: string) {
  res.cookie('stockmate_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookies = parseCookies(req.headers.cookie);
  const token = bearer || cookies['stockmate_token'];
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: string };
    if (!decoded?.sub) {
      res.status(401).json({ error: 'Invalid session token' });
      return;
    }
    req.userId = decoded.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid' });
  }
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // ============================================================================
  // AUTH ROUTES
  // ============================================================================
  app.post('/api/auth/register', async (req, res) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email().max(120),
      password: z.string().min(6).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid registration details', issues: parsed.error.issues });
      return;
    }

    const db = await readDb();
    const emailLower = parsed.data.email.toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === emailLower)) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const userId = `usr_${crypto.randomUUID().slice(0, 10)}`;
    const verificationToken = crypto.randomBytes(16).toString('hex');
    const newUser: StoredUser = {
      id: userId,
      name: parsed.data.name,
      email: emailLower,
      emailVerified: false,
      verificationToken,
      role: 'user',
      createdAt: new Date().toISOString(),
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      preferences: {
        theme: 'dark',
        defaultExchange: 'NSE',
        currency: 'INR',
        brokerageFlat: 20,
        brokeragePct: 0.03,
        dpCharges: 15.93,
        chargeEffectiveDate: '2024-10-01',
      },
    };

    const starter = createStarterUserWorkspace(userId);
    db.users.push(newUser);
    db.portfolios.push(starter.portfolio);
    db.watchlists.push(starter.watchlist);
    await persistDb(db);

    const token = issueToken(userId);
    setAuthCookie(res, token);
    res.status(201).json({
      token,
      user: sanitizeUser(newUser),
      verificationToken,
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const schema = z.object({
      email: z.string().trim().email(),
      password: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please enter valid email and password' });
      return;
    }

    const db = await readDb();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === parsed.data.email.toLowerCase()
    );
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = issueToken(user.id);
    setAuthCookie(res, token);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/demo', async (_req, res) => {
    const db = await readDb();
    const demo = db.users.find((u) => u.email === 'demo@stockmate.in');
    if (!demo) {
      res.status(404).json({ error: 'Demo user unavailable' });
      return;
    }
    const token = issueToken(demo.id);
    setAuthCookie(res, token);
    res.json({ token, user: sanitizeUser(demo) });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('stockmate_token', { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    const db = await readDb();
    const user = db.users.find((u) => u.id === req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      user: sanitizeUser(user),
      pendingVerificationToken: user.emailVerified ? null : user.verificationToken || null,
    });
  });

  app.put('/api/auth/profile', requireAuth, async (req: AuthRequest, res) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(80).optional(),
      preferences: z
        .object({
          theme: z.enum(['dark', 'light']).optional(),
          defaultExchange: z.enum(['NSE', 'BSE']).optional(),
          brokerageFlat: z.number().min(0).max(5000).optional(),
          brokeragePct: z.number().min(0).max(5).optional(),
          dpCharges: z.number().min(0).max(500).optional(),
          chargeEffectiveDate: z.enum(['2024-10-01', '2023-04-01']).optional(),
        })
        .optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid profile update', issues: parsed.error.issues });
      return;
    }

    const db = await readDb();
    const user = db.users.find((u) => u.id === req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (parsed.data.name) user.name = parsed.data.name;
    if (parsed.data.preferences) {
      user.preferences = { ...user.preferences, ...parsed.data.preferences };
    }
    await persistDb(db);
    res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/auth/verify-email', async (req, res) => {
    const schema = z.object({ token: z.string().min(4) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Verification token required' });
      return;
    }
    const db = await readDb();
    const user = db.users.find((u) => u.verificationToken === parsed.data.token);
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired verification token' });
      return;
    }
    user.emailVerified = true;
    user.verificationToken = null;
    await persistDb(db);
    res.json({ ok: true, user: sanitizeUser(user) });
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    const schema = z.object({ email: z.string().trim().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }
    const db = await readDb();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === parsed.data.email.toLowerCase()
    );
    if (!user) {
      res.json({
        ok: true,
        message: 'If an account exists for that email, a reset token has been generated.',
      });
      return;
    }
    const resetToken = crypto.randomBytes(6).toString('hex').toUpperCase();
    user.resetToken = resetToken;
    user.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await persistDb(db);
    // In local/sandbox mode without SMTP, return token for immediate self-service testing
    res.json({
      ok: true,
      message: 'Password reset token generated (valid for 15 minutes).',
      demoResetToken: resetToken,
    });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const schema = z.object({
      email: z.string().trim().email(),
      token: z.string().trim().min(4),
      newPassword: z.string().min(6).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid reset parameters' });
      return;
    }
    const db = await readDb();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === parsed.data.email.toLowerCase()
    );
    if (
      !user ||
      !user.resetToken ||
      user.resetToken !== parsed.data.token.trim().toUpperCase() ||
      !user.resetTokenExpiresAt ||
      new Date(user.resetTokenExpiresAt).getTime() < Date.now()
    ) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }
    user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpiresAt = null;
    await persistDb(db);
    res.json({ ok: true });
  });

  // ============================================================================
  // MARKET DATA ROUTES
  // ============================================================================
  app.get('/api/market/overview', async (_req, res) => {
    const [indices, status] = await Promise.all([
      getMarketIndices(),
      Promise.resolve(getIndianMarketStatus()),
    ]);
    res.json({ indices, marketStatus: status });
  });

  app.get('/api/market/search', (req, res) => {
    const q = String(req.query.q || '');
    res.json({ results: searchIndianStocks(q) });
  });

  app.get('/api/market/quotes', async (req, res) => {
    const symbolsParam = String(req.query.symbols || '');
    const symbols = symbolsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40);
    if (symbols.length === 0) {
      res.json({ quotes: {} });
      return;
    }
    const quotes = await getMultipleQuotes(symbols);
    res.json({ quotes });
  });

  app.get('/api/market/quote/:symbol', async (req, res) => {
    const quote = await getStockQuote(req.params.symbol);
    res.json({ quote });
  });

  app.get('/api/market/history/:symbol', async (req, res) => {
    const interval = (String(req.query.interval || '6M').toUpperCase() as TimeInterval);
    const validIntervals: TimeInterval[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y'];
    const safeInterval = validIntervals.includes(interval) ? interval : '6M';
    const history = await getStockHistory(req.params.symbol, safeInterval);
    res.json(history);
  });

  app.get('/api/market/news', async (_req, res) => {
    const articles = await getMarketNews();
    res.json({ articles, fetchedAt: new Date().toISOString() });
  });

  // ============================================================================
  // PORTFOLIO & HOLDINGS ROUTES (Authenticated & Private)
  // ============================================================================
  app.get('/api/portfolios', requireAuth, async (req: AuthRequest, res) => {
    const db = await readDb();
    const portfolios = db.portfolios.filter((p) => p.userId === req.userId);
    res.json({ portfolios });
  });

  app.post('/api/portfolios', requireAuth, async (req: AuthRequest, res) => {
    const schema = z.object({
      name: z.string().trim().min(1).max(60),
      description: z.string().trim().max(200).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Portfolio name is required' });
      return;
    }
    const db = await readDb();
    const pf: Portfolio = {
      id: `pf_${crypto.randomUUID().slice(0, 8)}`,
      userId: req.userId!,
      name: parsed.data.name,
      description: parsed.data.description,
      createdAt: new Date().toISOString(),
      holdings: [],
    };
    db.portfolios.push(pf);
    await persistDb(db);
    res.status(201).json({ portfolio: pf });
  });

  app.delete('/api/portfolios/:portfolioId', requireAuth, async (req: AuthRequest, res) => {
    const db = await readDb();
    const idx = db.portfolios.findIndex(
      (p) => p.id === req.params.portfolioId && p.userId === req.userId
    );
    if (idx === -1) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }
    db.portfolios.splice(idx, 1);
    await persistDb(db);
    res.json({ ok: true });
  });

  app.post('/api/portfolios/:portfolioId/holdings', requireAuth, async (req: AuthRequest, res) => {
    const schema = z.object({
      symbol: z.string().trim().min(1).max(24),
      name: z.string().trim().min(1).max(100),
      exchange: z.enum(['NSE', 'BSE']),
      sector: z.string().trim().max(60).optional(),
      quantity: z.number().positive(),
      price: z.number().positive(),
      charges: z.number().min(0).optional(),
      date: z.string().optional(),
      manualPrice: z.number().positive().nullable().optional(),
      notes: z.string().max(200).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid holding details', issues: parsed.error.issues });
      return;
    }

    const db = await readDb();
    const pf = db.portfolios.find(
      (p) => p.id === req.params.portfolioId && p.userId === req.userId
    );
    if (!pf) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    const symUpper = parsed.data.symbol.toUpperCase();
    const formattedSymbol =
      symUpper.endsWith('.NS') || symUpper.endsWith('.BO')
        ? symUpper
        : `${symUpper}.${parsed.data.exchange === 'BSE' ? 'BO' : 'NS'}`;

    const txDate = parsed.data.date || new Date().toISOString().slice(0, 10);
    const existing = pf.holdings.find((h) => h.symbol === formattedSymbol);

    if (existing) {
      const prevCost = existing.quantity * existing.averagePrice;
      const newCost = parsed.data.quantity * parsed.data.price;
      const totalQty = existing.quantity + parsed.data.quantity;
      existing.quantity = round4(totalQty);
      existing.averagePrice = round2((prevCost + newCost) / totalQty);
      if (parsed.data.manualPrice !== undefined) {
        existing.manualPrice = parsed.data.manualPrice;
      }
      existing.transactions.push({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        type: 'BUY',
        date: txDate,
        quantity: parsed.data.quantity,
        price: parsed.data.price,
        charges: parsed.data.charges ?? 0,
        notes: parsed.data.notes,
      });
    } else {
      const holding: StockHolding = {
        id: `hld_${crypto.randomUUID().slice(0, 8)}`,
        symbol: formattedSymbol,
        name: parsed.data.name,
        exchange: parsed.data.exchange as Exchange,
        sector: parsed.data.sector || 'Indian Equities',
        quantity: round4(parsed.data.quantity),
        averagePrice: round2(parsed.data.price),
        manualPrice: parsed.data.manualPrice ?? null,
        realizedPnL: 0,
        transactions: [
          {
            id: `tx_${crypto.randomUUID().slice(0, 8)}`,
            type: 'BUY',
            date: txDate,
            quantity: parsed.data.quantity,
            price: parsed.data.price,
            charges: parsed.data.charges ?? 0,
            notes: parsed.data.notes,
          },
        ],
        dividends: [],
      };
      pf.holdings.push(holding);
    }

    await persistDb(db);
    res.status(201).json({ portfolio: pf });
  });

  app.put(
    '/api/portfolios/:portfolioId/holdings/:holdingId',
    requireAuth,
    async (req: AuthRequest, res) => {
      const schema = z.object({
        quantity: z.number().min(0).optional(),
        averagePrice: z.number().positive().optional(),
        manualPrice: z.number().positive().nullable().optional(),
        sector: z.string().trim().max(60).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid holding update' });
        return;
      }

      const db = await readDb();
      const pf = db.portfolios.find(
        (p) => p.id === req.params.portfolioId && p.userId === req.userId
      );
      const holding = pf?.holdings.find((h) => h.id === req.params.holdingId);
      if (!pf || !holding) {
        res.status(404).json({ error: 'Holding not found' });
        return;
      }
      if (parsed.data.quantity !== undefined) holding.quantity = round4(parsed.data.quantity);
      if (parsed.data.averagePrice !== undefined)
        holding.averagePrice = round2(parsed.data.averagePrice);
      if (parsed.data.manualPrice !== undefined)
        holding.manualPrice = parsed.data.manualPrice;
      if (parsed.data.sector !== undefined) holding.sector = parsed.data.sector;

      await persistDb(db);
      res.json({ portfolio: pf });
    }
  );

  app.post(
    '/api/portfolios/:portfolioId/holdings/:holdingId/transactions',
    requireAuth,
    async (req: AuthRequest, res) => {
      const schema = z.object({
        type: z.enum(['BUY', 'SELL']),
        quantity: z.number().positive(),
        price: z.number().positive(),
        charges: z.number().min(0).optional(),
        date: z.string().optional(),
        notes: z.string().max(200).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid transaction data' });
        return;
      }

      const db = await readDb();
      const pf = db.portfolios.find(
        (p) => p.id === req.params.portfolioId && p.userId === req.userId
      );
      const holding = pf?.holdings.find((h) => h.id === req.params.holdingId);
      if (!pf || !holding) {
        res.status(404).json({ error: 'Holding not found' });
        return;
      }

      const { type, quantity, price } = parsed.data;
      const charges = parsed.data.charges ?? 0;

      if (type === 'SELL' && quantity > holding.quantity) {
        res.status(400).json({ error: 'Sell quantity exceeds current holding quantity' });
        return;
      }

      if (type === 'BUY') {
        const prevCost = holding.quantity * holding.averagePrice;
        const newTotal = holding.quantity + quantity;
        holding.averagePrice = round2((prevCost + quantity * price) / newTotal);
        holding.quantity = round4(newTotal);
      } else {
        const realized = (price - holding.averagePrice) * quantity - charges;
        holding.realizedPnL = round2(holding.realizedPnL + realized);
        holding.quantity = round4(holding.quantity - quantity);
      }

      holding.transactions.push({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        type,
        date: parsed.data.date || new Date().toISOString().slice(0, 10),
        quantity,
        price,
        charges,
        notes: parsed.data.notes,
      });

      await persistDb(db);
      res.json({ portfolio: pf });
    }
  );

  app.post(
    '/api/portfolios/:portfolioId/holdings/:holdingId/dividends',
    requireAuth,
    async (req: AuthRequest, res) => {
      const schema = z.object({
        amountPerShare: z.number().positive(),
        date: z.string().optional(),
        notes: z.string().max(200).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid dividend amount' });
        return;
      }

      const db = await readDb();
      const pf = db.portfolios.find(
        (p) => p.id === req.params.portfolioId && p.userId === req.userId
      );
      const holding = pf?.holdings.find((h) => h.id === req.params.holdingId);
      if (!pf || !holding) {
        res.status(404).json({ error: 'Holding not found' });
        return;
      }

      const totalAmount = round2(parsed.data.amountPerShare * holding.quantity);
      holding.dividends.push({
        id: `div_${crypto.randomUUID().slice(0, 8)}`,
        date: parsed.data.date || new Date().toISOString().slice(0, 10),
        amountPerShare: parsed.data.amountPerShare,
        totalAmount,
        notes: parsed.data.notes,
      });

      await persistDb(db);
      res.json({ portfolio: pf });
    }
  );

  app.delete(
    '/api/portfolios/:portfolioId/holdings/:holdingId',
    requireAuth,
    async (req: AuthRequest, res) => {
      const db = await readDb();
      const pf = db.portfolios.find(
        (p) => p.id === req.params.portfolioId && p.userId === req.userId
      );
      if (!pf) {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }
      pf.holdings = pf.holdings.filter((h) => h.id !== req.params.holdingId);
      await persistDb(db);
      res.json({ portfolio: pf });
    }
  );

  // CSV broker statement import: columns symbol,name,exchange,type,quantity,price,charges,date
  app.post('/api/portfolios/:portfolioId/import-csv', requireAuth, async (req: AuthRequest, res) => {
    const schema = z.object({
      rows: z
        .array(
          z.object({
            symbol: z.string().min(1),
            name: z.string().optional(),
            exchange: z.enum(['NSE', 'BSE']).optional(),
            type: z.enum(['BUY', 'SELL']).optional(),
            quantity: z.number().positive(),
            price: z.number().positive(),
            charges: z.number().min(0).optional(),
            date: z.string().optional(),
          })
        )
        .min(1)
        .max(200),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid CSV rows' });
      return;
    }

    const db = await readDb();
    const pf = db.portfolios.find(
      (p) => p.id === req.params.portfolioId && p.userId === req.userId
    );
    if (!pf) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    let importedCount = 0;
    for (const row of parsed.data.rows) {
      const exchange: Exchange = row.exchange || (row.symbol.endsWith('.BO') ? 'BSE' : 'NSE');
      const symUpper = row.symbol.trim().toUpperCase();
      const symbol =
        symUpper.endsWith('.NS') || symUpper.endsWith('.BO')
          ? symUpper
          : `${symUpper}.${exchange === 'BSE' ? 'BO' : 'NS'}`;
      const type = row.type || 'BUY';
      const date = row.date || new Date().toISOString().slice(0, 10);
      const charges = row.charges ?? 0;

      let holding = pf.holdings.find((h) => h.symbol === symbol);
      if (!holding && type === 'BUY') {
        holding = {
          id: `hld_${crypto.randomUUID().slice(0, 8)}`,
          symbol,
          name: row.name || symbol.replace(/\.(NS|BO)$/, ''),
          exchange,
          sector: 'Imported Equity',
          quantity: 0,
          averagePrice: 0,
          realizedPnL: 0,
          transactions: [],
          dividends: [],
        };
        pf.holdings.push(holding);
      }
      if (!holding) continue;

      if (type === 'BUY') {
        const prevCost = holding.quantity * holding.averagePrice;
        const newQty = holding.quantity + row.quantity;
        holding.averagePrice = round2((prevCost + row.quantity * row.price) / newQty);
        holding.quantity = round4(newQty);
      } else {
        const sellQty = Math.min(holding.quantity, row.quantity);
        if (sellQty <= 0) continue;
        holding.realizedPnL = round2(
          holding.realizedPnL + (row.price - holding.averagePrice) * sellQty - charges
        );
        holding.quantity = round4(holding.quantity - sellQty);
      }

      holding.transactions.push({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        type,
        date,
        quantity: row.quantity,
        price: row.price,
        charges,
        notes: 'CSV Broker Import',
      });
      importedCount++;
    }

    await persistDb(db);
    res.json({ importedCount, portfolio: pf });
  });

  // ============================================================================
  // WATCHLIST & ALERTS ROUTES
  // ============================================================================
  app.get('/api/watchlists', requireAuth, async (req: AuthRequest, res) => {
    const db = await readDb();
    res.json({
      watchlists: db.watchlists.filter((w) => w.userId === req.userId),
      alerts: db.alerts.filter((a) => a.userId === req.userId),
    });
  });

  app.post('/api/watchlists', requireAuth, async (req: AuthRequest, res) => {
    const schema = z.object({ name: z.string().trim().min(1).max(60) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Watchlist name required' });
      return;
    }
    const db = await readDb();
    const wl: Watchlist = {
      id: `wl_${crypto.randomUUID().slice(0, 8)}`,
      userId: req.userId!,
      name: parsed.data.name,
      items: [],
    };
    db.watchlists.push(wl);
    await persistDb(db);
    res.status(201).json({ watchlist: wl });
  });

  app.post('/api/watchlists/:id/items', requireAuth, async (req: AuthRequest, res) => {
    const schema = z.object({
      symbol: z.string().trim().min(1).max(24),
      name: z.string().trim().min(1).max(100),
      exchange: z.enum(['NSE', 'BSE']),
      sector: z.string().trim().max(60).optional(),
      manualPrice: z.number().positive().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid watchlist stock' });
      return;
    }
    const db = await readDb();
    const wl = db.watchlists.find((w) => w.id === req.params.id && w.userId === req.userId);
    if (!wl) {
      res.status(404).json({ error: 'Watchlist not found' });
      return;
    }
    const sym = parsed.data.symbol.toUpperCase();
    if (!wl.items.some((i) => i.symbol === sym)) {
      wl.items.push({
        symbol: sym,
        name: parsed.data.name,
        exchange: parsed.data.exchange,
        sector: parsed.data.sector || 'Indian Equities',
        manualPrice: parsed.data.manualPrice ?? null,
        addedAt: new Date().toISOString(),
      });
      await persistDb(db);
    }
    res.json({ watchlist: wl });
  });

  app.delete('/api/watchlists/:id/items/:symbol', requireAuth, async (req: AuthRequest, res) => {
    const db = await readDb();
    const wl = db.watchlists.find((w) => w.id === req.params.id && w.userId === req.userId);
    if (!wl) {
      res.status(404).json({ error: 'Watchlist not found' });
      return;
    }
    wl.items = wl.items.filter((i) => i.symbol !== req.params.symbol.toUpperCase());
    await persistDb(db);
    res.json({ watchlist: wl });
  });

  app.post('/api/alerts', requireAuth, async (req: AuthRequest, res) => {
    const schema = z.object({
      symbol: z.string().trim().min(1).max(24),
      stockName: z.string().trim().min(1).max(100),
      alertType: z.enum(['TARGET_ABOVE', 'STOPLOSS_BELOW']),
      targetValue: z.number().positive(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid alert details' });
      return;
    }
    const db = await readDb();
    const alert: PriceAlert = {
      id: `al_${crypto.randomUUID().slice(0, 8)}`,
      userId: req.userId!,
      symbol: parsed.data.symbol.toUpperCase(),
      stockName: parsed.data.stockName,
      alertType: parsed.data.alertType,
      targetValue: round2(parsed.data.targetValue),
      active: true,
      triggeredAt: null,
      createdAt: new Date().toISOString(),
    };
    db.alerts.push(alert);
    await persistDb(db);
    res.status(201).json({ alert });
  });

  app.delete('/api/alerts/:id', requireAuth, async (req: AuthRequest, res) => {
    const db = await readDb();
    db.alerts = db.alerts.filter(
      (a) => !(a.id === req.params.id && a.userId === req.userId)
    );
    await persistDb(db);
    res.json({ ok: true });
  });

  // ============================================================================
  // CALCULATION HISTORY ROUTES
  // ============================================================================
  app.get('/api/history', requireAuth, async (req: AuthRequest, res) => {
    const db = await readDb();
    const list = db.calculations
      .filter((c) => c.userId === req.userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ calculations: list });
  });

  app.post('/api/history', requireAuth, async (req: AuthRequest, res) => {
    const schema = z.object({
      calculatorId: z.string().min(1).max(60),
      calculatorName: z.string().min(1).max(100),
      category: z.enum(['core', 'advanced']),
      inputs: z.record(z.string(), z.unknown()),
      results: z.record(z.string(), z.unknown()),
      summary: z.string().min(1).max(240),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid calculation record' });
      return;
    }
    const db = await readDb();
    const record = {
      id: `calc_${crypto.randomUUID().slice(0, 8)}`,
      userId: req.userId!,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    db.calculations.unshift(record);
    await persistDb(db);
    res.status(201).json({ calculation: record });
  });

  app.delete('/api/history/:id', requireAuth, async (req: AuthRequest, res) => {
    const db = await readDb();
    db.calculations = db.calculations.filter(
      (c) => !(c.id === req.params.id && c.userId === req.userId)
    );
    await persistDb(db);
    res.json({ ok: true });
  });

  // ============================================================================
  // FINANCIAL GOALS ROUTES
  // ============================================================================
  app.get('/api/goals', requireAuth, async (req: AuthRequest, res) => {
    const db = await readDb();
    res.json({ goals: db.goals.filter((g) => g.userId === req.userId) });
  });

  app.post('/api/goals', requireAuth, async (req: AuthRequest, res) => {
    const schema = z.object({
      title: z.string().trim().min(1).max(80),
      targetAmount: z.number().positive(),
      currentAmount: z.number().min(0),
      monthlyContribution: z.number().min(0),
      expectedReturnPct: z.number().min(0).max(50),
      targetDate: z.string().min(4),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid goal details' });
      return;
    }
    const db = await readDb();
    const goal: FinancialGoal = {
      id: `goal_${crypto.randomUUID().slice(0, 8)}`,
      userId: req.userId!,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    db.goals.push(goal);
    await persistDb(db);
    res.status(201).json({ goal });
  });

  app.delete('/api/goals/:id', requireAuth, async (req: AuthRequest, res) => {
    const db = await readDb();
    db.goals = db.goals.filter((g) => !(g.id === req.params.id && g.userId === req.userId));
    await persistDb(db);
    res.json({ ok: true });
  });

  // ============================================================================
  // AI CALCULATION EXPLAINER (Server-side @google/genai)
  // ============================================================================
  app.post('/api/ai/explain', async (req, res) => {
    const schema = z.object({
      calculatorName: z.string().min(1).max(100),
      inputs: z.record(z.string(), z.unknown()),
      results: z.record(z.string(), z.unknown()),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid explanation payload' });
      return;
    }
    try {
      const out = await explainCalculation(parsed.data);
      res.json(out);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to explain calculation',
      });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    const schema = z.object({
      messages: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string().trim().min(1).max(25000),
          })
        )
        .min(1)
        .max(100),
      focusSymbol: z.string().trim().max(50).nullish(),
      portfolioSummary: z.string().max(20000).nullish(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        error: firstIssue
          ? `Invalid chat payload (${firstIssue.path.join('.') || 'body'}: ${firstIssue.message})`
          : 'Invalid chat payload',
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      const recentMessages = parsed.data.messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content.slice(0, 6000),
      }));
      const safePortfolioSummary = (parsed.data.portfolioSummary ?? '').slice(0, 6000);
      const latestText = recentMessages[recentMessages.length - 1]?.content || '';
      const userContextText = recentMessages
        .filter((m) => m.role === 'user')
        .slice(-2)
        .map((m) => m.content)
        .join(' ');
      const lower = userContextText.toLowerCase();
      const latestLower = latestText.toLowerCase();
      const matchedSymbols = new Set<string>();

      const isPortfolioQuery =
        latestLower.includes('portfolio') ||
        latestLower.includes('holding') ||
        latestLower.includes('my stock') ||
        parsed.data.focusSymbol === 'PORTFOLIO';

      // Match stocks in directory from latest question first
      for (const entry of INDIAN_STOCK_DIRECTORY) {
        const tickerLower = entry.baseTicker.toLowerCase();
        const nameLower = entry.name.toLowerCase();
        const nameWord = nameLower.split(' ')[0];
        if (
          latestLower.includes(tickerLower) ||
          latestLower.includes(entry.symbol.toLowerCase()) ||
          latestLower.includes(nameLower) ||
          (nameWord.length >= 4 && latestLower.includes(nameWord))
        ) {
          matchedSymbols.add(entry.symbol);
        }
      }

      // Sector keyword matching (e.g., "Indian banking stocks", "IT stocks", "pharma")
      const sectorMap: Array<{ keywords: string[]; symbols: string[] }> = [
        {
          keywords: ['bank', 'banking', 'nbfc', 'financial'],
          symbols: ['HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'KOTAKBANK.NS', 'AXISBANK.NS'],
        },
        {
          keywords: ['it ', 'software', 'tech', 'ai stock'],
          symbols: ['TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS'],
        },
        {
          keywords: ['auto', 'ev ', 'car', 'vehicle', 'mobility'],
          symbols: ['TATAMOTORS.NS', 'MARUTI.NS', 'M&M.NS', 'BAJAJ-AUTO.NS'],
        },
        {
          keywords: ['pharma', 'healthcare', 'medicine'],
          symbols: ['SUNPHARMA.NS', 'DRREDDY.NS', 'CIPLA.NS'],
        },
        {
          keywords: ['energy', 'oil', 'gas', 'power'],
          symbols: ['RELIANCE.NS', 'ONGC.NS', 'NTPC.NS', 'POWERGRID.NS'],
        },
        {
          keywords: ['fmcg', 'consumer', 'retail'],
          symbols: ['ITC.NS', 'HINDUNILVR.NS', 'NESTLEIND.NS'],
        },
      ];
      for (const group of sectorMap) {
        if (group.keywords.some((kw) => latestLower.includes(kw))) {
          for (const sym of group.symbols) matchedSymbols.add(sym);
        }
      }

      // Portfolio symbol extraction when user asks about their portfolio
      if (isPortfolioQuery && safePortfolioSummary) {
        const pfMatches = safePortfolioSummary.match(/\b[A-Z0-9&-]{2,15}\.(?:NS|BO)\b/g) || [];
        for (const sym of pfMatches) matchedSymbols.add(sym);
      }

      // If no explicit stock/sector was found in latest message, check previous user turn or focusSymbol
      if (matchedSymbols.size === 0) {
        for (const entry of INDIAN_STOCK_DIRECTORY) {
          const tickerLower = entry.baseTicker.toLowerCase();
          const nameWord = entry.name.split(' ')[0].toLowerCase();
          if (
            lower.includes(tickerLower) ||
            lower.includes(entry.symbol.toLowerCase()) ||
            (nameWord.length >= 4 && lower.includes(nameWord))
          ) {
            matchedSymbols.add(entry.symbol);
          }
        }
      }
      if (
        matchedSymbols.size === 0 &&
        parsed.data.focusSymbol &&
        parsed.data.focusSymbol !== 'PORTFOLIO'
      ) {
        matchedSymbols.add(parsed.data.focusSymbol.toUpperCase());
      }

      // Explicit uppercase custom NSE/BSE tickers typed by user (e.g. "IRCTC", "HAL", "ZOMATO.NS")
      const explicitTickers = latestText.match(/\b[A-Z]{2,12}(?:\.(?:NS|BO))?\b/g) || [];
      const stopWords = new Set([
        'BUY', 'SELL', 'HOLD', 'NSE', 'BSE', 'SIP', 'ROI', 'CAGR', 'EPS', 'PE',
        'INR', 'USD', 'CMP', 'RSI', 'SMA', 'MACD', 'ETF', 'IPO', 'SEBI', 'FII',
        'DII', 'QS', 'AI', 'VS', 'OR', 'AND', 'THE', 'FOR', 'NOT', 'NOW', 'CAN',
        'SHOULD', 'WHAT', 'WHICH', 'BEST', 'GOOD', 'RIGHT', 'STOCK', 'STOCKS',
      ]);
      for (const tok of explicitTickers) {
        if (stopWords.has(tok)) continue;
        if (tok.endsWith('.NS') || tok.endsWith('.BO')) {
          matchedSymbols.add(tok);
        } else if (tok.length >= 3 && matchedSymbols.size < 4) {
          matchedSymbols.add(`${tok}.NS`);
        }
      }

      const syms = Array.from(matchedSymbols).slice(0, 5);
      const qMap = syms.length > 0 ? await getMultipleQuotes(syms) : {};
      const validQuotes = Object.values(qMap).filter((q) => q.price > 0);

      // Fetch 3M candles & technicals for top 3 matched stocks in parallel
      const enrichedStocks: EnrichedStockResearch[] = await Promise.all(
        validQuotes.slice(0, 4).map(async (quote) => {
          let latestCandle = undefined;
          let rsi14: number | null = null;
          let sma20: number | null = null;
          let sma50: number | null = null;
          let macd: number | null = null;
          let macdSignal: number | null = null;
          let trendLabel: 'Bullish' | 'Consolidating' | 'Bearish' = 'Consolidating';

          try {
            const hist = await getStockHistory(quote.symbol, '3M');
            const candles = hist.candles || [];
            latestCandle = candles[candles.length - 1];
            if (latestCandle) {
              rsi14 = typeof latestCandle.rsi14 === 'number' ? latestCandle.rsi14 : null;
              sma20 = typeof latestCandle.sma20 === 'number' ? latestCandle.sma20 : null;
              if (candles.length >= 20) {
                const slice50 = candles.slice(-50);
                const sum50 = slice50.reduce((acc, c) => acc + c.close, 0);
                sma50 = Number((sum50 / slice50.length).toFixed(2));
              }
              macd = typeof latestCandle.macd === 'number' ? latestCandle.macd : null;
              macdSignal = typeof latestCandle.macdSignal === 'number' ? latestCandle.macdSignal : null;
              if (sma20 !== null && sma50 !== null) {
                if (quote.price > sma20 && sma20 >= sma50) trendLabel = 'Bullish';
                else if (quote.price < sma20 && sma20 < sma50) trendLabel = 'Bearish';
              } else if (sma20 !== null) {
                trendLabel = quote.price > sma20 ? 'Bullish' : 'Bearish';
              }
            }
          } catch {
            // proceed with quote-only enrichment
          }

          let posIn52WRangePct: number | null = null;
          if (
            quote.week52High &&
            quote.week52Low &&
            quote.week52High > quote.week52Low
          ) {
            posIn52WRangePct = Math.max(
              0,
              Math.min(
                100,
                ((quote.price - quote.week52Low) / (quote.week52High - quote.week52Low)) * 100
              )
            );
          }

          return {
            quote,
            latestCandle,
            posIn52WRangePct,
            rsi14,
            sma20,
            sma50,
            macd,
            macdSignal,
            trendLabel,
          };
        })
      );

      const newsQuery =
        enrichedStocks.length > 0
          ? enrichedStocks
              .slice(0, 2)
              .map((s) => s.quote.name.split(' ')[0])
              .join(' OR ')
          : latestText.slice(0, 80);

      const newsArticles = await getStockSpecificNews(newsQuery);

      const marketSnapshot = enrichedStocks
        .map(
          (s) =>
            `${s.quote.symbol} (${s.quote.name}): ₹${s.quote.price.toFixed(2)} (${
              s.quote.changePercent >= 0 ? '+' : ''
            }${s.quote.changePercent}%), 52W ₹${s.quote.week52Low ?? 'N/A'}–₹${
              s.quote.week52High ?? 'N/A'
            }, RSI14: ${s.rsi14 !== null ? s.rsi14.toFixed(1) : 'N/A'}, SMA20: ${
              s.sma20 !== null ? s.sma20.toFixed(2) : 'N/A'
            }, SMA50: ${s.sma50 !== null ? s.sma50.toFixed(2) : 'N/A'}, Trend: ${
              s.trendLabel
            }, Source: ${s.quote.source}`
        )
        .join('\n');

      const out = await stockResearchChat({
        messages: recentMessages,
        portfolioSummary: safePortfolioSummary,
        marketSnapshot,
        enrichedStocks,
        newsArticles,
      });
      res.json(out);
    } catch (err) {
      // Never return 502/503/504/403 since nginx intercepts those codes with HTML pages
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Stock research chat failed',
      });
    }
  });

  // ============================================================================
  // VITE / STATIC SERVING
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StockMate server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start StockMate server:', err);
  process.exit(1);
});
