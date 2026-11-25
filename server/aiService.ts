import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { CandlePoint, MarketQuote, NewsArticle } from '../src/types/stockmate';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function classifyAiError(err: unknown): 'quota' | 'auth' | 'other' {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) return 'quota';
  if (
    raw.includes('API_KEY_INVALID') ||
    raw.includes('PERMISSION_DENIED') ||
    raw.includes('403') ||
    raw.includes('API key')
  ) {
    return 'auth';
  }
  return 'other';
}

export async function explainCalculation(params: {
  calculatorName: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
}): Promise<{ explanation: string; modelUsed: string }> {
  const ai = getAiClient();
  if (!ai) {
    return {
      explanation:
        'AI explanation requires a configured GEMINI_API_KEY in Settings > Secrets. All calculator mathematics and Indian statutory tax formulas above remain 100% functional offline.',
      modelUsed: 'offline-fallback',
    };
  }

  const prompt = [
    `You are a concise Indian equity financial educator inside the StockMate calculator tool.`,
    `Explain the following ${params.calculatorName} result in 3 short, clear bullet points:`,
    `1) What the numbers mean in plain language (using INR / ₹ formatting).`,
    `2) Key cost, tax, or compounding driver in this calculation.`,
    `3) One practical risk or assumption check (educational only, never give buy/sell advice).`,
    ``,
    `Inputs: ${JSON.stringify(params.inputs)}`,
    `Calculated Results: ${JSON.stringify(params.results)}`,
  ].join('\n');

  for (const model of ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config:
            model === 'gemini-4-hydrogen'
              ? {
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                  systemInstruction:
                    'Provide objective, educational explanations of stock math and Indian market charges. Never recommend buying or selling any security. Keep response under 160 words.',
                }
              : {
                  systemInstruction:
                    'Provide objective, educational explanations of stock math and Indian market charges. Never recommend buying or selling any security. Keep response under 160 words.',
                },
        }),
        10_000,
        `explain:${model}`
      );
      return {
        explanation: response.text?.trim() || 'Unable to generate explanation.',
        modelUsed: model,
      };
    } catch {
      // try next model or fall back cleanly
    }
  }

  return {
    explanation: [
      `• **${params.calculatorName} Summary:** Your inputs (${Object.entries(params.inputs)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(', ')}) produce the exact figures displayed above using Indian equity conventions.`,
      `• **Cost & Tax Check:** Always compare gross return against brokerage, STT, exchange fees, GST, and stamp duty to confirm your net break-even buffer.`,
      `• **Quota Notice:** Live Gemini narrative explanation is currently rate-limited (429 RESOURCE_EXHAUSTED). Check **Settings > Secrets** to enable higher AI quota.`,
    ].join('\n'),
    modelUsed: 'telemetry-fallback',
  };
}

export interface AdvisorChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GroundedSource {
  title: string;
  uri: string;
  domain: string;
}

export interface EnrichedStockResearch {
  quote: MarketQuote;
  latestCandle?: CandlePoint;
  posIn52WRangePct: number | null;
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
  macd: number | null;
  macdSignal: number | null;
  trendLabel: 'Bullish' | 'Consolidating' | 'Bearish';
}

export interface StockResearchResponse {
  reply: string;
  sources: GroundedSource[];
  searchQueries: string[];
  modelUsed: string;
}

