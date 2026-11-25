import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Globe,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../lib/api';
import { formatINR, formatPct } from '../lib/finance';
import { INDIAN_STOCK_DIRECTORY } from '../lib/indianStocks';

interface GroundedSource {
  title: string;
  uri: string;
  domain: string;
}

interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: GroundedSource[];
  searchQueries?: string[];
  modelUsed?: string;
  timestamp: string;
}

function renderInlineFormatted(text: unknown): React.ReactNode[] {
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  const parts = safeText.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900 dark:text-slate-50">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 font-mono text-[11px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function parseTableRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line);
}

function SafeMarkdownBlock({ content }: { content?: string | null }) {
  const safeContent = typeof content === 'string' ? content : String(content ?? '');
  const lines = safeContent.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      nodes.push(<div key={`sp_${i}`} className="h-1" />);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line)) {
      nodes.push(
        <hr key={`hr_${i}`} className="border-slate-200 dark:border-slate-800 my-2" />
      );
      continue;
    }

    // Detect Markdown table block
    if (
      line.startsWith('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1].trim())
    ) {
      const headers = parseTableRow(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        rows.push(parseTableRow(lines[j].trim()));
        j++;
      }
      nodes.push(
        <div key={`tbl_${i}`} className="overflow-x-auto my-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="bg-slate-100 dark:bg-slate-800/70">
              <tr>
                {headers.map((h, hi) => (
                  <th
                    key={hi}
                    className="px-2.5 py-1.5 font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700"
                  >
                    {renderInlineFormatted(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map((row, ri) => (
                <tr key={ri} className="bg-white dark:bg-[#0B1120]">
                  {headers.map((_, ci) => (
                    <td
                      key={ci}
                      className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 align-top"
                    >
                      {renderInlineFormatted(row[ci] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = j - 1;
      continue;
    }

    if (line.startsWith('### ') || line.startsWith('## ')) {
      const heading = line.replace(/^#{2,3}\s+/, '');
      nodes.push(
        <h4
          key={`h_${i}`}
          className="text-sm font-semibold text-slate-900 dark:text-slate-50 pt-1"
        >
          {renderInlineFormatted(heading)}
        </h4>
      );
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      nodes.push(
        <div key={`b_${i}`} className="flex items-start gap-2 pl-1">
          <span className="text-blue-500 mt-0.5 select-none">•</span>
          <span>{renderInlineFormatted(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const match = line.match(/^(\d+\.)\s+(.*)$/);
      nodes.push(
        <div key={`n_${i}`} className="flex items-start gap-2 pl-1">
          <span className="font-mono font-semibold text-blue-500 shrink-0">
            {match?.[1]}
          </span>
          <span>{renderInlineFormatted(match?.[2] || line)}</span>
        </div>
      );
      continue;
    }

    nodes.push(<p key={`p_${i}`}>{renderInlineFormatted(line)}</p>);
  }

  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
      {nodes}
    </div>
  );
}

export function StockAdvisorChat({
  mode = 'page',
  onClose,
}: {
  mode?: 'page' | 'drawer';
  onClose?: () => void;
}) {
  const { portfolios, activePortfolioId, quotes, selectedChartSymbol, notify } = useApp();
  const [focusSymbol, setFocusSymbol] = useState<string>(selectedChartSymbol || 'RELIANCE.NS');
  const [includePortfolio, setIncludePortfolio] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: [
        '### StockMate Research & Buy/Sell Assistant',
        'Ask me whether to **buy, accumulate, hold, or sell** any NSE/BSE stock—or ask for a full review of your StockMate portfolio.',
        '- Every analysis uses **Google Search grounding** against verified financial news, filings, and analyst consensus.',
        '- I cross-reference your **live/delayed StockMate quotes** and **average buy prices** when portfolio context is enabled.',
      ].join('\n'),
      timestamp: new Date().toISOString(),
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const portfolioSummary = useMemo(() => {
    if (!includePortfolio || portfolios.length === 0) return '';
    const activePf = portfolios.find((p) => p.id === activePortfolioId) || portfolios[0];
    if (!activePf || activePf.holdings.length === 0) return '';
    const lines = activePf.holdings.map((h) => {
      const cmp = h.manualPrice ?? quotes[h.symbol]?.price ?? h.averagePrice;
      const pnlPct = h.averagePrice > 0 ? ((cmp - h.averagePrice) / h.averagePrice) * 100 : 0;
      return `${h.symbol} (${h.name}): Qty ${h.quantity}, Avg Buy ${formatINR(
        h.averagePrice
      )}, CMP ${formatINR(cmp)}, P/L ${formatPct(pnlPct)}`;
    });
    return `Active Portfolio "${activePf.name}":\n${lines.join('\n')}`;
  }, [includePortfolio, portfolios, activePortfolioId, quotes]);

  const quickPrompts = [
    `Should I buy, hold, or sell ${focusSymbol} right now based on recent earnings and analyst targets?`,
    'Review my current portfolio holdings: which stocks should I accumulate vs consider trimming or selling?',
    'Compare TCS.NS vs INFY.NS valuation, growth outlook, and buy/sell thesis.',
    'Which Indian banking stocks currently have strong verified earnings momentum?',
  ];

  const sendMessage = async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatItem = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!promptText) setInput('');
    setLoading(true);

    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);

    try {
      const apiMessages = nextHistory
        .filter((m) => m.id !== 'welcome' && !m.id.startsWith('err_') && m.content.trim().length > 0)
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 6000) }));

      const res = await apiRequest<{
        reply: string;
        sources: GroundedSource[];
        searchQueries: string[];
        modelUsed: string;
      }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: apiMessages,
          focusSymbol: focusSymbol && focusSymbol !== 'PORTFOLIO' ? focusSymbol : undefined,
          portfolioSummary: portfolioSummary ? portfolioSummary.slice(0, 6000) : undefined,
        }),
      });

      const replyText =
        typeof res?.reply === 'string' && res.reply.trim().length > 0
          ? res.reply
          : 'Research assistant returned an empty response. Please try again.';

      const assistantMsg: ChatItem = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: replyText,
        sources: Array.isArray(res?.sources) ? res.sources : [],
        searchQueries: Array.isArray(res?.searchQueries) ? res.searchQueries : [],
        modelUsed: typeof res?.modelUsed === 'string' ? res.modelUsed : undefined,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unable to reach research assistant';
      notify('error', errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `**Research Error:** ${errMsg}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 60);
    }
  };

  const handleClear = () => {
    setMessages((prev) => prev.slice(0, 1));
  };

  const handleCopy = async (item: ChatItem) => {
    const srcText =
      item.sources && item.sources.length > 0
        ? '\n\nVerified Sources:\n' + item.sources.map((s) => `- ${s.title}: ${s.uri}`).join('\n')
        : '';
    try {
      await navigator.clipboard.writeText((item.content || '') + srcText);
      notify('success', 'Research analysis copied');
    } catch {
      notify('error', 'Clipboard unavailable');
    }
  };

  const isDrawer = mode === 'drawer';

  return (
    <div
      className={`flex flex-col ${
        isDrawer
          ? 'h-full bg-white dark:bg-[#111827]'
          : 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] h-[calc(100vh-11rem)] min-h-[600px]'
      }`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              AI Stock Research Advisor
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Buy / Hold / Sell decision support grounded with Google Search & verified sources
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {isDrawer && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              aria-label="Close advisor drawer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Context Controls */}
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <label htmlFor="advisor-focus-stock" className="text-slate-500">
            Focus Stock:
          </label>
          <select
            id="advisor-focus-stock"
            value={focusSymbol}
            onChange={(e) => setFocusSymbol(e.target.value)}
            className="py-1 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] font-mono text-xs"
          >
            <option value="PORTFOLIO">All Portfolio Holdings</option>
            {INDIAN_STOCK_DIRECTORY.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.baseTicker}.{s.exchange} — {s.name}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={includePortfolio}
            onChange={(e) => setIncludePortfolio(e.target.checked)}
            className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
          />
          <span>Include my portfolio positions</span>
        </label>
      </div>

      {/* Messages Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] rounded-xl p-4 ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120]'
                }`}
              >
                {isUser ? (
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="space-y-3">
                    <SafeMarkdownBlock content={msg.content} />

                    {/* Verified Grounding Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-[#22C55E]">
                          <Globe className="w-3.5 h-3.5" />
                          Verified Web Sources ({msg.sources.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.sources.slice(0, 6).map((src, idx) => (
                            <a
                              key={idx}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-blue-500 transition-colors group"
                            >
                              <div className="min-w-0">
                                <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-500 truncate">
                                  {src.title}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {src.domain}
                                </div>
                              </div>
                              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Search queries used & copy button */}
                    {msg.id !== 'welcome' && (
                      <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500">
                        <span className="truncate max-w-[75%]">
                          {msg.searchQueries && msg.searchQueries.length > 0
                            ? `Searched: ${msg.searchQueries.slice(0, 2).join(' · ')}`
                            : msg.modelUsed === 'telemetry-research'
                              ? 'Live Telemetry & News Sources'
                              : msg.modelUsed === 'offline-fallback'
                                ? 'Offline fallback'
                                : 'StockMate Research'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg)}
                          className="inline-flex items-center gap-1 hover:text-blue-500 shrink-0"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120] px-4 py-3 text-xs text-slate-500">
              Verifying financial news, earnings & analyst sources...
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
        {quickPrompts.map((q, idx) => (
          <button
            key={idx}
            type="button"
            disabled={loading}
            onClick={() => sendMessage(q)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] hover:border-blue-500 text-[11px] text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 transition-colors"
          >
            {q.length > 58 ? q.slice(0, 58) + '…' : q}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0"
      >
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask which stock to buy, hold, or sell (e.g., Should I buy TCS.NS or sell TATAMOTORS.NS?)"
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1F2937] text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Ask
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <ShieldAlert className="w-3 h-3 shrink-0" />
          <span>
            Educational decision support grounded in public web sources. Verify filings & consult a SEBI-registered advisor before trading.
          </span>
        </div>
      </form>
    </div>
  );
}
