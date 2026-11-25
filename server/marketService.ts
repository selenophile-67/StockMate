import {
  INDIAN_INDICES_REF,
  INDIAN_STOCK_DIRECTORY,
  buildReferenceIndex,
  buildReferenceQuote,
} from '../src/lib/indianStocks';
import { enrichCandlesWithIndicators } from '../src/lib/finance';
import {
  CandlePoint,
  Exchange,
  IndexOverview,
  MarketQuote,
  NewsArticle,
  TimeInterval,
} from '../src/types/stockmate';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const quoteCache = new Map<string, CacheEntry<MarketQuote>>();
const indexCache = new Map<string, CacheEntry<IndexOverview>>();
const candleCache = new Map<string, CacheEntry<{ candles: CandlePoint[]; source: 'delayed' | 'reference-snapshot'; lastUpdated: string }>>();
let newsCache: CacheEntry<NewsArticle[]> | null = null;

const QUOTE_TTL_MS = 60_000;
const CANDLE_TTL_MS = 120_000;
const NEWS_TTL_MS = 300_000;

export function getIndianMarketStatus(): {
  isOpen: boolean;
  label: 'Open' | 'Closed';
  sessionNote: string;
} {
  // Compute IST (UTC+5:30)
  const nowUtc = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(nowUtc.getTime() + istOffsetMs);
  const day = ist.getUTCDay(); // 0 Sun .. 6 Sat
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const isWeekday = day >= 1 && day <= 5;
  const inSession = mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
  const isOpen = isWeekday && inSession;
  return {
    isOpen,
    label: isOpen ? 'Open' : 'Closed',
    sessionNote: isOpen
      ? 'NSE & BSE Regular Session (09:15–15:30 IST)'
      : 'Regular Trading Hours: Mon–Fri 09:15–15:30 IST',
  };
}

async function fetchYahooChart(
  symbol: string,
  range: string,
  interval: string
): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StockMate/1.0)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.chart?.result?.[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getMarketIndices(): Promise<IndexOverview[]> {
  const nowIso = new Date().toISOString();
  const results = await Promise.all(
    INDIAN_INDICES_REF.map(async (idx) => {
      const cached = indexCache.get(idx.symbol);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }

      const yahoo = await fetchYahooChart(idx.symbol, '5d', '1d');
      if (yahoo?.meta?.regularMarketPrice) {
        const meta = yahoo.meta;
        const price = Number(meta.regularMarketPrice);
        const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
        const change = Number((price - prev).toFixed(2));
        const changePercent = prev > 0 ? Number(((change / prev) * 100).toFixed(2)) : 0;
        const overview: IndexOverview = {
          symbol: idx.symbol,
          name: idx.name,
          price,
          change,
          changePercent,
          dayHigh: Number(meta.regularMarketDayHigh ?? price),
          dayLow: Number(meta.regularMarketDayLow ?? price),
          source: 'delayed',
          lastUpdated: meta.regularMarketTime
            ? new Date(meta.regularMarketTime * 1000).toISOString()
            : nowIso,
        };
        indexCache.set(idx.symbol, { data: overview, expiresAt: Date.now() + QUOTE_TTL_MS });
        return overview;
      }

      const fallback = buildReferenceIndex(idx, nowIso);
      indexCache.set(idx.symbol, { data: fallback, expiresAt: Date.now() + 20_000 });
      return fallback;
    })
  );
  return results;
}