function buildNewsAndReferenceSources(
  newsArticles: NewsArticle[],
  stocks: EnrichedStockResearch[]
): GroundedSource[] {
  const seen = new Set<string>();
  const out: GroundedSource[] = [];

  for (const article of newsArticles) {
    if (!article.link || article.link === '#' || seen.has(article.link)) continue;
    seen.add(article.link);
    let domain = article.publisher || 'News Wire';
    try {
      domain = new URL(article.link).hostname.replace(/^www\./, '');
    } catch {
      // keep publisher name
    }
    out.push({
      title: `${article.title} (${article.publisher})`,
      uri: article.link,
      domain,
    });
  }

  for (const s of stocks.slice(0, 3)) {
    const baseTicker = s.quote.symbol.replace(/\.(NS|BO)$/i, '');
    const yahooUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(s.quote.symbol)}`;
    if (!seen.has(yahooUrl)) {
      seen.add(yahooUrl);
      out.push({
        title: `${s.quote.name} (${s.quote.symbol}) Live Quote & Financials`,
        uri: yahooUrl,
        domain: 'finance.yahoo.com',
      });
    }
    const screenerUrl = `https://www.screener.in/company/${encodeURIComponent(baseTicker)}/consolidated/`;
    if (!seen.has(screenerUrl)) {
      seen.add(screenerUrl);
      out.push({
        title: `${baseTicker} Ratios, P/E & Quarterly Results`,
        uri: screenerUrl,
        domain: 'screener.in',
      });
    }
  }

  return out;
}

function deriveStance(stock: EnrichedStockResearch): {
  stance: string;
  bullReasons: string[];
  bearReasons: string[];
  riskCheck: string;
} {
  const { quote, rsi14, sma20, sma50, macd, macdSignal, posIn52WRangePct, trendLabel } = stock;
  let score = 0;
  const bullReasons: string[] = [];
  const bearReasons: string[] = [];

  if (sma20 !== null && sma50 !== null) {
    if (quote.price > sma20 && sma20 >= sma50) {
      score += 2;
      bullReasons.push(
        `Price (₹${quote.price.toFixed(2)}) trades above both 20-DMA (₹${sma20.toFixed(2)}) and 50-DMA (₹${sma50.toFixed(2)}), confirming an active uptrend.`
      );
    } else if (quote.price < sma20 && sma20 < sma50) {
      score -= 2;
      bearReasons.push(
        `Price (₹${quote.price.toFixed(2)}) sits below both 20-DMA (₹${sma20.toFixed(2)}) and 50-DMA (₹${sma50.toFixed(2)}), signaling short-term distribution.`
      );
    } else {
      bullReasons.push(
        `Moving averages show consolidation near 20-DMA (₹${sma20.toFixed(2)}) / 50-DMA (₹${sma50.toFixed(2)}).`
      );
    }
  }

  if (rsi14 !== null) {
    if (rsi14 >= 70) {
      score -= 1;
      bearReasons.push(
        `14-Day RSI is **${rsi14.toFixed(1)} (Overbought)** — chasing fresh entries here carries elevated pullback risk.`
      );
    } else if (rsi14 <= 35) {
      score += 1;
      bullReasons.push(
        `14-Day RSI is **${rsi14.toFixed(1)} (Oversold Zone)** — selling pressure may be nearing exhaustion for staggered accumulation.`
      );
    } else if (rsi14 >= 50) {
      score += 1;
      bullReasons.push(`14-Day RSI at **${rsi14.toFixed(1)}** indicates constructive momentum without extreme froth.`);
    } else {
      bearReasons.push(`14-Day RSI at **${rsi14.toFixed(1)}** reflects muted near-term buyer conviction.`);
    }
  }

  if (macd !== null && macdSignal !== null) {
    if (macd > macdSignal) {
      score += 1;
      bullReasons.push(`MACD (${macd.toFixed(2)}) is above its signal line (${macdSignal.toFixed(2)}), supporting positive momentum.`);
    } else {
      score -= 1;
      bearReasons.push(`MACD (${macd.toFixed(2)}) remains below its signal line (${macdSignal.toFixed(2)}).`);
    }
  }

  if (posIn52WRangePct !== null && quote.week52High && quote.week52Low) {
    const pctFromHigh = ((quote.week52High - quote.price) / quote.week52High) * 100;
    if (posIn52WRangePct > 88) {
      bearReasons.push(
        `Trading at **${posIn52WRangePct.toFixed(0)}%** of its 52-week range (only ${pctFromHigh.toFixed(1)}% below 52W high of ₹${quote.week52High.toFixed(2)}), leaving tighter margin of safety.`
      );
    } else if (posIn52WRangePct < 35) {
      bullReasons.push(
        `Trading in the lower third of its 52-week range (**${posIn52WRangePct.toFixed(0)}%**; 52W Low ₹${quote.week52Low.toFixed(2)} / High ₹${quote.week52High.toFixed(2)}), offering value support if fundamentals hold.`
      );
    } else {
      bullReasons.push(
        `Positioned at **${posIn52WRangePct.toFixed(0)}%** of its 52-week band (₹${quote.week52Low.toFixed(2)} – ₹${quote.week52High.toFixed(2)}).`
      );
    }
  }

  if (quote.changePercent >= 1.2) {
    bullReasons.push(`Positive session momentum of **+${quote.changePercent.toFixed(2)}%** today.`);
  } else if (quote.changePercent <= -1.2) {
    bearReasons.push(`Session weakness of **${quote.changePercent.toFixed(2)}%** today.`);
  }

  if (bullReasons.length === 0) {
    bullReasons.push(`Established ${quote.sector} constituent with regular NSE/BSE liquidity.`);
  }
  if (bearReasons.length === 0) {
    bearReasons.push(`Check upcoming quarterly margin trends and institutional FII/DII flows before sizing up.`);
  }

  let stance = 'Hold / Neutral (Wait for Confirmation)';
  if (score >= 2) stance = 'Favorable / Accumulate on Dips';
  else if (score <= -2) stance = 'Caution / Avoid Fresh Buys or Trim Strength';

  const stopRef = sma50 ? Math.min(quote.price * 0.94, sma50 * 0.97) : quote.price * 0.93;
  const riskCheck = `Trend: **${trendLabel}**. Key risk-management reference near **₹${stopRef.toFixed(2)}**; avoid allocating >10–15% of portfolio to a single stock without reviewing quarterly earnings on Screener/NSE filings.`;

  return { stance, bullReasons, bearReasons, riskCheck };
}

function buildGroundedTelemetryFallback(params: {
  latestQuestion: string;
  stocks: EnrichedStockResearch[];
  newsArticles: NewsArticle[];
  portfolioSummary?: string;
  reason: 'quota' | 'auth' | 'offline';
}): StockResearchResponse {
  const { latestQuestion, stocks, newsArticles, portfolioSummary, reason } = params;
  const qLower = latestQuestion.toLowerCase();
  const lines: string[] = [];

  if (stocks.length >= 2 && (qLower.includes('compare') || qLower.includes('vs') || qLower.includes('better'))) {
    lines.push(`### StockMate Comparative Research (${stocks.map((s) => s.quote.symbol).join(' vs ')})`);
    for (const s of stocks.slice(0, 4)) {
      const d = deriveStance(s);
      lines.push(
        `- **${s.quote.symbol} (${s.quote.name}) — ${d.stance}**: CMP **₹${s.quote.price.toFixed(2)}** (${s.quote.changePercent >= 0 ? '+' : ''}${s.quote.changePercent.toFixed(2)}%), RSI-14: **${s.rsi14 !== null ? s.rsi14.toFixed(1) : 'N/A'}**, 20-DMA: **${s.sma20 !== null ? `₹${s.sma20.toFixed(2)}` : 'N/A'}**, Trend: **${s.trendLabel}**.`
      );
      lines.push(`  - *Bull case:* ${d.bullReasons[0]}`);
      lines.push(`  - *Risk factor:* ${d.bearReasons[0]}`);
    }
  } else if (stocks.length === 1) {
    const s = stocks[0];
    const d = deriveStance(s);
    lines.push(`### ${s.quote.name} (${s.quote.symbol}) — Research View: **${d.stance}**`);
    lines.push(
      `Live/Delayed Quote: **₹${s.quote.price.toFixed(2)}** (${s.quote.changePercent >= 0 ? '+' : ''}${s.quote.changePercent.toFixed(2)}%) · 52W Range: **₹${s.quote.week52Low?.toFixed(2) ?? 'N/A'} – ₹${s.quote.week52High?.toFixed(2) ?? 'N/A'}** · Sector: ${s.quote.sector}`
    );
    lines.push('### Bull Factors (Reasons to Buy / Hold)');
    for (const b of d.bullReasons) lines.push(`- ${b}`);
    lines.push('### Bear Factors & Risks (Reasons to Trim / Avoid)');
    for (const r of d.bearReasons) lines.push(`- ${r}`);
    lines.push('### Actionable Risk Check');
    lines.push(`- ${d.riskCheck}`);
  } else if (stocks.length > 1) {
    lines.push(`### Research & Portfolio Screening (${stocks.length} Stocks Analyzed)`);
    for (const s of stocks.slice(0, 5)) {
      const d = deriveStance(s);
      lines.push(
        `- **${s.quote.symbol}** (₹${s.quote.price.toFixed(2)}, ${s.quote.changePercent >= 0 ? '+' : ''}${s.quote.changePercent.toFixed(2)}%) → **${d.stance}** · RSI ${s.rsi14 !== null ? s.rsi14.toFixed(1) : 'N/A'} · ${s.trendLabel}`
      );
      lines.push(`  - ${d.bullReasons[0]} | Risk: ${d.bearReasons[0]}`);
    }
  } else {
    lines.push('### Indian Equity Research Brief');
    lines.push(
      'Select a specific NSE/BSE stock in the **Focus Stock** dropdown or include ticker names (e.g., `TCS`, `RELIANCE`, `HDFCBANK`, `INFY`, `TATAMOTORS`) in your question for stock-specific technicals and news.'
    );
  }

  if (portfolioSummary) {
    lines.push('### Your Active Portfolio Context');
    for (const pLine of portfolioSummary.split('\n').slice(1, 6)) {
      if (pLine.trim()) lines.push(`- ${pLine.trim()}`);
    }
  }

  if (newsArticles.length > 0) {
    lines.push('### Latest Verified Headlines Fetched for Your Query');
    for (const n of newsArticles.slice(0, 4)) {
      lines.push(`- **${n.title}** — *${n.publisher}*`);
    }
  }

  const notice =
    reason === 'quota'
      ? 'Note: Gemini AI prose quota is currently exhausted (429 RESOURCE_EXHAUSTED — check **Settings > Secrets** for a billing-enabled key). All prices, RSI/DMA technicals, and news sources above are live for your query.'
      : reason === 'auth'
        ? 'Note: GEMINI_API_KEY is missing or unauthorized in **Settings > Secrets**. Showing live market telemetry, technicals, and verified news sources for your query.'
        : 'Note: Operating in offline telemetry research mode. Configure GEMINI_API_KEY in **Settings > Secrets** for full AI prose synthesis.';

  lines.push(notice);
  lines.push(
    'This is data-backed educational decision support and not personalized SEBI-registered investment advice.'
  );

  return {
    reply: lines.join('\n\n'),
    sources: buildNewsAndReferenceSources(newsArticles, stocks),
    searchQueries: [
      `${stocks.map((s) => s.quote.symbol).join(' ') || latestQuestion.slice(0, 48)} NSE BSE news`,
    ],
    modelUsed: 'telemetry-research',
  };
}