export async function getStockQuote(symbolInput: string): Promise<MarketQuote> {
  const normalized = symbolInput.trim().toUpperCase();
  const symbol =
    normalized.endsWith('.NS') || normalized.endsWith('.BO') || normalized.startsWith('^')
      ? normalized
      : `${normalized}.NS`;

  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const nowIso = new Date().toISOString();
  const dirMatch = INDIAN_STOCK_DIRECTORY.find(
    (s) => s.symbol === symbol || s.baseTicker === symbol.replace(/\.(NS|BO)$/, '')
  );

  const yahoo = await fetchYahooChart(symbol, '5d', '1d');
  if (yahoo?.meta?.regularMarketPrice) {
    const meta = yahoo.meta;
    const price = Number(meta.regularMarketPrice);
    const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
    const change = Number((price - prev).toFixed(2));
    const changePercent = prev > 0 ? Number(((change / prev) * 100).toFixed(2)) : 0;
    const exchange: Exchange = symbol.endsWith('.BO') ? 'BSE' : 'NSE';

    const quote: MarketQuote = {
      symbol,
      name: dirMatch?.name || meta.longName || meta.shortName || symbol,
      exchange,
      sector: dirMatch?.sector || 'Indian Equities',
      price,
      previousClose: prev,
      change,
      changePercent,
      dayHigh: Number(meta.regularMarketDayHigh ?? price),
      dayLow: Number(meta.regularMarketDayLow ?? price),
      open: Number(yahoo.indicators?.quote?.[0]?.open?.slice(-1)?.[0] ?? prev),
      volume: Number(meta.regularMarketVolume ?? 0),
      marketCap: dirMatch ? dirMatch.refMarketCapCr * 1e7 : null,
      week52High: Number(meta.fiftyTwoWeekHigh ?? dirMatch?.ref52WHigh ?? price),
      week52Low: Number(meta.fiftyTwoWeekLow ?? dirMatch?.ref52WLow ?? price),
      source: 'delayed',
      lastUpdated: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : nowIso,
    };
    quoteCache.set(symbol, { data: quote, expiresAt: Date.now() + QUOTE_TTL_MS });
    return quote;
  }

  if (dirMatch) {
    const ref = buildReferenceQuote(dirMatch, nowIso);
    quoteCache.set(symbol, { data: ref, expiresAt: Date.now() + 20_000 });
    return ref;
  }

  // Unknown custom ticker fallback
  return {
    symbol,
    name: symbol.replace(/\.(NS|BO)$/, ''),
    exchange: symbol.endsWith('.BO') ? 'BSE' : 'NSE',
    sector: 'Custom Equity',
    price: 0,
    previousClose: 0,
    change: 0,
    changePercent: 0,
    dayHigh: 0,
    dayLow: 0,
    open: 0,
    volume: 0,
    marketCap: null,
    week52High: null,
    week52Low: null,
    source: 'manual',
    lastUpdated: nowIso,
  };
}

export async function getMultipleQuotes(symbols: string[]): Promise<Record<string, MarketQuote>> {
  const unique = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)));
  const entries = await Promise.all(
    unique.map(async (sym) => {
      const q = await getStockQuote(sym);
      return [sym, q] as const;
    })
  );
  return Object.fromEntries(entries);
}

const INTERVAL_MAP: Record<TimeInterval, { range: string; interval: string; fallbackDays: number }> = {
  '1D': { range: '1d', interval: '15m', fallbackDays: 26 },
  '1W': { range: '5d', interval: '1h', fallbackDays: 35 },
  '1M': { range: '1mo', interval: '1d', fallbackDays: 22 },
  '3M': { range: '3mo', interval: '1d', fallbackDays: 63 },
  '6M': { range: '6mo', interval: '1d', fallbackDays: 126 },
  '1Y': { range: '1y', interval: '1d', fallbackDays: 250 },
  '5Y': { range: '5y', interval: '1wk', fallbackDays: 260 },
};

function generateDeterministicHistoricalSeries(
  symbol: string,
  basePrice: number,
  points: number,
  isIntraday: boolean
): CandlePoint[] {
  // Seeded pseudo-random walk anchored to end at exact reference price
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed = (seed * 31 + symbol.charCodeAt(i)) % 999983;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const now = Date.now();
  const stepMs = isIntraday ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const rawCloses: number[] = [basePrice > 0 ? basePrice : 1000];
  for (let i = 1; i < points; i++) {
    const pctMove = (rand() - 0.495) * (isIntraday ? 0.006 : 0.024);
    const prev = rawCloses[i - 1] / (1 + pctMove);
    rawCloses.push(Math.max(10, prev));
  }
  rawCloses.reverse();

  const candles: CandlePoint[] = rawCloses.map((close, idx) => {
    const ts = now - (points - 1 - idx) * stepMs;
    const dObj = new Date(ts);
    const spread = close * (isIntraday ? 0.004 : 0.015);
    const open = idx === 0 ? close * (1 + (rand() - 0.5) * 0.01) : rawCloses[idx - 1];
    const high = Math.max(open, close) + rand() * spread;
    const low = Math.min(open, close) - rand() * spread;
    const vol = Math.round(500000 + rand() * 3500000);
    return {
      date: isIntraday
        ? dObj.toISOString().slice(11, 16)
        : dObj.toISOString().slice(0, 10),
      timestamp: ts,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(Math.max(1, low).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: vol,
    };
  });

  return enrichCandlesWithIndicators(candles);
}

export async function getStockHistory(
  symbolInput: string,
  interval: TimeInterval
): Promise<{
  candles: CandlePoint[];
  source: 'delayed' | 'reference-snapshot';
  lastUpdated: string;
}> {
  const symbol = symbolInput.trim().toUpperCase();
  const cacheKey = `${symbol}:${interval}`;
  const cached = candleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const cfg = INTERVAL_MAP[interval] || INTERVAL_MAP['6M'];
  const yahoo = await fetchYahooChart(symbol, cfg.range, cfg.interval);
  const nowIso = new Date().toISOString();

  if (yahoo?.timestamp && yahoo?.indicators?.quote?.[0]) {
    const tsList: number[] = yahoo.timestamp;
    const q = yahoo.indicators.quote[0];
    const candles: CandlePoint[] = [];
    for (let i = 0; i < tsList.length; i++) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      const v = q.volume?.[i] ?? 0;
      if (o == null || h == null || l == null || c == null) continue;
      const dObj = new Date(tsList[i] * 1000);
      candles.push({
        date:
          interval === '1D' || interval === '1W'
            ? dObj.toISOString().slice(5, 16).replace('T', ' ')
            : dObj.toISOString().slice(0, 10),
        timestamp: tsList[i] * 1000,
        open: Number(o.toFixed(2)),
        high: Number(h.toFixed(2)),
        low: Number(l.toFixed(2)),
        close: Number(c.toFixed(2)),
        volume: Number(v),
      });
    }
    if (candles.length > 0) {
      const enriched = enrichCandlesWithIndicators(candles);
      const payload = { candles: enriched, source: 'delayed' as const, lastUpdated: nowIso };
      candleCache.set(cacheKey, { data: payload, expiresAt: Date.now() + CANDLE_TTL_MS });
      return payload;
    }
  }

  const quote = await getStockQuote(symbol);
  const fallbackCandles = generateDeterministicHistoricalSeries(
    symbol,
    quote.price || 1500,
    cfg.fallbackDays,
    interval === '1D'
  );
  const payload = {
    candles: fallbackCandles,
    source: 'reference-snapshot' as const,
    lastUpdated: nowIso,
  };
  candleCache.set(cacheKey, { data: payload, expiresAt: Date.now() + 30_000 });
  return payload;
}