export async function stockResearchChat(params: {
  messages: AdvisorChatMessage[];
  portfolioSummary?: string;
  marketSnapshot?: string;
  enrichedStocks?: EnrichedStockResearch[];
  newsArticles?: NewsArticle[];
}): Promise<StockResearchResponse> {
  const ai = getAiClient();
  const latestQuestion = params.messages[params.messages.length - 1]?.content || '';
  const stocks = params.enrichedStocks || [];
  const newsArticles = params.newsArticles || [];

  if (!ai) {
    return buildGroundedTelemetryFallback({
      latestQuestion,
      stocks,
      newsArticles,
      portfolioSummary: params.portfolioSummary,
      reason: 'offline',
    });
  }

  const newsContext =
    newsArticles.length > 0
      ? newsArticles
          .slice(0, 6)
          .map((n, idx) => `${idx + 1}. ${n.title} (${n.publisher}) — ${n.link}`)
          .join('\n')
      : '';

  const systemParts = [
    'You are StockMate AI Research Advisor, an Indian stock market (NSE & BSE) equity research assistant.',
    'Your job is to guide investors on whether to BUY, ACCUMULATE, HOLD, TRIM, or SELL specific stocks or evaluate their portfolio based strictly on verified, up-to-date public sources (earnings reports, SEBI/NSE/BSE filings, brokerage consensus targets, Moneycontrol, Economic Times, Mint, Reuters, Screener).',
    '',
    'Response rules:',
    '1. Ground your analysis in verified recent earnings, valuation multiples (P/E, ROE, debt), analyst consensus, price action, technicals, and verified news.',
    '2. Structure your answer clearly with Markdown:',
    '   - **Research View**: Clear stance (**Favorable / Accumulate on Dips**, **Hold / Neutral**, or **Caution / Consider Trimming or Selling**) with timeframe.',
    '   - **Verified Bull Factors (Reasons to Buy/Hold)**: Concrete metrics, technicals, or catalysts.',
    '   - **Verified Bear Factors & Risks (Reasons to Sell/Avoid)**: Valuation stretch, margin pressure, debt, or sector headwinds.',
    '   - **Actionable Risk Check**: Key support/52W reference and position-sizing note.',
    '3. Never fabricate prices, P/E ratios, or news. If a metric is unavailable, say so explicitly.',
    '4. End with one short sentence noting this is research-backed educational decision support and not personalized SEBI-registered investment advice.',
  ];

  if (params.marketSnapshot) {
    systemParts.push('', 'Current StockMate Quote & Technical Telemetry:', params.marketSnapshot);
  }
  if (params.portfolioSummary) {
    systemParts.push('', 'User Portfolio Context:', params.portfolioSummary);
  }
  if (newsContext) {
    systemParts.push('', 'Live Verified Market Headlines:', newsContext);
  }

  const contents = params.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const attempts: Array<{ model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite'; useSearch: boolean }> = [
    { model: 'gemini-4-hydrogen', useSearch: true },
    { model: 'gemini-3.1-flash-lite', useSearch: true },
    { model: 'gemini-3.1-flash-lite', useSearch: false },
  ];

  let lastReason: 'quota' | 'auth' | 'offline' = 'quota';

  for (const attempt of attempts) {
    try {
      const config: Record<string, unknown> = {
        systemInstruction: systemParts.join('\n'),
      };
      if (attempt.useSearch) {
        config.tools = [{ googleSearch: {} }];
      }
      if (attempt.model === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const response = await withTimeout(
        ai.models.generateContent({
          model: attempt.model,
          contents,
          config,
        }),
        12_000,
        `chat:${attempt.model}:${attempt.useSearch ? 'search' : 'direct'}`
      );

      const metadata = response.candidates?.[0]?.groundingMetadata;
      const rawChunks = metadata?.groundingChunks || [];
      const seenUris = new Set<string>();
      const sources: GroundedSource[] = [];

      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (!uri || seenUris.has(uri)) continue;
        seenUris.add(uri);
        let domain = 'Web Source';
        try {
          domain = new URL(uri).hostname.replace(/^www\./, '');
        } catch {
          // keep default
        }
        sources.push({
          title: title || domain,
          uri,
          domain,
        });
      }

      // If search tool wasn't used or returned no chunks, include verified RSS & financial sources
      if (sources.length === 0) {
        sources.push(...buildNewsAndReferenceSources(newsArticles, stocks));
      }

      const replyText = response.text?.trim();
      if (replyText) {
        return {
          reply: replyText,
          sources,
          searchQueries: metadata?.webSearchQueries || [],
          modelUsed: attempt.model,
        };
      }
    } catch (err) {
      const kind = classifyAiError(err);
      if (kind === 'auth') {
        lastReason = 'auth';
        break;
      }
      lastReason = 'quota';
    }
  }

  return buildGroundedTelemetryFallback({
    latestQuestion,
    stocks,
    newsArticles,
    portfolioSummary: params.portfolioSummary,
    reason: lastReason,
  });
}