export function searchIndianStocks(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return INDIAN_STOCK_DIRECTORY.slice(0, 12);
  return INDIAN_STOCK_DIRECTORY.filter(
    (s) =>
      s.baseTicker.toLowerCase().includes(q) ||
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.sector.toLowerCase().includes(q)
  );
}

export async function getMarketNews(): Promise<NewsArticle[]> {
  if (newsCache && newsCache.expiresAt > Date.now()) {
    return newsCache.data;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const rssUrl =
      'https://news.google.com/rss/search?q=NSE+OR+SENSEX+OR+NIFTY+50+stock+market+India&hl=en-IN&gl=IN&ceid=IN:en';
    const res = await fetch(rssUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'StockMate/1.0' },
    });
    if (!res.ok) throw new Error('RSS fetch failed');
    const xml = await res.text();
    const items: NewsArticle[] = [];
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (let i = 0; i < Math.min(8, itemMatches.length); i++) {
      const block = itemMatches[i];
      const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
      const pubMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const rawTitle = (titleMatch?.[1] || titleMatch?.[2] || '').trim();
      const title = rawTitle.replace(/\s*-\s*[^-]+$/, '').trim() || rawTitle;
      if (!title) continue;
      items.push({
        id: `news_${i}`,
        title,
        publisher: (sourceMatch?.[1] || 'Market Wire').trim(),
        link: (linkMatch?.[1] || '#').trim(),
        publishedAt: pubMatch?.[1]
          ? new Date(pubMatch[1]).toISOString()
          : new Date().toISOString(),
      });
    }
    if (items.length > 0) {
      newsCache = { data: items, expiresAt: Date.now() + NEWS_TTL_MS };
      return items;
    }
  } catch {
    // Graceful fallback
  } finally {
    clearTimeout(timer);
  }
  return [];
}

export async function getStockSpecificNews(query: string): Promise<NewsArticle[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return getMarketNews();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
      `${cleanQuery} NSE BSE stock India`
    )}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(rssUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'StockMate/1.0' },
    });
    if (!res.ok) throw new Error('Stock RSS fetch failed');
    const xml = await res.text();
    const items: NewsArticle[] = [];
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (let i = 0; i < Math.min(6, itemMatches.length); i++) {
      const block = itemMatches[i];
      const titleMatch = block.match(
        /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/
      );
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
      const pubMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const rawTitle = (titleMatch?.[1] || titleMatch?.[2] || '').trim();
      const title = rawTitle.replace(/\s*-\s*[^-]+$/, '').trim() || rawTitle;
      const link = (linkMatch?.[1] || '').trim();
      if (!title || !link) continue;
      items.push({
        id: `snews_${i}`,
        title,
        publisher: (sourceMatch?.[1] || 'Market Wire').trim(),
        link,
        publishedAt: pubMatch?.[1]
          ? new Date(pubMatch[1]).toISOString()
          : new Date().toISOString(),
      });
    }
    if (items.length > 0) return items;
  } catch {
    // fallback to general market news
  } finally {
    clearTimeout(timer);
  }
  return getMarketNews();
}

